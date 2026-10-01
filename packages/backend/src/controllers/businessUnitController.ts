// src/controllers/businessUnitController.ts
import { Request, Response, NextFunction } from 'express';
import { BusinessUnitService } from '../services/businessUnitService.js';
import { AppError } from '../middleware/errorHandler.js';
import { createBusinessUnitSchema } from '../utils/validators.js';
import { UserRole, BusinessUnitType } from '../generated/prisma/index.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { currencyService } from '../services/currencyService.js';
import { currencyMigrationService } from '../services/currencyMigrationService.js';

const businessUnitService = new BusinessUnitService();

// ============================================
// VALIDATION SCHEMAS
// ============================================

/**
 * Zod refinement for a settlement currency code.
 *
 * Accepts any string that uppercases to a known currency whose
 * registry entry has `settlementAllowed: true`. Returns the
 * uppercase code.
 */
const settlementCurrencySchema = z
  .string()
  .trim()
  .min(3)
  .max(3)
  .transform((v) => v.toUpperCase())
  .refine((code) => {
    const meta = currencyService.tryGetCurrency(code);
    return !!meta && meta.settlementAllowed;
  }, {
    message:
      'Unsupported settlement currency. ' +
      'Must be a currency that supports gateway settlement.',
  });

const updateBusinessUnitSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  code: z.string().min(1, 'Code is required').optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional(),
  isActive: z.boolean().optional(),
  type: z.enum(['HEADQUARTERS', 'BRANCH', 'WAREHOUSE', 'STORE']).optional(),
  currency: settlementCurrencySchema.optional(),
});

const addUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']).optional(),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1, 'ID is required')).min(1, 'At least one ID is required'),
});

const ensureUserBusinessUnitSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  companyId: z.string().min(1, 'Company ID is required'),
});

// ============================================
// CURRENCY-CHANGE SCHEMAS (Phase 3a)
// ============================================

const changeCurrencySchema = z.object({
  targetCurrency: z
    .string()
    .trim()
    .min(3)
    .max(3, 'Currency code must be exactly 3 characters'),
  acknowledgeDirtyRecords: z.boolean().optional().default(false),
  conversionRate: z.number().finite().positive().optional(),
  reason: z.string().max(500).nullable().optional(),
});

const previewCurrencySchema = z.object({
  targetCurrency: z
    .string()
    .trim()
    .min(3)
    .max(3, 'Currency code must be exactly 3 characters'),
});

// ============================================
// HELPERS
// ============================================

function isValidID(id: string): boolean {
  const cuidRegex = /^c[a-z0-9]{24}$/i;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const clerkIdRegex = /^user_[a-zA-Z0-9]{20,}$/;
  const simpleIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;
  return cuidRegex.test(id) || uuidRegex.test(id) || clerkIdRegex.test(id) || simpleIdRegex.test(id);
}

function handleValidationError(error: unknown, res: Response): boolean {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
    return true;
  }
  return false;
}

// ============================================
// BUSINESS UNIT CONTROLLER
// ============================================

export const businessUnitController = {
  /**
   * Get all business units
   * GET /business-units
   */
  async getAllBusinessUnits(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page,
        limit,
        search,
        companyId,
        isActive,
        sortBy,
        sortOrder,
        includeDeleted,
      } = req.query;

      const ALLOWED_SORT_FIELDS = new Set([
        'createdAt',
        'updatedAt',
        'name',
        'code',
        'type',
        'isActive',
      ]);

      const requestedSortBy = (sortBy as string) || 'createdAt';
      const safeSortBy = ALLOWED_SORT_FIELDS.has(requestedSortBy)
        ? requestedSortBy
        : 'createdAt';

      const requestedSortOrder =
        sortOrder === 'asc' || sortOrder === 'desc'
          ? (sortOrder as 'asc' | 'desc')
          : 'desc';

      const result = await businessUnitService.getAllBusinessUnits({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        companyId: companyId as string,
        isActive:
          isActive === 'true'
            ? true
            : isActive === 'false'
            ? false
            : undefined,
        sortBy: safeSortBy,
        sortOrder: requestedSortOrder,
        includeDeleted: includeDeleted === 'true',
      });

      res.json({
        success: true,
        data: result.businessUnits,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get the authenticated user's active business unit.
   * GET /business-units/current
   *
   * Used by the admin currency settings page
   * (`app/(dashboard)/admin/settings/currency/page.tsx`) to resolve
   * the BU whose currency it is editing.
   *
   * Resolution order:
   *   1. The user's active `BusinessUnitUser` row — the canonical
   *      source. A user can belong to more than one BU via the
   *      join table; we pick the oldest active membership.
   *   2. 404 — this user has no active business unit.
   *
   * ⚠ Never bootstraps. Unlike `cartController.getBusinessUnitId`,
   *   which creates a default BU for a fresh dev database, this
   *   endpoint must NOT create anything. An authenticated admin
   *   hitting "current" expects an existing resource or a clean
   *   404, not a side effect.
   *
   * ⚠ Must be registered BEFORE `GET /business-units/:id` in
   *   `index.ts` — otherwise the `:id` pattern matches "current"
   *   and shadows this handler. That ordering is already correct
   *   in `index.ts`.
   *
   * Response shape mirrors the admin page's expectations:
   *   { id, name, code, currency, currencySymbol }
   */
  async getCurrentBusinessUnit(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId =
        (req as any).user?.id ?? (req as any).user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 401);
      }

      // Canonical source: the join table. One active membership,
      // ordered by createdAt so the user's "primary" BU is stable
      // across requests if they happen to belong to several.
      const membership = await prisma.businessUnitUser.findFirst({
        where: { userId, isActive: true },
        include: {
          businessUnit: {
            select: {
              id: true,
              name: true,
              code: true,
              currency: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const businessUnit = membership?.businessUnit;

      if (!businessUnit || businessUnit.isActive === false) {
        throw new AppError(
          'You do not have an active business unit',
          404,
        );
      }

      // Resolve the settlement currency through the registry walk,
      // then derive the display symbol. Never a hardcoded literal.
      const resolvedCurrency = currencyService.resolveForBusiness(
        businessUnit.currency,
      );

      res.json({
        success: true,
        data: {
          id: businessUnit.id,
          name: businessUnit.name,
          code: businessUnit.code,
          currency: resolvedCurrency,
          currencySymbol:
            currencyService.tryGetCurrency(resolvedCurrency)?.symbol ??
            resolvedCurrency,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get business unit by ID
   * GET /business-units/:id
   */
  async getBusinessUnitById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }

      const businessUnit = await businessUnitService.getBusinessUnitById(id);
      res.json({ success: true, data: businessUnit });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create business unit
   * POST /business-units
   */
  async createBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createBusinessUnitSchema.parse(req.body);

      if (!data.companyId) {
        throw new AppError('Company ID is required to create a business unit', 400);
      }

      if (!isValidID(data.companyId)) {
        throw new AppError('Invalid company ID format. Must be a valid ID.', 400);
      }

      const resolvedCurrency =
        typeof (data as any).currency === 'string'
          ? (data as any).currency
          : undefined;

      const businessUnit = await businessUnitService.createBusinessUnit({
        name: data.name,
        code: data.code,
        address: data.address,
        phone: data.phone,
        email: data.email,
        companyId: data.companyId,
        isActive: data.isActive,
        type: (data.type as BusinessUnitType) || BusinessUnitType.STORE,
        currency: resolvedCurrency,
      });

      res.status(201).json({
        success: true,
        data: businessUnit,
        message: 'Business unit created successfully',
      });
    } catch (error) {
      if (handleValidationError(error, res)) return;
      next(error);
    }
  },

  /**
   * Update business unit
   * PUT /business-units/:id
   */
  async updateBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }

      const data = updateBusinessUnitSchema.parse(req.body);

      const updateData: any = { ...data };
      if (data.type) {
        updateData.type = data.type as BusinessUnitType;
      }

      const businessUnit = await businessUnitService.updateBusinessUnit(id, updateData);

      res.json({
        success: true,
        data: businessUnit,
        message: 'Business unit updated successfully',
      });
    } catch (error) {
      if (handleValidationError(error, res)) return;
      next(error);
    }
  },

  /**
   * Change business unit settlement currency
   * PATCH /business-units/:id/currency
   * POST /business-units/:id/currency/change
   *
   * Registered by `routes/currency.ts` and, historically, directly
   * in `index.ts`. Same handler either way.
   */
  async changeBusinessUnitCurrency(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id ?? (req as any).user?.userId;

      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const body = changeCurrencySchema.parse(req.body);
      const targetCurrency = body.targetCurrency.toUpperCase();

      const meta = currencyService.tryGetCurrency(targetCurrency);
      if (!meta) {
        throw new AppError(`Unknown currency: ${targetCurrency}`, 400);
      }
      if (!meta.settlementAllowed) {
        throw new AppError(
          `${targetCurrency} cannot be used as a settlement currency. ` +
            `It is display-only or has no gateway settlement support.`,
          400,
        );
      }

      const result = await businessUnitService.changeBusinessUnitCurrency({
        businessUnitId: id,
        targetCurrency,
        acknowledgeDirtyRecords: body.acknowledgeDirtyRecords,
        conversionRate: body.conversionRate,
        reason: body.reason ?? null,
        userId,
      });

      res.status(200).json({
        success: true,
        data: result,
        message:
          result.mode === 'migrated'
            ? `Business unit currency migrated from ${result.fromCurrency} to ${result.toCurrency}`
            : `Business unit currency changed from ${result.fromCurrency} to ${result.toCurrency}`,
      });
    } catch (error) {
      if (handleValidationError(error, res)) return;
      next(error);
    }
  },

  /**
   * Preview a business unit currency change
   * GET /business-units/:id/currency/preview?targetCurrency=EUR
   */
  async previewBusinessUnitCurrencyChange(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;

      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }

      const { targetCurrency } = previewCurrencySchema.parse(req.query);
      const preview = await currencyMigrationService.previewConversion(
        id,
        targetCurrency,
      );

      res.json({ success: true, data: preview });
    } catch (error) {
      if (handleValidationError(error, res)) return;
      next(error);
    }
  },

  /**
   * Delete business unit
   * DELETE /business-units/:id
   */
  async deleteBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }

      const result = await businessUnitService.deleteBusinessUnit(id);

      const message = result && typeof result === 'object' && 'message' in result
        ? (result as any).message
        : 'Business unit deleted successfully';

      res.json({
        success: true,
        message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Bulk delete business units
   * POST /business-units/bulk-delete
   */
  async bulkDeleteBusinessUnits(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = bulkDeleteSchema.parse(req.body);

      for (const id of ids) {
        if (!isValidID(id)) {
          throw new AppError(`Invalid ID format: ${id}`, 400);
        }
      }

      const result = await businessUnitService.bulkDeleteBusinessUnits(ids);

      res.json({
        success: true,
        data: result,
        message: `${result.deletedCount + result.softDeletedCount} business units processed successfully`,
      });
    } catch (error) {
      if (handleValidationError(error, res)) return;
      next(error);
    }
  },

  /**
   * Get business unit stats
   * GET /business-units/:id/stats
   */
  async getBusinessUnitStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }

      const stats = await businessUnitService.getBusinessUnitStats(id);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get business unit users
   * GET /business-units/:id/users
   */
  async getBusinessUnitUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }

      const users = await businessUnitService.getBusinessUnitUsers(id);
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add user to business unit
   * POST /business-units/:id/users
   */
  async addUserToBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }

      const { userId, role } = addUserSchema.parse(req.body);

      if (!isValidID(userId)) {
        throw new AppError('Invalid user ID format. Must be a valid ID.', 400);
      }

      const userRole = role ? (role as UserRole) : undefined;

      const result = await businessUnitService.addUserToBusinessUnit(id, userId, userRole);

      res.status(201).json({
        success: true,
        data: result,
        message: 'User added to business unit successfully',
      });
    } catch (error) {
      if (handleValidationError(error, res)) return;
      next(error);
    }
  },

  /**
   * Remove user from business unit
   * DELETE /business-units/:id/users/:userId
   */
  async removeUserFromBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, userId } = req.params;

      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }

      if (!isValidID(userId)) {
        throw new AppError('Invalid user ID format. Must be a valid ID.', 400);
      }

      const result = await businessUnitService.removeUserFromBusinessUnit(id, userId);

      res.json({
        success: true,
        data: result,
        message: 'User removed from business unit successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get default business unit for a company
   * GET /business-units/default/:companyId
   */
  async getOrCreateDefaultBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId } = req.params;

      if (!isValidID(companyId)) {
        throw new AppError('Invalid company ID format. Must be a valid ID.', 400);
      }

      const businessUnit = await businessUnitService.getOrCreateDefaultBusinessUnit(companyId);

      res.json({
        success: true,
        data: businessUnit,
        message: 'Business unit retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Ensure a business unit exists for a user
   * POST /business-units/ensure
   */
  async ensureUserBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, companyId } = ensureUserBusinessUnitSchema.parse(req.body);

      if (!isValidID(userId)) {
        throw new AppError('Invalid user ID format. Must be a valid ID.', 400);
      }

      if (!isValidID(companyId)) {
        throw new AppError('Invalid company ID format. Must be a valid ID.', 400);
      }

      const businessUnit = await businessUnitService.ensureUserBusinessUnit(userId, companyId);

      res.json({
        success: true,
        data: businessUnit,
        message: 'Business unit ensured successfully',
      });
    } catch (error) {
      if (handleValidationError(error, res)) return;
      next(error);
    }
  },

  /**
   * Get business units by company
   * GET /business-units/company/:companyId
   */
  async getBusinessUnitsByCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId } = req.params;

      if (!isValidID(companyId)) {
        throw new AppError('Invalid company ID format. Must be a valid ID.', 400);
      }

      const businessUnits = await businessUnitService.getBusinessUnitsByCompany(companyId);

      res.json({
        success: true,
        data: businessUnits,
        count: businessUnits.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get business unit by code
   * GET /business-units/code/:code
   */
  async getBusinessUnitByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.params;
      const { companyId } = req.query;

      if (!code) {
        throw new AppError('Business unit code is required', 400);
      }

      if (companyId && !isValidID(companyId as string)) {
        throw new AppError('Invalid company ID format. Must be a valid ID.', 400);
      }

      const businessUnit = await businessUnitService.getBusinessUnitByCode(
        code,
        companyId as string | undefined
      );

      res.json({
        success: true,
        data: businessUnit,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get business unit with full details
   * GET /business-units/:id/details
   */
  async getBusinessUnitWithDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }

      const businessUnit = await businessUnitService.getBusinessUnitWithDetails(id);

      res.json({
        success: true,
        data: businessUnit,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default businessUnitController;
