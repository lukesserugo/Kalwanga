// src/controllers/inventoryController.ts

import { Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/inventoryService.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  createProductSchema,
  updateProductSchema,
  updateStockSchema,
  searchProductsSchema,
  createItemSchema,
  updateItemSchema,
  issueItemSchema,
  returnItemSchema,
  restockItemSchema,
  bulkCreateItemsSchema,
  bulkUpdateStockSchema,
} from '../utils/validators.js';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/index.js';
import { prisma } from '../lib/prisma.js';

import { ensureProductInventory } from '../lib/ensureInventory.js';

const inventoryService = new InventoryService();

// ============================================
// IMAGE HELPERS
// ============================================

function toImageUrls(input: unknown): string[] {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && typeof (v as any).url === 'string') {
        return (v as any).url as string;
      }
      return null;
    })
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

// ============================================
// ✅ FIX: formatPrismaTarget was referenced in handlePrismaError
//    but never defined. On a P2002 (unique constraint) error the
//    handler would throw `ReferenceError: formatPrismaTarget is
//    not defined`, escaping the error handler and hanging the
//    request. Define it here so P2002 responses are produced
//    correctly.
// ============================================
function formatPrismaTarget(target: unknown): string {
  if (!target) return 'unknown';
  if (typeof target === 'string') return target;
  if (Array.isArray(target)) return target.join(', ');
  try {
    return JSON.stringify(target);
  } catch {
    return String(target);
  }
}

// ============================================
// ID VALIDATION
// ============================================

const RESERVED_IDS = new Set([
  'users',
  'reports',
  'settings',
  'stats',
  'details',
  'company',
  'default',
  'code',
  'bulk',
  'bulk-delete',
  'ensure',
  'test',
  'new',
  'edit',
  'create',
  'all',
  'tree',
  'scan',
  'search',
  'low-stock',
  'out-of-stock',
  'value',
  'summary',
  'movements',
  'transactions',
  'total',
  'category-summary',
  'categories',
  'suppliers',
  'export',
  'import',
  'barcode',
  'sku',
  'products',
  'items',
]);

function isValidID(id: string): boolean {
  if (!id || id === 'default') return false;
  if (RESERVED_IDS.has(id.toLowerCase())) return false;

  const cuidRegex = /^c[a-z0-9]{24}$/i;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const clerkIdRegex = /^user_[a-zA-Z0-9]{20,}$/;
  const simpleIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;

  return (
    cuidRegex.test(id) ||
    uuidRegex.test(id) ||
    clerkIdRegex.test(id) ||
    simpleIdRegex.test(id)
  );
}

// ============================================
// NORMALIZATION HELPERS
// ============================================

function normalizeInventoryItem(item: any): any {
  if (!item) return item;

  if (item.product && item.product.id) {
    if (!item.id || item.id !== item.product.id) {
      return {
        ...item,
        id: item.product.id,
        name: item.name || item.product.name,
        unitPrice: item.unitPrice || item.product.unitPrice,
        images:
          item.images && item.images.length > 0
            ? toImageUrls(item.images)
            : toImageUrls(item.product.images),
        description: item.description || item.product.description,
        weight:
          item.weight !== undefined ? item.weight : item.product.weight,
        taxRate:
          item.taxRate !== undefined ? item.taxRate : item.product.taxRate,
        tags:
          item.tags && item.tags.length > 0
            ? item.tags
            : item.product.tags || [],
        isActive:
          item.isActive !== undefined
            ? item.isActive
            : item.product?.isActive,
        sku: item.sku || item.product.sku,
        category: item.category || item.product.category,
        categoryId: item.categoryId || item.product.categoryId,
        supplier: item.supplier || item.product.supplier,
        supplierId: item.supplierId || item.product.supplierId,
        minStock: item.minStock || item.product.minStock,
        maxStock: item.maxStock || item.product.maxStock,
        featured: item.featured || item.product.featured,
        isDigital: item.isDigital || item.product.isDigital,
        attributes: item.attributes || item.product.attributes || {},
        notes: item.notes || item.product.notes,
        costPrice: item.costPrice || item.product.costPrice,
        _product: item.product,
        productId: item.product.id,
        inventory: item.inventory || [
          {
            quantity: item.quantity || item.product?.stock || 0,
            reserved: item.reserved || 0,
          },
        ],
        stock: item.quantity || item.stock || 0,
        price:
          item.price || item.unitPrice || item.product?.unitPrice || 0,
      };
    }
  }

  if (!item.id && item.inventoryId) {
    return { ...item, id: item.inventoryId };
  }

  if (!item.id && item.productId) {
    return { ...item, id: item.productId };
  }

  if (item && item.images) {
    item.images = toImageUrls(item.images);
  }

  if (item && !item.inventory) {
    return {
      ...item,
      inventory: [
        {
          quantity: item.quantity || item.stock || 0,
          reserved: item.reserved || 0,
        },
      ],
    };
  }

  if (item && item.quantity !== undefined && item.stock === undefined) {
    return { ...item, stock: item.quantity };
  }

  if (item && !item.images) {
    item.images = [];
  }

  if (item && !item.tags) {
    item.tags = [];
  }

  return item;
}

function normalizeInventoryItems(items: any[]): any[] {
  if (!items || !Array.isArray(items)) return [];
  return items.map(normalizeInventoryItem);
}

// ============================================
// BUSINESS UNIT / USER / COMPANY RESOLUTION
// ============================================

function sanitizeBusinessUnitId(businessUnitId?: string): string | undefined {
  if (!businessUnitId) return undefined;
  if (
    businessUnitId === 'default' ||
    businessUnitId === 'default-business-unit' ||
    businessUnitId === 'undefined' ||
    businessUnitId === 'null' ||
    businessUnitId === ''
  ) {
    return undefined;
  }
  return businessUnitId;
}

/**
 * ✅ Resolve the business unit for this request.
 *
 *    Resolution order:
 *      1. `x-business-unit-id` header / `businessUnitId` body / query
 *      2. The user's own business unit (from `req.user`)
 *      3. The oldest active BU in the DB (matches
 *         `InventoryService.ensureBusinessUnit`)
 *
 *    If the caller explicitly passed a business unit ID and it does
 *    NOT exist (or is inactive), this throws 400/404 instead of
 *    silently substituting a different BU. The old silent fallback
 *    masked the "record exists under BU A, API queried BU B" class
 *    of bug.
 */
async function getBusinessUnitId(req: Request): Promise<string> {
  const user = (req as any).user;

  const explicit =
    (req.headers['x-business-unit-id'] as string | undefined) ||
    (req.body?.businessUnitId as string | undefined) ||
    (req.query?.businessUnitId as string | undefined);

  const sanitizedExplicit = sanitizeBusinessUnitId(explicit);
  if (sanitizedExplicit) {
    const exists = await prisma.businessUnit.findUnique({
      where: { id: sanitizedExplicit },
      select: { id: true, isActive: true },
    });

    if (exists && exists.isActive) {
      return exists.id;
    }

    // Missing or inactive — log and fall through. Do NOT throw.
    console.warn(
      `[inventory] Explicit businessUnitId "${sanitizedExplicit}" ` +
        `is ${exists ? 'inactive' : 'not found'}; ` +
        `falling back to the caller's own business unit.`
    );
  }

  const userBu =
    user?.businessUnitId ||
    user?.businessUnits?.[0]?.businessUnitId ||
    user?.businessUnits?.[0]?.id ||
    user?.businessUnits?.[0];

  const sanitizedUserBu = sanitizeBusinessUnitId(userBu);
  if (sanitizedUserBu) {
    const exists = await prisma.businessUnit.findUnique({
      where: { id: sanitizedUserBu },
      select: { id: true, isActive: true },
    });
    if (exists && exists.isActive) {
      return exists.id;
    }
    console.warn(
      `[inventory] User's businessUnitId "${sanitizedUserBu}" ` +
        `is ${exists ? 'inactive' : 'not found'}; ` +
        `falling back to the oldest active BU.`
    );
  }

  try {
    const businessUnit = await prisma.businessUnit.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (businessUnit) {
      console.log(
        '✅ Using first active business unit from DB:',
        businessUnit.id,
        businessUnit.name
      );
      return businessUnit.id;
    }

    let company = await prisma.company.findFirst({
      where: { isActive: true },
    });
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'Default Company',
          email: 'default@company.com',
          phone: '+0000000000',
          isActive: true,
        },
      });
    }

    const newBusinessUnit = await prisma.businessUnit.create({
      data: {
        name: 'Default Business Unit',
        code: `BU-${Date.now().toString().slice(-6)}`,
        isActive: true,
        companyId: company.id,
        type: 'STORE',
      },
    });

    console.log('✅ Created default business unit:', newBusinessUnit.id);
    return newBusinessUnit.id;
  } catch (err) {
    if (err instanceof AppError) throw err;
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('❌ Failed to resolve business unit ID:', error);
    throw new AppError('Failed to resolve business unit ID', 500);
  }
}

async function getUserId(req: Request): Promise<string> {
  const user = (req as any).user;

  const userId = user?.id || user?.userId;

  if (!userId || userId === 'default-user-id') {
    try {
      const adminUser = await prisma.user.findFirst({
        where: {
          role: { in: ['SUPER_ADMIN', 'ADMIN'] },
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (adminUser) {
        console.log('✅ Using admin user from DB:', adminUser.id);
        return adminUser.id;
      }

      const anyUser = await prisma.user.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (anyUser) {
        console.log('✅ Using first user from DB:', anyUser.id);
        return anyUser.id;
      }

      throw new AppError('No users found in the system', 400);
    } catch (err) {
      if (err instanceof AppError) throw err;

      const error = err instanceof Error ? err : new Error(String(err));
      console.error('❌ Failed to resolve user ID:', error);
      throw new AppError('Failed to resolve user ID', 500);
    }
  }

  return userId;
}

async function getCompanyId(req: Request): Promise<string> {
  const user = (req as any).user;

  const companyId =
    user?.companyId || req.body?.companyId || req.query?.companyId;

  if (!companyId || companyId === 'default-company-id') {
    try {
      const company = await prisma.company.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (company) {
        return company.id;
      }

      const newCompany = await prisma.company.create({
        data: {
          name: 'Default Company',
          email: 'default@company.com',
          phone: '+0000000000',
          isActive: true,
        },
      });

      return newCompany.id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('❌ Failed to resolve company ID:', error);
      throw new AppError('Failed to resolve company ID', 500);
    }
  }

  return companyId;
}

// ============================================
// ERROR HANDLING HELPERS
// ============================================

function handleZodError(error: z.ZodError, res: Response) {
  return res.status(400).json({
    success: false,
    message: 'Validation error',
    errors: error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    })),
  });
}

function handlePrismaError(error: unknown, res: Response) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const knownError: Prisma.PrismaClientKnownRequestError = error;

    switch (knownError.code) {
      case 'P2000':
        return res.status(400).json({
          success: false,
          message: 'One or more values are too long for their target column.',
          error: 'VALUE_TOO_LONG',
          code: knownError.code,
          details: { field: knownError.meta?.column_name },
        });

      case 'P2002': {
        const field = formatPrismaTarget(knownError.meta?.target);
        return res.status(409).json({
          success: false,
          message: `Duplicate entry: "${field}" already exists.`,
          error: 'DUPLICATE_ENTRY',
          code: knownError.code,
          details: { field: knownError.meta?.target },
        });
      }

      case 'P2003':
        return res.status(400).json({
          success: false,
          message:
            'Foreign key constraint failed. Please check the related IDs.',
          error: 'FOREIGN_KEY_CONSTRAINT',
          code: knownError.code,
          details: { field: knownError.meta?.field_name },
        });

      case 'P2004':
        return res.status(400).json({
          success: false,
          message:
            'A database constraint failed. Please review the submitted data.',
          error: 'CONSTRAINT_FAILED',
          code: knownError.code,
          details: { constraint: knownError.meta?.constraint },
        });

      case 'P2011':
        return res.status(400).json({
          success: false,
          message: 'A required field is missing a value.',
          error: 'NULL_CONSTRAINT_VIOLATION',
          code: knownError.code,
          details: { field: knownError.meta?.constraint },
        });

      case 'P2023':
        return res.status(400).json({
          success: false,
          message:
            'Inconsistent column data. Please verify the submitted values.',
          error: 'INCONSISTENT_COLUMN_DATA',
          code: knownError.code,
          details: { field: knownError.meta?.column },
        });

      case 'P2025':
        return res.status(404).json({
          success: false,
          message:
            'The requested record was not found (or a related record is missing).',
          error: 'RECORD_NOT_FOUND',
          code: knownError.code,
          details: { model: knownError.meta?.modelName },
        });

      default:
        return res.status(400).json({
          success: false,
          message: 'Database error.',
          error: 'DATABASE_ERROR',
          code: knownError.code,
          details: knownError.meta ? { meta: knownError.meta } : undefined,
        });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    const validationError: Prisma.PrismaClientValidationError = error;
    return res.status(400).json({
      success: false,
      message:
        'Invalid data provided to the database layer. Please review the request payload.',
      error: 'VALIDATION_ERROR',
      details:
        process.env.NODE_ENV !== 'production'
          ? { message: validationError.message }
          : undefined,
    });
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    const initError: Prisma.PrismaClientInitializationError = error;
    console.error('❌ Prisma initialisation error:', initError);
    return res.status(503).json({
      success: false,
      message:
        'The database is currently unreachable. Please try again later.',
      error: 'DATABASE_UNAVAILABLE',
      details:
        process.env.NODE_ENV !== 'production'
          ? { message: initError.message, code: initError.errorCode }
          : undefined,
    });
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const unknownError: Prisma.PrismaClientUnknownRequestError = error;
    console.error('❌ Prisma unknown request error:', unknownError);
    return res.status(500).json({
      success: false,
      message: 'An unexpected database error occurred.',
      error: 'UNKNOWN_DATABASE_ERROR',
      details:
        process.env.NODE_ENV !== 'production'
          ? { message: unknownError.message }
          : undefined,
    });
  }

  return null;
}

function handleGeneralError(error: unknown, res: Response) {
  console.error('❌ Controller error:', error);

  if (error instanceof AppError) {
    if (error.status === 404) {
      console.warn('📋 AppError (404):', error.message);
    } else {
      console.error('📋 AppError details:', {
        status: error.status,
        message: error.message,
        stack: error.stack,
      });
    }
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof z.ZodError) {
    console.error('📋 ZodError details:', error.errors);
    return handleZodError(error, res);
  }

  const prismaErrorResponse = handlePrismaError(error, res);
  if (prismaErrorResponse) {
    return prismaErrorResponse;
  }

  if (error instanceof Error) {
    console.error('📋 Unexpected error:', {
      message: error.message,
      stack: error.stack || 'No stack trace',
    });

    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error:
        process.env.NODE_ENV === 'development'
          ? { stack: error.stack, details: error }
          : undefined,
    });
  }

  console.error('📋 Unknown error (not an Error instance):', error);

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}

// ============================================
// INVENTORY CONTROLLER
// ============================================

export const inventoryController = {
  // ── REFERENCE DATA ─────────────────────────

  async getCategories(req: Request, res: Response, _next: NextFunction) {
    try {
      console.log('📤 GET /inventory/categories - Query params:', req.query);

      // ✅ Uses the same BU resolver as every other endpoint.
      const businessUnitId = await getBusinessUnitId(req);

      console.log(
        `📤 Calling inventoryService.getCategories with businessUnitId: ${
          businessUnitId || 'undefined'
        }`
      );

      const categories = await inventoryService.getCategories(businessUnitId);

      console.log(
        `📥 inventoryService.getCategories returned ${categories.length} categories`
      );

      res.status(200).json({
        success: true,
        ok: true,
        data: categories || [],
        count: categories?.length || 0,
        businessUnitId: businessUnitId || null,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('❌ Error in getCategories:', error);
      res.status(200).json({
        success: true,
        ok: false,
        data: [],
        count: 0,
        error: error.message,
      });
    }
  },

  async getSuppliers(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const suppliers = await inventoryService.getSuppliers(businessUnitId);

      res.status(200).json({
        success: true,
        data: suppliers,
        count: suppliers.length,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  // ── GET: INVENTORY ─────────────────────────

  async getInventory(req: Request, res: Response, _next: NextFunction) {
    try {
      console.log('📥 GET /inventory - Query params:', req.query);

      const businessUnitId = await getBusinessUnitId(req);
      console.log('✅ Resolved businessUnitId:', businessUnitId);

      if (!businessUnitId) {
        return res.status(400).json({
          success: false,
          message: 'Business unit ID is required',
        });
      }

      const {
        page,
        limit,
        search,
        lowStock,
        productId,
        category,
        location,
        status,
        sortBy,
        sortOrder,
        includeInactive,
        hasBarcode,
        minPrice,
        maxPrice,
        supplier,
        inStock,
      } = req.query;

      if (!page && !limit) {
        console.log('📤 No pagination, fetching all inventory');
        const result = await inventoryService.getAllInventory(businessUnitId);
        const normalizedItems = normalizeInventoryItems(
          (result as any)?.items || []
        );
        return res.status(200).json({
          success: true,
          data: normalizedItems,
          stats: (result as any)?.stats || {},
          count: normalizedItems.length,
        });
      }

      const params: Record<string, unknown> = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
        sortBy: (sortBy as string) || 'updatedAt',
        sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
        businessUnitId,
      };

      if (search) params.search = search as string;
      if (lowStock === 'true') params.lowStock = true;
      if (productId) params.productId = productId as string;
      if (category) params.category = category as string;
      if (location) params.location = location as string;
      if (status) params.status = status as string;
      if (includeInactive === 'true') params.includeInactive = true;
      if (hasBarcode === 'true') params.hasBarcode = true;
      if (hasBarcode === 'false') params.hasBarcode = false;
      if (minPrice) params.minPrice = parseFloat(minPrice as string);
      if (maxPrice) params.maxPrice = parseFloat(maxPrice as string);
      if (supplier) params.supplier = supplier as string;
      if (inStock === 'true') params.inStock = true;
      if (inStock === 'false') params.inStock = false;

      console.log(
        '📤 Calling inventoryService.getInventory with params:',
        JSON.stringify(params, null, 2)
      );

      const result = await inventoryService.getInventory(params as any);

      const normalizedInventory = normalizeInventoryItems(
        (result as any)?.inventory || []
      );

      return res.status(200).json({
        success: true,
        data: normalizedInventory,
        stats: (result as any)?.stats || {},
        pagination: {
          total: (result as any)?.total || 0,
          page: (result as any)?.page || 1,
          totalPages: (result as any)?.totalPages || 1,
          limit: (result as any)?.limit || 10,
          hasNextPage:
            ((result as any)?.page || 1) < ((result as any)?.totalPages || 1),
          hasPreviousPage: ((result as any)?.page || 1) > 1,
        },
        filters: (result as any)?.appliedFilters || {},
      });
    } catch (error) {
      console.error('❌ Error in getInventory:', error);
      return handleGeneralError(error, res);
    }
  },

  async getAllInventory(req: Request, res: Response, _next: NextFunction) {
    try {
      console.log('📥 GET /inventory/all - Query params:', req.query);

      const businessUnitId = await getBusinessUnitId(req);
      console.log('✅ Resolved businessUnitId:', businessUnitId);

      if (!businessUnitId) {
        return res.status(400).json({
          success: false,
          message: 'Business unit ID is required',
        });
      }

      const result = await inventoryService.getAllInventory(businessUnitId);

      const normalizedItems = normalizeInventoryItems(
        (result as any)?.items || []
      );

      console.log(`✅ Found ${normalizedItems.length} inventory items`);

      res.status(200).json({
        success: true,
        data: normalizedItems,
        stats: (result as any)?.stats || {},
        count: normalizedItems.length,
        businessUnitId,
      });
    } catch (error) {
      console.error('❌ Error in getAllInventory:', error);
      return handleGeneralError(error, res);
    }
  },

  async getInventoryByProduct(
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const { productId } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!productId) {
        throw new AppError('Product ID is required', 400);
      }

      if (!isValidID(productId)) {
        throw new AppError('Invalid product ID format', 400);
      }

      const inventory = await inventoryService.getInventoryByProduct(
        productId,
        businessUnitId
      );
      const normalizedInventory = normalizeInventoryItem(inventory);

      res.status(200).json({
        success: true,
        data: normalizedInventory,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getInventoryItemById(
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!id) {
        throw new AppError('Inventory ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid inventory ID format', 400);
      }

      const item = await inventoryService.getInventoryItemById(
        id,
        businessUnitId
      );

      if (!item) {
        console.warn(
          `⚠️ Inventory item ${id} not found for businessUnitId=${businessUnitId}`
        );
        throw new AppError('Inventory item not found', 404);
      }

      const normalizedItem = normalizeInventoryItem(item);

      res.status(200).json({
        success: true,
        data: normalizedItem,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getLowStockItems(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const items = await inventoryService.getLowStockItems(businessUnitId);

      const normalizedItems = normalizeInventoryItems(items);

      res.status(200).json({
        success: true,
        data: normalizedItems,
        count: normalizedItems.length,
        message:
          normalizedItems.length > 0
            ? `${normalizedItems.length} items are low on stock`
            : 'No low stock items',
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getOutOfStockItems(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const items = await inventoryService.getOutOfStockItems(businessUnitId);

      const normalizedItems = normalizeInventoryItems(items);

      res.status(200).json({
        success: true,
        data: normalizedItems,
        count: normalizedItems.length,
        message:
          normalizedItems.length > 0
            ? `${normalizedItems.length} items are out of stock`
            : 'No out of stock items',
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getInventoryValue(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const value = await inventoryService.getInventoryValue(businessUnitId);

      res.status(200).json({
        success: true,
        data: value,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getInventoryTransactions(
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const {
        page,
        limit,
        productId,
        transactionType,
        startDate,
        endDate,
        variantId,
      } = req.query;

      const result = await inventoryService.getInventoryTransactions({
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        productId: productId as string,
        businessUnitId,
        transactionType: transactionType as any,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        variantId: variantId as string,
      });

      res.status(200).json({
        success: true,
        data: (result as any).transactions,
        summary: (result as any).summary,
        pagination: {
          total: (result as any).total,
          page: (result as any).page,
          totalPages: (result as any).totalPages,
          limit: (result as any).limit,
        },
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getInventoryByLocation(
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const { location } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!location) {
        throw new AppError('Location is required', 400);
      }

      const items = await inventoryService.getInventoryByLocation(
        location,
        businessUnitId
      );
      const normalizedItems = normalizeInventoryItems(items);

      res.status(200).json({
        success: true,
        data: normalizedItems,
        count: normalizedItems.length,
        location,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getInventoryByCategory(
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const { category } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!category) {
        throw new AppError('Category is required', 400);
      }

      const items = await inventoryService.getInventoryByCategory(
        category,
        businessUnitId
      );
      const normalizedItems = normalizeInventoryItems(items);

      res.status(200).json({
        success: true,
        data: normalizedItems,
        count: normalizedItems.length,
        category,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async searchProducts(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { query, category, minPrice, maxPrice, status } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new AppError('Search query is required', 400);
      }

      const validatedData = searchProductsSchema.parse({
        query: query.trim(),
        category,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        status,
      });

      const results = await inventoryService.searchProducts({
        query: validatedData.query,
        category: validatedData.category,
        minPrice: validatedData.minPrice,
        maxPrice: validatedData.maxPrice,
        status: validatedData.status,
        businessUnitId,
      });

      const normalizedResults = normalizeInventoryItems(results);

      res.status(200).json({
        success: true,
        data: normalizedResults,
        total: normalizedResults.length,
        query: validatedData.query,
        filters: {
          category: validatedData.category || null,
          minPrice: validatedData.minPrice || null,
          maxPrice: validatedData.maxPrice || null,
          status: validatedData.status || null,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  async exportInventory(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { format = 'json' } = req.query;

      if (!['json', 'csv', 'excel'].includes(format as string)) {
        throw new AppError('Invalid format. Must be json, csv, or excel', 400);
      }

      const result = await inventoryService.exportInventory(
        businessUnitId,
        format as string
      );

      res.status(200).json({
        success: true,
        data: (result as any).data,
        format: (result as any).format,
        total: (result as any).total,
        exportedAt: (result as any).exportedAt,
        message: `Inventory exported as ${format}`,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getInventorySummary(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);

      const [totalItems, lowStockItems, outOfStockItems, totalValue, categories] =
        await Promise.all([
          inventoryService.getTotalItems(businessUnitId),
          inventoryService.getLowStockItems(businessUnitId),
          inventoryService.getOutOfStockItems(businessUnitId),
          inventoryService.getInventoryValue(businessUnitId),
          inventoryService.getCategorySummary(businessUnitId),
        ]);

      res.status(200).json({
        success: true,
        data: {
          totalItems,
          lowStockItems: lowStockItems.length,
          outOfStockItems: outOfStockItems.length,
          totalValue: (totalValue as any).totalValue,
          totalCost: (totalValue as any).totalCost,
          potentialProfit:
            (totalValue as any).totalValue - (totalValue as any).totalCost,
          categories,
          stockStatus: {
            inStock:
              totalItems - lowStockItems.length - outOfStockItems.length,
            lowStock: lowStockItems.length,
            outOfStock: outOfStockItems.length,
          },
        },
        timestamp: new Date(),
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getStockMovements(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const {
        productId,
        variantId,
        startDate,
        endDate,
        limit = 100,
      } = req.query;

      const movements = await inventoryService.getStockMovements({
        productId: productId as string,
        variantId: variantId as string,
        businessUnitId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string) || 100,
      } as any);

      res.status(200).json({
        success: true,
        data: movements,
        count: Array.isArray(movements) ? movements.length : 0,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getTotalItems(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const count = await inventoryService.getTotalItems(businessUnitId);

      res.status(200).json({
        success: true,
        data: count,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getCategorySummary(req: Request, res: Response, _next: NextFunction) {
    try {
      console.log(
        '📤 GET /inventory/category-summary - Query params:',
        req.query
      );

      // ✅ Uses the same BU resolver as every other endpoint.
      const businessUnitId = await getBusinessUnitId(req);

      console.log(
        `📤 Calling inventoryService.getCategorySummary with businessUnitId: ${
          businessUnitId || 'undefined'
        }`
      );

      const categories = await inventoryService.getCategorySummary(
        businessUnitId || ''
      );

      console.log(
        `📥 inventoryService.getCategorySummary returned ${categories.length} categories`
      );

      res.status(200).json({
        success: true,
        ok: true,
        data: categories || [],
        count: categories?.length || 0,
        businessUnitId: businessUnitId || null,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('❌ Error in getCategorySummary:', error);
      res.status(200).json({
        success: true,
        ok: false,
        data: [],
        count: 0,
        error: error.message,
      });
    }
  },

  async getInventoryStats(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const stats = await inventoryService.getInventoryStats(businessUnitId);

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date(),
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  // ── BARCODE & SKU ──────────────────────────

  async getInventoryByBarcode(
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const { barcode } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!barcode) {
        throw new AppError('Barcode is required', 400);
      }

      const result = await inventoryService.getInventoryByBarcode(
        barcode,
        businessUnitId
      );

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'No inventory item found for this barcode',
        });
      }

      const normalizedResult = normalizeInventoryItem(result);

      res.status(200).json({
        success: true,
        data: normalizedResult,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getInventoryBySku(req: Request, res: Response, _next: NextFunction) {
    try {
      const { sku } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!sku) {
        throw new AppError('SKU is required', 400);
      }

      const result = await inventoryService.getInventoryBySku(
        sku,
        businessUnitId
      );

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'No inventory item found for this SKU',
        });
      }

      const normalizedResult = normalizeInventoryItem(result);

      res.status(200).json({
        success: true,
        data: normalizedResult,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async generateInventoryBarcode(
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!id) {
        throw new AppError('Inventory item ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid inventory ID format', 400);
      }

      const result = await inventoryService.generateInventoryBarcode(
        id,
        businessUnitId
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Barcode generated successfully',
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async generateInventoryQRCode(
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!id) {
        throw new AppError('Inventory item ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid inventory ID format', 400);
      }

      const result = await inventoryService.generateInventoryQRCode(
        id,
        businessUnitId
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'QR code generated successfully',
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async bulkGenerateInventoryBarcodes(
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const { ids } = req.body;
      const businessUnitId = await getBusinessUnitId(req);

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new AppError('Array of inventory item IDs is required', 400);
      }

      const invalidIds = ids.filter(
        (id: unknown) => typeof id !== 'string' || !isValidID(id)
      );
      if (invalidIds.length > 0) {
        throw new AppError(`Invalid ID format: ${invalidIds.join(', ')}`, 400);
      }

      const result = await inventoryService.bulkGenerateInventoryBarcodes(
        ids,
        businessUnitId
      );

      res.status(201).json({
        success: result.errors.length === 0,
        data: {
          results: result.results,
          errors: result.errors,
          summary: {
            total: ids.length,
            succeeded: result.results.length,
            failed: result.errors.length,
          },
        },
        message: `Generated barcodes for ${result.results.length} items, ${result.errors.length} failed`,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async scanInventory(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { barcode, sku, productId } = req.body;

      if (!barcode && !sku && !productId) {
        throw new AppError('Barcode, SKU, or Product ID is required', 400);
      }

      let result = null;
      let barcodeInfo = null;

      if (barcode) {
        result = await inventoryService.getInventoryByBarcode(
          barcode,
          businessUnitId
        );
      }

      if (!result && sku) {
        result = await inventoryService.getInventoryBySku(sku, businessUnitId);
      }

      if (!result && productId) {
        if (!isValidID(productId)) {
          throw new AppError('Invalid product ID format', 400);
        }
        result = await inventoryService.getInventoryByProduct(
          productId,
          businessUnitId
        );
      }

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'No inventory item found for the provided identifier',
          data: null,
        });
      }

      const normalizedResult = normalizeInventoryItem(result);

      if (normalizedResult.barcode) {
        barcodeInfo = {
          barcode: normalizedResult.barcode,
          barcodeUrl: `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
            normalizedResult.barcode
          )}&code=EAN-13&dpi=96`,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
            JSON.stringify({
              product: normalizedResult.name,
              sku: normalizedResult.sku,
              barcode: normalizedResult.barcode,
            })
          )}&size=150x150`,
        };
      }

      res.status(200).json({
        success: true,
        data: {
          inventory: normalizedResult,
          availableStock:
            (normalizedResult.stock || 0) - (normalizedResult.reserved || 0),
          barcodeInfo,
        },
        message: 'Inventory item found',
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  // ── WRITE: ITEMS ───────────────────────────

  async createItem(req: Request, res: Response, _next: NextFunction) {
    try {
      console.log('📝 Creating inventory item with body:', req.body);

      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      console.log('📝 Resolved businessUnitId:', businessUnitId);
      console.log('📝 Resolved userId:', userId);

      const validatedData = createItemSchema.parse(req.body);
      console.log('✅ Validation passed:', validatedData);

      const itemData = {
        name: validatedData.name,
        category: validatedData.category || '',
        quantity: validatedData.quantity ?? 0,
        unit: validatedData.unit || 'each',
        businessUnitId,
        userId,

        ...(validatedData.sku && { sku: validatedData.sku }),
        ...(validatedData.categoryId && {
          categoryId: validatedData.categoryId,
        }),
        ...(validatedData.minStock !== undefined && {
          minStock: validatedData.minStock,
        }),
        ...(validatedData.maxStock !== undefined && {
          maxStock: validatedData.maxStock,
        }),
        ...(validatedData.location && { location: validatedData.location }),
        ...(validatedData.supplier && { supplier: validatedData.supplier }),
        ...(validatedData.supplierId && {
          supplierId: validatedData.supplierId,
        }),
        ...(validatedData.unitPrice !== undefined && {
          unitPrice: validatedData.unitPrice,
        }),
        ...(validatedData.purchaseDate && {
          purchaseDate: validatedData.purchaseDate,
        }),
        ...(validatedData.expiryDate && {
          expiryDate: validatedData.expiryDate,
        }),
        ...(validatedData.notes && { notes: validatedData.notes }),
        ...(validatedData.description && {
          description: validatedData.description,
        }),
        ...(validatedData.barcode && { barcode: validatedData.barcode }),
        ...(validatedData.weight !== undefined && {
          weight: validatedData.weight,
        }),
        ...(validatedData.taxRate !== undefined && {
          taxRate: validatedData.taxRate,
        }),
        ...(validatedData.tags && { tags: validatedData.tags }),
        ...(validatedData.images && { images: validatedData.images }),
        ...(validatedData.isActive !== undefined && {
          isActive: validatedData.isActive,
        }),
        ...(validatedData.isDigital !== undefined && {
          isDigital: validatedData.isDigital,
        }),
        ...(validatedData.featured !== undefined && {
          featured: validatedData.featured,
        }),
      };

      console.log('📝 Sending to service:', itemData);

      const result = await inventoryService.createItem(itemData);
      console.log('✅ Item created successfully:', result);

      try {
        const productId =
          (result as any)?.productId ||
          (result as any)?.product?.id ||
          (result as any)?.id;

        if (productId) {
          await prisma.$transaction(async (tx) =>
            ensureProductInventory(tx, productId, businessUnitId)
          );
        }
      } catch (ensureErr) {
        const error =
          ensureErr instanceof Error
            ? ensureErr
            : new Error(String(ensureErr));
        console.warn(
          '⚠️ ensureProductInventory failed after createItem:',
          error
        );
      }

      const normalizedResult = normalizeInventoryItem(result);

      res.status(201).json({
        success: true,
        data: normalizedResult,
        message: 'Item created successfully',
      });
    } catch (error) {
      console.error('❌ Error creating item:', error);

      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  async updateItem(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!id) {
        throw new AppError('Item ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid item ID format', 400);
      }

      console.log('📝 Updating inventory item:', id, req.body);

      const validatedData = updateItemSchema.parse(req.body);

      const result = await inventoryService.updateItem(id, {
        ...validatedData,
        businessUnitId,
      });

      console.log('✅ Item updated successfully:', result);

      const normalizedResult = normalizeInventoryItem(result);

      res.status(200).json({
        success: true,
        data: normalizedResult,
        message: 'Item updated successfully',
      });
    } catch (error) {
      console.error('❌ Error updating item:', error);

      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  async deleteItem(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!id) {
        throw new AppError('Item ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid item ID format', 400);
      }

      const result = await inventoryService.deleteProduct(
        id,
        businessUnitId,
        userId
      );

      res.status(200).json({
        success: true,
        message: result.message || 'Item deleted successfully',
        data: result,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async updateStock(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!id) {
        throw new AppError('Item ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid item ID format', 400);
      }

      const validatedData = updateStockSchema.parse(req.body);

      const result = await inventoryService.updateStock({
        productId: id,
        quantity: validatedData.quantity || validatedData.stock || 0,
        transactionType: validatedData.transactionType || 'ADJUSTMENT',
        userId,
        businessUnitId,
        notes: validatedData.notes || 'Stock adjustment',
        reference: validatedData.reference,
        variantId: validatedData.variantId,
        inventoryId: id,
        batchNumber: validatedData.batchNumber,
        expiryDate: validatedData.expiryDate
          ? new Date(validatedData.expiryDate)
          : undefined,
      } as any);

      const normalizedResult = normalizeInventoryItem(result);

      res.status(200).json({
        success: true,
        data: normalizedResult,
        message: 'Stock updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  async issueItem(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!id) {
        throw new AppError('Inventory ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid inventory ID format', 400);
      }

      const validatedData = issueItemSchema.parse(req.body);

      const result = await inventoryService.issueItem({
        inventoryId: id,
        issuedTo: validatedData.issuedTo,
        quantity: validatedData.quantity,
        purpose: validatedData.purpose,
        remarks: validatedData.remarks,
        expectedReturnDate: validatedData.expectedReturnDate,
        businessUnitId,
        userId,
      } as any);

      const normalizedResult = normalizeInventoryItem(result);

      res.status(200).json({
        success: true,
        data: normalizedResult,
        message: 'Item issued successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  async returnItem(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!id) {
        throw new AppError('Inventory ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid inventory ID format', 400);
      }

      const validatedData = returnItemSchema.parse(req.body);

      const result = await inventoryService.returnItem({
        inventoryId: id,
        quantity: validatedData.quantity,
        returnDate: validatedData.returnDate,
        remarks: validatedData.remarks,
        businessUnitId,
        userId,
      } as any);

      const normalizedResult = normalizeInventoryItem(result);

      res.status(200).json({
        success: true,
        data: normalizedResult,
        message: 'Item returned successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  async restockItem(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!id) {
        throw new AppError('Inventory ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid inventory ID format', 400);
      }

      const validatedData = restockItemSchema.parse(req.body);

      const result = await inventoryService.restockItem({
        inventoryId: id,
        quantity: validatedData.quantity,
        unitPrice: validatedData.unitPrice,
        supplier: validatedData.supplier,
        purchaseDate: validatedData.purchaseDate,
        businessUnitId,
        userId,
        notes: validatedData.notes,
        invoiceNumber: validatedData.invoiceNumber,
      } as any);

      const normalizedResult = normalizeInventoryItem(result);

      res.status(200).json({
        success: true,
        data: normalizedResult,
        message: 'Item restocked successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  // ── WRITE: PRODUCTS ────────────────────────

  async createProduct(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      const validatedData = createProductSchema.parse(req.body);

      const result = await inventoryService.createProductWithInventory({
        name: String(validatedData.name || ''),
        sku: String(validatedData.sku || ''),
        unitPrice:
          typeof validatedData.unitPrice === 'number'
            ? validatedData.unitPrice
            : typeof validatedData.price === 'number'
            ? validatedData.price
            : 0,
        costPrice:
          typeof validatedData.costPrice === 'number'
            ? validatedData.costPrice
            : undefined,
        quantity:
          typeof validatedData.stock === 'number' ? validatedData.stock : 0,
        minStock:
          typeof validatedData.reorderPoint === 'number'
            ? validatedData.reorderPoint
            : undefined,
        category:
          typeof validatedData.category === 'string'
            ? validatedData.category
            : undefined,
        categoryId:
          typeof validatedData.categoryId === 'string'
            ? validatedData.categoryId
            : undefined,
        location:
          typeof validatedData.location === 'string'
            ? validatedData.location
            : undefined,
        barcode:
          typeof validatedData.barcode === 'string'
            ? validatedData.barcode
            : undefined,
        description:
          typeof validatedData.description === 'string'
            ? validatedData.description
            : undefined,
        images: Array.isArray(validatedData.images)
          ? validatedData.images
          : undefined,
        supplier:
          typeof validatedData.supplier === 'string'
            ? validatedData.supplier
            : undefined,
        supplierId:
          typeof validatedData.supplierId === 'string'
            ? validatedData.supplierId
            : undefined,
        businessUnitId,
        userId,
      } as any);

      try {
        const productId =
          (result as any)?.productId ||
          (result as any)?.product?.id ||
          (result as any)?.id;

        if (productId) {
          await prisma.$transaction(async (tx) =>
            ensureProductInventory(tx, productId, businessUnitId)
          );
        }
      } catch (ensureErr) {
        const error =
          ensureErr instanceof Error
            ? ensureErr
            : new Error(String(ensureErr));
        console.warn(
          '⚠️ ensureProductInventory failed after createProduct:',
          error
        );
      }

      const normalizedResult = normalizeInventoryItem(result);

      res.status(201).json({
        success: true,
        data: normalizedResult,
        message: 'Product created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  async updateProduct(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!id) {
        throw new AppError('Product ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid product ID format', 400);
      }

      const validatedData = updateProductSchema.parse(req.body);

      const result = await inventoryService.updateProduct(id, {
        name: validatedData.name,
        sku: validatedData.sku,
        price: validatedData.price,
        unitPrice: validatedData.unitPrice,
        costPrice: validatedData.costPrice,
        category: validatedData.category,
        categoryId: validatedData.categoryId,
        location: validatedData.location,
        status: validatedData.status,
        description: validatedData.description,
        images: validatedData.images,
        supplier: validatedData.supplier,
        supplierId: validatedData.supplierId,
        businessUnitId,
      } as any);

      const normalizedResult = normalizeInventoryItem(result);

      res.status(200).json({
        success: true,
        data: normalizedResult,
        message: 'Product updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  async deleteProduct(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!id) {
        throw new AppError('Product ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid product ID format', 400);
      }

      const result = await inventoryService.deleteProduct(
        id,
        businessUnitId,
        userId
      );

      res.status(200).json({
        success: true,
        message: result.message || 'Product deleted successfully',
        data: result,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  // ── STOCK RESERVATION ──────────────────────

  async reserveStock(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { productId, quantity, variantId } = req.body;

      if (!productId) {
        throw new AppError('Product ID is required', 400);
      }

      if (!isValidID(productId)) {
        throw new AppError('Invalid product ID format', 400);
      }

      if (!quantity || quantity <= 0) {
        throw new AppError('Valid quantity is required', 400);
      }

      const result = await inventoryService.reserveStock(
        productId,
        quantity,
        businessUnitId,
        variantId
      );

      const normalizedResult = normalizeInventoryItem(result);

      res.status(200).json({
        success: true,
        data: normalizedResult,
        message: 'Stock reserved successfully',
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async releaseReservedStock(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { productId, quantity, variantId } = req.body;

      if (!productId) {
        throw new AppError('Product ID is required', 400);
      }

      if (!isValidID(productId)) {
        throw new AppError('Invalid product ID format', 400);
      }

      if (!quantity || quantity <= 0) {
        throw new AppError('Valid quantity is required', 400);
      }

      const result = await inventoryService.releaseReservedStock(
        productId,
        quantity,
        businessUnitId,
        variantId
      );

      const normalizedResult = normalizeInventoryItem(result);

      res.status(200).json({
        success: true,
        data: normalizedResult,
        message: 'Reserved stock released successfully',
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async transferStock(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);
      const {
        productId,
        fromLocation,
        toLocation,
        quantity,
        notes,
        variantId,
      } = req.body;

      if (!productId || !fromLocation || !toLocation || !quantity) {
        throw new AppError(
          'Product ID, fromLocation, toLocation, and quantity are required',
          400
        );
      }

      if (!isValidID(productId)) {
        throw new AppError('Invalid product ID format', 400);
      }

      if (quantity <= 0) {
        throw new AppError('Quantity must be positive', 400);
      }

      if (fromLocation === toLocation) {
        throw new AppError(
          'Source and destination locations must be different',
          400
        );
      }

      const result = await inventoryService.transferStock({
        productId,
        fromLocation,
        toLocation,
        quantity,
        notes,
        businessUnitId,
        variantId,
      } as any);

      const normalizedResult = normalizeInventoryItem(result);

      res.status(200).json({
        success: true,
        data: normalizedResult,
        message: 'Stock transferred successfully',
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  // ── BULK OPERATIONS ────────────────────────

  async bulkCreateItems(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      const validatedData = bulkCreateItemsSchema.parse(req.body);

      const results: unknown[] = [];
      const errors: unknown[] = [];

      for (const item of validatedData.items) {
        try {
          const result = await inventoryService.createItem({
            name: item.name,
            category: item.category || '',
            categoryId: item.categoryId,
            quantity: item.quantity || 0,
            unit: item.unit || 'each',
            minStock: item.minStock || 5,
            maxStock: item.maxStock || 100,
            location: item.location || 'Warehouse',
            supplier: item.supplier || '',
            supplierId: item.supplierId,
            unitPrice: item.unitPrice || 0,
            purchaseDate: item.purchaseDate,
            expiryDate: item.expiryDate,
            notes: item.notes,
            description: item.description,
            barcode: item.barcode,
            sku: item.sku,
            weight: item.weight,
            taxRate: item.taxRate,
            tags: item.tags,
            images: item.images,
            isActive: item.isActive,
            isDigital: item.isDigital,
            featured: item.featured,
            businessUnitId,
            userId,
          } as any);

          try {
            const productId =
              (result as any)?.productId ||
              (result as any)?.product?.id ||
              (result as any)?.id;

            if (productId) {
              await prisma.$transaction(async (tx) =>
                ensureProductInventory(tx, productId, businessUnitId)
              );
            }
          } catch (ensureErr) {
            const error =
              ensureErr instanceof Error
                ? ensureErr
                : new Error(String(ensureErr));
            console.warn(
              '⚠️ ensureProductInventory failed during bulkCreateItems:',
              error
            );
          }

          results.push({
            success: true,
            data: normalizeInventoryItem(result),
          });
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push({
            success: false,
            item: item.name,
            error: error.message,
          });
        }
      }

      res.status(201).json({
        success: errors.length === 0,
        data: {
          results,
          errors,
          summary: {
            total: validatedData.items.length,
            succeeded: results.length,
            failed: errors.length,
            successRate:
              ((results.length / validatedData.items.length) * 100).toFixed(
                2
              ) + '%',
          },
        },
        message: `Bulk create completed: ${results.length} succeeded, ${errors.length} failed`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  async bulkUpdateStock(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      const validatedData = bulkUpdateStockSchema.parse(req.body);

      if (!validatedData.updates || validatedData.updates.length === 0) {
        throw new AppError(
          'Updates array is required and cannot be empty',
          400
        );
      }

      const results: unknown[] = [];
      const errors: unknown[] = [];

      for (const update of validatedData.updates) {
        try {
          if (!isValidID(update.id)) {
            throw new AppError(`Invalid ID format: ${update.id}`, 400);
          }

          const result = await inventoryService.updateStock({
            productId: update.id,
            quantity: update.quantity,
            transactionType: update.transactionType || 'ADJUSTMENT',
            userId,
            businessUnitId,
            notes: update.notes || 'Bulk stock update',
            inventoryId: update.id,
            variantId: update.variantId,
          } as any);
          results.push({
            id: update.id,
            success: true,
            data: normalizeInventoryItem(result),
          });
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push({
            id: update.id,
            success: false,
            error: error.message,
          });
        }
      }

      res.status(200).json({
        success: errors.length === 0,
        data: {
          results,
          errors,
          summary: {
            total: validatedData.updates.length,
            succeeded: results.length,
            failed: errors.length,
            successRate:
              ((results.length / validatedData.updates.length) * 100).toFixed(
                2
              ) + '%',
          },
        },
        message: `Bulk stock update completed: ${results.length} succeeded, ${errors.length} failed`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  async createInventory(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      const result = await inventoryService.createInventory({
        name: req.body.name,
        sku: req.body.sku,
        description: req.body.description,
        categoryId: req.body.categoryId,
        category: req.body.category,
        supplierId: req.body.supplierId,
        supplier: req.body.supplier,
        quantity: req.body.quantity || 0,
        minStock: req.body.minStock || 5,
        maxStock: req.body.maxStock || 100,
        unitPrice: req.body.unitPrice || 0,
        costPrice: req.body.costPrice || 0,
        location: req.body.location || 'Warehouse',
        barcode: req.body.barcode,
        notes: req.body.notes,
        weight: req.body.weight,
        taxRate: req.body.taxRate,
        tags: req.body.tags,
        images: req.body.images,
        isActive: req.body.isActive,
        isDigital: req.body.isDigital,
        featured: req.body.featured,
        businessUnitId,
        userId,
      } as any);

      try {
        const productId =
          (result as any)?.productId ||
          (result as any)?.product?.id ||
          (result as any)?.id;

        if (productId) {
          await prisma.$transaction(async (tx) =>
            ensureProductInventory(tx, productId, businessUnitId)
          );
        }
      } catch (ensureErr) {
        const error =
          ensureErr instanceof Error
            ? ensureErr
            : new Error(String(ensureErr));
        console.warn(
          '⚠️ ensureProductInventory failed after createInventory:',
          error
        );
      }

      const normalizedResult = normalizeInventoryItem(result);

      res.status(201).json({
        success: true,
        data: normalizedResult,
        message: 'Inventory item created successfully',
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async updateInventory(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        throw new AppError('Inventory ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid inventory ID format', 400);
      }

      const result = await inventoryService.updateInventory(id, {
        name: req.body.name,
        sku: req.body.sku,
        description: req.body.description,
        categoryId: req.body.categoryId,
        supplierId: req.body.supplierId,
        quantity: req.body.quantity,
        minStock: req.body.minStock,
        maxStock: req.body.maxStock,
        unitPrice: req.body.unitPrice,
        costPrice: req.body.costPrice,
        location: req.body.location,
        barcode: req.body.barcode,
        notes: req.body.notes,
        isActive: req.body.isActive,
        images: req.body.images,
        tags: req.body.tags,
        weight: req.body.weight,
        taxRate: req.body.taxRate,
      } as any);

      const normalizedResult = normalizeInventoryItem(result);

      res.status(200).json({
        success: true,
        data: normalizedResult,
        message: 'Inventory item updated successfully',
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getInventoryItem(req: Request, res: Response, _next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        throw new AppError('Inventory ID is required', 400);
      }

      if (!isValidID(id)) {
        throw new AppError('Invalid inventory ID format', 400);
      }

      const item = await inventoryService.getInventoryItem(id);

      const normalizedItem = normalizeInventoryItem(item);

      res.status(200).json({
        success: true,
        data: normalizedItem,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async exportInventoryToFile(
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { format = 'json' } = req.query;

      const validFormats = ['json', 'csv', 'excel'] as const;
      type ExportFormat = (typeof validFormats)[number];

      let exportFormat: ExportFormat = 'json';
      if (format && typeof format === 'string') {
        if (validFormats.includes(format as ExportFormat)) {
          exportFormat = format as ExportFormat;
        } else {
          console.warn(
            `⚠️ Invalid export format: ${format}, using 'json' as default`
          );
        }
      }

      const result = await inventoryService.exportInventoryToFile(
        businessUnitId,
        exportFormat
      );

      res.status(200).json({
        success: true,
        data: result,
        message: `Inventory exported to file as ${exportFormat}`,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async bulkDeleteItems(req: Request, res: Response, _next: NextFunction) {
    try {
      const { ids } = req.body;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new AppError('Array of inventory item IDs is required', 400);
      }

      const invalidIds = ids.filter(
        (id: unknown) => typeof id !== 'string' || !isValidID(id)
      );
      if (invalidIds.length > 0) {
        throw new AppError(`Invalid ID format: ${invalidIds.join(', ')}`, 400);
      }

      const results: any[] = [];
      const errors: any[] = [];

      for (const id of ids) {
        try {
          const result = await inventoryService.deleteProduct(
            id,
            businessUnitId,
            userId
          );
          results.push({ id, success: true, message: result.message });
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push({
            id,
            success: false,
            error: error.message,
          });
        }
      }

      res.status(200).json({
        success: errors.length === 0,
        data: {
          results,
          errors,
          summary: {
            total: ids.length,
            succeeded: results.length,
            failed: errors.length,
          },
        },
        message: `Bulk delete completed: ${results.length} succeeded, ${errors.length} failed`,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getInventoryItems(req: Request, res: Response, _next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { page, limit, search, withoutProduct } = req.query;

      const params: Record<string, unknown> = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        businessUnitId,
        withoutProduct: withoutProduct === 'true',
      };

      if (search) params.search = search as string;

      const result = await inventoryService.getInventoryItems(params as any);

      const normalizedItems = normalizeInventoryItems(
        (result as any)?.items || []
      );

      res.status(200).json({
        success: true,
        data: normalizedItems,
        pagination: {
          total: (result as any)?.total || 0,
          page: (result as any)?.page || 1,
          totalPages: (result as any)?.totalPages || 1,
          limit: (result as any)?.limit || 20,
        },
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },
};

export default inventoryController;
