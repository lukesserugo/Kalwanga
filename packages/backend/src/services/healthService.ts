// src/services/healthService.ts
import { prisma } from '../lib/prisma.js';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// ============================================
// PRISMA ERROR NARROWING
// ============================================
//
// Same structural narrowing the controller uses. Do NOT
// `instanceof Prisma.PrismaClientKnownRequestError` — in Prisma 7
// with the pg driver adapter the class is sometimes a type-only
// symbol, and `instanceof` against it narrows the value to `never`.

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

function isDatabaseUnreachable(
  err: unknown,
): err is PrismaKnownError & { code: 'P1001' } {
  return isPrismaKnownError(err) && err.code === 'P1001';
}

function isSchemaDrift(
  err: unknown,
): err is PrismaKnownError & { code: 'P2021' | 'P2022' } {
  return (
    isPrismaKnownError(err) &&
    (err.code === 'P2021' || err.code === 'P2022')
  );
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

// ============================================
// INTERFACES
// ============================================

interface DatabaseStatus {
  connected: boolean;
  latency: number;
  error?: string;
  /** Prisma code when the failure is classifiable (P1001, P2021, …). */
  code?: string;
  version?: string;
  connections?: number;
}

interface SystemStatus {
  memory: {
    heapUsed: string;
    heapTotal: string;
    rss: string;
    external: string;
    totalSystemMemory: string;
    freeSystemMemory: string;
    memoryUsagePercent: number;
  };
  cpu: {
    loadAverage: number[];
    cores: number;
    model: string;
    speed: number;
    usagePercent: number;
  };
  platform: string;
  architecture: string;
  hostname: string;
  uptime: number;
  nodeVersion: string;
  processId: number;
}

interface ServiceCheck {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  error?: string;
  configured?: boolean;
  writable?: boolean;
}

interface HealthCheck {
  passed: boolean;
  message?: string;
  timestamp: Date;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  database: DatabaseStatus;
  system: SystemStatus;
  services: Record<string, ServiceCheck>;
  checks: Record<string, HealthCheck>;
}

// ============================================
// SERVICE
// ============================================

export class HealthService {
  private healthCheckHistory: Array<{
    timestamp: Date;
    status: string;
    checks: Record<string, HealthCheck>;
  }> = [];

  private readonly maxHistorySize = 100;

  /**
   * Whether we have ever successfully reached the database since
   * process start. Used to gate `persistHealthCheck` so we do not
   * spam audit logs when the DB is unhealthy.
   */
  private hasEverConnected = false;

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Full health snapshot.
   *
   * ⚠ This method is intended for the detailed endpoint. It may
   *   throw a Prisma known error (P1001 / P2021 / P2022) so the
   *   controller can classify it and return a structured body.
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const dbStatus = await this.checkDatabase();
    const systemStatus = this.getSystemStatus();
    const services = await this.checkServices();
    const checks = await this.runHealthChecks();

    const status = this.determineStatus(dbStatus, services, checks);

    this.addToHistory(status, checks);
    await this.persistHealthCheck(status);

    return {
      status,
      timestamp: new Date(),
      uptime: process.uptime(),
      database: dbStatus,
      system: systemStatus,
      services,
      checks,
    };
  }

  /**
   * Lightweight liveness probe. Never throws. Returns `ok` when the
   * database is reachable, `degraded` otherwise.
   */
  async getBasicHealth() {
    const dbStatus = await this.checkDatabase({ rethrow: false });

    return {
      status: dbStatus.connected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus.connected,
    };
  }

  /**
   * Readiness probe body. Does NOT throw on a DB failure — it
   * returns `success: false` plus a Prisma `code` when one is
   * available, so the controller can map it to a 503.
   */
  async getDatabaseStatus() {
    const dbStatus = await this.checkDatabase({ rethrow: false });

    if (!dbStatus.connected) {
      return {
        success: false,
        connected: false,
        latency: dbStatus.latency,
        code: dbStatus.code,
        error: dbStatus.error,
        timestamp: new Date().toISOString(),
      };
    }

    // ✅ Extra detail queries only run when the DB is actually up.
    let databaseInfo: Record<string, unknown> = {};
    try {
      const [version, connections, databaseSize] = await Promise.all([
        prisma.$queryRaw`SELECT version()`,
        prisma.$queryRaw`SELECT count(*)::int AS count FROM pg_stat_activity`,
        prisma.$queryRaw`SELECT pg_database_size(current_database())::bigint AS size`,
      ]);

      databaseInfo = {
        version:
          (version as Array<{ version: string }>)[0]?.version?.split(
            ' on ',
          )[0] || 'Unknown',
        activeConnections:
          (connections as Array<{ count: number }>)[0]?.count ?? 0,
        databaseSize: this.formatBytes(
          Number((databaseSize as Array<{ size: bigint | number }>)[0]?.size ?? 0),
        ),
      };
    } catch (error) {
      console.warn(
        '[healthService] Failed to fetch DB detail:',
        toErrorMessage(error),
      );
    }

    return {
      success: true,
      connected: true,
      latency: dbStatus.latency,
      version: dbStatus.version,
      ...databaseInfo,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Recent health-check history. Never throws.
   */
  async getHealthHistory(limit: number = 20) {
    try {
      const dbHistory = await prisma.auditLog.findMany({
        where: { entityType: 'HEALTH_CHECK' },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      if (dbHistory.length > 0) return dbHistory;
    } catch (error) {
      console.warn(
        '[healthService] DB history fetch failed, using in-memory:',
        toErrorMessage(error),
      );
    }

    return this.healthCheckHistory.slice(-limit);
  }

  // ============================================
  // DATABASE CHECK
  // ============================================

  /**
   * Ping the database.
   *
   * @param opts.rethrow
   *   When `true` (the default), Prisma known errors for P1001 /
   *   P2021 / P2022 are re-thrown so the controller can classify
   *   them. When `false`, the error is folded into the return
   *   value — useful for liveness probes that must not throw.
   */
  private async checkDatabase(
    opts: { rethrow?: boolean } = {},
  ): Promise<DatabaseStatus> {
    const rethrow = opts.rethrow ?? true;

    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      this.hasEverConnected = true;

      let version = 'Unknown';
      try {
        const result = await prisma.$queryRaw`SELECT version()`;
        version =
          (result as Array<{ version: string }>)[0]?.version?.split(
            ' on ',
          )[0] || 'Unknown';
      } catch (error) {
        console.warn(
          '[healthService] Failed to read DB version:',
          toErrorMessage(error),
        );
      }

      return { connected: true, latency, version };
    } catch (error) {
      // ✅ Classify Prisma errors and attach the code so the
      //    controller can map it to the right HTTP status.
      const code = isPrismaKnownError(error) ? error.code : undefined;
      const message = toErrorMessage(error);

      const status: DatabaseStatus = {
        connected: false,
        latency: 0,
        code,
        error: message,
      };

      if (rethrow && (isDatabaseUnreachable(error) || isSchemaDrift(error))) {
        // Re-throw so the caller (controller) can classify.
        throw error;
      }

      return status;
    }
  }

  // ============================================
  // SYSTEM STATUS
  // ============================================

  private getSystemStatus(): SystemStatus {
    const memoryUsage = process.memoryUsage();
    const totalSystemMemory = os.totalmem();
    const freeSystemMemory = os.freemem();
    const memoryUsagePercent =
      ((totalSystemMemory - freeSystemMemory) / totalSystemMemory) * 100;

    const cpus = os.cpus();
    const loadAverage = os.loadavg();
    const cpuUsagePercent =
      cpus.length > 0 ? (loadAverage[0] / cpus.length) * 100 : 0;

    return {
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        totalSystemMemory: `${Math.round(totalSystemMemory / 1024 / 1024)}MB`,
        freeSystemMemory: `${Math.round(freeSystemMemory / 1024 / 1024)}MB`,
        memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
      },
      cpu: {
        loadAverage,
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        speed: cpus[0]?.speed || 0,
        usagePercent: Math.round(cpuUsagePercent * 100) / 100,
      },
      platform: os.platform(),
      architecture: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      nodeVersion: process.version,
      processId: process.pid,
    };
  }

  // ============================================
  // SERVICE CHECKS
  // ============================================

  private async checkServices(): Promise<Record<string, ServiceCheck>> {
    const services: Record<string, ServiceCheck> = {};

    // ── Database ──────────────────────────────────
    // ✅ Uses `rethrow: false` — the database status is already
    //    captured on `services.database`, and we do not want a
    //    single failed ping to abort the whole snapshot.
    const dbStatus = await this.checkDatabase({ rethrow: false });
    services.database = {
      status: dbStatus.connected ? 'up' : 'down',
      latency: dbStatus.latency,
      error: dbStatus.error,
    };

    // ── File system ───────────────────────────────
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      const uploadDir = path.join(process.cwd(), 'uploads');

      const backupWritable = this.checkDirectoryWritable(backupDir);
      const uploadWritable = this.checkDirectoryWritable(uploadDir);

      services.fileSystem = {
        status:
          backupWritable && uploadWritable ? 'up' : 'degraded',
        writable: backupWritable && uploadWritable,
      };
    } catch (error) {
      services.fileSystem = {
        status: 'down',
        error: toErrorMessage(error),
      };
    }

    // ── Redis (optional) ──────────────────────────
    if (process.env.REDIS_URL) {
      services.redis = {
        // Presence of the env var is not proof the socket is up.
        // Mark as 'degraded' until a real ping is wired in.
        status: 'degraded',
        configured: true,
      };
    }

    return services;
  }

  // ============================================
  // HEALTH CHECKS
  // ============================================

  private async runHealthChecks(): Promise<Record<string, HealthCheck>> {
    const checks: Record<string, HealthCheck> = {};

    // Database
    const dbStatus = await this.checkDatabase({ rethrow: false });
    checks.database = {
      passed: dbStatus.connected,
      message: dbStatus.connected
        ? 'Database connected'
        : `Database unreachable${dbStatus.code ? ` (${dbStatus.code})` : ''}`,
      timestamp: new Date(),
    };

    // Memory
    const memoryUsagePercent =
      ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    checks.memory = {
      passed: memoryUsagePercent < 90,
      message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%`,
      timestamp: new Date(),
    };

    // CPU
    const cpus = os.cpus();
    const loadAverage = os.loadavg();
    const cpuUsagePercent =
      cpus.length > 0 ? (loadAverage[0] / cpus.length) * 100 : 0;
    checks.cpu = {
      passed: cpuUsagePercent < 90,
      message: `CPU usage: ${cpuUsagePercent.toFixed(2)}%`,
      timestamp: new Date(),
    };

    // Disk — only attempted on POSIX. `df` is not available on
    // Windows; the catch below marks the check as skipped.
    try {
      const { stdout } = await execAsync('df -h /');
      const lines = stdout.trim().split('\n');
      if (lines.length > 1) {
        const diskInfo = lines[1].split(/\s+/);
        const diskUsagePercent = parseInt(diskInfo[4], 10);
        checks.disk = {
          passed: Number.isFinite(diskUsagePercent)
            ? diskUsagePercent < 90
            : true,
          message: `Disk usage: ${diskUsagePercent}%`,
          timestamp: new Date(),
        };
      }
    } catch {
      checks.disk = {
        passed: true,
        message: 'Disk check not available on this platform',
        timestamp: new Date(),
      };
    }

    return checks;
  }

  // ============================================
  // STATUS DERIVATION
  // ============================================

  private determineStatus(
    dbStatus: DatabaseStatus,
    services: Record<string, ServiceCheck>,
    checks: Record<string, HealthCheck>,
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (!dbStatus.connected) return 'unhealthy';

    for (const service of Object.values(services)) {
      if (service.status === 'down') return 'degraded';
    }

    for (const check of Object.values(checks)) {
      if (!check.passed) return 'degraded';
    }

    return 'healthy';
  }

  // ============================================
  // HISTORY & PERSISTENCE
  // ============================================

  private addToHistory(
    status: string,
    checks: Record<string, HealthCheck>,
  ): void {
    this.healthCheckHistory.push({
      timestamp: new Date(),
      status,
      checks,
    });

    if (this.healthCheckHistory.length > this.maxHistorySize) {
      this.healthCheckHistory.shift();
    }
  }

  /**
   * Best-effort audit-log write.
   *
   * ✅ Only writes when the database has been reachable at least
   *    once in this process's lifetime. This prevents the health
   *    check itself from flooding the logs (and the error channel)
   *    when the DB is down.
   *
   * ✅ Never throws.
   */
  private async persistHealthCheck(status: string): Promise<void> {
    if (!this.hasEverConnected) return;

    try {
      await prisma.auditLog.create({
        data: {
          action: 'VIEW',
          entityType: 'HEALTH_CHECK',
          entityId: `${Date.now()}`,
          entityName: `Health check: ${status}`,
          changes: { status },
          severity: 'INFO',
          userId: 'system',
        },
      });
    } catch (error) {
      // The DB may have gone down between the last successful ping
      // and this write. Log once at debug level and move on.
      console.debug(
        '[healthService] persistHealthCheck skipped:',
        toErrorMessage(error),
      );
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  private checkDirectoryWritable(dir: string): boolean {
    try {
      if (!fs.existsSync(dir)) return false;
      fs.accessSync(dir, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  }
}

export const healthService = new HealthService();
