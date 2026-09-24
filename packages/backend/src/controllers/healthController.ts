// src/controllers/healthController.ts
import { Request, Response, NextFunction } from 'express';
import { healthService } from '../services/healthService.js';
import { AppError } from '../middleware/errorHandler.js';

// ============================================
// PRISMA ERROR NARROWING
// ============================================
//
// Do NOT `instanceof Prisma.PrismaClientKnownRequestError`.
// In Prisma 7 with the pg driver adapter, the class is sometimes
// exposed as a type-only symbol depending on the generated client.
// `instanceof` against a type-only symbol narrows the value to
// `never`, and the next property access fails with
// "Property 'code' does not exist on type 'never'".
//
// We narrow structurally instead: any thrown object with a string
// `code` field is treated as a Prisma known-request error. That is
// the shape Prisma serializes, and it is stable across versions.

interface PrismaKnownError {
  code: string;
  clientVersion?: string;
  meta?: Record<string, unknown>;
}

function isPrismaKnownError(err: unknown): err is PrismaKnownError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  );
}

/** P1001 — PostgreSQL server is not reachable. */
function isDatabaseUnreachable(
  err: unknown,
): err is PrismaKnownError & { code: 'P1001' } {
  return isPrismaKnownError(err) && err.code === 'P1001';
}

/** P2021 / P2022 — table or column missing (schema drift). */
function isSchemaDrift(
  err: unknown,
): err is PrismaKnownError & { code: 'P2021' | 'P2022' } {
  return (
    isPrismaKnownError(err) &&
    (err.code === 'P2021' || err.code === 'P2022')
  );
}

// ============================================
// SMALL HELPERS
// ============================================

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

function clampLimit(raw: unknown, fallback: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.floor(parsed));
}

// ============================================
// CONTROLLER
// ============================================

export const healthController = {
  /**
   * Basic liveness probe.
   * GET /health
   *
   * Always 200 while the process is up. The `database` field reports
   * whether the DB is reachable, but the status code does NOT flip —
   * use /health/database for a readiness probe.
   */
  async getHealth(_req: Request, res: Response) {
    try {
      const health = await healthService.getBasicHealth();

      return res.status(200).json({
        status: health.status,
        timestamp: health.timestamp,
        uptime: health.uptime,
        // ✅ JSON.stringify drops `undefined` — fall back to a
        //    sentinel so the field is never missing.
        database: health.database ?? 'unknown',
      });
    } catch (err) {
      // A broken health service must not 500 the liveness probe.
      // The process itself is still running.
      return res.status(200).json({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'unknown',
        error: toErrorMessage(err),
      });
    }
  },

  /**
   * Detailed health snapshot.
   * GET /health/detailed
   *
   * 200 = healthy or degraded, 503 = unhealthy.
   */
  async getDetailedHealth(_req: Request, res: Response) {
    try {
      const healthStatus = await healthService.getHealthStatus();

      const statusCode =
        healthStatus.status === 'unhealthy' ? 503 : 200;

      return res.status(statusCode).json({
        success: healthStatus.status !== 'unhealthy',
        ...healthStatus,
      });
    } catch (err) {
      if (isDatabaseUnreachable(err)) {
        return res.status(503).json({
          success: false,
          status: 'unhealthy',
          database: 'unreachable',
          code: 'P1001',
          message:
            'Cannot reach the PostgreSQL server. Verify it is running ' +
            'and that DATABASE_URL is correct.',
          timestamp: new Date().toISOString(),
        });
      }

      if (isSchemaDrift(err)) {
        return res.status(503).json({
          success: false,
          status: 'unhealthy',
          database: 'schema_drift',
          code: err.code,
          message:
            'Database is reachable but the schema is out of date. ' +
            'Run `npx prisma migrate deploy` (or `prisma db push` in dev).',
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        database: 'error',
        message: toErrorMessage(err),
        timestamp: new Date().toISOString(),
      });
    }
  },

  /**
   * Readiness probe — wire this into Docker healthchecks and load
   * balancers.
   * GET /health/database
   *
   * 200 = DB reachable, 503 = DB unreachable OR schema drift.
   */
  async getDatabaseStatus(_req: Request, res: Response) {
    try {
      const dbStatus = await healthService.getDatabaseStatus();

      // ✅ Respect the service's own success flag. Only default to
      //    true when the service did not supply one.
      const success =
        typeof (dbStatus as { success?: unknown }).success === 'boolean'
          ? Boolean((dbStatus as { success: boolean }).success)
          : true;

      return res.status(success ? 200 : 503).json({
        ...dbStatus,
        success,
      });
    } catch (err) {
      if (isDatabaseUnreachable(err)) {
        return res.status(503).json({
          success: false,
          status: 'unhealthy',
          database: 'unreachable',
          code: 'P1001',
          message:
            'Cannot reach the PostgreSQL server. Verify it is running ' +
            'and that DATABASE_URL points at the correct host/port.',
          timestamp: new Date().toISOString(),
        });
      }

      if (isSchemaDrift(err)) {
        // ✅ `err` is narrowed to PrismaKnownError here — `err.code`
        //    is a literal union, safe to read.
        return res.status(503).json({
          success: false,
          status: 'unhealthy',
          database: 'schema_drift',
          code: err.code,
          message:
            'Database is reachable but the schema is out of date. ' +
            'Run `npx prisma migrate deploy` (or `prisma db push` in dev).',
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        database: 'error',
        message: toErrorMessage(err),
        timestamp: new Date().toISOString(),
      });
    }
  },

  /**
   * Recent health-check history (in-memory ring buffer).
   * GET /health/history?limit=20
   */
  async getHealthHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = clampLimit(req.query.limit, 20, 100);

      const history = await healthService.getHealthHistory(limit);

      return res.json({
        success: true,
        data: history,
        count: history.length,
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * Minimal probe for uptime monitors.
   * GET /health/check
   */
  async quickCheck(_req: Request, res: Response) {
    try {
      const health = await healthService.getBasicHealth();

      // ✅ 'ok' is the healthy sentinel. Anything else → 503.
      return res
        .status(health.status === 'ok' ? 200 : 503)
        .json({
          status: health.status,
          timestamp: health.timestamp,
        });
    } catch (err) {
      return res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: toErrorMessage(err),
      });
    }
  },

  /**
   * Process-level system info.
   * GET /health/system
   */
  async getSystemInfo(_req: Request, res: Response, next: NextFunction) {
    try {
      const healthStatus = await healthService.getHealthStatus();

      return res.json({
        success: true,
        data: {
          system: healthStatus.system,
          nodeVersion: healthStatus.system.nodeVersion,
          processId: healthStatus.system.processId,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
};
