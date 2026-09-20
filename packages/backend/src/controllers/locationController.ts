// packages/backend/src/controllers/locationController.ts

import { Request, Response, NextFunction } from 'express';
import { LocationService } from '../services/locationService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { prisma } from '../lib/prisma.js';

const locationService = new LocationService();

// ============================================
// BUSINESS UNIT / USER RESOLUTION
// ============================================
//
// Same logic the inventory controller uses. Kept local because
// importing from `inventoryController.ts` would create a circular
// dependency (inventoryController imports inventoryService, which
// transitively could import locationService, which we're not doing,
// but route → controller → controller is fragile).

function sanitizeBusinessUnitId(id?: string | null): string | undefined {
  if (!id) return undefined;
  if (
    id === 'default' ||
    id === 'default-business-unit' ||
    id === 'undefined' ||
    id === 'null' ||
    id === ''
  ) {
    return undefined;
  }
  return id;
}

async function resolveBusinessUnitId(req: Request): Promise<string> {
  const user = (req as any).user;

  const explicit =
    (req.headers['x-business-unit-id'] as string | undefined) ||
    (req.query?.businessUnitId as string | undefined) ||
    (req.body?.businessUnitId as string | undefined);

  const sanitized = sanitizeBusinessUnitId(explicit);
  if (sanitized) {
    const exists = await prisma.businessUnit.findUnique({
      where: { id: sanitized },
      select: { id: true, isActive: true },
    });
    if (exists && exists.isActive) return exists.id;
    console.warn(
      `⚠️ Explicit businessUnitId ${sanitized} not found or inactive, falling back`
    );
  }

  const fromUser =
    user?.businessUnitId ||
    user?.businessUnits?.[0]?.businessUnitId ||
    user?.businessUnits?.[0]?.id;

  const userBu = sanitizeBusinessUnitId(fromUser);
  if (userBu) {
    const exists = await prisma.businessUnit.findUnique({
      where: { id: userBu },
      select: { id: true, isActive: true },
    });
    if (exists && exists.isActive) return exists.id;
  }

  if (user?.id) {
    const userWithBUs = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        businessUnits: { include: { businessUnit: true } },
      },
    });
    const first = userWithBUs?.businessUnits.find(
      (bu: any) => bu.businessUnit?.isActive
    );
    if (first?.businessUnit) return first.businessUnit.id;
  }

  const fallback = await prisma.businessUnit.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (fallback) return fallback.id;

  throw new AppError('No active business unit found', 400);
}

async function resolveUserId(req: Request): Promise<string> {
  const user = (req as any).user;
  const id = user?.id || user?.userId;
  if (id && id !== 'default-user-id') return id;

  const admin = await prisma.user.findFirst({
    where: {
      role: { in: ['SUPER_ADMIN', 'ADMIN'] },
      isActive: true,
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (admin) return admin.id;

  throw new AppError('No users found in the system', 400);
}

// ============================================
// ID VALIDATION
// ============================================

const RESERVED_IDS = new Set([
  'new',
  'edit',
  'create',
  'all',
  'default',
  'list',
  'search',
  'types',
  // ✅ Static route segments that would otherwise be captured by `:id`
  // if the router ordering ever regresses. Guarding here too means the
  // controller returns 400 instead of "Location not found" for these.
  'settings',
  'reports',
  'export',
  'import',
]);

function isValidID(id: string): boolean {
  if (!id || id === 'default') return false;
  if (RESERVED_IDS.has(id.toLowerCase())) return false;

  const cuidRegex = /^c[a-z0-9]{24}$/i;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const simpleIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;

  return (
    cuidRegex.test(id) || uuidRegex.test(id) || simpleIdRegex.test(id)
  );
}

// ============================================
// ERROR HANDLING
// ============================================
//
// Mirror of `handleGeneralError` in inventoryController so failures
// surface with the same envelope shape the frontend already parses.

function handleError(error: unknown, res: Response) {
  console.error('❌ LocationController error:', error);

  if (error instanceof AppError) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = unique constraint (name/code clash on same BU)
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate entry',
        error: `A record with this ${String(
          error.meta?.target ?? ''
        )} already exists`,
        code: error.code,
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Database error',
      error: error.message,
      code: error.code,
    });
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      message: 'Invalid data provided',
      error: error.message,
    });
  }

  if (error instanceof Error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}

// ============================================
// INPUT VALIDATION HELPERS
// ============================================

const VALID_EXPORT_FORMATS = new Set(['csv', 'xlsx', 'json', 'pdf']);
const MAX_IMPORT_ROWS = 1000;

function parseBooleanQuery(value: unknown): boolean {
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  if (typeof value === 'boolean') return value;
  return false;
}

// ============================================
// CONTROLLER
// ============================================

export const locationController = {
  // ─────────────────────────────────────────
  // CRUD (existing)
  // ─────────────────────────────────────────

  /**
   * GET /api/locations
   * List all non-deleted locations for the caller's business unit.
   */
  async list(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await resolveBusinessUnitId(req);
      const locations = await locationService.list(businessUnitId);

      res.status(200).json({
        success: true,
        data: locations,
        count: locations.length,
      });
    } catch (err) {
      return handleError(err, res);
    }
  },

  /**
   * GET /api/locations/:id
   * Fetch a single location by id.
   */
  async getById(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Location ID is required', 400);
      if (!isValidID(id)) throw new AppError('Invalid location ID format', 400);

      const businessUnitId = await resolveBusinessUnitId(req);

      // LocationService doesn't have a `getById` — read directly.
      const location = await prisma.location.findFirst({
        where: { id, businessUnitId, deletedAt: null },
      });

      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Location not found',
        });
      }

      res.status(200).json({ success: true, data: location });
    } catch (err) {
      return handleError(err, res);
    }
  },

  /**
   * POST /api/locations
   * Create a new location for the caller's business unit.
   */
  async create(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await resolveBusinessUnitId(req);
      const location = await locationService.create(businessUnitId, req.body);

      res.status(201).json({
        success: true,
        data: location,
        message: 'Location created successfully',
      });
    } catch (err) {
      return handleError(err, res);
    }
  },

  /**
   * PATCH /api/locations/:id
   * Update an existing location.
   */
  async update(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Location ID is required', 400);
      if (!isValidID(id)) throw new AppError('Invalid location ID format', 400);

      const businessUnitId = await resolveBusinessUnitId(req);
      const location = await locationService.update(
        id,
        businessUnitId,
        req.body
      );

      res.status(200).json({
        success: true,
        data: location,
        message: 'Location updated successfully',
      });
    } catch (err) {
      return handleError(err, res);
    }
  },

  /**
   * DELETE /api/locations/:id
   * Soft delete. Refuses if inventory rows still reference it.
   */
  async remove(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Location ID is required', 400);
      if (!isValidID(id)) throw new AppError('Invalid location ID format', 400);

      const businessUnitId = await resolveBusinessUnitId(req);
      const userId = await resolveUserId(req);

      await locationService.softDelete(id, businessUnitId, userId);

      res.status(200).json({
        success: true,
        message: 'Location deleted successfully',
      });
    } catch (err) {
      return handleError(err, res);
    }
  },

  // ─────────────────────────────────────────
  // SETTINGS
  // ─────────────────────────────────────────

  /**
   * GET /api/locations/settings
   * Fetch the settings row for the caller's business unit.
   * Returns 404 when no row exists yet — the client applies defaults.
   */
  async getSettings(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await resolveBusinessUnitId(req);
      const settings = await locationService.getSettings(businessUnitId);

      if (!settings) {
        return res.status(404).json({
          success: false,
          message: 'No settings found for this business unit',
        });
      }

      res.status(200).json({ success: true, data: settings });
    } catch (err) {
      return handleError(err, res);
    }
  },

  /**
   * PUT /api/locations/settings
   * Upsert the settings row for the caller's business unit.
   */
  async updateSettings(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await resolveBusinessUnitId(req);

      // Whitelist the fields the client may update. Anything else in
      // req.body is ignored — prevents clients from setting `id`,
      // `businessUnitId`, or `createdAt` directly.
      const allowed = [
        'defaultLocationId',
        'enabledTypes',
        'allowNegativeStock',
        'reserveStockOnAdd',
        'defaultReorderPoint',
        'defaultReorderQuantity',
        'requireTransferReference',
        'autoReceiveTransfers',
        'allowCrossBusinessUnitTransfers',
        'showCodeOnCards',
        'showInactiveInLists',
      ] as const;

      const payload: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in req.body) payload[key] = req.body[key];
      }

      if (Object.keys(payload).length === 0) {
        throw new AppError('No recognized settings fields provided', 400);
      }

      const settings = await locationService.updateSettings(
        businessUnitId,
        payload
      );

      res.status(200).json({
        success: true,
        data: settings,
        message: 'Settings updated successfully',
      });
    } catch (err) {
      return handleError(err, res);
    }
  },

  // ─────────────────────────────────────────
  // REPORTS
  // ─────────────────────────────────────────

  /**
   * GET /api/locations/reports
   * Per-location aggregates: item count, total quantity, total value,
   * low-stock count, out-of-stock count.
   */
  async getReports(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await resolveBusinessUnitId(req);
      const rows = await locationService.getReports(businessUnitId);

      res.status(200).json({
        success: true,
        data: rows,
        count: rows.length,
      });
    } catch (err) {
      return handleError(err, res);
    }
  },

  // ─────────────────────────────────────────
  // IMPORT
  // ─────────────────────────────────────────

  /**
   * POST /api/locations/import
   * Body: { rows: ImportLocationRow[] }
   * Bulk-create locations. Per-row validation happens in the service;
   * this controller handles shape and size checks only.
   */
  async import(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await resolveBusinessUnitId(req);
      const userId = await resolveUserId(req);

      const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;

      if (!rows) {
        throw new AppError('Request body must include a `rows` array', 400);
      }
      if (rows.length === 0) {
        throw new AppError('No rows supplied', 400);
      }
      if (rows.length > MAX_IMPORT_ROWS) {
        throw new AppError(
          `Import limited to ${MAX_IMPORT_ROWS} rows per request`,
          400
        );
      }

      const result = await locationService.importMany(
        businessUnitId,
        userId,
        rows
      );

      res.status(201).json({
        success: true,
        data: result,
        message: `${result.created} location(s) imported${
          result.failed > 0 ? `, ${result.failed} failed` : ''
        }`,
      });
    } catch (err) {
      return handleError(err, res);
    }
  },

  // ─────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────

  /**
   * GET /api/locations/export
   *   ?format=csv|xlsx|json|pdf
   *   &includeInactive=true|false
   *   &includeInventory=true|false
   * Streams a downloadable file.
   */
  async export(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await resolveBusinessUnitId(req);

      const formatRaw = String(req.query.format ?? 'csv').toLowerCase();
      if (!VALID_EXPORT_FORMATS.has(formatRaw)) {
        throw new AppError(
          `Unsupported export format: ${formatRaw}. Expected one of: ${[
            ...VALID_EXPORT_FORMATS,
          ].join(', ')}`,
          400
        );
      }

      const format = formatRaw as 'csv' | 'xlsx' | 'json' | 'pdf';
      const includeInactive = parseBooleanQuery(req.query.includeInactive);
      const includeInventory = parseBooleanQuery(req.query.includeInventory);

      const { buffer, contentType, filename } = await locationService.exportAll(
        businessUnitId,
        { format, includeInactive, includeInventory }
      );

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.setHeader('Content-Length', buffer.length);
      // Prevent intermediary caches from holding a per-tenant export.
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(buffer);
    } catch (err) {
      // Note: once we start writing the body we can't call handleError
      // (headers already sent). We only reach here on the pre-write
      // errors (BU resolution, format validation), so it's safe.
      return handleError(err, res);
    }
  },
};

export default locationController;
