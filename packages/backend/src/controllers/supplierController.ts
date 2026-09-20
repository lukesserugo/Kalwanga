// D:\Projects\Kalwanga\packages\backend\src\controllers\supplierController.ts

import { Request, Response, NextFunction } from 'express';
import { supplierService } from '../services/supplierService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import {
  createSupplierSchema,
  updateSupplierSchema,
} from '../utils/validators.js';
import { Prisma } from '../generated/prisma/index.js';

// ============================================
// CONSTANTS
// ============================================

/**
 * Placeholder IDs that the frontend sometimes sends when it fails to
 * resolve a real database entity. We reject these at the controller
 * layer so the service never has to guess.
 */
const PLACEHOLDER_COMPANY_IDS = new Set([
  'default',
  'default-company',
  'default-company-id',
  'null',
  'undefined',
  '',
]);

const PLACEHOLDER_USER_IDS = new Set([
  'default',
  'default-user',
  'default-user-id',
  'null',
  'undefined',
  '',
]);

/**
 * Recognised user ID formats.
 *
 *   - Prisma CUID:      "cmu4l93cr00045kc90tx9rzdj"
 *   - UUID v4:          "8f9a2c1e-4b3d-4f5e-9a1b-2c3d4e5f6a7b"
 *   - Clerk user ID:    "user_3HxSsg839NHqUGCeoZH5MgdlvUw"
 */
const CUID_PATTERN = /^c[a-z0-9]{20,30}$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLERK_USER_ID_PATTERN = /^user_[A-Za-z0-9]+$/;

// ============================================
// HELPERS
// ============================================

/**
 * Parse a numeric query param safely.
 */
const parseNumber = (
  value: unknown,
  fallback: number,
  { min = 1, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {}
): number => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
};

/**
 * Parse a boolean query param safely. Accepts `true`, `1`, `yes`.
 */
const parseBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const s = String(value).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return undefined;
};

/**
 * Normalise a trimmed string from query params.
 */
const parseString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Ensure a value is a non-placeholder company ID.
 * Returns the trimmed value or throws a 400 AppError.
 */
const requireCompanyId = (raw: unknown): string => {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new AppError('Company ID is required', 400);
  }
  const trimmed = raw.trim();
  if (PLACEHOLDER_COMPANY_IDS.has(trimmed.toLowerCase())) {
    throw new AppError(
      `Invalid company ID "${trimmed}". Please select a real company.`,
      400
    );
  }
  return trimmed;
};

/**
 * Ensure a value is a non-placeholder user ID.
 *
 * Accepts BOTH:
 *   - Prisma CUID    ("cmu4l93cr00045kc90tx9rzdj")
 *   - UUID v4        ("8f9a2c1e-...")
 *   - Clerk user ID  ("user_3HxSsg839NHqUGCeoZH5MgdlvUw")
 *
 * The distinction between "which column to look up" is made in the
 * service layer. This helper only rejects obviously-invalid inputs
 * (empty, placeholder strings, or garbage that doesn't match any
 * recognised format).
 */
const requireUserId = (raw: unknown): string => {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new AppError('User ID is required', 400);
  }
  const trimmed = raw.trim();

  if (PLACEHOLDER_USER_IDS.has(trimmed.toLowerCase())) {
    throw new AppError(
      `Invalid user ID "${trimmed}". Please log in again.`,
      400
    );
  }

  // Reject strings that are clearly not a recognised ID format. This
  // catches typos and truncated IDs before we even hit the DB.
  const isRecognised =
    CUID_PATTERN.test(trimmed) ||
    UUID_PATTERN.test(trimmed) ||
    CLERK_USER_ID_PATTERN.test(trimmed);

  if (!isRecognised) {
    throw new AppError(
      `Invalid user ID format "${trimmed}". Please log in again.`,
      400
    );
  }

  return trimmed;
};

/**
 * Convert a Zod error into a clean AppError with a readable message.
 */
const formatZodError = (error: z.ZodError): AppError => {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'body';
    return `${path}: ${issue.message}`;
  });
  return new AppError(`Validation failed: ${issues.join('; ')}`, 400);
};

/**
 * Safely extract an ID from `req.params` and reject empty strings.
 */
const requireParamId = (raw: unknown, label = 'ID'): string => {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new AppError(`${label} is required`, 400);
  }
  return raw.trim();
};

// ============================================
// CONTROLLER
// ============================================

export const supplierController = {
  // ==========================================
  // GET /suppliers
  // ==========================================

  async getAllSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, companyId, isActive } = req.query;

      const result = await supplierService.getAllSuppliers({
        page: parseNumber(page, 1, { min: 1 }),
        limit: parseNumber(limit, 50, { min: 1, max: 200 }),
        search: parseString(search),
        companyId: parseString(companyId),
        isActive: parseBoolean(isActive),
      });

      res.json({
        success: true,
        data: result?.data ?? [],
        pagination: {
          total: result?.total ?? 0,
          page: result?.page ?? 1,
          totalPages: result?.totalPages ?? 1,
          limit: result?.limit ?? 50,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // GET /suppliers/:id
  // ==========================================

  async getSupplierById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = requireParamId(req.params.id, 'Supplier ID');
      const companyId = parseString(req.query.companyId);

      const supplier = await supplierService.getSupplierById(id, companyId);

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      res.json({
        success: true,
        data: supplier,
      });
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // POST /suppliers
  // ==========================================

  async createSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📝 Creating supplier with body:', req.body);

      // ---- 1. Zod validation ------------------------------------------
      let validatedData: z.infer<typeof createSupplierSchema>;
      try {
        validatedData = createSupplierSchema.parse(req.body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          throw formatZodError(err);
        }
        throw err;
      }

      console.log('✅ Validation passed:', validatedData);

      // ---- 2. Placeholder + format rejection --------------------------
      // These throw friendly 400s BEFORE we hit Prisma. This is what
      // turns the cryptic "Foreign key constraint failed" into a
      // message the UI can actually display.
      const companyId = requireCompanyId(validatedData.companyId);
      const userId = requireUserId(validatedData.userId);

      // ---- 3. Build the payload for the service -----------------------
      // The service is responsible for resolving `userId` against
      // EITHER the `User.id` (CUID) OR the `User.clerkId` (Clerk) —
      // see `SupplierService.resolveUserId()`.
      const data = {
        name: validatedData.name,
        contactPerson: validatedData.contactPerson ?? null,
        email: validatedData.email ?? null,
        phone: validatedData.phone ?? null,
        address: validatedData.address ?? null,
        taxId: validatedData.taxId ?? null,
        notes: validatedData.notes ?? null,
        paymentTerms: validatedData.paymentTerms ?? null,
        deliveryTerms: validatedData.deliveryTerms ?? null,
        website: validatedData.website ?? null,
        rating:
          validatedData.rating !== undefined ? validatedData.rating : null,
        creditLimit:
          validatedData.creditLimit !== undefined
            ? validatedData.creditLimit
            : null,
        companyId,
        userId,
        isActive:
          validatedData.isActive !== undefined ? validatedData.isActive : true,
      };

      // ---- 4. Delegate to service (which resolves + validates) --------
      const supplier = await supplierService.createSupplier(data);

      res.status(201).json({
        success: true,
        data: supplier,
        message: 'Supplier created successfully',
      });
    } catch (error) {
      console.error('❌ Error in createSupplier controller:', error);
      next(error);
    }
  },

  // ==========================================
  // PUT /suppliers/:id
  // ==========================================

  async updateSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const id = requireParamId(req.params.id, 'Supplier ID');

      // ---- 1. Zod validation ------------------------------------------
      let validatedData: z.infer<typeof updateSupplierSchema>;
      try {
        validatedData = updateSupplierSchema.parse(req.body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          throw formatZodError(err);
        }
        throw err;
      }

      // ---- 2. Build a partial update payload --------------------------
      const data: Record<string, unknown> = {};

      if (validatedData.name !== undefined) data.name = validatedData.name;
      if (validatedData.contactPerson !== undefined)
        data.contactPerson = validatedData.contactPerson;
      if (validatedData.email !== undefined) data.email = validatedData.email;
      if (validatedData.phone !== undefined) data.phone = validatedData.phone;
      if (validatedData.address !== undefined)
        data.address = validatedData.address;
      if (validatedData.taxId !== undefined) data.taxId = validatedData.taxId;
      if (validatedData.notes !== undefined) data.notes = validatedData.notes;
      if (validatedData.paymentTerms !== undefined)
        data.paymentTerms = validatedData.paymentTerms;
      if (validatedData.deliveryTerms !== undefined)
        data.deliveryTerms = validatedData.deliveryTerms;
      if (validatedData.website !== undefined)
        data.website = validatedData.website;
      if (validatedData.rating !== undefined)
        data.rating = validatedData.rating;
      if (validatedData.creditLimit !== undefined)
        data.creditLimit = validatedData.creditLimit;
      if (validatedData.isActive !== undefined)
        data.isActive = validatedData.isActive;

      const supplier = await supplierService.updateSupplier(id, data);

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      res.json({
        success: true,
        data: supplier,
        message: 'Supplier updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // DELETE /suppliers/:id
  // ==========================================

  async deleteSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const id = requireParamId(req.params.id, 'Supplier ID');
      const companyId = parseString(req.query.companyId);

      const result = await supplierService.deleteSupplier(id, companyId);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // PATCH /suppliers/:id/status
  // ==========================================

  async toggleSupplierStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const id = requireParamId(req.params.id, 'Supplier ID');
      const { isActive } = req.body;

      if (isActive === undefined || isActive === null) {
        throw new AppError('isActive field is required', 400);
      }

      if (typeof isActive !== 'boolean') {
        throw new AppError('isActive must be a boolean', 400);
      }

      const supplier = await supplierService.toggleSupplierStatus(
        id,
        isActive
      );

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      res.json({
        success: true,
        data: supplier,
        message: `Supplier ${
          isActive ? 'activated' : 'deactivated'
        } successfully`,
      });
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // GET /suppliers/search
  // ==========================================

  async searchSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const query = parseString(req.query.query);
      const companyId = parseString(req.query.companyId);
      const limit = parseNumber(req.query.limit, 10, { min: 1, max: 100 });

      if (!query) {
        throw new AppError('Search query is required', 400);
      }

      const suppliers = await supplierService.searchSuppliers(
        query,
        companyId,
        limit
      );

      res.json({
        success: true,
        data: suppliers ?? [],
      });
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // POST /suppliers/bulk/delete
  // ==========================================

  async bulkDeleteSuppliers(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { ids, companyId } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new AppError('Supplier IDs array is required', 400);
      }

      // Guard against accidental string-of-array or mixed types.
      const normalisedIds = ids
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      if (normalisedIds.length === 0) {
        throw new AppError('Supplier IDs array is required', 400);
      }

      const result = await supplierService.bulkDeleteSuppliers(
        normalisedIds,
        parseString(companyId)
      );

      const failedCount = result.errors?.length ?? 0;

      res.json({
        success: true,
        data: result,
        message: `${result.deletedCount} suppliers deleted successfully${
          failedCount > 0 ? `, ${failedCount} failed` : ''
        }`,
      });
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // GET /suppliers/:id/products
  // ==========================================

  async getSupplierProducts(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const id = requireParamId(req.params.id, 'Supplier ID');

      const result = await supplierService.getSupplierProducts(id, {
        page: parseNumber(req.query.page, 1, { min: 1 }),
        limit: parseNumber(req.query.limit, 10, { min: 1, max: 200 }),
      });

      res.json({
        success: true,
        data:
          result ?? {
            products: [],
            total: 0,
            page: 1,
            totalPages: 1,
            limit: 10,
          },
      });
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // GET /suppliers/:id/purchase-orders
  // ==========================================

  async getSupplierPurchaseOrders(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const id = requireParamId(req.params.id, 'Supplier ID');

      const result = await supplierService.getSupplierPurchaseOrders(id, {
        page: parseNumber(req.query.page, 1, { min: 1 }),
        limit: parseNumber(req.query.limit, 10, { min: 1, max: 200 }),
      });

      res.json({
        success: true,
        data:
          result ?? {
            purchaseOrders: [],
            total: 0,
            page: 1,
            totalPages: 1,
            limit: 10,
          },
      });
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // GET /suppliers/:id/orders
  // ==========================================

  async getSupplierOrderHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const id = requireParamId(req.params.id, 'Supplier ID');

      const result = await supplierService.getSupplierOrderHistory(id, {
        page: parseNumber(req.query.page, 1, { min: 1 }),
        limit: parseNumber(req.query.limit, 10, { min: 1, max: 200 }),
      });

      res.json({
        success: true,
        data:
          result ?? {
            orders: [],
            total: 0,
            page: 1,
            totalPages: 1,
            limit: 10,
          },
      });
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // GET /suppliers/:id/statistics
  // ==========================================

  async getSupplierStatistics(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const id = requireParamId(req.params.id, 'Supplier ID');

      const statistics = await supplierService.getSupplierStatistics(id);

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default supplierController;
