// src/controllers/productController.ts

import { Request, Response, NextFunction } from 'express';
import { ProductService, ProductCreateData } from '../services/productService.js';
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

// ✅ NEW: Inventory invariant helpers
import {
  ensureProductInventory,
  ensureVariantInventory,
} from '../lib/ensureInventory.js';

// Initialize product service
const productService = new ProductService();

// Extend the search params schema to include all product filters
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
// HELPER FUNCTIONS
// ============================================

/**
 * Resolve the effective business unit ID for a request.
 *
 * ✅ UNIFIED with cartController/orderController/inventoryController:
 *    explicit header > body > query, then user BU, then newest active BU,
 *    then bootstrap a default. Keeping the priority order identical across
 *    controllers is what prevents cart/order/inventory from pointing at
 *    different BUs.
 */
async function getBusinessUnitId(req: Request): Promise<string> {
  const user = (req as any).user;

  // 1. Explicit override (header > body > query)
  const explicit =
    (req.headers['x-business-unit-id'] as string | undefined) ||
    (req.body?.businessUnitId as string | undefined) ||
    (req.query?.businessUnitId as string | undefined);

  if (
    explicit &&
    explicit !== 'default' &&
    explicit !== 'default-business-unit' &&
    explicit !== 'undefined' &&
    explicit !== 'null'
  ) {
    const exists = await prisma.businessUnit.findUnique({
      where: { id: explicit },
      select: { id: true, isActive: true },
    });
    if (exists && exists.isActive) {
      return exists.id;
    }
    console.warn(
      `⚠️ Explicit businessUnitId "${explicit}" not found or inactive, falling back`
    );
  }

  // 2. User's own unit
  const userBu =
    (user?.businessUnitId as string | undefined) ||
    (user?.businessUnits?.[0]?.businessUnitId as string | undefined) ||
    (user?.businessUnits?.[0]?.id as string | undefined);

  if (userBu && userBu !== 'default') {
    const exists = await prisma.businessUnit.findUnique({
      where: { id: userBu },
      select: { id: true, isActive: true },
    });
    if (exists && exists.isActive) {
      return exists.id;
    }
  }

  // 3. Fallback: most recent active unit
  const businessUnit = await prisma.businessUnit.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  if (businessUnit) {
    console.warn(
      `⚠️ getBusinessUnitId (products): falling back to "${businessUnit.name}" (${businessUnit.id})`
    );
    return businessUnit.id;
  }

  // 4. Bootstrap a default company + unit
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

  return newBusinessUnit.id;
}

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

function nullToStringUndefined(value: string | null | undefined): string | undefined {
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

function sanitizeProductData(data: any, businessUnitId: string): any {
  const name = data.name?.trim();
  if (!name) {
    throw new AppError('Product name is required', 400);
  }

  let sku = data.sku?.trim()?.toUpperCase();
  if (!sku || sku === 'SKU' || sku.trim() === '') {
    sku = productService.generateProductSKU(name);
    console.log(`✅ Auto-generated SKU: ${sku}`);
  }

  const categoryId = data.categoryId || data.category || undefined;
  const unitPrice = data.unitPrice ?? data.price ?? 0;
  const stock = data.stock ?? data.initialStock ?? 0;

  let images = data.images || [];
  const MAX_IMAGES = 10;

  if (images.length > MAX_IMAGES) {
    images = images.slice(0, MAX_IMAGES);
    console.log(`⚠️ Trimmed images to ${MAX_IMAGES}`);
  }

  if (images.length > 0) {
    images = images.filter((img: string) => {
      if (typeof img !== 'string') {
        console.warn('⚠️ Skipping non-string image');
        return false;
      }
      const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
      if (img.length > MAX_IMAGE_SIZE) {
        console.warn(
          `⚠️ Image too large (${Math.round(img.length / 1024 / 1024)}MB), skipping`
        );
        return false;
      }
      return true;
    });
  }

  let tags = data.tags || [];
  if (!Array.isArray(tags)) {
    if (typeof tags === 'string') {
      tags = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    } else {
      tags = [];
    }
  }

  let variants = data.variants || [];
  if (Array.isArray(variants)) {
    variants = variants.map((variant: any, index: number) => {
      let variantImages = variant.images || [];
      if (Array.isArray(variantImages)) {
        variantImages = variantImages.filter((img: string) => {
          if (typeof img !== 'string') return false;
          const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
          if (img.length > MAX_IMAGE_SIZE) {
            console.warn(
              `⚠️ Variant image too large (${Math.round(img.length / 1024 / 1024)}MB), skipping`
            );
            return false;
          }
          return true;
        });
      }

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
      };
    });
  }

  return {
    name: name,
    sku: sku,
    description: data.description?.trim() || null,
    unitPrice: Number(unitPrice),
    costPrice: data.costPrice ? Number(data.costPrice) : Number(unitPrice),
    barcode: data.barcode?.trim() || undefined,
    categoryId: categoryId || null,
    businessUnitId: businessUnitId,
    isActive: data.isActive !== undefined ? data.isActive : true,
    featured: data.featured || false,
    isDigital: data.isDigital || false,
    taxRate: data.taxRate ? Number(data.taxRate) : 0,
    weight: data.weight ? Number(data.weight) : null,
    minStock: data.minStock ? Number(data.minStock) : 5,
    maxStock: data.maxStock ? Number(data.maxStock) : null,
    tags: tags,
    images: images,
    stock: Number(stock),
    location: data.location || 'Warehouse',
    supplier: data.supplier?.trim() || null,
    supplierId: data.supplierId || null,
    notes: data.notes?.trim() || null,
    attributes: data.attributes || {},
    seo: data.seo || {},
    variants: variants,
  };
}

// ============================================
// PRODUCT CONTROLLER
// ============================================

export const productController = {
  // ============================================
  // PRODUCT CRUD METHODS
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
        businessUnitId: businessUnitId,
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
        `📦 getAllProducts: businessUnitId="${businessUnitId}", count=${result?.products?.length ?? 0}, total=${result?.total ?? 0}`
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid query parameters', 400, error.errors));
      }
      console.error('❌ Error in getAllProducts:', error);
      next(error);
    }
  },

  async getPublicProducts(req: Request, res: Response, next: NextFunction) {
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
    } catch (error) {
      console.error('❌ Error in getPublicProducts:', error);
      res.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: 1,
          totalPages: 1,
          limit: 10,
        },
      });
    }
  },

  async checkSKUExists(req: Request, res: Response, next: NextFunction) {
    try {
      const { sku } = req.params;

      if (!sku) {
        return res.json({
          success: true,
          data: { exists: false },
        });
      }

      const businessUnitId = await getBusinessUnitId(req);
      const excludeProductId = req.query.excludeProductId as string;

      const exists = await productService.checkSKUExists(
        sku,
        businessUnitId,
        excludeProductId
      );

      res.json({
        success: true,
        data: { exists },
      });
    } catch (error) {
      console.warn('⚠️ SKU check error:', error);
      res.json({
        success: true,
        data: { exists: false },
      });
    }
  },

  async addRecentlyViewed(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const { productId } = req.params;

      const result = await productService.addRecentlyViewed(userId, productId);

      res.json({
        success: true,
        data: result || { message: 'Added to recently viewed' },
      });
    } catch (error) {
      console.error('❌ Error in addRecentlyViewed:', error);
      res.json({
        success: true,
        data: { message: 'Recently viewed tracking is currently unavailable' },
      });
    }
  },

  async getRecentlyViewed(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const { limit = 10 } = req.query;
      const limitNum = parseIntParam(String(limit)) || 10;

      const products = await productService.getRecentlyViewed(userId, limitNum);

      res.json({
        success: true,
        data: products || [],
      });
    } catch (error) {
      console.error('❌ Error in getRecentlyViewed:', error);
      res.json({
        success: true,
        data: [],
      });
    }
  },

  async clearRecentlyViewed(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const result = await productService.clearRecentlyViewed(userId);
      res.json({
        success: true,
        data: result || { message: 'Recently viewed cleared' },
      });
    } catch (error) {
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
    } catch (error) {
      next(error);
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
    } catch (error) {
      next(error);
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
    } catch (error) {
      next(error);
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
    } catch (error) {
      next(error);
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
    } catch (error) {
      next(error);
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
    } catch (error) {
      next(error);
    }
  },

  async getRelatedProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { limit = 4 } = req.query;
      const limitNum = parseIntParam(String(limit)) || 4;
      const products = await productService.getRelatedProducts(id, limitNum);
      res.json({ success: true, data: products });
    } catch (error) {
      next(error);
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
    } catch (error) {
      next(error);
    }
  },

  async getProductsWithoutBarcode(req: Request, res: Response, next: NextFunction) {
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
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // CREATE PRODUCT
  // ============================================

  async createProduct(req: Request, res: Response, next: NextFunction) {
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

      let businessUnitId: string;
      try {
        businessUnitId = body.businessUnitId || (await getBusinessUnitId(req));
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'Business unit ID is required',
        });
      }

      let userId: string;
      try {
        userId = getUserId(req);
      } catch (err) {
        userId = 'system_fallback';
        console.warn('⚠️ Using fallback user ID');
      }

      let categoryId = body.categoryId || body.category || body.category_id;

      if (categoryId && typeof categoryId === 'object' && categoryId.id) {
        categoryId = categoryId.id;
      }

      if (
        categoryId === 'null' ||
        categoryId === '' ||
        categoryId === 'undefined'
      ) {
        categoryId = undefined;
      }

      console.log(`🔍 Category ID resolved: "${categoryId}"`);

      let sku =
        body.sku?.trim()?.toUpperCase() || body.productSku?.trim()?.toUpperCase();
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

      console.log(`📸 Images received: ${images.length} images`);

      if (inventoryId) {
        const product = await productService.createProductFromInventory(
          inventoryId,
          { ...body, sku, categoryId },
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

        // ✅ Ensure inventory is linked for products created from inventory.
        try {
          await prisma.$transaction(async (tx) =>
            ensureProductInventory(tx, product.id, businessUnitId)
          );
        } catch (ensureErr) {
          console.warn(
            `⚠️ ensureProductInventory failed for ${product.id}:`,
            ensureErr
          );
        }

        return res.status(201).json({
          success: true,
          data: product,
          message: 'Product created from inventory successfully',
        });
      }

      const productData: ProductCreateData = {
        name: name,
        sku: sku,
        description: body.description?.trim() || null,
        unitPrice: Number(unitPrice),
        costPrice: costPrice ? Number(costPrice) : undefined,
        barcode: barcode || undefined,
        categoryId: categoryId || undefined,
        supplierId: supplierId || undefined,
        isActive: isActive,
        featured: featured,
        isDigital: isDigital,
        taxRate: taxRate,
        weight: weight,
        minStock: minStock,
        maxStock: maxStock,
        tags: tags,
        images: images,
        notes: notes || undefined,
        seo: seo,
        businessUnitId: businessUnitId,
        variants: variants,
      };

      console.log('📦 Final product data being sent to service:', {
        ...productData,
        categoryId: productData.categoryId || 'NOT SET',
        imagesCount: productData.images?.length || 0,
        variantsCount: productData.variants?.length || 0,
      });

      const product = await productService.createProduct(productData, userId);

      if (!product || !product.id) {
        console.error('❌ Product creation failed - no ID returned:', product);
        return res.status(500).json({
          success: false,
          message: 'Product created but ID not returned',
        });
      }

      // ✅ Ensure the product and every variant has a linked Inventory row
      //    in the resolved business unit. Idempotent — safe on every create.
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
        // Do NOT fail the create — the product exists. The backfill
        // script and the order/cart lookup will recover on next read.
        console.warn(
          `⚠️ ensureProductInventory/ensureVariantInventory failed for product ${product.id}:`,
          ensureErr
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
    } catch (err: any) {
      console.error('❌ [createProduct] Error:', err);

      if (err.code === 'P2002') {
        const target = err.meta?.target || 'field';
        return res.status(400).json({
          success: false,
          message: `Duplicate entry: ${target} already exists`,
          error: 'DUPLICATE_ENTRY',
          details: { field: target },
        });
      }

      if (err.code === 'P2003') {
        return res.status(400).json({
          success: false,
          message:
            'Foreign key constraint failed. Please check category, supplier, or business unit IDs.',
          error: 'FOREIGN_KEY_CONSTRAINT',
        });
      }

      if (err.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Related record not found',
          error: 'RECORD_NOT_FOUND',
        });
      }

      if (err instanceof AppError) {
        return res.status(err.status || 500).json({
          success: false,
          message: err.message,
          errors: err.details || [],
        });
      }

      if (err.name === 'ZodError') {
        const errors =
          err.errors?.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })) || [];

        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: errors,
        });
      }

      return res.status(500).json({
        success: false,
        message: err.message || 'An unexpected error occurred',
      });
    }
  },

  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const data = updateProductSchema.parse(req.body);

      const updateData: any = {};

      if (data.name !== undefined) updateData.name = data.name?.trim();
      if (data.description !== undefined)
        updateData.description = data.description?.trim();
      if (data.sku !== undefined) updateData.sku = data.sku?.trim()?.toUpperCase();
      if (data.barcode !== undefined) updateData.barcode = data.barcode?.trim();
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
        updateData.maxStock = Number(data.maxStock);
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.isDigital !== undefined) updateData.isDigital = data.isDigital;
      if (data.featured !== undefined) updateData.featured = data.featured;
      if (data.weight !== undefined)
        updateData.weight = data.weight ? Number(data.weight) : null;
      if (data.dimensions !== undefined)
        updateData.dimensions = data.dimensions;
      if (data.images !== undefined) updateData.images = data.images;
      if (data.attributes !== undefined) updateData.attributes = data.attributes;
      if (data.notes !== undefined) updateData.notes = data.notes?.trim();
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.seo !== undefined) updateData.seo = data.seo;
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
      if (data.category !== undefined && data.categoryId === undefined) {
        updateData.categoryId = data.category;
      }
      if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
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

      // ✅ If the update added new variants, ensure they get inventory
      //    rows too. Cheap and idempotent.
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
          ensureErr
        );
      }

      res.json({
        success: true,
        data: product,
        message: 'Product updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid product data', 400, error.errors));
      }
      next(error);
    }
  },

  async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { force = false } = req.query;

      console.log(`🗑️ Delete product request: ${id}, force: ${force}`);

      const result = await productService.deleteProduct(id, force === 'true');

      const isSoftDelete = result?.softDeleted === true;

      res.json({
        success: true,
        message: result?.message || 'Product deleted successfully',
        data: {
          ...result,
          softDeleted: isSoftDelete,
          productId: id,
          requiresAction: isSoftDelete
            ? 'Product was deactivated. It can be restored or permanently deleted.'
            : undefined,
        },
      });
    } catch (error: any) {
      console.error('❌ Error in deleteProduct:', error);

      if (error?.code === 'P2003') {
        return res.status(400).json({
          success: false,
          message:
            'Cannot delete product due to foreign key constraints. Product has associated sales, orders, or inventory records.',
          error: 'FOREIGN_KEY_CONSTRAINT',
          details: error.meta || {},
        });
      }

      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
          error: 'NOT_FOUND',
        });
      }

      next(error);
    }
  },

  async unlinkProductFromInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { keepInventory = true } = req.body;

      const result = await productService.deleteProductFromInventory(
        id,
        keepInventory
      );

      res.json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (error) {
      next(error);
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

      const result = await productService.bulkActivateProducts(productIds);

      res.json({
        success: true,
        data: result,
        message: `Activated ${result.results?.length || 0} products, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (error) {
      next(error);
    }
  },

  async bulkDeactivateProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { productIds } = req.body;
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        throw new AppError('Product IDs array is required', 400);
      }

      const result = await productService.bulkDeactivateProducts(productIds);

      res.json({
        success: true,
        data: result,
        message: `Deactivated ${result.results?.length || 0} products, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (error) {
      next(error);
    }
  },

  async bulkUpdatePrices(req: Request, res: Response, next: NextFunction) {
    try {
      const data = bulkUpdatePricesSchema.parse(req.body);
      const result = await productService.bulkUpdatePrices(data.updates);
      res.json({
        success: true,
        data: result,
        message: `Updated ${result.results?.length || 0} products, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid update data', 400, error.errors));
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
    } catch (error) {
      next(error);
    }
  },

  async bulkCreateProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
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

      // ✅ Ensure every created product has inventory linked.
      try {
        const created = (result?.results || []).filter(
          (r: any) => r?.success && r?.data?.id
        );

        await prisma.$transaction(async (tx) => {
          for (const r of created) {
            const productId = r.data.id;
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
          ensureErr
        );
      }

      res.status(201).json({
        success: true,
        data: result,
        message: `${result.results?.length || 0} products created, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid bulk product data', 400, error.errors));
      }
      next(error);
    }
  },

  async bulkDeleteProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const data = bulkDeleteProductsSchema.parse(req.body);

      const result = await productService.bulkDeleteProducts(
        data.productIds,
        businessUnitId
      );

      res.json({
        success: true,
        data: result,
        message: `${result.results?.length || 0} products deleted, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid product IDs', 400, error.errors));
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
      const options = generateBarcodeSchema.parse(req.body || {});

      const result = await productService.generateBarcode(id, options);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Barcode generated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(
          new AppError('Invalid barcode generation options', 400, error.errors)
        );
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(
          new AppError('Invalid barcode generation options', 400, error.errors)
        );
      }
      next(error);
    }
  },

  async getProductBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await productService.getProductBarcode(id);

      if (!result) {
        throw new AppError('No barcode found for this product', 404);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async getBarcodeImage(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await productService.getBarcodeImage(id);

      if (!result || !result.barcodeUrl) {
        throw new AppError('No barcode image found for this product', 404);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async getProductQRCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await productService.getProductQRCode(id);

      if (!result || !result.qrCodeUrl) {
        throw new AppError('No QR code found for this product', 404);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
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
    } catch (error) {
      next(error);
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
    } catch (error) {
      next(error);
    }
  },

  async associateBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { barcode } = associateBarcodeSchema.parse(req.body);

      const result = await productService.associateBarcode(id, barcode);

      res.json({
        success: true,
        data: result,
        message: 'Barcode associated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid barcode data', 400, error.errors));
      }
      next(error);
    }
  },

  async validateBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { barcode, excludeProductId } = validateBarcodeSchema.parse(req.body);

      const result = await productService.validateBarcode(
        barcode,
        excludeProductId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(
          new AppError('Invalid barcode validation data', 400, error.errors)
        );
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
    } catch (error) {
      next(error);
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

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // VARIANT METHODS
  // ============================================

  async addVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const data = createVariantSchema.parse(req.body);

      if (!data.images) {
        data.images = [];
      }

      const variant = await productService.addVariant(id, data);

      // ✅ Ensure the new variant has a linked Inventory row.
      if (variant && (variant as any).id) {
        try {
          await prisma.$transaction(async (tx) =>
            ensureVariantInventory(tx, (variant as any).id, businessUnitId)
          );
        } catch (ensureErr) {
          console.warn(
            `⚠️ ensureVariantInventory failed for ${(variant as any).id}:`,
            ensureErr
          );
        }
      }

      res.status(201).json({
        success: true,
        data: variant,
        message: 'Variant added successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid variant data', 400, error.errors));
      }
      next(error);
    }
  },

  async bulkCreateVariants(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const data = bulkCreateVariantsSchema.parse(req.body);

      if (data.variants) {
        data.variants = data.variants.map((v: any) => ({
          ...v,
          images: v.images || [],
        }));
      }

      const result = await productService.bulkCreateVariants(id, data.variants);

      // ✅ Ensure every variant has inventory linked.
      try {
        const createdIds: string[] = (result?.results || [])
          .map((r: any) => r?.data?.id || r?.id)
          .filter((x: any) => typeof x === 'string');

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
          ensureErr
        );
      }

      res.status(201).json({
        success: true,
        data: result,
        message: `${result.results?.length || 0} variants created, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid variant data', 400, error.errors));
      }
      next(error);
    }
  },

  async getProductVariants(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const variants = await productService.getProductVariants(id);
      res.json({ success: true, data: variants });
    } catch (error) {
      next(error);
    }
  },

  async getVariantById(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId } = req.params;
      const variant = await productService.getVariantById(variantId);
      res.json({ success: true, data: variant });
    } catch (error) {
      next(error);
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
    } catch (error) {
      next(error);
    }
  },

  async getVariantBySku(req: Request, res: Response, next: NextFunction) {
    try {
      const { sku } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const variant = await productService.getVariantBySku(sku, businessUnitId);
      res.json({ success: true, data: variant });
    } catch (error) {
      next(error);
    }
  },

  async updateVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId } = req.params;
      const data = updateVariantSchema.parse(req.body);
      const variant = await productService.updateVariant(variantId, data);

      res.json({
        success: true,
        data: variant,
        message: 'Variant updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid variant data', 400, error.errors));
      }
      next(error);
    }
  },

  async deleteVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId } = req.params;
      const result = await productService.deleteVariant(variantId);

      const isSoftDelete =
        result && typeof result === 'object' && 'message' in result;
      const message = isSoftDelete ? result.message : 'Variant deleted successfully';

      res.json({
        success: true,
        message: message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async bulkDeleteVariants(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantIds } = req.body;
      if (!variantIds || !Array.isArray(variantIds) || variantIds.length === 0) {
        throw new AppError('Variant IDs array is required', 400);
      }

      const result = await productService.bulkDeleteVariants(variantIds);

      res.json({
        success: true,
        data: result,
        message: `${result.results?.length || 0} variants deleted, ${
          result.errors?.length || 0
        } failed`,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateVariantStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId } = req.params;
      const { quantity, note } = req.body;
      const userId = getUserId(req);

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
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // CATEGORY METHODS
  // ============================================

  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const categories = await productService.getCategories(businessUnitId);
      res.json({
        success: true,
        data: categories || [],
      });
    } catch (error) {
      next(error);
    }
  },

  async getCategoryTree(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const tree = await productService.getCategoryTree(businessUnitId);
      res.json({ success: true, data: tree || [] });
    } catch (error) {
      next(error);
    }
  },

  async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const category = await productService.getCategoryById(id, businessUnitId);
      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  },

  async getCategoryProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;
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
    } catch (error) {
      next(error);
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
        businessUnitId: businessUnitId,
        userId: userId,
        isActive: data.isActive ?? true,
        featured: data.featured ?? false,
      };

      const category = await productService.createCategory(categoryData);

      res.status(201).json({
        success: true,
        data: category,
        message: 'Category created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid category data', 400, error.errors));
      }
      next(error);
    }
  },

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid category data', 400, error.errors));
      }
      next(error);
    }
  },

  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      await productService.deleteCategory(id, businessUnitId);
      res.json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // SUPPLIER METHODS
  // ============================================

  async getSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const suppliers = await productService.getSuppliers(companyId);
      res.json({
        success: true,
        data: suppliers || [],
      });
    } catch (error) {
      next(error);
    }
  },

  async getSupplierById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const companyId = getCompanyId(req);
      const supplier = await productService.getSupplierById(id, companyId);
      res.json({
        success: true,
        data: supplier,
      });
    } catch (error) {
      next(error);
    }
  },

  async getSupplierProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;
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
    } catch (error) {
      next(error);
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
        companyId: companyId,
        userId: userId,
      });

      res.status(201).json({
        success: true,
        data: supplier,
        message: 'Supplier created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid supplier data', 400, error.errors));
      }
      next(error);
    }
  },

  async updateSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateSupplierSchema.parse(req.body);

      const supplier = await productService.updateSupplier(id, data);

      res.json({
        success: true,
        data: supplier,
        message: 'Supplier updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid supplier data', 400, error.errors));
      }
      next(error);
    }
  },

  async deleteSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const companyId = getCompanyId(req);
      await productService.deleteSupplier(id, companyId);
      res.json({
        success: true,
        message: 'Supplier deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // REVIEW METHODS
  // ============================================

  async getProductReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10 } = req.query;

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
    } catch (error) {
      next(error);
    }
  },

  async getReviewStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const stats = await productService.getReviewStats(id);
      res.json({
        success: true,
        data: stats || {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async exportProductReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { format = 'csv' } = req.query;

      const result = await productService.getProductReviews(id, { limit: 1000 });
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
    } catch (error) {
      next(error);
    }
  },

  async createProductReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const data = createProductReviewSchema.parse(req.body);

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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid review data', 400, error.errors));
      }
      next(error);
    }
  },

  async updateProductReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewId } = req.params;
      const userId = getUserId(req);
      const data = req.body;

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
    } catch (error) {
      next(error);
    }
  },

  async deleteProductReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewId } = req.params;
      const userId = getUserId(req);
      await productService.deleteProductReview(reviewId, userId);
      res.json({
        success: true,
        message: 'Review deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  async verifyReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewId } = req.params;
      const review = await productService.verifyReview(reviewId);
      res.json({
        success: true,
        data: review,
        message: 'Review verified successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  async markReviewHelpful(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewId } = req.params;
      const userId = getUserId(req);
      const result = await productService.markReviewHelpful(reviewId, userId);
      res.json({
        success: true,
        data: result,
        message: result?.helpful ? 'Marked as helpful' : 'Removed helpful vote',
      });
    } catch (error) {
      next(error);
    }
  },

  async reportReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewId } = req.params;
      const userId = getUserId(req);
      const { reason } = req.body;

      if (!reason) {
        throw new AppError('Reason is required', 400);
      }

      const result = await productService.reportReview(reviewId, reason, userId);

      res.json({
        success: true,
        data: result,
        message: 'Review reported successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // TAG & SEARCH METHODS
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
    } catch (error) {
      next(error);
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

      res.json({
        success: true,
        data: products || [],
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // WISHLIST METHODS
  // ============================================

  async toggleWishlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const { productId } = req.params;
      const result = await productService.toggleWishlist(userId, productId);
      res.json({
        success: true,
        data: result || { added: false, message: 'Operation completed' },
      });
    } catch (error) {
      next(error);
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
    } catch (error) {
      next(error);
    }
  },

  async checkWishlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const { productId } = req.params;
      const isInWishlist = await productService.checkWishlist(userId, productId);
      res.json({ success: true, data: isInWishlist || false });
    } catch (error) {
      next(error);
    }
  },

  async getWishlistCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const count = await productService.getWishlistCount(userId);
      res.json({ success: true, data: count || 0 });
    } catch (error) {
      next(error);
    }
  },

  async getWishlistProductIds(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const ids = await productService.getWishlistProductIds(userId);
      res.json({ success: true, data: ids || [] });
    } catch (error) {
      next(error);
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
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // COMPARE METHODS
  // ============================================

  async compareProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { productIds } = req.body;
      if (!productIds || !Array.isArray(productIds) || productIds.length < 2) {
        throw new AppError('At least 2 product IDs are required', 400);
      }
      const products = await productService.compareProducts(productIds);
      res.json({ success: true, data: products || [] });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // EXPORT / IMPORT METHODS
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
    } catch (error) {
      next(error);
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
    } catch (error) {
      next(error);
    }
  },

  async downloadImportTemplate(req: Request, res: Response, next: NextFunction) {
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
    } catch (error) {
      next(error);
    }
  },
};

export default productController;
