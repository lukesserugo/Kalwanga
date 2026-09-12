// src/controllers/inventoryController.ts

import { Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/inventoryService.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  createProductSchema,
  updateProductSchema,
  updateStockSchema,
  searchProductsSchema,
  reserveStockSchema,
  createItemSchema,
  updateItemSchema,
  issueItemSchema,
  returnItemSchema,
  restockItemSchema,
  listItemsQuerySchema,
  bulkCreateItemsSchema,
  bulkUpdateStockSchema,
  generateBarcodeSchema,
  generateQRCodeSchema,
  scanBarcodeSchema,
} from '../utils/validators.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '../generated/prisma/index.js';
import { prisma } from '../lib/prisma.js';

// ✅ NEW: Inventory invariant helpers — guarantee every Product/Variant
//    has a linked Inventory row so downstream services (cart, order,
//    checkout, sale) never fail with "No inventory found".
import {
  ensureProductInventory,
  ensureVariantInventory,
} from '../lib/ensureInventory.js';

const inventoryService = new InventoryService();

// ============================================
// TYPES
// ============================================

interface InventoryResponse {
  inventory: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: any;
  appliedFilters: any;
}

interface GetAllInventoryResponse {
  items: any[];
  stats: any;
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
            ? item.images
            : item.product.images || [],
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
// HELPER FUNCTIONS WITH DATABASE FALLBACKS
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

async function getBusinessUnitId(req: Request): Promise<string> {
  const user = (req as any).user;

  // 1. Explicit override from header, body, or query
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
    console.warn(
      `⚠️ Explicit businessUnitId ${sanitizedExplicit} not found or inactive, falling back`
    );
  }

  // 2. User's own business unit
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
  }

  // 3. Fall back to first active business unit
  try {
    if (user?.id) {
      const userWithBusinessUnits = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          businessUnits: {
            include: { businessUnit: true },
          },
        },
      });

      if (userWithBusinessUnits?.businessUnits) {
        const first = userWithBusinessUnits.businessUnits.find(
          (bu: any) => bu.businessUnit?.isActive
        );
        if (first?.businessUnit) {
          console.log(
            '✅ Using business unit from user:',
            first.businessUnit.id,
            first.businessUnit.name
          );
          return first.businessUnit.id;
        }
      }
    }

    const businessUnit = await prisma.businessUnit.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (businessUnit) {
      console.log(
        '✅ Using first active business unit from DB:',
        businessUnit.id,
        businessUnit.name
      );
      return businessUnit.id;
    }

    // 4. Bootstrap default company + unit
    let company = await prisma.company.findFirst({ where: { isActive: true } });
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
  } catch (error) {
    console.error('❌ Failed to resolve business unit ID:', error);
    throw new AppError('Failed to resolve business unit ID', 500);
  }
}

async function getAllBusinessUnits(req: Request): Promise<any[]> {
  try {
    const businessUnits = await prisma.businessUnit.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`📊 Found ${businessUnits.length} active business units`);
    return businessUnits;
  } catch (error) {
    console.error('❌ Failed to fetch business units:', error);
    return [];
  }
}

async function getUserId(req: Request): Promise<string> {
  const user = (req as any).user;

  let userId = user?.id || user?.userId;

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
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('❌ Failed to resolve user ID:', error);
      throw new AppError('Failed to resolve user ID', 500);
    }
  }

  return userId;
}

async function getCompanyId(req: Request): Promise<string> {
  const user = (req as any).user;

  let companyId =
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
    } catch (error) {
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

function handlePrismaError(error: any, res: Response) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return res.status(409).json({
          success: false,
          message: 'Duplicate entry',
          error: `A record with this ${error.meta?.target} already exists`,
          code: error.code,
        });
      case 'P2003':
        return res.status(400).json({
          success: false,
          message: 'Foreign key constraint failed',
          error: 'Referenced record does not exist',
          code: error.code,
        });
      case 'P2025':
        return res.status(404).json({
          success: false,
          message: 'Record not found',
          error: 'The requested record does not exist',
          code: error.code,
        });
      default:
        return res.status(400).json({
          success: false,
          message: 'Database error',
          error: error.message,
          code: error.code,
        });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      message: 'Invalid data provided',
      error: error.message,
    });
  }

  return null;
}

function handleGeneralError(error: any, res: Response) {
  console.error('❌ Controller error:', error);

  if (error instanceof AppError) {
    console.error('📋 AppError details:', {
      status: error.status,
      message: error.message,
      stack: error.stack,
    });
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

  console.error('📋 Unexpected error:', {
    message: error?.message || 'Unknown error',
    stack: error?.stack || 'No stack trace',
    code: error?.code || 'No error code',
  });

  return res.status(500).json({
    success: false,
    message: error?.message || 'Internal server error',
    error:
      process.env.NODE_ENV === 'development'
        ? {
            stack: error?.stack,
            details: error,
          }
        : undefined,
  });
}

// ============================================
// INVENTORY CONTROLLER
// ============================================

export const inventoryController = {
  // ============================================
  // REFERENCE DATA ENDPOINTS
  // ============================================

  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📤 GET /inventory/categories - Query params:', req.query);

      let businessUnitId = req.query.businessUnitId as string;

      if (!businessUnitId) {
        const user = (req as any).user;
        if (user?.businessUnitId) {
          businessUnitId = user.businessUnitId;
        }
      }

      if (
        !businessUnitId ||
        businessUnitId === 'default' ||
        businessUnitId === 'default-business-unit'
      ) {
        const user = (req as any).user;
        if (user?.businessUnits && user.businessUnits.length > 0) {
          const firstBU = user.businessUnits[0];
          businessUnitId = firstBU.businessUnitId || firstBU.id || firstBU;
          console.log(`✅ Using business unit from user: ${businessUnitId}`);
        } else {
          const firstBU = await prisma.businessUnit.findFirst({
            where: { isActive: true },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          });
          if (firstBU) {
            businessUnitId = firstBU.id;
            console.log(
              `✅ Using first active business unit from DB: ${businessUnitId}`
            );
          }
        }
      }

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
        data: categories || [],
        count: categories?.length || 0,
        businessUnitId: businessUnitId || null,
      });
    } catch (error) {
      console.error('❌ Error in getCategories:', error);
      res.status(200).json({
        success: true,
        data: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  async getSuppliers(req: Request, res: Response, next: NextFunction) {
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

  // ============================================
  // GET ENDPOINTS - READ OPERATIONS
  // ============================================

  async getInventory(req: Request, res: Response, next: NextFunction) {
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
        const result = (await inventoryService.getAllInventory(
          businessUnitId
        )) as GetAllInventoryResponse;
        const normalizedItems = normalizeInventoryItems(result?.items || []);
        return res.status(200).json({
          success: true,
          data: normalizedItems,
          stats: result?.stats || {},
          count: normalizedItems.length,
        });
      }

      const params: any = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
        sortBy: (sortBy as string) || 'updatedAt',
        sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
        businessUnitId: businessUnitId,
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

      const result = (await inventoryService.getInventory(
        params
      )) as InventoryResponse;

      const normalizedInventory = normalizeInventoryItems(
        result?.inventory || []
      );

      return res.status(200).json({
        success: true,
        data: normalizedInventory,
        stats: result?.stats || {},
        pagination: {
          total: result?.total || 0,
          page: result?.page || 1,
          totalPages: result?.totalPages || 1,
          limit: result?.limit || 10,
          hasNextPage: (result?.page || 1) < (result?.totalPages || 1),
          hasPreviousPage: (result?.page || 1) > 1,
        },
        filters: result?.appliedFilters || {},
      });
    } catch (error) {
      console.error('❌ Error in getInventory:', error);
      return handleGeneralError(error, res);
    }
  },

  async getAllInventory(req: Request, res: Response, next: NextFunction) {
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

      const result = (await inventoryService.getAllInventory(
        businessUnitId
      )) as GetAllInventoryResponse;

      const normalizedItems = normalizeInventoryItems(result?.items || []);

      console.log(`✅ Found ${normalizedItems.length} inventory items`);

      res.status(200).json({
        success: true,
        data: normalizedItems,
        stats: result?.stats || {},
        count: normalizedItems.length,
        businessUnitId: businessUnitId,
      });
    } catch (error) {
      console.error('❌ Error in getAllInventory:', error);
      return handleGeneralError(error, res);
    }
  },

  async getInventoryByProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!productId) {
        throw new AppError('Product ID is required', 400);
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

  async getInventoryItemById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!id) {
        throw new AppError('Inventory ID is required', 400);
      }

      let item;
      try {
        item = await inventoryService.getInventoryItemById(id, businessUnitId);
      } catch (error) {
        if (inventoryService.getInventoryItem) {
          item = await inventoryService.getInventoryItem(id);
        } else {
          item = await prisma.inventory.findUnique({
            where: { id },
            include: {
              product: true,
              variant: true,
              businessUnit: true,
              transactions: true,
              issues: true,
            },
          });
        }
      }

      if (!item) {
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

  async getLowStockItems(req: Request, res: Response, next: NextFunction) {
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

  async getOutOfStockItems(req: Request, res: Response, next: NextFunction) {
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

  async getInventoryValue(req: Request, res: Response, next: NextFunction) {
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

  async getInventoryTransactions(req: Request, res: Response, next: NextFunction) {
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
        data: result.transactions,
        summary: result.summary,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
        },
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getInventoryByLocation(req: Request, res: Response, next: NextFunction) {
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

  async getInventoryByCategory(req: Request, res: Response, next: NextFunction) {
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

  async searchProducts(req: Request, res: Response, next: NextFunction) {
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

  async exportInventory(req: Request, res: Response, next: NextFunction) {
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
        data: result.data,
        format: result.format,
        total: result.total,
        exportedAt: result.exportedAt,
        message: `Inventory exported as ${format}`,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getInventorySummary(req: Request, res: Response, next: NextFunction) {
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
          totalValue: totalValue.totalValue,
          totalCost: totalValue.totalCost,
          potentialProfit: totalValue.totalValue - totalValue.totalCost,
          categories,
          stockStatus: {
            inStock: totalItems - lowStockItems.length - outOfStockItems.length,
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

  async getStockMovements(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { productId, variantId, startDate, endDate, limit = 100 } = req.query;

      const movements = await inventoryService.getStockMovements({
        productId: productId as string,
        variantId: variantId as string,
        businessUnitId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string) || 100,
      });

      res.status(200).json({
        success: true,
        data: movements,
        count: movements.length,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getTotalItems(req: Request, res: Response, next: NextFunction) {
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

  async getCategorySummary(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📤 GET /inventory/category-summary - Query params:', req.query);

      let businessUnitId = req.query.businessUnitId as string;

      if (
        !businessUnitId ||
        businessUnitId === 'default' ||
        businessUnitId === 'default-business-unit'
      ) {
        const user = (req as any).user;
        if (user?.businessUnitId) {
          businessUnitId = user.businessUnitId;
        } else if (user?.businessUnits && user.businessUnits.length > 0) {
          businessUnitId =
            user.businessUnits[0].businessUnitId || user.businessUnits[0].id;
        } else {
          const firstBU = await prisma.businessUnit.findFirst({
            where: { isActive: true },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          });
          if (firstBU) {
            businessUnitId = firstBU.id;
          }
        }
      }

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
        data: categories || [],
        count: categories?.length || 0,
        businessUnitId: businessUnitId || null,
      });
    } catch (error) {
      console.error('❌ Error in getCategorySummary:', error);
      res.status(200).json({
        success: true,
        data: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  async getInventoryStats(req: Request, res: Response, next: NextFunction) {
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

  // ============================================
  // BARCODE & SKU ENDPOINTS
  // ============================================

  async getInventoryByBarcode(req: Request, res: Response, next: NextFunction) {
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

  async getInventoryBySku(req: Request, res: Response, next: NextFunction) {
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

  async generateInventoryBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!id) {
        throw new AppError('Inventory item ID is required', 400);
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

  async generateInventoryQRCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!id) {
        throw new AppError('Inventory item ID is required', 400);
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
    next: NextFunction
  ) {
    try {
      const { ids } = req.body;
      const businessUnitId = await getBusinessUnitId(req);

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new AppError('Array of inventory item IDs is required', 400);
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

  async scanInventory(req: Request, res: Response, next: NextFunction) {
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

  // ============================================
  // POST / PUT / PATCH / DELETE ENDPOINTS
  // ============================================

  async createItem(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📝 Creating inventory item with body:', req.body);

      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      console.log('📝 Resolved businessUnitId:', businessUnitId);
      console.log('📝 Resolved userId:', userId);

      let validatedData;
      try {
        validatedData = createItemSchema.parse(req.body);
        console.log('✅ Validation passed:', validatedData);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.error('❌ Validation error:', validationError.errors);
          return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: validationError.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          });
        }
        throw validationError;
      }

      const itemData = {
        name: validatedData.name,
        category: validatedData.category || '',
        quantity: validatedData.quantity ?? 0,
        unit: validatedData.unit || 'each',
        businessUnitId: businessUnitId,
        userId: userId,

        ...(validatedData.sku && { sku: validatedData.sku }),
        ...(validatedData.categoryId && { categoryId: validatedData.categoryId }),
        ...(validatedData.minStock !== undefined && {
          minStock: validatedData.minStock,
        }),
        ...(validatedData.maxStock !== undefined && {
          maxStock: validatedData.maxStock,
        }),
        ...(validatedData.location && { location: validatedData.location }),
        ...(validatedData.supplier && { supplier: validatedData.supplier }),
        ...(validatedData.supplierId && { supplierId: validatedData.supplierId }),
        ...(validatedData.unitPrice !== undefined && {
          unitPrice: validatedData.unitPrice,
        }),
        ...(validatedData.purchaseDate && {
          purchaseDate: validatedData.purchaseDate,
        }),
        ...(validatedData.expiryDate && { expiryDate: validatedData.expiryDate }),
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

      // ✅ Ensure the resulting product has a linked Inventory row.
      //    `createItem` in the service creates both a Product and an
      //    Inventory row; this call guarantees the FK link exists even
      //    if the service omitted it.
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
        console.warn(
          '⚠️ ensureProductInventory failed after createItem:',
          ensureErr
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

  async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!id) {
        throw new AppError('Item ID is required', 400);
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

  async deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!id) {
        throw new AppError('Item ID is required', 400);
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

  async updateStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!id) {
        throw new AppError('Item ID is required', 400);
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
      });

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

  async issueItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!id) {
        throw new AppError('Inventory ID is required', 400);
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
      });

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

  async returnItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!id) {
        throw new AppError('Inventory ID is required', 400);
      }

      const validatedData = returnItemSchema.parse(req.body);

      const result = await inventoryService.returnItem({
        inventoryId: id,
        quantity: validatedData.quantity,
        returnDate: validatedData.returnDate,
        remarks: validatedData.remarks,
        businessUnitId,
        userId,
      });

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

  async restockItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!id) {
        throw new AppError('Inventory ID is required', 400);
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
      });

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

  async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      const validatedData = createProductSchema.parse(req.body);

      const result = await inventoryService.createProductWithInventory({
        name: String(validatedData.name || ''),
        sku: String(validatedData.sku || ''),
        price:
          typeof validatedData.price === 'number'
            ? validatedData.price
            : typeof validatedData.unitPrice === 'number'
            ? validatedData.unitPrice
            : 0,
        unitPrice:
          typeof validatedData.unitPrice === 'number'
            ? validatedData.unitPrice
            : undefined,
        costPrice:
          typeof validatedData.costPrice === 'number'
            ? validatedData.costPrice
            : undefined,
        stock:
          typeof validatedData.stock === 'number' ? validatedData.stock : 0,
        reorderPoint:
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
        expiryDate: validatedData.expiryDate
          ? new Date(String(validatedData.expiryDate))
          : undefined,
        batchNumber:
          typeof validatedData.batchNumber === 'string'
            ? validatedData.batchNumber
            : undefined,
        businessUnitId,
        userId,
      });

      // ✅ Ensure the resulting product has a linked Inventory row.
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
        console.warn(
          '⚠️ ensureProductInventory failed after createProduct (inventory):',
          ensureErr
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

  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      if (!id) {
        throw new AppError('Product ID is required', 400);
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
      });

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

  async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!id) {
        throw new AppError('Product ID is required', 400);
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

  async reserveStock(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { productId, quantity, variantId } = req.body;

      if (!productId) {
        throw new AppError('Product ID is required', 400);
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

  async releaseReservedStock(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { productId, quantity, variantId } = req.body;

      if (!productId) {
        throw new AppError('Product ID is required', 400);
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

  async transferStock(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);
      const { productId, fromLocation, toLocation, quantity, notes, variantId } =
        req.body;

      if (!productId || !fromLocation || !toLocation || !quantity) {
        throw new AppError(
          'Product ID, fromLocation, toLocation, and quantity are required',
          400
        );
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
        userId,
        variantId,
      });

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

  async bulkCreateItems(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      const validatedData = bulkCreateItemsSchema.parse(req.body);

      const results = [];
      const errors = [];

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
          });

          // ✅ Ensure the created product has inventory linked.
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
            console.warn(
              '⚠️ ensureProductInventory failed during bulkCreateItems:',
              ensureErr
            );
          }

          results.push({
            success: true,
            data: normalizeInventoryItem(result),
          });
        } catch (error) {
          errors.push({
            success: false,
            item: item.name,
            error: error instanceof Error ? error.message : 'Unknown error',
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
              ((results.length / validatedData.items.length) * 100).toFixed(2) +
              '%',
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

  async bulkUpdateStock(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      const validatedData = bulkUpdateStockSchema.parse(req.body);

      if (!validatedData.updates || validatedData.updates.length === 0) {
        throw new AppError('Updates array is required and cannot be empty', 400);
      }

      const results = [];
      const errors = [];

      for (const update of validatedData.updates) {
        try {
          const result = await inventoryService.updateStock({
            productId: update.id,
            quantity: update.quantity,
            transactionType: update.transactionType || 'ADJUSTMENT',
            userId,
            businessUnitId,
            notes: update.notes || 'Bulk stock update',
            inventoryId: update.id,
            variantId: update.variantId,
          });
          results.push({
            id: update.id,
            success: true,
            data: normalizeInventoryItem(result),
          });
        } catch (error) {
          errors.push({
            id: update.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
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

  async createInventory(req: Request, res: Response, next: NextFunction) {
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
      });

      // ✅ Ensure the created product has inventory linked.
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
        console.warn(
          '⚠️ ensureProductInventory failed after createInventory:',
          ensureErr
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

  async updateInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        throw new AppError('Inventory ID is required', 400);
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
      });

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

  async getInventoryItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        throw new AppError('Inventory ID is required', 400);
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

  async exportInventoryToFile(req: Request, res: Response, next: NextFunction) {
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

  async bulkDeleteItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body;
      const businessUnitId = await getBusinessUnitId(req);
      const userId = await getUserId(req);

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new AppError('Array of inventory item IDs is required', 400);
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
        } catch (error) {
          errors.push({
            id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
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

  async getInventoryItems(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { page, limit, search, withoutProduct } = req.query;

      const params: any = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        businessUnitId,
        withoutProduct: withoutProduct === 'true',
      };

      if (search) params.search = search as string;

      const result = await inventoryService.getInventoryItems(params);

      const normalizedItems = normalizeInventoryItems(result?.items || []);

      res.status(200).json({
        success: true,
        data: normalizedItems,
        pagination: {
          total: result?.total || 0,
          page: result?.page || 1,
          totalPages: result?.totalPages || 1,
          limit: result?.limit || 20,
        },
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },
};

export default inventoryController;
