// src/controllers/productController.ts

import { Request, Response, NextFunction } from 'express';
import {
  ProductService,
  ProductCreateData,
} from '../services/productService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { prisma } from '../lib/prisma.js';
import {
  createProductSchema,
  updateProductSchema,
  searchParamsSchema,
  createCategorySchema,
  updateCategorySchema,
  createSupplierSchema,
  updateSupplierSchema,
  createProductReviewSchema,
  bulkCreateProductsSchema,
  bulkDeleteProductsSchema,
  bulkActivateProductsSchema,
  bulkDeactivateProductsSchema,
  bulkUpdatePricesSchema,
  generateBarcodeSchema,
  associateBarcodeSchema,
  validateBarcodeSchema,
  createVariantSchema,
  updateVariantSchema,
  bulkCreateVariantsSchema,
} from '../utils/validators.js';
import { z } from 'zod';

// ✅ Inventory invariant helpers
import {
  ensureProductInventory,
  ensureVariantInventory,
} from '../lib/ensureInventory.js';

const productService = new ProductService();

// ============================================
// ID VALIDATION
// ============================================
//
// Same rules every other controller in this codebase uses. Static
// route segments (e.g. "featured", "search", "variants") are rejected
// so they never reach the service as an :id.

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
  'search',
  'featured',
  'popular',
  'new-arrivals',
  'related',
  'no-barcode',
  'statistics',
  'check-sku',
  'barcode',
  'qrcode',
  'wishlist',
  'compare',
  'recently-viewed',
  'tags',
  'variants',
  'reviews',
  'by-name',
  'with-products',
  'subcategories',
  'products',
  'categories',
  'suppliers',
  'export',
  'import',
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

function assertValidId(id: string, label = 'ID'): void {
  if (!isValidID(id)) {
    throw new AppError(`Invalid ${label} format`, 400);
  }
}

// ============================================
// SEARCH SCHEMA
// ============================================

const productSearchSchema = searchParamsSchema.extend({
  categoryId: z.string().optional(),
  businessUnitId: z.string().optional(),
  isActive: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  featured: z.string().optional(),
  inStock: z.string().optional(),
  minRating: z.string().optional(),
  hasVariants: z.string().optional(),
  hasBarcode: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

type ProductSearchParams = z.infer<typeof productSearchSchema>;

// ============================================
// BUSINESS UNIT RESOLUTION
// ============================================
//
// ✅ Hardened: every candidate source is validated against the
// database before being accepted. The first valid candidate wins. If
// NONE is valid, we log loudly and fall back to the most recent active
// business unit so a fresh install still works — but the fallback is
// always visible in the logs, never silent.
//
// Priority (highest to lowest):
//   1. `x-business-unit-id` header   — set by the frontend on writes
//   2. `req.body.businessUnitId`     — carried on POST/PUT bodies
//   3. `req.query.businessUnitId`    — carried on GET requests
//   4. The authenticated user's BU   — from the verified JWT
//   5. The most recent active BU     — last-resort fallback

async function getBusinessUnitId(req: Request): Promise<string> {
  const user = (req as any).user;

  const PLACEHOLDER = new Set([
    '',
    'default',
    'default-business-unit',
    'undefined',
    'null',
  ]);

  const candidates: Array<{ source: string; value: string | undefined }> = [
    {
      source: 'header:x-business-unit-id',
      value: req.headers['x-business-unit-id'] as string | undefined,
    },
    {
      source: 'body.businessUnitId',
      value:
        typeof req.body?.businessUnitId === 'string'
          ? req.body.businessUnitId
          : undefined,
    },
    {
      source: 'query.businessUnitId',
      value:
        typeof req.query?.businessUnitId === 'string'
          ? (req.query.businessUnitId as string)
          : undefined,
    },
    {
      source: 'user.businessUnitId',
      value:
        (user?.businessUnitId as string | undefined) ||
        (user?.businessUnits?.[0]?.businessUnitId as string | undefined) ||
        (user?.businessUnits?.[0]?.id as string | undefined),
    },
  ];

  for (const { source, value } of candidates) {
    if (!value) continue;
    const trimmed = String(value).trim();
    if (!trimmed || PLACEHOLDER.has(trimmed)) continue;

    const exists = await prisma.businessUnit.findUnique({
      where: { id: trimmed },
      select: { id: true, isActive: true },
    });

    if (exists && exists.isActive) {
      return exists.id;
    }

    console.warn(
      `⚠️ getBusinessUnitId: candidate from "${source}" ("${trimmed}") ` +
        `was not found or is inactive — trying next candidate`
    );
  }

  // Last resort — pick the most recent active BU. Keeps fresh
  // installs working, but logs loudly so the fallback is visible.
  const fallback = await prisma.businessUnit.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  if (fallback) {
    console.warn(
      `⚠️ getBusinessUnitId: NO valid candidate — falling back to ` +
        `"${fallback.name}" (${fallback.id}). This request may be ` +
        `targeting the wrong business unit.`
    );
    return fallback.id;
  }

  // Nothing exists — bootstrap a company + BU so the request can
  // proceed in a genuinely fresh install.
  let company = await prisma.company.findFirst();
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
    },
  });

  console.log(
    `✅ getBusinessUnitId: bootstrapped new BU "${newBusinessUnit.id}"`
  );
  return newBusinessUnit.id;
}

/**
 * Try the header/body hint first. If it's a valid BU, use it. If not,
 * fall through to the full `getBusinessUnitId` chain.
 */
async function resolveBusinessUnitHint(
  req: Request
): Promise<string | null> {
  const headerBu = req.headers['x-business-unit-id'] as string | undefined;
  const bodyBu =
    typeof req.body?.businessUnitId === 'string'
      ? req.body.businessUnitId
      : undefined;
  const hint = (headerBu || bodyBu || '').trim();

  if (!hint || hint === 'default') return null;

  const exists = await prisma.businessUnit.findUnique({
    where: { id: hint },
    select: { id: true, isActive: true },
  });

  if (exists && exists.isActive) return exists.id;

  console.warn(
    `⚠️ resolveBusinessUnitHint: hint "${hint}" was not found or is ` +
      `inactive — falling back to getBusinessUnitId(req)`
  );
  return null;
}

// ============================================
// USER / COMPANY RESOLUTION
// ============================================

function getUserId(req: Request): string {
  const user = (req as any).user;
  const userId = user?.id || user?.userId || user?.sub || user?.clerkId;

  if (!userId) {
    console.error('❌ No user ID found in request');
    throw new AppError('User authentication required', 401);
  }

  return userId;
}

function getCompanyId(req: Request): string {
  const user = (req as any).user;
  const companyId =
    user?.companyId ||
    (req.query?.companyId as string) ||
    req.body?.companyId ||
    (req.headers['x-company-id'] as string);

  if (!companyId) {
    console.warn('⚠️ No company ID found, using fallback');
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Company ID is required', 400);
    }
    return 'default-company-id';
  }

  return companyId;
}

// ============================================
// SMALL HELPERS
// ============================================

/**
 * Narrow an `unknown` catch variable into a typed Error safely.
 */
function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  try {
    return new Error(JSON.stringify(err));
  } catch {
    return new Error('Unknown error');
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

function parseIntParam(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

function parseFloatParam(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  if (value === null) return undefined;
  return value;
}

function nullToStringUndefined(
  value: string | null | undefined
): string | undefined {
  if (value === null || value === '') return undefined;
  return value;
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row: any) =>
    headers.map((h: string) => JSON.stringify(row[h] || '')).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Normalize a category input that may arrive as:
 *   - a string (id or name)
 *   - an object `{ id }`
 *   - a legacy `category_id` alias
 * Returns `undefined` for empty/sentinel values.
 */
function resolveCategoryIdInput(raw: any): string | undefined {
  if (raw === undefined || raw === null) return undefined;

  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    const id = (raw as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim() && id !== 'null' && id !== 'undefined') {
      return id.trim();
    }
    return undefined;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
      return undefined;
    }
    return trimmed;
  }

  return undefined;
}

/**
 * Sanitize the raw request body into a shape the product service
 * expects.
 */
function sanitizeProductData(data: any, businessUnitId: string): any {
  const name = data.name?.trim() || data.productName?.trim();
  if (!name) {
    throw new AppError('Product name is required', 400);
  }

  let sku = data.sku?.trim()?.toUpperCase();
  if (!sku || sku === 'SKU' || sku.trim() === '') {
    sku = productService.generateProductSKU(name);
    console.log(`✅ Auto-generated SKU: ${sku}`);
  }

  const categoryId = resolveCategoryIdInput(
    data.categoryId ?? data.category ?? data.category_id
  );

  const unitPrice = data.unitPrice ?? data.price ?? 0;
  const costPrice = data.costPrice ?? data.productCostPrice ?? unitPrice;
  const stock = data.stock ?? data.initialStock ?? 0;
  const location = (data.location || 'Warehouse').trim() || 'Warehouse';

  // ── Images ─────────────────────────────────────────
  let images: string[] = Array.isArray(data.images) ? data.images : [];
  const MAX_IMAGES = 10;
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

  if (images.length > MAX_IMAGES) {
    images = images.slice(0, MAX_IMAGES);
    console.log(`⚠️ Trimmed images to ${MAX_IMAGES}`);
  }

  if (images.length > 0) {
    images = images.filter((img: unknown) => {
      if (typeof img !== 'string') {
        console.warn('⚠️ Skipping non-string image');
        return false;
      }
      if (img.length > MAX_IMAGE_SIZE) {
        console.warn(
          `⚠️ Image too large (${Math.round(
            img.length / 1024 / 1024
          )}MB), skipping`
        );
        return false;
      }
      return true;
    });
  }

  // ── Tags ───────────────────────────────────────────
  let tags: string[] = [];
  if (Array.isArray(data.tags)) {
    tags = data.tags.filter(
      (t: unknown): t is string => typeof t === 'string' && t.trim().length > 0
    );
  } else if (typeof data.tags === 'string') {
    tags = data.tags
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);
  }

  // ── Variants ───────────────────────────────────────
  let variants: any[] = Array.isArray(data.variants) ? data.variants : [];
  variants = variants.map((variant: any, index: number) => {
    let variantImages: string[] = Array.isArray(variant.images)
      ? variant.images
      : [];

    variantImages = variantImages.filter((img: unknown) => {
      if (typeof img !== 'string') return false;
      if (img.length > MAX_IMAGE_SIZE) {
        console.warn(
          `⚠️ Variant image too large (${Math.round(
            img.length / 1024 / 1024
          )}MB), skipping`
        );
        return false;
      }
      return true;
    });

    return {
      ...variant,
      sku:
        variant.sku && variant.sku !== 'SKU'
          ? variant.sku.toUpperCase()
          : productService.generateVariantSKU(
              name,
              variant.name || `VAR${index + 1}`
            ),
      images: variantImages,
      price: variant.price ?? unitPrice,
      costPrice: variant.costPrice ?? costPrice,
      stock: variant.stock ?? 0,
      attributes: variant.attributes || {},
      isActive: variant.isActive !== undefined ? variant.isActive : true,
    };
  });

  return {
    name,
    sku,
    description: data.description?.trim() || null,
    unitPrice: Number(unitPrice),
    costPrice: Number(costPrice),
    barcode: data.barcode?.trim() || undefined,
    categoryId: categoryId ?? null,
    businessUnitId,
    isActive: data.isActive !== undefined ? data.isActive : true,
    featured: !!data.featured,
    isDigital: !!data.isDigital,
    taxRate: data.taxRate ? Number(data.taxRate) : 0,
    weight: data.weight ? Number(data.weight) : null,
    dimensions: data.dimensions || null,
    minStock: data.minStock ? Number(data.minStock) : 5,
    maxStock: data.maxStock ? Number(data.maxStock) : null,
    tags,
    images,
    stock: Number(stock),
    location,
    supplier: data.supplier?.trim() || null,
    supplierId: data.supplierId || null,
    notes: data.notes?.trim() || null,
    attributes: data.attributes || {},
    seo: data.seo || {},
    variants,
  };
}

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

// ============================================
// PRISMA ERROR HANDLER
// ============================================

/**
 * Extract a printable form of Prisma's `meta.target`.
 */
function formatPrismaTarget(target: unknown): string {
  if (!target) return 'field';
  if (typeof target === 'string') return target;
  if (Array.isArray(target)) {
    const parts = target.filter(
      (t): t is string => typeof t === 'string' && t.length > 0
    );
    return parts.length > 0 ? parts.join(', ') : 'field';
  }
  return 'field';
}

function handlePrismaError(error: unknown, res: Response) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const knownError: Prisma.PrismaClientKnownRequestError = error;

    switch (knownError.code) {
      case 'P2000':
        return res.status(400).json({
          success: false,
          message:
            'One or more values are too long for their target column.',
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

// ============================================
// PRODUCT CONTROLLER
// ============================================

export const productController = {
  // ============================================
  // PRODUCT CRUD
  // ============================================

  async getAllProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const params = productSearchSchema.parse(req.query);

      const result = await productService.getAllProducts({
        page: parseIntParam(String(params.page)),
        limit: parseIntParam(String(params.limit)),
        search: params.search || undefined,
        categoryId: params.categoryId || undefined,
        businessUnitId,
        isActive: parseBoolean(params.isActive),
        minPrice: parseFloatParam(String(params.minPrice)),
        maxPrice: parseFloatParam(String(params.maxPrice)),
        featured: parseBoolean(params.featured),
        inStock: parseBoolean(params.inStock),
        minRating: parseFloatParam(String(params.minRating)),
        hasVariants: parseBoolean(params.hasVariants),
        hasBarcode: parseBoolean(params.hasBarcode),
        sortBy: params.sortBy || 'createdAt',
        sortOrder: params.sortOrder || 'desc',
      });

      console.log(
        `📦 getAllProducts: businessUnitId="${businessUnitId}", count=${
          result?.products?.length ?? 0
        }, total=${result?.total ?? 0}`
      );

      res.json({
        success: true,
        data: result?.products || [],
        pagination: {
          total: result?.total || 0,
          page: result?.page || 1,
          totalPages: result?.totalPages || 1,
          limit: result?.limit || 10,
        },
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      console.error('❌ Error in getAllProducts:', error);
      next(error);
    }
  },

  async getPublicProducts(req: Request, res: Response, _next: NextFunction) {
    try {
      const { businessUnitId } = req.query;

      const result = await productService.getAllProducts({
        businessUnitId: businessUnitId as string,
        isPublic: true,
        page: parseIntParam(String(req.query.page)),
        limit: parseIntParam(String(req.query.limit)),
        search: req.query.search as string,
        categoryId: req.query.categoryId as string,
        minPrice: parseFloatParam(String(req.query.minPrice)),
        maxPrice: parseFloatParam(String(req.query.maxPrice)),
        featured: parseBoolean(req.query.featured as string),
        inStock: true,
        sortBy: (req.query.sortBy as string) || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      });

      res.json({
        success: true,
        data: result?.products || [],
        pagination: {
          total: result?.total || 0,
          page: result?.page || 1,
          totalPages: result?.totalPages || 1,
          limit: result?.limit || 10,
        },
      });
    } catch (err: unknown) {
      const error = toError(err);
      console.error('❌ Error in getPublicProducts:', error);
      res.json({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, totalPages: 1, limit: 10 },
      });
    }
  },

  async checkSKUExists(req: Request, res: Response, _next: NextFunction) {
    try {
      const { sku } = req.params;

      if (!sku) {
        return res.json({ success: true, data: { exists: false } });
      }

      const businessUnitId = await getBusinessUnitId(req);
      const excludeProductId = req.query.excludeProductId as string;

      if (excludeProductId && !isValidID(excludeProductId)) {
        return res.json({ success: true, data: { exists: false } });
      }

      const exists = await productService.checkSKUExists(
        sku,
        businessUnitId,
        excludeProductId
      );

      res.json({ success: true, data: { exists } });
    } catch (err: unknown) {
      const error = toError(err);
      console.warn('⚠️ SKU check error:', error);
      res.json({ success: true, data: { exists: false } });
    }
  },

  async addRecentlyViewed(req: Request, res: Response, _next: NextFunction) {
    try {
      const userId = getUserId(req);
      const { productId } = req.params;

      assertValidId(productId, 'product ID');

      const result = await productService.addRecentlyViewed(userId, productId);

      res.json({
        success: true,
        data: result || { message: 'Added to recently viewed' },
      });
    } catch (err: unknown) {
      const error = toError(err);
      console.error('❌ Error in addRecentlyViewed:', error);
      res.json({
        success: true,
        data: { message: 'Recently viewed tracking is currently unavailable' },
      });
    }
  },

  async getRecentlyViewed(req: Request, res: Response, _next: NextFunction) {
    try {
      const userId = getUserId(req);
      const { limit = 10 } = req.query;
      const limitNum = parseIntParam(String(limit)) || 10;

      const products = await productService.getRecentlyViewed(userId, limitNum);

      res.json({ success: true, data: products || [] });
    } catch (err: unknown) {
      const error = toError(err);
      console.error('❌ Error in getRecentlyViewed:', error);
      res.json({ success: true, data: [] });
    }
  },

  async clearRecentlyViewed(req: Request, res: Response, _next: NextFunction) {
    try {
      const userId = getUserId(req);
      const result = await productService.clearRecentlyViewed(userId);
      res.json({
        success: true,
        data: result || { message: 'Recently viewed cleared' },
      });
    } catch (err: unknown) {
      const error = toError(err);
      console.error('❌ Error in clearRecentlyViewed:', error);
      res.json({
        success: true,
        data: { message: 'Recently viewed cleared' },
      });
    }
  },

  async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      assertValidId(id, 'product ID');

      const product = await productService.getProductById(id);

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      res.json({
        success: true,
        data: {
          ...product,
          inventory: product.inventory,
          variants: product.variants?.map((v: any) => ({
            ...v,
            inventory: v.inventory,
          })),
        },
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getProductBySku(req: Request, res: Response, next: NextFunction) {
    try {
      const { sku } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const product = await productService.getProductBySku(sku, businessUnitId);

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      res.json({ success: true, data: product });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getProductByBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { barcode } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      const product = await productService.getProductByBarcode(
        barcode,
        businessUnitId
      );

      if (!product) {
        throw new AppError(`Product with barcode "${barcode}" not found`, 404);
      }

      res.json({ success: true, data: product });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getFeaturedProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 10, businessUnitId } = req.query;
      const limitNum = parseIntParam(String(limit)) || 10;
      const resolvedBusinessUnitId =
        (businessUnitId as string) || (await getBusinessUnitId(req));
      const products = await productService.getFeaturedProducts(
        limitNum,
        resolvedBusinessUnitId
      );
      res.json({ success: true, data: products });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getPopularProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 10, businessUnitId } = req.query;
      const limitNum = parseIntParam(String(limit)) || 10;
      const resolvedBusinessUnitId =
        (businessUnitId as string) || (await getBusinessUnitId(req));
      const products = await productService.getPopularProducts(
        limitNum,
        resolvedBusinessUnitId
      );
      res.json({ success: true, data: products });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getNewArrivals(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 10, businessUnitId } = req.query;
      const limitNum = parseIntParam(String(limit)) || 10;
      const resolvedBusinessUnitId =
        (businessUnitId as string) || (await getBusinessUnitId(req));
      const products = await productService.getNewArrivals(
        limitNum,
        resolvedBusinessUnitId
      );
      res.json({ success: true, data: products });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getRelatedProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { limit = 4 } = req.query;

      assertValidId(id, 'product ID');

      const limitNum = parseIntParam(String(limit)) || 4;
      const products = await productService.getRelatedProducts(id, limitNum);
      res.json({ success: true, data: products });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getProductStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = req.query;
      const resolvedBusinessUnitId =
        (businessUnitId as string) || (await getBusinessUnitId(req));
      const stats = await productService.getProductStatistics(
        resolvedBusinessUnitId
      );
      res.json({ success: true, data: stats });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getProductsWithoutBarcode(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { page = 1, limit = 20 } = req.query;

      const result = await productService.getProductsWithoutBarcode({
        businessUnitId,
        page: parseIntParam(String(page)) || 1,
        limit: parseIntParam(String(limit)) || 20,
      });

      res.json({
        success: true,
        data: result?.products || [],
        pagination: {
          total: result?.total || 0,
          page: result?.page || 1,
          totalPages: result?.totalPages || 1,
          limit: result?.limit || 20,
        },
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  // ============================================
  // CREATE PRODUCT
  // ============================================
  //
  // The BU is resolved from:
  //   1. the `x-business-unit-id` header (frontend sets it explicitly)
  //   2. `body.businessUnitId`
  //   3. the full getBusinessUnitId(req) fallback chain
  //
  // After resolving, we validate the BU exists and is active BEFORE
  // building the create payload — this is what turns a stale ID into
  // an early, clear 400 instead of a Prisma FK error.

  async createProduct(req: Request, res: Response, _next: NextFunction) {
    try {
      console.log('📝 [createProduct] ========== START ==========');

      const body = req.body;

      if (!body || Object.keys(body).length === 0) {
        return res.status(400).json({
          success: false,
          message:
            'Empty request body. Please ensure Content-Type is application/json.',
        });
      }

      const name = body.name?.trim() || body.productName?.trim();

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Product name is required',
          errors: [{ field: 'name', message: 'Product name is required' }],
        });
      }

      // ── 1. Resolve the business unit ────────────────────────────
      let businessUnitId: string;
      try {
        const hint = await resolveBusinessUnitHint(req);
        businessUnitId = hint ?? (await getBusinessUnitId(req));
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Business unit ID is required',
        });
      }

      // ── 2. Confirm the BU exists and is active ──────────────────
      const bu = await prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
        select: { id: true, isActive: true },
      });
      if (!bu || !bu.isActive) {
        return res.status(400).json({
          success: false,
          message: `Business unit "${businessUnitId}" not found or inactive`,
        });
      }

      // ── 3. Resolve the acting user ──────────────────────────────
      let userId: string;
      try {
        userId = getUserId(req);
      } catch {
        userId = 'system_fallback';
        console.warn('⚠️ Using fallback user ID');
      }

      try {
        const existingUser =
          (await prisma.user.findUnique({ where: { id: userId } })) ??
          (await prisma.user.findUnique({ where: { clerkId: userId } }));
        if (existingUser) {
          userId = existingUser.id;
        }
      } catch {
        /* fall through — service will resolve */
      }

      // ── 4. Resolve category + SKU ───────────────────────────────
      const categoryId = resolveCategoryIdInput(
        body.categoryId ?? body.category ?? body.category_id
      );

      console.log(`🔍 Category ID resolved: "${categoryId ?? 'none'}"`);

      let sku =
        body.sku?.trim()?.toUpperCase() ||
        body.productSku?.trim()?.toUpperCase();
      if (!sku || sku === 'SKU' || sku.trim() === '') {
        sku = productService.generateProductSKU(name);
        console.log(`✅ Auto-generated SKU: ${sku}`);
      }

      const unitPrice = body.unitPrice ?? body.price ?? 0;
      const costPrice = body.costPrice ?? body.productCostPrice;
      const barcode = body.barcode || body.productBarcode;
      const supplierId = body.supplierId || body.supplier;
      const isActive = body.isActive !== undefined ? body.isActive : true;
      const featured = body.featured || false;
      const isDigital = body.isDigital || false;
      const taxRate = body.taxRate ? Number(body.taxRate) : undefined;
      const weight = body.weight ? Number(body.weight) : undefined;
      const minStock = body.minStock ? Number(body.minStock) : 5;
      const maxStock = body.maxStock ? Number(body.maxStock) : undefined;
      const tags = Array.isArray(body.tags) ? body.tags : [];
      const images = Array.isArray(body.images) ? body.images : [];
      const notes = body.notes?.trim();
      const seo = body.seo || {};
      const variants = Array.isArray(body.variants) ? body.variants : [];
      const inventoryId = body.inventoryId;

      const stock = body.stock ?? body.initialStock ?? 0;
      const location = (body.location || 'Warehouse').trim() || 'Warehouse';

      console.log(`📸 Images received: ${images.length} images`);
      console.log(
        `📦 Stock/initialStock resolved: ${stock}, location: ${location}`
      );

      // ── 5. From inventory: idempotent create-or-update ──────────
      //
      //    The service returns `Product & { action }`. We use the
      //    action to pick the HTTP status — no more 400 on the
      //    second save of the same inventory row.
      if (inventoryId) {
        assertValidId(inventoryId, 'inventory ID');

        const product = await productService.createProductFromInventory(
          inventoryId,
          { ...body, sku, categoryId, businessUnitId },
          userId
        );

        if (!product || !product.id) {
          console.error(
            '❌ Product creation from inventory failed - no ID returned:',
            product
          );
          return res.status(500).json({
            success: false,
            message: 'Product created but ID not returned',
          });
        }

        // Reconcile inventory for the product (and any variants).
        // Failure here is non-fatal — the product exists either way.
        try {
          await prisma.$transaction(async (tx) =>
            ensureProductInventory(tx, product.id, businessUnitId)
          );
        } catch (ensureErr) {
          console.warn(
            `⚠️ ensureProductInventory failed for ${product.id}:`,
            toError(ensureErr)
          );
        }

        // `action` is part of the service's return type now — no cast.
        const isUpdate = product.action === 'updated';

        console.log(
          `✅ [createProduct] Inventory "${inventoryId}" → product ` +
            `"${product.id}" (${product.action})`
        );
        console.log('📝 [createProduct] ========== END ==========');

        return res.status(isUpdate ? 200 : 201).json({
          success: true,
          data: product,
          message: isUpdate
            ? 'Product updated from inventory successfully'
            : 'Product created from inventory successfully',
        });
      }

      // ── 6. Fresh product (no inventoryId) ───────────────────────
      const productData: ProductCreateData = {
        name,
        sku,
        description: body.description?.trim() || null,
        unitPrice: Number(unitPrice),
        costPrice: costPrice ? Number(costPrice) : undefined,
        barcode: barcode || undefined,
        categoryId: categoryId || undefined,
        supplierId: supplierId || undefined,
        isActive,
        featured,
        isDigital,
        taxRate,
        weight,
        minStock,
        maxStock,
        tags,
        images,
        notes: notes || undefined,
        seo,
        businessUnitId,
        variants,
        stock: Number(stock),
        initialStock: Number(stock),
        location,
      };

      console.log('📦 Final product data being sent to service:', {
        ...productData,
        categoryId: productData.categoryId || 'NOT SET',
        imagesCount: productData.images?.length || 0,
        variantsCount: productData.variants?.length || 0,
        stock: productData.stock,
        location: productData.location,
      });

      const product = await productService.createProduct(productData, userId);

      if (!product || !product.id) {
        console.error('❌ Product creation failed - no ID returned:', product);
        return res.status(500).json({
          success: false,
          message: 'Product created but ID not returned',
        });
      }

      // Reconcile inventory for the product and every created variant.
      try {
        await prisma.$transaction(async (tx) => {
          await ensureProductInventory(tx, product.id, businessUnitId);

          const createdVariants = await tx.productVariant.findMany({
            where: { productId: product.id },
            select: { id: true },
          });

          for (const v of createdVariants) {
            await ensureVariantInventory(tx, v.id, businessUnitId);
          }
        });
      } catch (ensureErr) {
        console.warn(
          `⚠️ ensureProductInventory/ensureVariantInventory failed for product ${product.id}:`,
          toError(ensureErr)
        );
      }

      console.log('✅ [createProduct] Product created successfully:', product.id);
      console.log(`📸 Images stored: ${product.images?.length || 0} images`);
      console.log('📝 [createProduct] ========== END ==========');

      return res.status(201).json({
        success: true,
        data: product,
        message: 'Product created successfully',
      });
    } catch (err: unknown) {
      console.error('❌ [createProduct] Error:', err);

      const prismaResponse = handlePrismaError(err, res);
      if (prismaResponse) return prismaResponse;

      if (err instanceof z.ZodError) {
        return handleZodError(err, res);
      }

      if (err instanceof AppError) {
        return res.status(err.status || 500).json({
          success: false,
          message: err.message,
          errors: err.details || [],
        });
      }

      const message = err instanceof Error ? err.message : String(err);

      return res.status(500).json({
        success: false,
        message: message || 'An unexpected error occurred',
      });
    }
  },

  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const data = updateProductSchema.parse(req.body);

      assertValidId(id, 'product ID');

      const updateData: Record<string, unknown> = {};

      if (data.name !== undefined) updateData.name = data.name?.trim();
      if (data.description !== undefined)
        updateData.description = data.description?.trim() ?? null;
      if (data.sku !== undefined)
        updateData.sku = data.sku?.trim()?.toUpperCase();
      if (data.barcode !== undefined)
        updateData.barcode = data.barcode?.trim() ?? null;
      if (data.unitPrice !== undefined)
        updateData.unitPrice = Number(data.unitPrice);
      if (data.price !== undefined && data.unitPrice === undefined) {
        updateData.unitPrice = Number(data.price);
      }
      if (data.costPrice !== undefined)
        updateData.costPrice = Number(data.costPrice);
      if (data.taxRate !== undefined) updateData.taxRate = Number(data.taxRate);
      if (data.minStock !== undefined)
        updateData.minStock = Number(data.minStock);
      if (data.maxStock !== undefined)
        updateData.maxStock = data.maxStock === null ? null : Number(data.maxStock);
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.isDigital !== undefined) updateData.isDigital = data.isDigital;
      if (data.featured !== undefined) updateData.featured = data.featured;
      if (data.weight !== undefined)
        updateData.weight = data.weight ? Number(data.weight) : null;
      if (data.dimensions !== undefined)
        updateData.dimensions = data.dimensions;
      if (data.images !== undefined) updateData.images = data.images;
      if (data.attributes !== undefined)
        updateData.attributes = data.attributes;
      if (data.notes !== undefined) updateData.notes = data.notes?.trim() ?? null;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.seo !== undefined) updateData.seo = data.seo;

      if (data.categoryId !== undefined)
        updateData.categoryId = data.categoryId;
      if (data.category !== undefined && data.categoryId === undefined) {
        updateData.categoryId = data.category;
      }
      if (data.supplierId !== undefined)
        updateData.supplierId = data.supplierId;
      if (data.supplier !== undefined && data.supplierId === undefined) {
        updateData.supplierId = data.supplier;
      }
      if (data.location !== undefined) updateData.location = data.location;
      if (data.variants !== undefined) updateData.variants = data.variants;

      const product = await productService.updateProduct(id, updateData, userId);

      if (!product || !product.id) {
        console.error('❌ Product update failed - no ID returned:', product);
        return res.status(500).json({
          success: false,
          message: 'Product updated but ID not returned',
        });
      }

      try {
        const businessUnitId = await getBusinessUnitId(req);

        await prisma.$transaction(async (tx) => {
          await ensureProductInventory(tx, product.id, businessUnitId);

          const variants = await tx.productVariant.findMany({
            where: { productId: product.id },
            select: { id: true },
          });

          for (const v of variants) {
            await ensureVariantInventory(tx, v.id, businessUnitId);
          }
        });
      } catch (ensureErr) {
        console.warn(
          `⚠️ ensureProductInventory failed during update for ${product.id}:`,
          toError(ensureErr)
        );
      }

      res.json({
        success: true,
        data: product,
        message: 'Product updated successfully',
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { force = false } = req.query;

      assertValidId(id, 'product ID');

      console.log(`🗑️ Delete product request: ${id}, force: ${force}`);

      const result = await productService.deleteProduct(id, force === 'true');

      const isSoftDelete = result.softDeleted === true;

      res.json({
        success: true,
        message: result.message || 'Product deleted successfully',
        data: {
          ...result,
          softDeleted: isSoftDelete,
          productId: id,
          requiresAction: isSoftDelete
            ? 'Product was deactivated. It can be restored or permanently deleted with ?force=true.'
            : undefined,
        },
      });
    } catch (err: unknown) {
      const error = toError(err);
      console.error('❌ Error in deleteProduct:', error);

      const prismaResponse = handlePrismaError(error, res);
      if (prismaResponse) return prismaResponse;

      next(error);
    }
  },

  async unlinkProductFromInventory(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const { keepInventory = true } = req.body;

      assertValidId(id, 'product ID');

      const result = await productService.deleteProductFromInventory(
        id,
        keepInventory
      );

      res.json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async bulkActivateProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { productIds } = req.body;
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        throw new AppError('Product IDs array is required', 400);
      }

      const invalidIds = productIds.filter(
        (id: unknown) => typeof id !== 'string' || !isValidID(id)
      );
      if (invalidIds.length > 0) {
        throw new AppError(`Invalid ID format: ${invalidIds.join(', ')}`, 400);
      }

      const result = await productService.bulkActivateProducts(productIds);

      res.json({
        success: true,
        data: result,
        message: `Activated ${result.results?.length || 0} products, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async bulkDeactivateProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { productIds } = req.body;
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        throw new AppError('Product IDs array is required', 400);
      }

      const invalidIds = productIds.filter(
        (id: unknown) => typeof id !== 'string' || !isValidID(id)
      );
      if (invalidIds.length > 0) {
        throw new AppError(`Invalid ID format: ${invalidIds.join(', ')}`, 400);
      }

      const result = await productService.bulkDeactivateProducts(productIds);

      res.json({
        success: true,
        data: result,
        message: `Deactivated ${result.results?.length || 0} products, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async bulkUpdatePrices(req: Request, res: Response, next: NextFunction) {
    try {
      const data = bulkUpdatePricesSchema.parse(req.body);

      const invalidIds = data.updates
        .map((u: any) => u.id)
        .filter((id: unknown) => typeof id !== 'string' || !isValidID(id));
      if (invalidIds.length > 0) {
        throw new AppError(`Invalid ID format: ${invalidIds.join(', ')}`, 400);
      }

      const result = await productService.bulkUpdatePrices(data.updates);
      res.json({
        success: true,
        data: result,
        message: `Updated ${result.results?.length || 0} products, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async bulkUpdateStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { updates } = req.body;
      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        throw new AppError('Updates array is required', 400);
      }

      for (const update of updates) {
        if (!update.id) {
          throw new AppError('Each update must have an id', 400);
        }
        if (!isValidID(update.id)) {
          throw new AppError(`Invalid ID format: ${update.id}`, 400);
        }
        if (update.stock === undefined || update.stock < 0) {
          throw new AppError(
            'Each update must have a non-negative stock value',
            400
          );
        }
      }

      const result = await productService.bulkUpdateStock(updates);
      res.json({
        success: true,
        data: result,
        message: `Updated ${result.results?.length || 0} products, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async bulkCreateProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const hint = await resolveBusinessUnitHint(req);
      const businessUnitId = hint ?? (await getBusinessUnitId(req));
      const userId = getUserId(req);
      const data = bulkCreateProductsSchema.parse(req.body);

      const sanitizedProducts = data.products.map((product: any) =>
        sanitizeProductData(product, businessUnitId)
      );

      const result = await productService.bulkCreateProducts(
        sanitizedProducts,
        businessUnitId,
        userId
      );

      try {
        const created = (result?.results || []).filter((r: any) => r?.id);

        await prisma.$transaction(async (tx) => {
          for (const product of created) {
            const productId = product.id;
            await ensureProductInventory(tx, productId, businessUnitId);

            const variants = await tx.productVariant.findMany({
              where: { productId },
              select: { id: true },
            });

            for (const v of variants) {
              await ensureVariantInventory(tx, v.id, businessUnitId);
            }
          }
        });
      } catch (ensureErr) {
        console.warn(
          `⚠️ ensureInventory failed during bulkCreateProducts:`,
          toError(ensureErr)
        );
      }

      res.status(201).json({
        success: true,
        data: result,
        message: `${result.results?.length || 0} products created, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },


  async bulkDeleteProducts(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { productIds } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new AppError('Product IDs array is required', 400);
      }

      const invalidIds = productIds.filter(
        (id: unknown) => typeof id !== 'string' || !isValidID(id),
      );
      if (invalidIds.length > 0) {
        throw new AppError(
          `Invalid ID format: ${invalidIds.join(', ')}`,
          400,
        );
      }

      const results: any[] = [];
      const errors: Array<{ id: string; error: string }> = [];

      for (const id of productIds as string[]) {
        try {
          // Hard delete via the service — the caller confirmed.
          const result = await productService.deleteProduct(id, true);
          results.push({ id, ...result });
        } catch (err: unknown) {
          const error = toError(err);
          errors.push({ id, error: error.message });
        }
      }

      return res.json({
        success: errors.length === 0,
        data: { results, errors },
        message:
          errors.length === 0
            ? `${results.length} products deleted successfully`
            : `${results.length} deleted, ${errors.length} failed`,
      });
    } catch (err: unknown) {
      const error = toError(err);

      const prismaResponse = handlePrismaError(error, res);
      if (prismaResponse) return prismaResponse;

      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }

      next(error);
    }
  },

  // ============================================
  // BARCODE METHODS
  // ============================================

  async generateBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      assertValidId(id, 'product ID');

      const options = generateBarcodeSchema.parse(req.body || {});

      const result = await productService.generateBarcode(id, options);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Barcode generated successfully',
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async generateUniqueBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const options = generateBarcodeSchema.parse(req.body || {});

      const result = await productService.generateUniqueBarcode(options);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Unique barcode generated successfully',
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async getProductBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      assertValidId(id, 'product ID');

      const result = await productService.getProductBarcode(id);

      if (!result) {
        throw new AppError('No barcode found for this product', 404);
      }

      res.json({ success: true, data: result });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getBarcodeImage(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      assertValidId(id, 'product ID');

      const result = await productService.getBarcodeImage(id);

      if (!result || !result.barcodeUrl) {
        throw new AppError('No barcode image found for this product', 404);
      }

      res.json({ success: true, data: result });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getProductQRCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      assertValidId(id, 'product ID');

      const result = await productService.getProductQRCode(id);

      if (!result || !result.qrCodeUrl) {
        throw new AppError('No QR code found for this product', 404);
      }

      res.json({ success: true, data: result });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async generateBarcodeImage(req: Request, res: Response, next: NextFunction) {
    try {
      const { barcode, format } = req.body;

      if (!barcode) {
        throw new AppError('Barcode string is required', 400);
      }

      const result = await productService.generateBarcodeImage(barcode, format);

      res.json({
        success: true,
        data: result,
        message: 'Barcode image generated successfully',
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async generateQRCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { data } = req.body;

      if (!data) {
        throw new AppError('QR code data is required', 400);
      }

      const result = await productService.generateQRCode(data);

      res.json({
        success: true,
        data: result,
        message: 'QR code generated successfully',
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async associateBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      assertValidId(id, 'product ID');

      const { barcode } = associateBarcodeSchema.parse(req.body);

      const result = await productService.associateBarcode(id, barcode);

      res.json({
        success: true,
        data: result,
        message: 'Barcode associated successfully',
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async validateBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { barcode, excludeProductId } = validateBarcodeSchema.parse(
        req.body
      );

      if (excludeProductId && !isValidID(excludeProductId)) {
        throw new AppError('Invalid excludeProductId format', 400);
      }

      const result = await productService.validateBarcode(
        barcode,
        excludeProductId
      );

      res.json({ success: true, data: result });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async bulkGenerateBarcodes(req: Request, res: Response, next: NextFunction) {
    try {
      const { productIds, options } = req.body;

      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        throw new AppError('Product IDs array is required', 400);
      }

      const invalidIds = productIds.filter(
        (id: unknown) => typeof id !== 'string' || !isValidID(id)
      );
      if (invalidIds.length > 0) {
        throw new AppError(`Invalid ID format: ${invalidIds.join(', ')}`, 400);
      }

      const result = await productService.bulkGenerateBarcodes(
        productIds,
        options
      );

      res.json({
        success: true,
        data: result,
        message: `${result.results?.length || 0} barcodes generated, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async scanBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { barcode, businessUnitId } = req.body;

      if (!barcode) {
        throw new AppError('Barcode is required', 400);
      }

      const resolvedBusinessUnitId =
        businessUnitId || (await getBusinessUnitId(req));
      const result = await productService.scanBarcode(
        barcode,
        resolvedBusinessUnitId
      );

      res.json({ success: true, data: result });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  // ============================================
  // VARIANT METHODS
  // ============================================

  async addVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      assertValidId(id, 'product ID');

      const data = createVariantSchema.parse(req.body);

      if (!data.images) {
        data.images = [];
      }

      const variant = await productService.addVariant(id, data);

      if (variant && (variant as any).id) {
        try {
          await prisma.$transaction(async (tx) =>
            ensureVariantInventory(tx, (variant as any).id, businessUnitId)
          );
        } catch (ensureErr) {
          console.warn(
            `⚠️ ensureVariantInventory failed for ${(variant as any).id}:`,
            toError(ensureErr)
          );
        }
      }

      res.status(201).json({
        success: true,
        data: variant,
        message: 'Variant added successfully',
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async bulkCreateVariants(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      assertValidId(id, 'product ID');

      const data = bulkCreateVariantsSchema.parse(req.body);

      if (data.variants) {
        data.variants = data.variants.map((v: any) => ({
          ...v,
          images: v.images || [],
        }));
      }

      const result = await productService.bulkCreateVariants(id, data.variants);

      try {
        const createdIds: string[] = (result?.results || [])
          .map((r: any) => r?.id || r?.data?.id)
          .filter((x: any): x is string => typeof x === 'string');

        if (createdIds.length > 0) {
          await prisma.$transaction(async (tx) => {
            for (const variantId of createdIds) {
              await ensureVariantInventory(tx, variantId, businessUnitId);
            }
          });
        }
      } catch (ensureErr) {
        console.warn(
          `⚠️ ensureVariantInventory failed during bulkCreateVariants:`,
          toError(ensureErr)
        );
      }

      res.status(201).json({
        success: true,
        data: result,
        message: `${result.results?.length || 0} variants created, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async getProductVariants(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      assertValidId(id, 'product ID');

      const variants = await productService.getProductVariants(id);
      res.json({ success: true, data: variants });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getVariantById(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId } = req.params;

      assertValidId(variantId, 'variant ID');

      const variant = await productService.getVariantById(variantId);
      res.json({ success: true, data: variant });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getVariantByBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { barcode } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const variant = await productService.getVariantByBarcode(
        barcode,
        businessUnitId
      );
      res.json({ success: true, data: variant });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getVariantBySku(req: Request, res: Response, next: NextFunction) {
    try {
      const { sku } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const variant = await productService.getVariantBySku(sku, businessUnitId);
      res.json({ success: true, data: variant });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async updateVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId } = req.params;

      assertValidId(variantId, 'variant ID');

      const data = updateVariantSchema.parse(req.body);
      const variant = await productService.updateVariant(variantId, data);

      res.json({
        success: true,
        data: variant,
        message: 'Variant updated successfully',
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async deleteVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId } = req.params;

      assertValidId(variantId, 'variant ID');

      const result = await productService.deleteVariant(variantId);

      const isSoftDelete =
        result && typeof result === 'object' && 'message' in result;
      const message = isSoftDelete
        ? (result as any).message
        : 'Variant deleted successfully';

      res.json({
        success: true,
        message,
        data: result,
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async bulkDeleteVariants(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantIds } = req.body;
      if (!variantIds || !Array.isArray(variantIds) || variantIds.length === 0) {
        throw new AppError('Variant IDs array is required', 400);
      }

      const invalidIds = variantIds.filter(
        (id: unknown) => typeof id !== 'string' || !isValidID(id)
      );
      if (invalidIds.length > 0) {
        throw new AppError(`Invalid ID format: ${invalidIds.join(', ')}`, 400);
      }

      const result = await productService.bulkDeleteVariants(variantIds);

      res.json({
        success: true,
        data: result,
        message: `${result.results?.length || 0} variants deleted, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async updateVariantStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId } = req.params;
      const { quantity, note } = req.body;
      const userId = getUserId(req);

      assertValidId(variantId, 'variant ID');

      if (quantity === undefined || quantity < 0) {
        throw new AppError('Valid stock quantity is required', 400);
      }

      const variant = await productService.updateVariantStock(
        variantId,
        Number(quantity),
        userId,
        note
      );

      res.json({
        success: true,
        data: variant,
        message: `Variant stock updated to ${quantity}`,
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  // ============================================
  // CATEGORY METHODS
  // ============================================

  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const categories = await productService.getCategories(businessUnitId);
      res.json({ success: true, data: categories || [] });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getCategoryTree(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const tree = await productService.getCategoryTree(businessUnitId);
      res.json({ success: true, data: tree || [] });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      assertValidId(id, 'category ID');

      const category = await productService.getCategoryById(id, businessUnitId);
      res.json({ success: true, data: category });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getCategoryProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;

      assertValidId(id, 'category ID');

      const result = await productService.getCategoryProducts(id, {
        page: parseIntParam(String(page)),
        limit: parseIntParam(String(limit)),
      });
      res.json({
        success: true,
        data: result?.products || [],
        pagination: {
          total: result?.total || 0,
          page: result?.page || 1,
          totalPages: result?.totalPages || 1,
          limit: result?.limit || 10,
        },
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const userId = getUserId(req);
      const data = createCategorySchema.parse(req.body);

      const categoryData = {
        name: data.name,
        description: nullToUndefined(data.description),
        parentId: nullToUndefined(data.parentId),
        businessUnitId,
        userId,
        isActive: data.isActive ?? true,
        featured: data.featured ?? false,
      };

      const category = await productService.createCategory(categoryData);

      res.status(201).json({
        success: true,
        data: category,
        message: 'Category created successfully',
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      assertValidId(id, 'category ID');

      const data = updateCategorySchema.parse(req.body);

      const categoryData: {
        name?: string;
        description?: string;
        parentId?: string;
        featured?: boolean;
        isActive?: boolean;
      } = {};

      if (data.name !== undefined) categoryData.name = data.name;
      if (data.description !== undefined)
        categoryData.description = nullToUndefined(data.description);
      if (data.parentId !== undefined)
        categoryData.parentId = nullToUndefined(data.parentId);
      if (data.isActive !== undefined) categoryData.isActive = data.isActive;
      if (data.featured !== undefined) categoryData.featured = data.featured;

      const category = await productService.updateCategory(id, categoryData);

      res.json({
        success: true,
        data: category,
        message: 'Category updated successfully',
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      assertValidId(id, 'category ID');

      await productService.deleteCategory(id, businessUnitId);
      res.json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  // ============================================
  // SUPPLIER METHODS
  // ============================================

  async getSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const suppliers = await productService.getSuppliers(companyId);
      res.json({ success: true, data: suppliers || [] });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getSupplierById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const companyId = getCompanyId(req);

      assertValidId(id, 'supplier ID');

      const supplier = await productService.getSupplierById(id, companyId);
      res.json({ success: true, data: supplier });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getSupplierProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;

      assertValidId(id, 'supplier ID');

      const result = await productService.getSupplierProducts(id, {
        page: parseIntParam(String(page)),
        limit: parseIntParam(String(limit)),
      });
      res.json({
        success: true,
        data: result?.products || [],
        pagination: {
          total: result?.total || 0,
          page: result?.page || 1,
          totalPages: result?.totalPages || 1,
          limit: result?.limit || 10,
        },
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async createSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const data = createSupplierSchema.parse(req.body);

      const supplier = await productService.createSupplier({
        name: data.name,
        contactPerson: data.contactPerson || '',
        email: data.email || '',
        phone: data.phone || '',
        address: nullToStringUndefined(data.address),
        taxId: nullToStringUndefined(data.taxId),
        notes: nullToStringUndefined(data.notes),
        isActive: data.isActive !== undefined ? data.isActive : true,
        companyId,
        userId,
      });

      res.status(201).json({
        success: true,
        data: supplier,
        message: 'Supplier created successfully',
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async updateSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      assertValidId(id, 'supplier ID');

      const data = updateSupplierSchema.parse(req.body);

      const supplier = await productService.updateSupplier(id, data);

      res.json({
        success: true,
        data: supplier,
        message: 'Supplier updated successfully',
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async deleteSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const companyId = getCompanyId(req);

      assertValidId(id, 'supplier ID');

      await productService.deleteSupplier(id, companyId);
      res.json({
        success: true,
        message: 'Supplier deleted successfully',
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  // ============================================
  // REVIEW METHODS
  // ============================================

  async getProductReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10 } = req.query;

      assertValidId(id, 'product ID');

      const result = await productService.getProductReviews(id, {
        page: parseIntParam(String(page)) || 1,
        limit: parseIntParam(String(limit)) || 10,
      });

      res.json({
        success: true,
        data: result?.reviews || [],
        stats: result?.stats || {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
        pagination: result?.pagination || {
          total: 0,
          page: 1,
          totalPages: 1,
          limit: 10,
        },
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getReviewStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      assertValidId(id, 'product ID');

      const stats = await productService.getReviewStats(id);
      res.json({
        success: true,
        data: stats || {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async exportProductReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { format = 'csv' } = req.query;

      assertValidId(id, 'product ID');

      const result = await productService.getProductReviews(id, {
        limit: 1000,
      });
      const reviews = result?.reviews || [];

      const exportData = reviews.map((review: any) => ({
        User: review.user
          ? `${review.user.firstName || ''} ${
              review.user.lastName || ''
            }`.trim() || 'Anonymous'
          : 'Anonymous',
        Rating: review.rating || 0,
        Title: review.title || '',
        Comment: review.comment || '',
        Verified: review.isVerified ? 'Yes' : 'No',
        'Helpful Count': review.helpfulCount || 0,
        Date: review.createdAt
          ? new Date(review.createdAt).toLocaleDateString()
          : '',
      }));

      if (format === 'csv') {
        const csv = convertToCSV(exportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=reviews_${id}.csv`
        );
        return res.send(csv);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=reviews_${id}.json`
      );
      res.json(exportData);
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async createProductReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const data = createProductReviewSchema.parse(req.body);

      assertValidId(id, 'product ID');

      const review = await productService.createProductReview({
        ...data,
        productId: id,
        userId,
      });

      res.status(201).json({
        success: true,
        data: review,
        message: 'Review added successfully',
      });
    } catch (err: unknown) {
      const error = toError(err);
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      next(error);
    }
  },

  async updateProductReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewId } = req.params;
      const userId = getUserId(req);
      const data = req.body;

      assertValidId(reviewId, 'review ID');

      const review = await productService.updateProductReview(
        reviewId,
        data,
        userId
      );

      res.json({
        success: true,
        data: review,
        message: 'Review updated successfully',
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async deleteProductReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewId } = req.params;
      const userId = getUserId(req);

      assertValidId(reviewId, 'review ID');

      await productService.deleteProductReview(reviewId, userId);
      res.json({
        success: true,
        message: 'Review deleted successfully',
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async verifyReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewId } = req.params;

      assertValidId(reviewId, 'review ID');

      const review = await productService.verifyReview(reviewId);
      res.json({
        success: true,
        data: review,
        message: 'Review verified successfully',
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async markReviewHelpful(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewId } = req.params;
      const userId = getUserId(req);

      assertValidId(reviewId, 'review ID');

      const result = await productService.markReviewHelpful(reviewId, userId);
      res.json({
        success: true,
        data: result,
        message: result?.helpful ? 'Marked as helpful' : 'Removed helpful vote',
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async reportReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewId } = req.params;
      const userId = getUserId(req);
      const { reason } = req.body;

      assertValidId(reviewId, 'review ID');

      if (!reason) {
        throw new AppError('Reason is required', 400);
      }

      const result = await productService.reportReview(
        reviewId,
        reason,
        userId
      );

      res.json({
        success: true,
        data: result,
        message: 'Review reported successfully',
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  // ============================================
  // TAG & SEARCH
  // ============================================

  async getTags(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);

      const result = await productService.getAllProducts({
        businessUnitId,
        limit: 1000,
        isActive: true,
      });

      const tagSet = new Map<string, number>();
      const products = result?.products || [];

      for (const product of products) {
        const productWithTags = product as any;
        if (productWithTags.tags && Array.isArray(productWithTags.tags)) {
          for (const tag of productWithTags.tags) {
            tagSet.set(tag, (tagSet.get(tag) || 0) + 1);
          }
        }
      }

      const tags = Array.from(tagSet.entries()).map(([name, count]) => ({
        name,
        count,
      }));

      res.json({
        success: true,
        data: tags.sort((a, b) => b.count - a.count),
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async searchProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { query, category } = req.query;

      if (!query) {
        throw new AppError('Search query is required', 400);
      }

      const products = await productService.searchProducts({
        query: query as string,
        category: category as string,
        businessUnitId,
      });

      res.json({ success: true, data: products || [] });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  // ============================================
  // WISHLIST
  // ============================================

  async toggleWishlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const { productId } = req.params;

      assertValidId(productId, 'product ID');

      const result = await productService.toggleWishlist(userId, productId);
      res.json({
        success: true,
        data: result || { added: false, message: 'Operation completed' },
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getWishlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const { page = 1, limit = 20 } = req.query;
      const result = await productService.getWishlist(userId, {
        page: parseIntParam(String(page)) || 1,
        limit: parseIntParam(String(limit)) || 20,
      });
      res.json({
        success: true,
        data: result?.products || [],
        pagination: {
          total: result?.total || 0,
          page: result?.page || 1,
          totalPages: result?.totalPages || 1,
          limit: result?.limit || 20,
        },
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async checkWishlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const { productId } = req.params;

      assertValidId(productId, 'product ID');

      const isInWishlist = await productService.checkWishlist(
        userId,
        productId
      );
      res.json({ success: true, data: isInWishlist || false });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getWishlistCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const count = await productService.getWishlistCount(userId);
      res.json({ success: true, data: count || 0 });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async getWishlistProductIds(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const ids = await productService.getWishlistProductIds(userId);
      res.json({ success: true, data: ids || [] });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async clearWishlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const result = await productService.clearWishlist(userId);
      res.json({
        success: true,
        data: result || { message: 'Wishlist cleared' },
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  // ============================================
  // COMPARE
  // ============================================

  async compareProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { productIds } = req.body;
      if (!productIds || !Array.isArray(productIds) || productIds.length < 2) {
        throw new AppError('At least 2 product IDs are required', 400);
      }

      const invalidIds = productIds.filter(
        (id: unknown) => typeof id !== 'string' || !isValidID(id)
      );
      if (invalidIds.length > 0) {
        throw new AppError(`Invalid ID format: ${invalidIds.join(', ')}`, 400);
      }

      const products = await productService.compareProducts(productIds);
      res.json({ success: true, data: products || [] });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  // ============================================
  // EXPORT / IMPORT
  // ============================================

  async exportProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { format = 'csv' } = req.query;
      const formatStr = (format as string) || 'csv';

      const result = await productService.getAllProducts({
        businessUnitId,
        limit: 10000,
      });

      const products = result?.products || [];

      if (formatStr === 'csv') {
        const exportData = products.map((product: any) => ({
          ID: product.id || '',
          Name: product.name || '',
          SKU: product.sku || '',
          Barcode: product.barcode || '',
          'Unit Price': product.unitPrice || 0,
          'Cost Price': product.costPrice || 0,
          Category: product.category?.name || '',
          Supplier: product.supplier?.name || '',
          Stock: product.inventory?.quantity || 0,
          Variants: product.variants?.length || 0,
          Status: product.isActive ? 'Active' : 'Inactive',
          'Created At': product.createdAt
            ? new Date(product.createdAt).toLocaleDateString()
            : '',
        }));

        const csv = convertToCSV(exportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=products_${Date.now()}.csv`
        );
        return res.send(csv);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=products_${Date.now()}.json`
      );
      res.json({
        success: true,
        data: products,
        total: products.length,
        exportedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async importProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const userId = getUserId(req);

      res.json({
        success: true,
        message: 'Products imported successfully',
        data: {
          businessUnitId,
          userId,
          imported: 0,
          failed: 0,
          total: 0,
        },
      });
    } catch (err: unknown) {
      next(toError(err));
    }
  },

  async downloadImportTemplate(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const templateHeaders = [
        'Name',
        'SKU',
        'Barcode',
        'Description',
        'Unit Price',
        'Cost Price',
        'Category',
        'Supplier',
        'Min Stock',
        'Max Stock',
        'Weight (kg)',
        'Tax Rate (%)',
        'Status (Active/Inactive)',
        'Digital (Yes/No)',
        'Featured (Yes/No)',
        'Tags (comma separated)',
      ];

      const csv = convertToCSV([templateHeaders]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=product_import_template.csv`
      );
      return res.send(csv);
    } catch (err: unknown) {
      next(toError(err));
    }
  },

    // ─────────────────────────────────────────────────────────
  // PUBLIC: single product by id
  // ─────────────────────────────────────────────────────────
  async getPublicProductById(
    req: Request,
    res: Response,
    _next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      assertValidId(id, 'product ID');

      const product = await productService.getProductById(id);

      // Anonymous callers only see active, non-deleted products.
      if (!product || !product.isActive || product.deletedAt) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      res.json({ success: true, data: product });
    } catch (err: unknown) {
      const error = toError(err);
      if (error.message.toLowerCase().includes('not found')) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }
      console.error('❌ Error in getPublicProductById:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load product',
      });
    }
  },

  // ─────────────────────────────────────────────────────────
  // PUBLIC: categories
  // ─────────────────────────────────────────────────────────
  async getPublicCategories(
    req: Request,
    res: Response,
    _next: NextFunction,
  ) {
    try {
      const requested = req.query.businessUnitId as string | undefined;
      let businessUnitId: string | undefined;

      if (requested) {
        const exists = await prisma.businessUnit.findUnique({
          where: { id: requested },
          select: { id: true, isActive: true },
        });
        if (exists && exists.isActive) businessUnitId = exists.id;
      }
      if (!businessUnitId) businessUnitId = await getBusinessUnitId(req);

      const categories = await productService.getCategories(businessUnitId);

      // Anonymous callers only see active categories.
      const visible = (categories || []).filter(
        (c: any) => c?.isActive !== false,
      );

      res.json({ success: true, data: visible });
    } catch (err: unknown) {
      const error = toError(err);
      console.error('❌ Error in getPublicCategories:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load categories',
        data: [],
      });
    }
  },

  // ─────────────────────────────────────────────────────────
  // PUBLIC: featured
  // ─────────────────────────────────────────────────────────
  async getPublicFeatured(
    req: Request,
    res: Response,
    _next: NextFunction,
  ) {
    try {
      const limit = parseIntParam(String(req.query.limit)) || 10;
      const businessUnitId =
        (req.query.businessUnitId as string) ||
        (await getBusinessUnitId(req));

      const products = await productService.getFeaturedProducts(
        limit,
        businessUnitId,
      );

      res.json({
        success: true,
        data: (products || []).filter(
          (p: any) => p.isActive && !p.deletedAt,
        ),
      });
    } catch (err: unknown) {
      const error = toError(err);
      console.error('❌ Error in getPublicFeatured:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load featured products',
        data: [],
      });
    }
  },

  // ─────────────────────────────────────────────────────────
  // PUBLIC: new arrivals
  // ─────────────────────────────────────────────────────────
  async getPublicNewArrivals(
    req: Request,
    res: Response,
    _next: NextFunction,
  ) {
    try {
      const limit = parseIntParam(String(req.query.limit)) || 10;
      const businessUnitId =
        (req.query.businessUnitId as string) ||
        (await getBusinessUnitId(req));

      const products = await productService.getNewArrivals(
        limit,
        businessUnitId,
      );

      res.json({
        success: true,
        data: (products || []).filter(
          (p: any) => p.isActive && !p.deletedAt,
        ),
      });
    } catch (err: unknown) {
      const error = toError(err);
      console.error('❌ Error in getPublicNewArrivals:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load new arrivals',
        data: [],
      });
    }
  },

  // ─────────────────────────────────────────────────────────
  // PUBLIC: search
  // ─────────────────────────────────────────────────────────
  async getPublicSearch(
    req: Request,
    res: Response,
    _next: NextFunction,
  ) {
    try {
      const query = (req.query.query as string)?.trim();
      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required',
        });
      }

      const businessUnitId =
        (req.query.businessUnitId as string) ||
        (await getBusinessUnitId(req));

      const products = await productService.searchProducts({
        query,
        category: req.query.category as string | undefined,
        businessUnitId,
      });

      res.json({
        success: true,
        data: (products || []).filter(
          (p: any) => p.isActive && !p.deletedAt,
        ),
      });
    } catch (err: unknown) {
      const error = toError(err);
      console.error('❌ Error in getPublicSearch:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search products',
        data: [],
      });
    }
  },

  // ─────────────────────────────────────────────────────────
  // PUBLIC: products in a category
  // ─────────────────────────────────────────────────────────
  async getPublicCategoryProducts(
    req: Request,
    res: Response,
    _next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      assertValidId(id, 'category ID');

      const result = await productService.getCategoryProducts(id, {
        page: parseIntParam(String(req.query.page)),
        limit: parseIntParam(String(req.query.limit)),
      });

      const visible = (result?.products || []).filter(
        (p: any) => p.isActive && !p.deletedAt,
      );

      res.json({
        success: true,
        data: visible,
        pagination: {
          total: visible.length,
          page: result?.page || 1,
          totalPages: result?.totalPages || 1,
          limit: result?.limit || 10,
        },
      });
    } catch (err: unknown) {
      const error = toError(err);
      console.error('❌ Error in getPublicCategoryProducts:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load category products',
        data: [],
        pagination: { total: 0, page: 1, totalPages: 1, limit: 10 },
      });
    }
  },
};

export default productController;
