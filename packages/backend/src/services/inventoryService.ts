// D:\Projects\Kalwanga\packages\backend\src\services\inventoryService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { realtimeService } from './realtimeService.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// INTERFACES
// ============================================

interface CreateProductData {
  name: string;
  sku: string;
  price?: number;
  unitPrice?: number;
  costPrice?: number;
  stock: number;
  reorderPoint?: number;
  category?: string;
  categoryId?: string;
  location?: string;
  barcode?: string;
  businessUnitId: string;
  userId: string;
  description?: string;
  images?: string[];
  supplier?: string;
  supplierId?: string;
  expiryDate?: Date;
  batchNumber?: string;
}

interface UpdateProductData {
  name?: string;
  sku?: string;
  price?: number;
  unitPrice?: number;
  costPrice?: number;
  category?: string;
  categoryId?: string;
  location?: string;
  status?: string;
  businessUnitId: string;
  description?: string;
  images?: string[];
  supplier?: string;
  supplierId?: string;
}

interface UpdateStockData {
  productId: string;
  quantity: number;
  transactionType: string;
  userId: string;
  businessUnitId: string;
  notes?: string;
  reference?: string;
  variantId?: string;
  inventoryId?: string;
  batchNumber?: string;
  expiryDate?: Date;
}

interface TransferStockData {
  productId: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  notes?: string;
  businessUnitId: string;
  userId: string;
  variantId?: string;
}

interface CreateItemData {
  name: string;
  category: string;
  categoryId?: string;
  quantity: number;
  unit: string;
  minStock?: number;
  maxStock?: number;
  location?: string;
  supplier?: string;
  supplierId?: string;
  unitPrice?: number;
  costPrice?: number;
  purchaseDate?: string;
  expiryDate?: string;
  notes?: string;
  businessUnitId: string;
  userId: string;
  description?: string;
  barcode?: string;
  sku?: string;
  weight?: number;
  taxRate?: number;
  tags?: string[];
  images?: string[];
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
}

interface IssueItemData {
  inventoryId: string;
  issuedTo: string;
  quantity: number;
  purpose?: string;
  remarks?: string;
  expectedReturnDate?: string;
  businessUnitId: string;
  userId: string;
}

interface ReturnItemData {
  inventoryId: string;
  quantity?: number;
  returnDate?: string;
  remarks?: string;
  businessUnitId: string;
  userId: string;
}

interface RestockItemData {
  inventoryId: string;
  quantity: number;
  unitPrice?: number;
  supplier?: string;
  purchaseDate?: string;
  businessUnitId: string;
  userId: string;
  notes?: string;
  invoiceNumber?: string;
}

interface InventoryReport {
  totalItems: number;
  totalValue: number;
  totalCost: number;
  potentialProfit: number;
  lowStockItems: number;
  outOfStockItems: number;
  byCategory: Array<{ category: string; count: number; value: number }>;
  byLocation: Array<{ location: string; count: number; value: number }>;
  topMovers: Array<{ productId: string; name: string; movements: number }>;
}

export interface FlatInventoryItem {
  id: string;
  productId: string | null;
  product: Record<string, unknown> | null;
  variantId: string | null;
  variant: Record<string, unknown> | null;
  name: string;
  description: string | null;
  sku: string;
  barcode: string | null;
  quantity: number;
  stock: number;
  reserved: number;
  available: number;
  price: number;
  unitPrice: number;
  costPrice: number;
  reorderPoint: number;
  reorderQuantity: number;
  category: string;
  categoryId: string | null;
  location: string;
  shelfNumber: string | null;
  supplier: string | null;
  supplierId: string | null;
  notes: string | null;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  isActive: boolean;
  images: string[];
  tags: string[];
  weight: number;
  taxRate: number;
  isDigital: boolean;
  featured: boolean;
  inventory: Array<{ quantity: number; reserved: number }>;
  businessUnitId: string;
}

interface InventoryStats {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
  totalCost: number;
  potentialProfit: number;
  profitMargin: number;
  totalUnits: number;
  totalReserved: number;
  availableUnits: number;
  byCategory: Array<{ category: string; count: number; value: number }>;
}

interface CategoryOption {
  id: string;
  name: string;
  productCount?: number;
}

// ============================================
// RESOLVED ROW TYPE (for barcode/QR helpers)
// ============================================
//
// `resolveInventoryRow` accepts a dynamic `include`, so the returned
// row shape depends on what the caller passes. The two callers
// (generateInventoryBarcode / generateInventoryQRCode) always pass
// `{ product: { include: { images: true } } }`, so we narrow to the
// shape they actually need. Declaring it explicitly lets TypeScript
// see `.product.name`, `.product.sku`, etc. instead of collapsing to
// a union of unrelated transaction types.

type ResolvedInventoryRow = {
  id: string;
  quantity: number;
  reserved: number;
  reorderPoint: number;
  reorderQuantity: number;
  location: string | null;
  description: string | null;
  weight: number | null;
  taxRate: number | null;
  tags: string[];
  businessUnitId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    description: string | null;
    weight: number | null;
    taxRate: number | null;
    tags: string[];
    images: Array<{ url: string }>;
  } | null;
} | null;

// ============================================
// INTERNAL HELPERS
// ============================================

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * ✅ NEW: slugify helper.
 *
 * `Category.slug` is required by Prisma (the model declares
 * `slug String` with `@@unique([businessUnitId, slug])`). When the
 * service lazily creates a category from a free-text name, it must
 * produce a slug. This mirrors the pattern Prisma would enforce at
 * the DB level: lowercase, non-alphanumerics → `-`, collapse runs,
 * trim leading/trailing dashes.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'category';
}

// ============================================
// IMAGE + LOCATION HELPERS
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

function toImageCreateInput(urls: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of urls) {
    if (!seen.has(url)) {
      seen.add(url);
      unique.push(url);
    }
  }
  return {
    create: unique.map((url, index) => ({
      url,
      order: index,
      isPrimary: index === 0,
    })),
  };
}

function toImageUpdateInput(urls: string[]) {
  return {
    deleteMany: {},
    create: toImageCreateInput(urls).create,
  };
}

async function resolveLocationId(
  tx: any,
  businessUnitId: string,
  locationName: string | undefined | null
): Promise<string | null> {
  const name = (locationName || 'Warehouse').trim();
  if (!name) return null;

  let loc = await tx.location.findFirst({
    where: { businessUnitId, name, deletedAt: null },
    select: { id: true },
  });

  if (!loc) {
    loc = await tx.location.create({
      data: {
        name,
        businessUnitId,
        type: 'OTHER',
        isActive: true,
        isDefault: false,
      },
      select: { id: true },
    });
  }

  return loc.id;
}

// ============================================
// PRODUCT SELECT SHAPES
// ============================================
//
// ✅ These are shared between the read paths so every query includes
//    the fields `normalizeInventoryItem` actually reads. Previously
//    some paths omitted `weight`, `taxRate`, and `tags`, which made
//    the normalizer silently fall back to 0 / [] even when the row
//    had real values.

const PRODUCT_SELECT = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  unitPrice: true,
  costPrice: true,
  description: true,
  weight: true,
  taxRate: true,
  tags: true,
  isActive: true,
  isDigital: true,
  featured: true,
  minStock: true,
  maxStock: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  images: true,
} as const;

const PRODUCT_SELECT_MINIMAL = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  unitPrice: true,
  costPrice: true,
  description: true,
  weight: true,
  taxRate: true,
  tags: true,
  isActive: true,
  category: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  images: true,
} as const;

// ============================================
// NORMALIZATION HELPERS
// ============================================

function normalizeInventoryItem(item: any): FlatInventoryItem | null {
  if (!item) return null;

  const product = item.product || null;
  const variant = item.variant || null;

  const quantity =
    typeof item.quantity === 'number'
      ? item.quantity
      : typeof product?.stock === 'number'
      ? product.stock
      : 0;

  const reserved = typeof item.reserved === 'number' ? item.reserved : 0;
  const available =
    typeof item.available === 'number' ? item.available : quantity - reserved;

  const unitPrice =
    product?.unitPrice ?? variant?.price ?? item.unitPrice ?? 0;
  const costPrice = product?.costPrice ?? item.costPrice ?? 0;

  const categoryName =
    product?.category?.name ?? item.category ?? 'Uncategorized';
  const categoryId =
    product?.category?.id ?? product?.categoryId ?? item.categoryId ?? null;

  const supplierName = item.supplier ?? product?.supplier?.name ?? null;
  const supplierId =
    product?.supplierId ?? product?.supplier?.id ?? item.supplierId ?? null;

  const images =
    item.images && Array.isArray(item.images) && item.images.length > 0
      ? toImageUrls(item.images)
      : toImageUrls(product?.images);

  const tags =
    item.tags && Array.isArray(item.tags) && item.tags.length > 0
      ? item.tags
      : product?.tags || [];

  const status =
    quantity === 0
      ? 'out_of_stock'
      : quantity <= (item.reorderPoint || 5)
      ? 'low_stock'
      : item.status === 'INACTIVE'
      ? 'inactive'
      : 'active';

  const createdAt =
    item.createdAt ?? product?.createdAt ?? new Date().toISOString();
  const updatedAt =
    item.updatedAt ?? product?.updatedAt ?? new Date().toISOString();

  return {
    id: item.id || product?.id,
    productId: product?.id ?? item.productId ?? null,
    product: product,
    variantId: variant?.id ?? item.variantId ?? null,
    variant: variant,
    name: product?.name ?? variant?.name ?? item.name ?? 'Unknown Product',
    description: item.description ?? product?.description ?? null,
    sku: product?.sku ?? variant?.sku ?? item.sku ?? 'N/A',
    barcode: product?.barcode ?? item.barcode ?? null,
    quantity,
    stock: quantity,
    reserved,
    available,
    price: unitPrice,
    unitPrice,
    costPrice,
    reorderPoint: item.reorderPoint ?? 5,
    reorderQuantity: item.reorderQuantity ?? 10,
    category: categoryName,
    categoryId,
    location: item.location ?? 'Warehouse',
    shelfNumber: item.shelfNumber ?? null,
    supplier: supplierName,
    supplierId,
    notes: item.notes ?? null,
    lastUpdated: updatedAt,
    createdAt,
    updatedAt,
    status,
    isActive: product?.isActive ?? item.isActive ?? true,
    images,
    tags,
    weight: item.weight ?? product?.weight ?? 0,
    taxRate: item.taxRate ?? product?.taxRate ?? 0,
    isDigital: product?.isDigital ?? item.isDigital ?? false,
    featured: product?.featured ?? item.featured ?? false,
    inventory: [{ quantity, reserved }],
    businessUnitId: item.businessUnitId ?? product?.businessUnitId ?? '',
  };
}

function normalizeInventoryItems(items: any[]): FlatInventoryItem[] {
  if (!items || !Array.isArray(items)) return [];
  return items
    .map(normalizeInventoryItem)
    .filter((item): item is FlatInventoryItem => item !== null);
}

// ============================================
// INVENTORY SERVICE
// ============================================

export class InventoryService extends BaseService {
  private isValidID(id: string): boolean {
    if (!id || id === 'default') return false;
    const cuidRegex = /^c[a-z0-9]{24}$/i;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const simpleIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;
    return cuidRegex.test(id) || uuidRegex.test(id) || simpleIdRegex.test(id);
  }

  private async getAllBusinessUnits(): Promise<
    Array<{ id: string; name: string }>
  > {
    try {
      const businessUnits = await this.prisma.businessUnit.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true },
      });
      return businessUnits;
    } catch (err) {
      const error = toError(err);
      console.error('❌ Failed to fetch business units:', error);
      return [];
    }
  }

  private async getBusinessUnits(
    businessUnitId?: string
  ): Promise<Array<{ id: string; name: string }>> {
    if (
      businessUnitId &&
      businessUnitId !== 'default' &&
      businessUnitId !== 'default-business-unit'
    ) {
      const existing = await this.prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
        select: { id: true, name: true, isActive: true },
      });

      if (existing && existing.isActive) {
        return [{ id: existing.id, name: existing.name }];
      }

      return this.getAllBusinessUnits();
    }
    return this.getAllBusinessUnits();
  }

  private async ensureBusinessUnit(
    businessUnitId?: string
  ): Promise<{ id: string; name: string }> {
    const isSentinel =
      !businessUnitId ||
      businessUnitId === 'default' ||
      businessUnitId === 'default-business-unit' ||
      businessUnitId === 'undefined' ||
      businessUnitId === 'null' ||
      businessUnitId === '';

    if (isSentinel) {
      const allUnits = await this.getAllBusinessUnits();

      if (allUnits.length > 0) {
        return allUnits[0];
      }

      let company = await this.prisma.company.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (!company) {
        company = await this.prisma.company.create({
          data: {
            name: 'Default Company',
            email: 'default@company.com',
            phone: '+0000000000',
            isActive: true,
          },
        });
      }

      const newBusinessUnit = await this.prisma.businessUnit.create({
        data: {
          name: 'Default Business Unit',
          code: `BU-${Date.now().toString().slice(-6)}`,
          isActive: true,
          companyId: company.id,
          type: 'STORE',
        },
      });

      return { id: newBusinessUnit.id, name: newBusinessUnit.name };
    }

    const existing = await this.prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
      select: { id: true, name: true, isActive: true },
    });

    if (existing && existing.isActive) {
      return { id: existing.id, name: existing.name };
    }

    if (existing && !existing.isActive) {
      throw new AppError(`Business unit ${businessUnitId} is inactive`, 400);
    }

    throw new AppError(`Business unit ${businessUnitId} not found`, 404);
  }

  private safeEmitInventoryUpdate(data: any, businessUnitId: string): void {
    const fn = (realtimeService as any)?.emitInventoryUpdated;
    if (typeof fn !== 'function') return;
    try {
      fn.call(realtimeService, data, businessUnitId);
    } catch (err) {
      console.error('[inventory] realtime emit failed:', toError(err));
    }
  }

  private safeEmitLowStockAlert(data: any, businessUnitId: string): void {
    const fn = (realtimeService as any)?.emitLowStockAlert;
    if (typeof fn !== 'function') return;
    try {
      fn.call(realtimeService, data, businessUnitId);
    } catch (err) {
      console.error('[inventory] realtime low-stock emit failed:', toError(err));
    }
  }

  private async generateUniqueBarcode(tx: any): Promise<string> {
    let barcode: string;
    let counter = 0;
    do {
      barcode = `2${Date.now().toString().slice(-11)}${counter}`.slice(0, 13);
      counter++;
      if (counter > 100) {
        throw new AppError('Failed to generate unique barcode', 500);
      }
    } while (await tx.product.findFirst({ where: { barcode } }));
    return barcode;
  }

  /**
   * ✅ FIX #1: The Map's value type now allows `id: string | null`
   *    so it matches what `categoryId` actually is. Previously the
   *    type inferred from the initial literal was `id?: string |
   *    undefined`, and passing `string | null` failed.
   */
  private async calculateInventoryStats(
    businessUnitId: string
  ): Promise<InventoryStats> {
    try {
      const inventoryItems = await this.prisma.inventory.findMany({
        where: { businessUnitId },
        include: {
          product: {
            select: {
              costPrice: true,
              unitPrice: true,
              category: { select: { name: true, id: true } },
            },
          },
        },
      });

      let lowStockCount = 0;
      let outOfStockCount = 0;
      let totalValueAmount = 0;
      let totalCostAmount = 0;
      let totalUnits = 0;
      let totalReserved = 0;

      // ✅ `id` is now `string | null` — matches `categoryId` exactly.
      const categoryStats = new Map<
        string,
        { count: number; value: number; id: string | null }
      >();

      for (const item of inventoryItems) {
        const quantity = item.quantity ?? 0;
        const reorderPoint = item.reorderPoint ?? 5;

        if (quantity === 0) outOfStockCount++;
        else if (quantity <= reorderPoint) lowStockCount++;

        totalValueAmount += quantity * (item.product?.unitPrice || 0);
        totalCostAmount += quantity * (item.product?.costPrice || 0);
        totalUnits += quantity;
        totalReserved += item.reserved || 0;

        const categoryName = item.product?.category?.name || 'Uncategorized';
        const categoryId = item.product?.category?.id ?? null;
        const current = categoryStats.get(categoryName) || {
          count: 0,
          value: 0,
          id: categoryId,
        };
        current.count += quantity;
        current.value += quantity * (item.product?.unitPrice || 0);
        categoryStats.set(categoryName, current);
      }

      return {
        totalProducts: inventoryItems.length,
        lowStockCount,
        outOfStockCount,
        totalValue: totalValueAmount,
        totalCost: totalCostAmount,
        potentialProfit: totalValueAmount - totalCostAmount,
        profitMargin:
          totalCostAmount > 0
            ? ((totalValueAmount - totalCostAmount) / totalCostAmount) * 100
            : 0,
        totalUnits,
        totalReserved,
        availableUnits: totalUnits - totalReserved,
        byCategory: Array.from(categoryStats.entries()).map(
          ([category, data]) => ({ category, ...data })
        ),
      };
    } catch (err) {
      console.warn('Failed to calculate inventory stats:', toError(err));
      return {
        totalProducts: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        totalValue: 0,
        totalCost: 0,
        potentialProfit: 0,
        profitMargin: 0,
        totalUnits: 0,
        totalReserved: 0,
        availableUnits: 0,
        byCategory: [],
      };
    }
  }

  private formatInventoryItem(item: any): FlatInventoryItem | null {
    return normalizeInventoryItem(item);
  }

  // ============================================
  // REFERENCE DATA
  // ============================================

  async getCategories(businessUnitId?: string): Promise<CategoryOption[]> {
    try {
      let actualBusinessUnitId: string | undefined;

      if (
        businessUnitId &&
        businessUnitId !== 'default' &&
        businessUnitId !== 'default-business-unit'
      ) {
        const existing = await this.prisma.businessUnit.findUnique({
          where: { id: businessUnitId },
          select: { id: true, isActive: true },
        });
        if (existing && existing.isActive) {
          actualBusinessUnitId = existing.id;
        }
      }

      if (!actualBusinessUnitId) {
        const firstBU = await this.prisma.businessUnit.findFirst({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { createdAt: 'asc' },
        });
        if (firstBU) actualBusinessUnitId = firstBU.id;
        else return [];
      }

      const categories = await this.prisma.category.findMany({
        where: { isActive: true, businessUnitId: actualBusinessUnitId },
        include: {
          _count: {
            select: { products: { where: { isActive: true } } },
          },
          children: {
            where: { isActive: true },
            select: { id: true, name: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      return categories.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        productCount: cat._count?.products || 0,
      }));
    } catch (err) {
      console.error('❌ Failed to fetch categories:', toError(err));
      return [];
    }
  }

  async getSuppliers(businessUnitId?: string): Promise<
    Array<{ id: string; name: string; email?: string | null; phone?: string | null }>
  > {
    try {
      return await this.prisma.supplier.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true, phone: true },
        orderBy: { name: 'asc' },
      });
    } catch (err) {
      console.error('❌ Failed to fetch suppliers:', toError(err));
      return [];
    }
  }

  async getCategorySummary(businessUnitId: string): Promise<
    Array<{
      id: string;
      name: string;
      categoryId?: string;
      count: number;
      value: number;
    }>
  > {
    try {
      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const categories = await this.prisma.category.findMany({
        where: { businessUnitId: resolvedBU.id, isActive: true },
        include: {
          products: {
            where: {
              isActive: true,
              inventory: { some: { businessUnitId: resolvedBU.id } },
            },
            select: {
              id: true,
              unitPrice: true,
              inventory: {
                where: { businessUnitId: resolvedBU.id },
                select: { quantity: true },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      return categories.map((cat: any) => {
        let totalCount = 0;
        let totalValue = 0;
        cat.products.forEach((product: any) => {
          const inventory = product.inventory?.[0];
          if (inventory) {
            const quantity = inventory.quantity || 0;
            totalCount += quantity;
            totalValue += quantity * (product.unitPrice || 0);
          }
        });
        return {
          id: cat.id,
          name: cat.name,
          categoryId: cat.id,
          count: totalCount,
          value: totalValue,
        };
      });
    } catch (err) {
      console.error('❌ Failed to fetch category summary:', toError(err));
      return [];
    }
  }

  // ============================================
  // GET ENDPOINTS
  // ============================================

  async getInventory(params: {
    page?: number;
    limit?: number;
    search?: string;
    businessUnitId?: string;
    lowStock?: boolean;
    productId?: string;
    category?: string;
    location?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    includeInactive?: boolean;
    hasBarcode?: boolean;
    minPrice?: number;
    maxPrice?: number;
    supplier?: string;
    inStock?: boolean;
  }) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        businessUnitId,
        lowStock,
        productId,
        category,
        location,
        status,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
        hasBarcode,
        supplier,
        inStock,
      } = params;

      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(200, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      const validSortFields = [
        'id','quantity','reserved','available','reorderPoint',
        'reorderQuantity','location','shelfNumber','supplier','notes',
        'status','createdAt','updatedAt',
      ];

      const orderBy = validSortFields.includes(sortBy)
        ? { [sortBy]: sortOrder }
        : { createdAt: sortOrder };

      const where: any = {};

      if (productId) where.productId = productId;
      if (location)
        where.location = { contains: location, mode: 'insensitive' as const };
      if (status === 'inactive') where.status = 'INACTIVE';
      if (lowStock) where.quantity = { lte: 10, gt: 0 };

      if (inStock === true) where.quantity = { gt: 0 };
      else if (inStock === false) where.quantity = { equals: 0 };

      if (search) {
        where.OR = [
          { product: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
          { product: { is: { sku: { contains: search, mode: 'insensitive' as const } } } },
          { product: { is: { barcode: { contains: search, mode: 'insensitive' as const } } } },
        ];
      }

      const productFilter: any = {};
      if (category) {
        productFilter.category = {
          is: { name: { contains: category, mode: 'insensitive' as const } },
        };
      }
      if (hasBarcode === true) {
        productFilter.barcode = { not: null };
      } else if (hasBarcode === false) {
        productFilter.barcode = null;
      }
      if (Object.keys(productFilter).length > 0) {
        where.product = { is: productFilter };
      }

      if (supplier) {
        where.supplier = { contains: supplier, mode: 'insensitive' as const };
      }

      const include = {
        product: { select: PRODUCT_SELECT },
        variant: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            attributes: true,
            isActive: true,
            images: true,
          },
        },
        businessUnit: { select: { id: true, name: true, code: true } },
      };

      const isAllBusinessUnits =
        !businessUnitId ||
        businessUnitId === 'default' ||
        businessUnitId === 'default-business-unit';

      if (!isAllBusinessUnits) {
        const resolvedBU = await this.ensureBusinessUnit(businessUnitId);
        where.businessUnitId = resolvedBU.id;
      }

      const [inventory, total, stats] = await Promise.all([
        this.prisma.inventory.findMany({
          where,
          skip,
          take: validatedLimit,
          orderBy: orderBy as any,
          include,
        }),
        this.prisma.inventory.count({ where }),
        isAllBusinessUnits
          ? this.calculateCombinedStats()
          : this.calculateInventoryStats(
              (await this.ensureBusinessUnit(businessUnitId)).id
            ),
      ]);

      const formattedInventory = normalizeInventoryItems(inventory);

      return {
        inventory: formattedInventory,
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
        stats,
        appliedFilters: {
          search: search || null,
          category: category || null,
          location: location || null,
          status: status || null,
          lowStock: lowStock || false,
        },
      };
    } catch (err) {
      console.error('❌ Error in InventoryService.getInventory:', toError(err));
      throw err;
    }
  }

  private async calculateCombinedStats(): Promise<InventoryStats> {
    const allBusinessUnits = await this.getAllBusinessUnits();
    const combined: InventoryStats = {
      totalProducts: 0, lowStockCount: 0, outOfStockCount: 0,
      totalValue: 0, totalCost: 0, potentialProfit: 0, profitMargin: 0,
      totalUnits: 0, totalReserved: 0, availableUnits: 0, byCategory: [],
    };

    for (const bu of allBusinessUnits) {
      const stats = await this.calculateInventoryStats(bu.id);
      combined.totalProducts += stats.totalProducts;
      combined.lowStockCount += stats.lowStockCount;
      combined.outOfStockCount += stats.outOfStockCount;
      combined.totalValue += stats.totalValue;
      combined.totalCost += stats.totalCost;
      combined.potentialProfit += stats.potentialProfit;
      combined.totalUnits += stats.totalUnits;
      combined.totalReserved += stats.totalReserved;
      combined.availableUnits += stats.availableUnits;
      combined.byCategory = [...combined.byCategory, ...stats.byCategory];
    }

    combined.profitMargin =
      combined.totalCost > 0
        ? ((combined.totalValue - combined.totalCost) / combined.totalCost) * 100
        : 0;

    return combined;
  }

  async getAllInventory(
    businessUnitId: string
  ): Promise<{ items: FlatInventoryItem[]; stats: InventoryStats }> {
    try {
      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: { businessUnitId: resolvedBU.id },
        include: {
          product: { select: PRODUCT_SELECT },
          variant: {
            select: {
              id: true, name: true, sku: true, price: true,
              attributes: true, isActive: true, images: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return {
        items: normalizeInventoryItems(items),
        stats: await this.calculateInventoryStats(resolvedBU.id),
      };
    } catch (err) {
      this.handleError(err, 'InventoryService.getAllInventory');
      throw err;
    }
  }

  async getInventoryByProduct(
    productId: string,
    businessUnitId: string
  ): Promise<FlatInventoryItem | null> {
    try {
      if (!productId || !businessUnitId) {
        throw new AppError('Product ID and business unit ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const inventory = await this.prisma.inventory.findFirst({
        where: { businessUnitId: resolvedBU.id, productId },
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
              images: true,
              variants: { where: { isActive: true }, include: { images: true } },
            },
          },
          variant: { include: { images: true } },
          transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });

      if (!inventory) {
        throw new AppError('Product not found in inventory', 404);
      }

      return normalizeInventoryItem(inventory);
    } catch (err) {
      this.handleError(err, 'InventoryService.getInventoryByProduct');
      throw err;
    }
  }

  async getInventoryItemById(
    id: string,
    businessUnitId?: string
  ): Promise<FlatInventoryItem | null> {
    try {
      if (!id) throw new AppError('Inventory ID is required', 400);

      const include = {
        product: {
          include: {
            category: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } },
            images: true,
            creator: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        variant: { include: { images: true } },
        transactions: {
          orderBy: { createdAt: 'desc' as const },
          take: 50,
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        issues: {
          where: { status: 'ISSUED' as const },
          orderBy: { createdAt: 'desc' as const },
          take: 10,
        },
      };

      let resolvedBuId: string | undefined;
      if (businessUnitId) {
        const resolvedBU = await this.ensureBusinessUnit(businessUnitId);
        resolvedBuId = resolvedBU.id;
      }

      const primaryWhere: any = { id };
      if (resolvedBuId) primaryWhere.businessUnitId = resolvedBuId;

      let item = await this.prisma.inventory.findFirst({
        where: primaryWhere,
        include,
      });

      if (!item) {
        const productWhere: any = {
          product: { is: { id } },
        };
        if (resolvedBuId) productWhere.businessUnitId = resolvedBuId;

        item = await this.prisma.inventory.findFirst({
          where: productWhere,
          include,
        });
      }

      if (!item) return null;
      return normalizeInventoryItem(item);
    } catch (err) {
      this.handleError(err, 'InventoryService.getInventoryItemById');

      const error = toError(err);

      if (error instanceof AppError) {
        const status = (error as AppError & { status?: number }).status;
        if (status === 404) return null;
      }

      throw error;
    }
  }

  async getInventoryItem(id: string): Promise<FlatInventoryItem | null> {
    return this.getInventoryItemById(id);
  }

  async getLowStockItems(businessUnitId: string): Promise<FlatInventoryItem[]> {
    try {
      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const all = await this.prisma.inventory.findMany({
        where: { businessUnitId: resolvedBU.id, quantity: { gt: 0 } },
        include: {
          product: { select: PRODUCT_SELECT_MINIMAL },
          variant: { select: { id: true, name: true, sku: true, images: true } },
        },
        orderBy: { quantity: 'asc' },
      });

      const lowStock = all.filter(
        (row) => row.quantity <= (row.reorderPoint ?? 5)
      );

      return normalizeInventoryItems(lowStock);
    } catch (err) {
      this.handleError(err, 'InventoryService.getLowStockItems');
      return [];
    }
  }

  async getOutOfStockItems(
    businessUnitId: string
  ): Promise<FlatInventoryItem[]> {
    try {
      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: { businessUnitId: resolvedBU.id, quantity: 0 },
        include: {
          product: { select: PRODUCT_SELECT_MINIMAL },
          variant: { select: { id: true, name: true, sku: true, images: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return normalizeInventoryItems(items);
    } catch (err) {
      this.handleError(err, 'InventoryService.getOutOfStockItems');
      return [];
    }
  }

  async getInventoryValue(businessUnitId: string) {
    try {
      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: { businessUnitId: resolvedBU.id },
        include: { product: { select: { costPrice: true, unitPrice: true } } },
      });

      const totalCost = items.reduce(
        (sum: number, item: any) => sum + item.quantity * (item.product?.costPrice || 0), 0
      );
      const totalValue = items.reduce(
        (sum: number, item: any) => sum + item.quantity * (item.product?.unitPrice || 0), 0
      );

      return {
        totalCost,
        totalValue,
        profitMargin: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
        itemCount: items.length,
        totalUnits: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      };
    } catch (err) {
      this.handleError(err, 'InventoryService.getInventoryValue');
      throw err;
    }
  }

  async getInventoryTransactions(params: {
    page?: number;
    limit?: number;
    productId?: string;
    businessUnitId?: string;
    transactionType?: string;
    startDate?: Date;
    endDate?: Date;
    variantId?: string;
  }): Promise<{
    transactions: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    summary: { totalIn: number; totalOut: number; netChange: number };
  }> {
    try {
      const {
        page = 1, limit = 20, productId, businessUnitId,
        transactionType, startDate, endDate, variantId,
      } = params;

      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);
      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(100, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: any = { businessUnitId: resolvedBU.id };
      if (productId) where.productId = productId;
      if (variantId) where.variantId = variantId;
      if (transactionType) where.transactionType = transactionType;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const [transactions, total] = await Promise.all([
        this.prisma.inventoryTransaction.findMany({
          where, skip, take: validatedLimit,
          orderBy: { createdAt: 'desc' },
          include: {
            product: { select: { id: true, name: true, sku: true, images: true } },
            variant: { select: { id: true, name: true, sku: true, images: true } },
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        this.prisma.inventoryTransaction.count({ where }),
      ]);

      const totalIn = transactions
        .filter((t: any) => t.quantity > 0)
        .reduce((sum: number, t: any) => sum + t.quantity, 0);
      const totalOut = transactions
        .filter((t: any) => t.quantity < 0)
        .reduce((sum: number, t: any) => sum + Math.abs(t.quantity), 0);

      return {
        transactions, total,
        page: validatedPage, limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
        summary: { totalIn, totalOut, netChange: totalIn - totalOut },
      };
    } catch (err) {
      this.handleError(err, 'InventoryService.getInventoryTransactions');
      throw err;
    }
  }

  async getInventoryByLocation(
    location: string,
    businessUnitId: string
  ): Promise<FlatInventoryItem[]> {
    try {
      if (!location || !businessUnitId)
        throw new AppError('Location and business unit ID are required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: {
          businessUnitId: resolvedBU.id,
          location: { contains: location, mode: 'insensitive' },
        },
        include: {
          product: { select: PRODUCT_SELECT_MINIMAL },
        },
      });

      return normalizeInventoryItems(items);
    } catch (err) {
      this.handleError(err, 'InventoryService.getInventoryByLocation');
      return [];
    }
  }

  async getInventoryByCategory(
    category: string,
    businessUnitId: string
  ): Promise<FlatInventoryItem[]> {
    try {
      if (!category || !businessUnitId)
        throw new AppError('Category and business unit ID are required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: {
          businessUnitId: resolvedBU.id,
          product: {
            is: { category: { is: { name: { contains: category, mode: 'insensitive' } } } },
          },
        },
        include: {
          product: { select: PRODUCT_SELECT_MINIMAL },
        },
      });

      return normalizeInventoryItems(items);
    } catch (err) {
      this.handleError(err, 'InventoryService.getInventoryByCategory');
      return [];
    }
  }

  async searchProducts(params: {
    query: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    businessUnitId: string;
  }): Promise<FlatInventoryItem[]> {
    try {
      const { query, category, minPrice, maxPrice, businessUnitId } = params;

      if (!query || !businessUnitId)
        throw new AppError('Query and business unit ID are required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const where: any = {
        businessUnitId: resolvedBU.id,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
          { barcode: { contains: query, mode: 'insensitive' } },
        ],
      };

      if (category)
        where.category = { is: { name: { contains: category, mode: 'insensitive' } } };
      if (minPrice !== undefined || maxPrice !== undefined) {
        where.unitPrice = {};
        if (minPrice !== undefined) where.unitPrice.gte = minPrice;
        if (maxPrice !== undefined) where.unitPrice.lte = maxPrice;
      }

      const products = await this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          images: true,
          inventory: {
            where: { businessUnitId: resolvedBU.id },
            select: {
              id: true, quantity: true, reserved: true, reorderPoint: true,
              location: true, images: true, description: true,
              weight: true, taxRate: true, tags: true,
            },
          },
          variants: { where: { isActive: true }, include: { images: true } },
        },
        orderBy: { name: 'asc' },
        take: 50,
      });

      return products
        .map((product: any) => {
          if (product.inventory && product.inventory[0]) {
            return normalizeInventoryItem({ ...product.inventory[0], product });
          }
          return null;
        })
        .filter((item): item is FlatInventoryItem => item !== null);
    } catch (err) {
      this.handleError(err, 'InventoryService.searchProducts');
      throw err;
    }
  }

  async getTotalItems(businessUnitId: string): Promise<number> {
    try {
      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);
      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);
      return await this.prisma.inventory.count({
        where: { businessUnitId: resolvedBU.id },
      });
    } catch (err) {
      this.handleError(err, 'InventoryService.getTotalItems');
      return 0;
    }
  }

  async getStockMovements(params: {
    productId?: string;
    variantId?: string;
    businessUnitId: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    try {
      const { productId, variantId, businessUnitId, startDate, endDate, limit = 100 } = params;
      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);
      const where: any = { businessUnitId: resolvedBU.id };
      if (productId) where.productId = productId;
      if (variantId) where.variantId = variantId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      return await this.prisma.inventoryTransaction.findMany({
        where, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true, sku: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      });
    } catch (err) {
      this.handleError(err, 'InventoryService.getStockMovements');
      return [];
    }
  }

  async getInventoryStats(businessUnitId: string) {
    try {
      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const [totalItems, lowStockItems, outOfStockItems, totalValue, categories, stats] =
        await Promise.all([
          this.getTotalItems(resolvedBU.id),
          this.getLowStockItems(resolvedBU.id),
          this.getOutOfStockItems(resolvedBU.id),
          this.getInventoryValue(resolvedBU.id),
          this.getCategorySummary(resolvedBU.id),
          this.calculateInventoryStats(resolvedBU.id),
        ]);

      return {
        ...stats,
        totalItems,
        lowStockItems: lowStockItems.length,
        outOfStockItems: outOfStockItems.length,
        totalValue: totalValue.totalValue,
        totalCost: totalValue.totalCost,
        profitMargin: totalValue.profitMargin,
        categories,
        timestamp: new Date(),
      };
    } catch (err) {
      this.handleError(err, 'InventoryService.getInventoryStats');
      throw err;
    }
  }

  async getInventoryReport(
    businessUnitId: string,
    params?: {
      includeInactive?: boolean;
      categoryId?: string;
      location?: string;
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<InventoryReport> {
    try {
      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);
      const where: any = { businessUnitId: resolvedBU.id };
      if (params?.location) where.location = params.location;

      const [items, transactions] = await Promise.all([
        this.prisma.inventory.findMany({
          where,
          include: { product: { include: { category: true, supplier: true } } },
        }),
        this.prisma.inventoryTransaction.findMany({
          where: {
            businessUnitId: resolvedBU.id,
            ...(params?.dateRange && {
              createdAt: { gte: params.dateRange.start, lte: params.dateRange.end },
            }),
          },
          include: { product: { select: { id: true, name: true } } },
        }),
      ]);

      const totalValue = items.reduce(
        (sum: number, item: any) => sum + item.quantity * (item.product?.unitPrice || 0), 0
      );
      const totalCost = items.reduce(
        (sum: number, item: any) => sum + item.quantity * (item.product?.costPrice || 0), 0
      );
      const lowStock = items.filter(
        (i: any) => i.quantity <= (i.reorderPoint || 5) && i.quantity > 0
      ).length;
      const outOfStock = items.filter((i: any) => i.quantity === 0).length;

      const categoryMap = new Map<string, { count: number; value: number }>();
      items.forEach((item: any) => {
        const name = item.product?.category?.name || 'Uncategorized';
        const current = categoryMap.get(name) || { count: 0, value: 0 };
        current.count += item.quantity;
        current.value += item.quantity * (item.product?.unitPrice || 0);
        categoryMap.set(name, current);
      });

      const locationMap = new Map<string, { count: number; value: number }>();
      items.forEach((item: any) => {
        const location = item.location || 'Warehouse';
        const current = locationMap.get(location) || { count: 0, value: 0 };
        current.count += item.quantity;
        current.value += item.quantity * (item.product?.unitPrice || 0);
        locationMap.set(location, current);
      });

      const movementMap = new Map<string, { productId: string; name: string; movements: number }>();
      transactions.forEach((tx: any) => {
        const productId = tx.productId;
        const current = movementMap.get(productId) || {
          productId, name: tx.product?.name || 'Unknown', movements: 0,
        };
        current.movements += Math.abs(tx.quantity);
        movementMap.set(productId, current);
      });

      const topMovers = Array.from(movementMap.values())
        .sort((a, b) => b.movements - a.movements)
        .slice(0, 10);

      return {
        totalItems: items.length, totalValue, totalCost,
        potentialProfit: totalValue - totalCost,
        lowStockItems: lowStock, outOfStockItems: outOfStock,
        byCategory: Array.from(categoryMap.entries()).map(([category, data]) => ({ category, ...data })),
        byLocation: Array.from(locationMap.entries()).map(([location, data]) => ({ location, ...data })),
        topMovers,
      };
    } catch (err) {
      this.handleError(err, 'InventoryService.getInventoryReport');
      throw err;
    }
  }

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  async createItem(data: CreateItemData): Promise<FlatInventoryItem> {
    try {
      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);
      const businessUnitId = resolvedBU.id;

      const sku =
        data.sku ||
        `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      let categoryId = data.categoryId;
      if (data.category && !categoryId) {
        const existingCategory = await this.prisma.category.findFirst({
          where: { name: { equals: data.category, mode: 'insensitive' }, businessUnitId },
        });
        if (existingCategory) categoryId = existingCategory.id;
        else {
          // ✅ FIX #2: `Category.slug` is required by Prisma.
          // Generate one from the name, then resolve collisions by
          // appending a numeric suffix — same uniqueness rule the
          // DB's `@@unique([businessUnitId, slug])` enforces.
          const baseSlug = slugify(data.category);
          let slug = baseSlug;
          let suffix = 1;

          // Bounded loop: in practice we never go past 1 or 2
          // iterations because the base slug is derived from a
          // free-text name that just failed a find-first lookup.
          while (
            await this.prisma.category.findFirst({
              where: { businessUnitId, slug },
              select: { id: true },
            })
          ) {
            slug = `${baseSlug}-${suffix++}`;
            if (suffix > 100) {
              throw new AppError(
                `Could not generate a unique slug for category "${data.category}"`,
                500
              );
            }
          }

          const newCategory = await this.prisma.category.create({
            data: {
              name: data.category,
              slug,
              businessUnitId,
              isActive: true,
            },
          });
          categoryId = newCategory.id;
        }
      }

      let supplierId = data.supplierId;
      if (data.supplier && !supplierId) {
        const existingSupplier = await this.prisma.supplier.findFirst({
          where: { name: { equals: data.supplier, mode: 'insensitive' } },
        });
        if (existingSupplier) supplierId = existingSupplier.id;
        else {
          const company = await this.prisma.company.findFirst();
          if (company) {
            const newSupplier = await this.prisma.supplier.create({
              data: {
                name: data.supplier,
                email: `${data.supplier.toLowerCase().replace(/\s+/g, '.')}@supplier.com`,
                phone: '+0000000000',
                companyId: company.id,
                isActive: true,
              },
            });
            supplierId = newSupplier.id;
          }
        }
      }

      return await this.prisma.$transaction(async (tx) => {
        const locationId = await resolveLocationId(tx, businessUnitId, data.location);

        const product = await tx.product.create({
          data: {
            name: data.name,
            sku: sku.toUpperCase(),
            description: data.description || '',
            unitPrice: data.unitPrice || 0,
            costPrice: data.costPrice ?? 0,
            minStock: data.minStock || 5,
            maxStock: data.maxStock || 100,
            barcode: data.barcode || null,
            taxRate: data.taxRate || null,
            weight: data.weight || null,
            tags: data.tags || [],
            images: toImageCreateInput(toImageUrls(data.images)),
            categoryId: categoryId || null,
            supplierId: supplierId || null,
            businessUnitId,
            createdBy: data.userId,
            updatedBy: data.userId,
            isActive: data.isActive !== undefined ? data.isActive : true,
            isDigital: data.isDigital || false,
            featured: data.featured || false,
            rating: 0,
            reviewCount: 0,
            inventoryId: null,
          },
        });

        const inventory = await tx.inventory.create({
          data: {
            businessUnitId,
            quantity: data.quantity || 0,
            reserved: 0,
            available: data.quantity || 0,
            reorderPoint: data.minStock || 5,
            reorderQuantity: data.maxStock || 100,
            location: data.location || 'Warehouse',
            locationId,
            supplier: data.supplier || null,
            notes: data.notes || null,
            status: 'ACTIVE',
            images: toImageUrls(data.images),
            description: data.description || '',
            weight: data.weight || 0,
            taxRate: data.taxRate || 0,
            tags: data.tags || [],
          },
        });

        await tx.product.update({
          where: { id: product.id },
          data: { inventoryId: inventory.id },
        });

        if (data.quantity && data.quantity > 0) {
          await tx.inventoryTransaction.create({
            data: {
              transactionType: 'INITIAL',
              quantity: data.quantity,
              notes: 'Initial stock entry',
              productId: product.id,
              inventoryId: inventory.id,
              businessUnitId,
              userId: data.userId,
            },
          });
        }

        const fullProduct = await tx.product.findUnique({
          where: { id: product.id },
          include: {
            category: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } },
            images: true,
          },
        });

        const formatted = normalizeInventoryItem({ ...inventory, product: fullProduct });
        if (!formatted) throw new AppError('Failed to create inventory item', 500);
        return formatted;
      });
    } catch (err) {
      this.handleError(err, 'InventoryService.createItem');
      throw err;
    }
  }

  async createInventory(data: {
    name: string; sku?: string; description?: string;
    categoryId?: string; category?: string;
    supplierId?: string; supplier?: string;
    quantity?: number; minStock?: number; maxStock?: number;
    unitPrice?: number; costPrice?: number; location?: string;
    barcode?: string; notes?: string;
    businessUnitId: string; userId: string;
    weight?: number; taxRate?: number; tags?: string[];
    images?: string[]; isActive?: boolean; isDigital?: boolean; featured?: boolean;
  }): Promise<FlatInventoryItem> {
    return this.createItem({
      name: data.name,
      sku: data.sku,
      category: data.category || '',
      categoryId: data.categoryId,
      quantity: data.quantity || 0,
      unit: 'each',
      minStock: data.minStock,
      maxStock: data.maxStock,
      location: data.location,
      supplier: data.supplier,
      supplierId: data.supplierId,
      unitPrice: data.unitPrice,
      costPrice: data.costPrice,
      notes: data.notes,
      businessUnitId: data.businessUnitId,
      userId: data.userId,
      description: data.description,
      barcode: data.barcode,
      weight: data.weight,
      taxRate: data.taxRate,
      tags: data.tags,
      images: data.images,
      isActive: data.isActive,
      isDigital: data.isDigital,
      featured: data.featured,
    });
  }

  async createProductWithInventory(data: CreateProductData): Promise<FlatInventoryItem> {
    try {
      if (!data.name || !data.sku || !data.businessUnitId || !data.userId) {
        throw new AppError('Name, SKU, business unit ID, and user ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);

      return await this.prisma.$transaction(async (tx) => {
        const existingProduct = await tx.product.findFirst({
          where: { sku: data.sku.toUpperCase(), businessUnitId: resolvedBU.id },
        });
        if (existingProduct)
          throw new AppError('Product with this SKU already exists', 400);

        const locationId = await resolveLocationId(tx, resolvedBU.id, data.location);

        const inventory = await tx.inventory.create({
          data: {
            businessUnitId: resolvedBU.id,
            quantity: data.stock || 0,
            reserved: 0,
            available: data.stock || 0,
            reorderPoint: data.reorderPoint || 5,
            reorderQuantity: Math.max(data.reorderPoint || 5, 10),
            location: data.location || 'Warehouse',
            locationId,
            supplier: data.supplier || null,
            status: 'ACTIVE',
            images: toImageUrls(data.images),
            description: data.description || '',
            weight: 0, taxRate: 0, tags: [],
          },
        });

        const product = await tx.product.create({
          data: {
            name: data.name,
            sku: data.sku.toUpperCase(),
            unitPrice: data.price || data.unitPrice || 0,
            costPrice: data.costPrice || 0,
            barcode: data.barcode || (await this.generateUniqueBarcode(tx)),
            description: data.description,
            images: toImageCreateInput(toImageUrls(data.images)),
            businessUnitId: resolvedBU.id,
            createdBy: data.userId,
            isActive: true,
            categoryId: data.categoryId,
            supplierId: data.supplierId,
            inventoryId: inventory.id,
            minStock: data.reorderPoint || 5,
            maxStock: Math.max(data.reorderPoint || 5, 10),
          },
        });

        if (data.stock > 0) {
          await tx.inventoryTransaction.create({
            data: {
              transactionType: 'INITIAL',
              quantity: data.stock,
              notes: `Initial stock setup: ${data.stock} units`,
              productId: product.id,
              inventoryId: inventory.id,
              businessUnitId: resolvedBU.id,
              userId: data.userId,
            },
          });
        }

        this.safeEmitInventoryUpdate(
          { productId: product.id, quantity: data.stock || 0 },
          resolvedBU.id
        );

        const fullProduct = await tx.product.findUnique({
          where: { id: product.id },
          include: {
            category: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } },
            images: true,
          },
        });

        const formatted = normalizeInventoryItem({ ...inventory, product: fullProduct });
        if (!formatted)
          throw new AppError('Failed to create product with inventory', 500);
        return formatted;
      });
    } catch (err) {
      this.handleError(err, 'InventoryService.createProductWithInventory');
      throw err;
    }
  }

  async updateItem(id: string, data: any): Promise<FlatInventoryItem> {
    try {
      if (!id || !data.businessUnitId) {
        throw new AppError('Inventory ID and business unit ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);

      const result = await this.prisma.$transaction(async (tx) => {
        let inventoryItem = await tx.inventory.findFirst({
          where: { id, businessUnitId: resolvedBU.id },
          include: { product: true },
        });

        if (!inventoryItem) {
          inventoryItem = await tx.inventory.findFirst({
            where: {
              businessUnitId: resolvedBU.id,
              product: { is: { id } },
            },
            include: { product: true },
          });
        }

        if (!inventoryItem) {
          throw new AppError('Inventory item not found', 404);
        }

        const inventoryRowId = inventoryItem.id;

        const productUpdateData: any = {};
        if (data.name !== undefined) productUpdateData.name = data.name;
        if (data.sku !== undefined)
          productUpdateData.sku = String(data.sku).toUpperCase();
        if (data.unitPrice !== undefined) productUpdateData.unitPrice = data.unitPrice;
        if (data.costPrice !== undefined) productUpdateData.costPrice = data.costPrice;
        if (data.description !== undefined) productUpdateData.description = data.description;
        if (data.notes !== undefined) productUpdateData.notes = data.notes;
        if (data.barcode !== undefined) productUpdateData.barcode = data.barcode;
        if (data.tags !== undefined) productUpdateData.tags = data.tags;
        if (data.images !== undefined)
          productUpdateData.images = toImageUpdateInput(toImageUrls(data.images));
        if (data.weight !== undefined) productUpdateData.weight = data.weight;
        if (data.taxRate !== undefined) productUpdateData.taxRate = data.taxRate;
        if (data.categoryId !== undefined) productUpdateData.categoryId = data.categoryId;
        if (data.supplierId !== undefined) productUpdateData.supplierId = data.supplierId;
        if (data.isActive !== undefined) productUpdateData.isActive = data.isActive;
        if (data.featured !== undefined) productUpdateData.featured = data.featured;
        if (data.isDigital !== undefined) productUpdateData.isDigital = data.isDigital;

        let product = inventoryItem.product;
        if (Object.keys(productUpdateData).length > 0 && product) {
          product = await tx.product.update({
            where: { id: product.id },
            data: productUpdateData,
          });
        }

        const inventoryUpdateData: any = {};
        if (data.location !== undefined) {
          inventoryUpdateData.location = data.location;
          inventoryUpdateData.locationId = await resolveLocationId(
            tx, resolvedBU.id, data.location
          );
        }
        if (data.minStock !== undefined) inventoryUpdateData.reorderPoint = data.minStock;
        if (data.maxStock !== undefined) inventoryUpdateData.reorderQuantity = data.maxStock;
        if (data.supplier !== undefined) inventoryUpdateData.supplier = data.supplier;
        if (data.notes !== undefined) inventoryUpdateData.notes = data.notes;
        if (data.images !== undefined) inventoryUpdateData.images = toImageUrls(data.images);
        if (data.description !== undefined) inventoryUpdateData.description = data.description;
        if (data.weight !== undefined) inventoryUpdateData.weight = data.weight;
        if (data.taxRate !== undefined) inventoryUpdateData.taxRate = data.taxRate;
        if (data.tags !== undefined) inventoryUpdateData.tags = data.tags;

        let inventory: any = inventoryItem;
        if (Object.keys(inventoryUpdateData).length > 0) {
          inventory = await tx.inventory.update({
            where: { id: inventoryRowId },
            data: inventoryUpdateData,
          });
        }

        if (
          data.quantity !== undefined &&
          Number(data.quantity) !== inventoryItem.quantity
        ) {
          const newQty = Number(data.quantity);
          const delta = Math.abs(newQty - inventoryItem.quantity);
          const isIncrease = newQty > inventoryItem.quantity;
          const currentReserved = inventoryItem.reserved || 0;
          const newAvailable = Math.max(0, newQty - currentReserved);

          if (newQty < 0) {
            throw new AppError('Quantity cannot be negative', 400);
          }

          inventory = await tx.inventory.update({
            where: { id: inventoryRowId },
            data: { quantity: newQty, available: newAvailable },
          });

          if (delta > 0 && product?.id) {
            await tx.inventoryTransaction.create({
              data: {
                transactionType: isIncrease ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
                quantity: isIncrease ? delta : -delta,
                notes: `Quantity adjusted from ${inventoryItem.quantity} to ${newQty}`,
                productId: product.id,
                inventoryId: inventoryRowId,
                businessUnitId: resolvedBU.id,
                userId: data.userId || 'system',
              },
            });
          }
        }

        const finalProduct = product
          ? await tx.product.findUnique({
              where: { id: product.id },
              include: {
                category: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true } },
                images: true,
              },
            })
          : product;

        return normalizeInventoryItem({ ...inventory, product: finalProduct });
      });

      if (!result) throw new AppError('Failed to update inventory item', 500);
      return result;
    } catch (err) {
      this.handleError(err, 'InventoryService.updateItem');
      throw err;
    }
  }

  async updateProduct(id: string, data: UpdateProductData): Promise<FlatInventoryItem> {
    try {
      if (!id || !data.businessUnitId) {
        throw new AppError('Inventory ID and business unit ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);

      const result = await this.prisma.$transaction(async (tx) => {
        const inventoryItem = await tx.inventory.findFirst({
          where: { id, businessUnitId: resolvedBU.id },
          include: { product: true },
        });
        if (!inventoryItem) throw new AppError('Inventory item not found', 404);

        const productUpdateData: any = {};
        if (data.name !== undefined) productUpdateData.name = data.name;
        if (data.sku !== undefined) productUpdateData.sku = data.sku.toUpperCase();
        if (data.price !== undefined || data.unitPrice !== undefined)
          productUpdateData.unitPrice = data.price || data.unitPrice;
        if (data.costPrice !== undefined) productUpdateData.costPrice = data.costPrice;
        if (data.description !== undefined) productUpdateData.description = data.description;
        if (data.images !== undefined)
          productUpdateData.images = toImageUpdateInput(toImageUrls(data.images));

        let product = inventoryItem.product;
        if (Object.keys(productUpdateData).length > 0 && product) {
          product = await tx.product.update({
            where: { id: product.id }, data: productUpdateData,
          });
        }

        const inventoryUpdateData: any = {};
        if (data.location !== undefined) {
          inventoryUpdateData.location = data.location;
          inventoryUpdateData.locationId = await resolveLocationId(
            tx, resolvedBU.id, data.location
          );
        }
        if (data.status !== undefined) inventoryUpdateData.status = data.status;
        if (data.description !== undefined) inventoryUpdateData.description = data.description;
        if (data.images !== undefined) inventoryUpdateData.images = toImageUrls(data.images);

        let inventory: any = inventoryItem;
        if (Object.keys(inventoryUpdateData).length > 0) {
          inventory = await tx.inventory.update({ where: { id }, data: inventoryUpdateData });
        }

        const finalProduct = product
          ? await tx.product.findUnique({
              where: { id: product.id },
              include: {
                category: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true } },
                images: true,
              },
            })
          : product;

        return normalizeInventoryItem({ ...inventory, product: finalProduct });
      });

      if (!result) throw new AppError('Failed to update product', 500);
      return result;
    } catch (err) {
      this.handleError(err, 'InventoryService.updateProduct');
      throw err;
    }
  }

  async updateInventory(
    id: string,
    data: {
      name?: string; sku?: string; description?: string;
      categoryId?: string; supplierId?: string;
      quantity?: number; minStock?: number; maxStock?: number;
      unitPrice?: number; costPrice?: number; location?: string;
      barcode?: string; notes?: string; isActive?: boolean;
      images?: string[]; tags?: string[]; weight?: number; taxRate?: number;
    }
  ): Promise<FlatInventoryItem> {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id }, include: { product: true },
      });
      if (!inventory) throw new AppError('Inventory item not found', 404);
      if (!inventory.product) throw new AppError('Associated product not found', 404);

      const productData: any = {};
      if (data.name !== undefined) productData.name = data.name;
      if (data.sku !== undefined) productData.sku = data.sku.toUpperCase();
      if (data.description !== undefined) productData.description = data.description;
      if (data.unitPrice !== undefined) productData.unitPrice = data.unitPrice;
      if (data.costPrice !== undefined) productData.costPrice = data.costPrice;
      if (data.minStock !== undefined) productData.minStock = data.minStock;
      if (data.maxStock !== undefined) productData.maxStock = data.maxStock;
      if (data.barcode !== undefined) productData.barcode = data.barcode;
      if (data.categoryId !== undefined) productData.categoryId = data.categoryId;
      if (data.supplierId !== undefined) productData.supplierId = data.supplierId;
      if (data.isActive !== undefined) productData.isActive = data.isActive;
      if (data.images !== undefined)
        productData.images = toImageUpdateInput(toImageUrls(data.images));
      if (data.tags !== undefined) productData.tags = data.tags;
      if (data.weight !== undefined) productData.weight = data.weight;
      if (data.taxRate !== undefined) productData.taxRate = data.taxRate;

      await this.prisma.product.update({
        where: { id: inventory.product.id }, data: productData,
      });

      const inventoryData: any = {};
      if (data.quantity !== undefined) inventoryData.quantity = data.quantity;
      if (data.minStock !== undefined) inventoryData.reorderPoint = data.minStock;
      if (data.maxStock !== undefined) inventoryData.reorderQuantity = data.maxStock;
      if (data.location !== undefined) {
        inventoryData.location = data.location;
        inventoryData.locationId = await resolveLocationId(
          this.prisma, inventory.businessUnitId, data.location
        );
      }
      if (data.notes !== undefined) inventoryData.notes = data.notes;
      if (data.images !== undefined) inventoryData.images = toImageUrls(data.images);
      if (data.description !== undefined) inventoryData.description = data.description;
      if (data.weight !== undefined) inventoryData.weight = data.weight;
      if (data.taxRate !== undefined) inventoryData.taxRate = data.taxRate;
      if (data.tags !== undefined) inventoryData.tags = data.tags;

      const updatedInventory = await this.prisma.inventory.update({
        where: { id }, data: inventoryData,
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
              images: true,
            },
          },
        },
      });

      const result = normalizeInventoryItem(updatedInventory);
      if (!result) throw new AppError('Failed to update inventory', 500);
      return result;
    } catch (err) {
      this.handleError(err, 'InventoryService.updateInventory');
      throw err;
    }
  }

  async deleteProduct(
    id: string, businessUnitId: string, userId: string
  ): Promise<{ message: string; softDeleted: boolean }> {
    try {
      if (!id || !businessUnitId || !userId) {
        throw new AppError('Inventory ID, business unit ID, and user ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      return await this.prisma.$transaction(async (tx) => {
        const inventoryItem = await tx.inventory.findFirst({
          where: { id, businessUnitId: resolvedBU.id },
          include: {
            product: { include: { _count: { select: { saleItems: true, orderItems: true } } } },
          },
        });
        if (!inventoryItem) throw new AppError('Inventory item not found', 404);

        const product = inventoryItem.product;
        const hasSales = (product?._count?.saleItems || 0) > 0;
        const hasOrders = (product?._count?.orderItems || 0) > 0;

        if (hasSales || hasOrders) {
          if (product) {
            await tx.product.update({
              where: { id: product.id },
              data: { isActive: false, deletedAt: new Date(), deletedBy: userId },
            });
          }
          await tx.inventory.update({
            where: { id }, data: { status: 'INACTIVE' },
          });
          return {
            message: 'Product marked as inactive due to existing sales or orders',
            softDeleted: true,
          };
        }

        await tx.inventoryTransaction.deleteMany({ where: { inventoryId: id } });
        await tx.inventoryIssue.deleteMany({ where: { inventoryId: id } });
        await tx.inventory.delete({ where: { id } });
        if (product) await tx.product.delete({ where: { id: product.id } });

        return { message: 'Product deleted successfully', softDeleted: false };
      });
    } catch (err) {
      this.handleError(err, 'InventoryService.deleteProduct');
      throw err;
    }
  }

  async updateStock(data: UpdateStockData): Promise<FlatInventoryItem> {
    try {
      const {
        productId, quantity, transactionType, userId, businessUnitId,
        notes, reference, variantId, inventoryId,
      } = data;

      if (!productId || !businessUnitId || !userId) {
        throw new AppError('Product ID, business unit ID, and user ID are required', 400);
      }
      if (quantity <= 0) throw new AppError('Quantity must be positive', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      let inventory = inventoryId
        ? await this.prisma.inventory.findFirst({
            where: { id: inventoryId, businessUnitId: resolvedBU.id },
          })
        : null;

      if (!inventory) {
        inventory = await this.prisma.inventory.findFirst({
          where: {
            businessUnitId: resolvedBU.id,
            product: { is: { id: productId } },
          },
        });
      }

      if (!inventory) {
        const product = await this.prisma.product.findUnique({
          where: { id: productId },
          include: { images: true },
        });
        if (!product) throw new AppError('Product not found', 404);

        const locationId = await resolveLocationId(
          this.prisma, resolvedBU.id, 'Warehouse'
        );

        inventory = await this.prisma.inventory.create({
          data: {
            businessUnitId: resolvedBU.id,
            quantity: 0,
            reserved: 0,
            available: 0,
            reorderPoint: product.minStock || 5,
            reorderQuantity: 10,
            location: 'Warehouse',
            locationId,
            status: 'ACTIVE',
            images: toImageUrls(product.images),
            description: product.description || '',
            weight: product.weight || 0,
            taxRate: product.taxRate || 0,
            tags: product.tags || [],
          },
        });

        await this.prisma.product.update({
          where: { id: productId },
          data: { inventoryId: inventory.id },
        });
      }

      const decreasingTypes = ['SALE', 'ISSUE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'];
      const increasingTypes = ['PURCHASE', 'RESTOCK', 'RETURN', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'INITIAL'];

      const isDecrease = decreasingTypes.includes(transactionType);
      const isIncrease = increasingTypes.includes(transactionType);

      const currentQuantity = inventory.quantity;
      const currentReserved = inventory.reserved || 0;
      const currentAvailable = currentQuantity - currentReserved;

      let newQuantity: number;
      if (isDecrease) {
        if (currentAvailable < quantity) {
          throw new AppError(
            `Insufficient stock. Available: ${currentAvailable}`,
            400
          );
        }
        newQuantity = currentQuantity - quantity;
      } else if (isIncrease) {
        newQuantity = currentQuantity + quantity;
      } else {
        newQuantity = quantity;
      }

      if (newQuantity < 0) throw new AppError('Insufficient stock', 400);

      const newAvailable = Math.max(0, newQuantity - currentReserved);

      const updatedInventory = await this.prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity: newQuantity, available: newAvailable },
      });

      await this.prisma.inventoryTransaction.create({
        data: {
          transactionType: transactionType as any,
          quantity: isDecrease ? -quantity : quantity,
          notes: notes || null,
          reference: reference || null,
          productId,
          variantId: variantId || null,
          inventoryId: inventory.id,
          businessUnitId: resolvedBU.id,
          userId,
        },
      });

      if (newQuantity <= (updatedInventory.reorderPoint || 5)) {
        const product = await this.prisma.product.findUnique({
          where: { id: productId },
          select: { name: true },
        });
        await this.prisma.notification.create({
          data: {
            title: 'Low Stock Alert',
            message: `Product ${product?.name || productId} is below reorder point. Current stock: ${newQuantity}`,
            type: 'WARNING',
            userId,
            businessUnitId: resolvedBU.id,
            isRead: false,
          },
        });
      }

      const fullInventory = await this.prisma.inventory.findUnique({
        where: { id: updatedInventory.id },
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
              images: true,
            },
          },
        },
      });

      const result = normalizeInventoryItem(fullInventory);
      if (!result) throw new AppError('Failed to update stock', 500);
      return result;
    } catch (err) {
      this.handleError(err, 'InventoryService.updateStock');
      throw err;
    }
  }

  async reserveStock(
    productId: string, quantity: number, businessUnitId: string, variantId?: string
  ): Promise<FlatInventoryItem> {
    try {
      if (!productId || !businessUnitId)
        throw new AppError('Product ID and business unit ID are required', 400);
      if (quantity <= 0) throw new AppError('Quantity must be positive', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const inventory = await this.prisma.inventory.findFirst({
        where: { businessUnitId: resolvedBU.id, productId },
      });
      if (!inventory) throw new AppError('Product not found in inventory', 404);

      const currentQuantity = inventory.quantity;
      const currentReserved = inventory.reserved || 0;
      const currentAvailable = currentQuantity - currentReserved;
      if (currentAvailable < quantity)
        throw new AppError('Insufficient available stock', 400);

      const newReserved = currentReserved + quantity;
      const newAvailable = Math.max(0, currentQuantity - newReserved);

      const updated = await this.prisma.inventory.update({
        where: { id: inventory.id },
        data: { reserved: newReserved, available: newAvailable },
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
              images: true,
            },
          },
        },
      });

      const result = normalizeInventoryItem(updated);
      if (!result) throw new AppError('Failed to reserve stock', 500);
      return result;
    } catch (err) {
      this.handleError(err, 'InventoryService.reserveStock');
      throw err;
    }
  }

  async releaseReservedStock(
    productId: string, quantity: number, businessUnitId: string, variantId?: string
  ): Promise<FlatInventoryItem> {
    try {
      if (!productId || !businessUnitId)
        throw new AppError('Product ID and business unit ID are required', 400);
      if (quantity <= 0) throw new AppError('Quantity must be positive', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const inventory = await this.prisma.inventory.findFirst({
        where: { businessUnitId: resolvedBU.id, productId },
      });
      if (!inventory) throw new AppError('Product not found in inventory', 404);
      if ((inventory.reserved || 0) < quantity)
        throw new AppError('Cannot release more reserved stock than reserved', 400);

      const currentQuantity = inventory.quantity;
      const newReserved = (inventory.reserved || 0) - quantity;
      const newAvailable = Math.max(0, currentQuantity - newReserved);

      const updated = await this.prisma.inventory.update({
        where: { id: inventory.id },
        data: { reserved: newReserved, available: newAvailable },
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
              images: true,
            },
          },
        },
      });

      const result = normalizeInventoryItem(updated);
      if (!result) throw new AppError('Failed to release reserved stock', 500);
      return result;
    } catch (err) {
      this.handleError(err, 'InventoryService.releaseReservedStock');
      throw err;
    }
  }

  async transferStock(data: TransferStockData): Promise<{
    transferred: number; fromLocation: string; toLocation: string; reference: string;
  }> {
    try {
      const {
        productId, fromLocation, toLocation, quantity, notes,
        businessUnitId, userId, variantId,
      } = data;

      if (!productId || !fromLocation || !toLocation || !businessUnitId || !userId) {
        throw new AppError(
          'Product ID, locations, business unit ID, and user ID are required', 400
        );
      }
      if (quantity <= 0) throw new AppError('Quantity must be positive', 400);
      if (fromLocation === toLocation)
        throw new AppError('Source and destination locations must be different', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      return await this.prisma.$transaction(async (tx) => {
        const sourceInventory = await tx.inventory.findFirst({
          where: { businessUnitId: resolvedBU.id, productId, location: fromLocation },
        });
        if (!sourceInventory)
          throw new AppError(`Product not found in source location: ${fromLocation}`, 404);

        const sourceQuantity = sourceInventory.quantity;
        const sourceReserved = sourceInventory.reserved || 0;
        const sourceAvailable = sourceQuantity - sourceReserved;
        if (sourceAvailable < quantity)
          throw new AppError(
            `Insufficient stock in ${fromLocation}. Available: ${sourceAvailable}`, 400
          );

        let destInventory = await tx.inventory.findFirst({
          where: { businessUnitId: resolvedBU.id, productId, location: toLocation },
        });

        if (!destInventory) {
          const product = await tx.product.findUnique({
            where: { id: productId }, include: { images: true },
          });
          if (!product) throw new AppError('Product not found', 404);

          const destLocationId = await resolveLocationId(tx, resolvedBU.id, toLocation);

          destInventory = await tx.inventory.create({
            data: {
              businessUnitId: resolvedBU.id,
              location: toLocation,
              locationId: destLocationId,
              quantity: 0, reserved: 0, available: 0,
              reorderPoint: product.minStock || 5,
              reorderQuantity: 10,
              status: 'ACTIVE',
              images: toImageUrls(product.images),
              description: product.description || '',
              weight: product.weight || 0,
              taxRate: product.taxRate || 0,
              tags: product.tags || [],
            },
          });
        }

        const transferReference = `TRANSFER_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        const newSourceQuantity = sourceQuantity - quantity;
        const newSourceAvailable = Math.max(0, newSourceQuantity - sourceReserved);
        await tx.inventory.update({
          where: { id: sourceInventory.id },
          data: { quantity: newSourceQuantity, available: newSourceAvailable },
        });

        const destQuantity = destInventory.quantity;
        const destReserved = destInventory.reserved || 0;
        const newDestQuantity = destQuantity + quantity;
        const newDestAvailable = Math.max(0, newDestQuantity - destReserved);
        await tx.inventory.update({
          where: { id: destInventory.id },
          data: { quantity: newDestQuantity, available: newDestAvailable },
        });

        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'TRANSFER_OUT' as any,
            quantity: -quantity,
            notes: notes || `Transfer from ${fromLocation} to ${toLocation}`,
            reference: transferReference,
            productId, variantId: variantId || null,
            inventoryId: sourceInventory.id,
            businessUnitId: resolvedBU.id, userId,
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'TRANSFER_IN' as any,
            quantity,
            notes: notes || `Transfer from ${fromLocation} to ${toLocation}`,
            reference: transferReference,
            productId, variantId: variantId || null,
            inventoryId: destInventory.id,
            businessUnitId: resolvedBU.id, userId,
          },
        });

        return { transferred: quantity, fromLocation, toLocation, reference: transferReference };
      });
    } catch (err) {
      this.handleError(err, 'InventoryService.transferStock');
      throw err;
    }
  }

  async issueItem(data: IssueItemData): Promise<{ issue: any; inventory: FlatInventoryItem }> {
    try {
      if (!data.inventoryId || !data.issuedTo || !data.businessUnitId || !data.userId) {
        throw new AppError(
          'Inventory ID, issuedTo, business unit ID, and user ID are required', 400
        );
      }
      if (data.quantity <= 0) throw new AppError('Quantity must be positive', 400);

      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);

      return await this.prisma.$transaction(async (tx) => {
        const inventory = await tx.inventory.findFirst({
          where: { id: data.inventoryId, businessUnitId: resolvedBU.id },
        });
        if (!inventory) throw new AppError('Inventory item not found', 404);

        const currentQuantity = inventory.quantity;
        const currentReserved = inventory.reserved || 0;
        const currentAvailable = currentQuantity - currentReserved;
        if (currentAvailable < data.quantity)
          throw new AppError(`Insufficient stock. Available: ${currentAvailable}`, 400);

        const newQuantity = currentQuantity - data.quantity;
        const newAvailable = Math.max(0, newQuantity - currentReserved);

        const updatedInventory = await tx.inventory.update({
          where: { id: data.inventoryId },
          data: { quantity: newQuantity, available: newAvailable },
        });

        const product = await tx.product.findFirst({
          where: { inventoryId: data.inventoryId }, select: { id: true },
        });
        const productId = product?.id || '';

        const issue = await tx.inventoryIssue.create({
          data: {
            inventoryId: data.inventoryId,
            productId,
            issuedTo: data.issuedTo,
            quantity: data.quantity,
            purpose: data.purpose || null,
            remarks: data.remarks || null,
            expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
            businessUnitId: resolvedBU.id,
            userId: data.userId,
            status: 'ISSUED',
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'ISSUE' as any,
            quantity: -data.quantity,
            notes: `Issued to ${data.issuedTo}: ${data.purpose || 'No purpose specified'}`,
            productId, inventoryId: inventory.id,
            businessUnitId: resolvedBU.id,
            userId: data.userId,
            reference: `ISSUE_${issue.id}`,
          },
        });

        if (newQuantity <= (updatedInventory.reorderPoint || 5)) {
          const productName = await tx.product.findUnique({
            where: { id: productId }, select: { name: true },
          });
          await tx.notification.create({
            data: {
              title: 'Low Stock Alert',
              message: `Product ${productName?.name || inventory.id} is below reorder point. Current stock: ${newQuantity}`,
              type: 'WARNING',
              userId: data.userId, businessUnitId: resolvedBU.id, isRead: false,
            },
          });
          this.safeEmitLowStockAlert({ productId, quantity: newQuantity }, resolvedBU.id);
        }

        this.safeEmitInventoryUpdate({ productId, quantity: newQuantity }, resolvedBU.id);

        const fullInventory = await tx.inventory.findUnique({
          where: { id: updatedInventory.id },
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true } },
                images: true,
              },
            },
          },
        });

        const normalized = normalizeInventoryItem(fullInventory);
        if (!normalized) throw new AppError('Failed to issue item', 500);
        return { issue, inventory: normalized };
      });
    } catch (err) {
      this.handleError(err, 'InventoryService.issueItem');
      throw err;
    }
  }

  async returnItem(data: ReturnItemData): Promise<{
    issue: any; inventory: FlatInventoryItem; returnedQuantity: number;
  }> {
    try {
      if (!data.inventoryId || !data.businessUnitId || !data.userId) {
        throw new AppError('Inventory ID, business unit ID, and user ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);

      return await this.prisma.$transaction(async (tx) => {
        const issue = await tx.inventoryIssue.findFirst({
          where: { inventoryId: data.inventoryId, status: 'ISSUED' },
          orderBy: { createdAt: 'desc' },
        });
        if (!issue)
          throw new AppError('No active issue record found for this item', 404);

        const quantityToReturn = data.quantity || issue.quantity;
        if (quantityToReturn <= 0)
          throw new AppError('Return quantity must be positive', 400);
        if (quantityToReturn > issue.quantity)
          throw new AppError(
            `Cannot return more than issued quantity. Issued: ${issue.quantity}`, 400
          );

        const currentInventory = await tx.inventory.findUnique({
          where: { id: data.inventoryId },
        });
        const currentQuantity = currentInventory?.quantity || 0;
        const currentReserved = currentInventory?.reserved || 0;
        const newQuantity = currentQuantity + quantityToReturn;
        const newAvailable = Math.max(0, newQuantity - currentReserved);

        const inventory = await tx.inventory.update({
          where: { id: data.inventoryId },
          data: { quantity: newQuantity, available: newAvailable },
        });

        const updatedIssue = await tx.inventoryIssue.update({
          where: { id: issue.id },
          data: {
            status: quantityToReturn === issue.quantity ? 'RETURNED' : 'ISSUED',
            returnDate: data.returnDate ? new Date(data.returnDate) : new Date(),
            remarks: data.remarks || issue.remarks,
          },
        });

        const product = await tx.product.findFirst({
          where: { inventoryId: data.inventoryId }, select: { id: true },
        });
        const productId = product?.id || '';

        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'RETURN' as any,
            quantity: quantityToReturn,
            notes: `Returned from ${issue.issuedTo}: ${data.remarks || 'Returned'}`,
            productId, inventoryId: data.inventoryId,
            businessUnitId: resolvedBU.id,
            userId: data.userId,
            reference: `RETURN_${updatedIssue.id}`,
          },
        });

        this.safeEmitInventoryUpdate({ productId, quantity: newQuantity }, resolvedBU.id);

        const fullInventory = await tx.inventory.findUnique({
          where: { id: inventory.id },
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true } },
                images: true,
              },
            },
          },
        });

        const normalized = normalizeInventoryItem(fullInventory);
        if (!normalized) throw new AppError('Failed to return item', 500);
        return { issue: updatedIssue, inventory: normalized, returnedQuantity: quantityToReturn };
      });
    } catch (err) {
      this.handleError(err, 'InventoryService.returnItem');
      throw err;
    }
  }

  async restockItem(data: RestockItemData): Promise<{
    inventory: FlatInventoryItem; message: string;
  }> {
    try {
      if (!data.inventoryId || !data.businessUnitId || !data.userId) {
        throw new AppError('Inventory ID, business unit ID, and user ID are required', 400);
      }
      if (data.quantity <= 0)
        throw new AppError('Restock quantity must be positive', 400);

      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);

      return await this.prisma.$transaction(async (tx) => {
        const inventory = await tx.inventory.findFirst({
          where: { id: data.inventoryId, businessUnitId: resolvedBU.id },
        });
        if (!inventory) throw new AppError('Inventory item not found', 404);

        const currentQuantity = inventory.quantity;
        const currentReserved = inventory.reserved || 0;
        const newQuantity = currentQuantity + data.quantity;
        const newAvailable = Math.max(0, newQuantity - currentReserved);

        const updatedInventory = await tx.inventory.update({
          where: { id: data.inventoryId },
          data: {
            quantity: newQuantity, available: newAvailable,
            supplier: data.supplier || inventory.supplier,
          },
        });

        const product = await tx.product.findFirst({
          where: { inventoryId: data.inventoryId }, select: { id: true },
        });
        const productId = product?.id || '';

        if (data.unitPrice && data.unitPrice > 0 && productId) {
          await tx.product.update({
            where: { id: productId },
            data: { unitPrice: data.unitPrice, costPrice: data.unitPrice },
          });
        }

        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'PURCHASE' as any,
            quantity: data.quantity,
            notes: `Restocked ${data.quantity} units from ${data.supplier || 'Unknown supplier'}`,
            productId, inventoryId: inventory.id,
            businessUnitId: resolvedBU.id,
            userId: data.userId,
            reference: data.invoiceNumber || `RESTOCK_${Date.now()}`,
          },
        });

        this.safeEmitInventoryUpdate({ productId, quantity: newQuantity }, resolvedBU.id);

        const fullInventory = await tx.inventory.findUnique({
          where: { id: updatedInventory.id },
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true } },
                images: true,
              },
            },
          },
        });

        const normalized = normalizeInventoryItem(fullInventory);
        if (!normalized) throw new AppError('Failed to restock item', 500);
        return { inventory: normalized, message: 'Item restocked successfully' };
      });
    } catch (err) {
      this.handleError(err, 'InventoryService.restockItem');
      throw err;
    }
  }

  // ============================================
  // EXPORT
  // ============================================

  async exportInventory(
    businessUnitId: string,
    format: string = 'json'
  ): Promise<{ data: any[]; format: string; total: number; exportedAt: string }> {
    try {
      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: { businessUnitId: resolvedBU.id },
        include: {
          product: {
            select: {
              name: true, sku: true, barcode: true,
              unitPrice: true, costPrice: true,
              category: { select: { name: true } },
              images: true,
              tags: true, description: true, weight: true, taxRate: true,
            },
          },
          variant: { include: { images: true } },
        },
      });

      const exportData = items.map((item: any) => ({
        name: item.product?.name || 'N/A',
        sku: item.product?.sku || item.variant?.sku || 'N/A',
        barcode: item.product?.barcode || 'N/A',
        category: item.product?.category?.name || 'Uncategorized',
        stock: item.quantity,
        reserved: item.reserved || 0,
        available: item.quantity - (item.reserved || 0),
        reorderPoint: item.reorderPoint || 5,
        location: item.location || 'Warehouse',
        price: item.product?.unitPrice || 0,
        costPrice: item.product?.costPrice || 0,
        description: item.description || item.product?.description || '',
        weight: item.weight ?? item.product?.weight ?? 0,
        taxRate: item.taxRate ?? item.product?.taxRate ?? 0,
        tags:
          item.tags && item.tags.length > 0
            ? item.tags.join(', ')
            : (item.product?.tags || []).join(', '),
        images:
          item.images && item.images.length > 0
            ? toImageUrls(item.images).join(', ')
            : toImageUrls(item.product?.images).join(', '),
        lastUpdated: item.updatedAt.toISOString(),
      }));

      return { data: exportData, format, total: exportData.length, exportedAt: new Date().toISOString() };
    } catch (err) {
      this.handleError(err, 'InventoryService.exportInventory');
      throw err;
    }
  }

  async exportInventoryToFile(
    businessUnitId: string,
    format: 'csv' | 'excel' | 'json' = 'json'
  ): Promise<{ filePath: string; fileName: string; format: string; totalRecords: number }> {
    try {
      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);

      const result = await this.exportInventory(businessUnitId, format);
      const exportDir = path.join(process.cwd(), 'exports', 'inventory');

      if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `inventory_${timestamp}.${format === 'excel' ? 'xlsx' : format}`;
      const filePath = path.join(exportDir, fileName);

      if (format === 'csv') {
        const headers = Object.keys(result.data[0] || {}).join(',');
        const rows = result.data.map((row: any) => Object.values(row).join(','));
        fs.writeFileSync(filePath, [headers, ...rows].join('\n'));
      } else {
        fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2));
      }

      return { filePath, fileName, format, totalRecords: result.total };
    } catch (err) {
      this.handleError(err, 'InventoryService.exportInventoryToFile');
      throw err;
    }
  }

  // ============================================
  // BARCODE / QR CODE
  // ============================================

  async getInventoryByBarcode(
    barcode: string, businessUnitId: string
  ): Promise<FlatInventoryItem | null> {
    try {
      if (!barcode || !businessUnitId)
        throw new AppError('Barcode and business unit ID are required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      let inventory = await this.prisma.inventory.findFirst({
        where: { businessUnitId: resolvedBU.id, product: { is: { barcode } } },
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
              images: true,
              variants: { where: { isActive: true }, include: { images: true } },
            },
          },
          variant: { include: { images: true } },
          transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });

      if (!inventory) {
        inventory = await this.prisma.inventory.findFirst({
          where: {
            businessUnitId: resolvedBU.id,
            product: { is: { sku: { equals: barcode, mode: 'insensitive' } } },
          },
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true } },
                images: true,
                variants: { where: { isActive: true }, include: { images: true } },
              },
            },
            variant: { include: { images: true } },
            transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
          },
        });
      }

      if (!inventory) return null;
      return normalizeInventoryItem(inventory);
    } catch (err) {
      this.handleError(err, 'InventoryService.getInventoryByBarcode');
      return null;
    }
  }

  async getInventoryBySku(sku: string, businessUnitId: string): Promise<FlatInventoryItem | null> {
    try {
      if (!sku || !businessUnitId)
        throw new AppError('SKU and business unit ID are required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const inventory = await this.prisma.inventory.findFirst({
        where: {
          businessUnitId: resolvedBU.id,
          product: { is: { sku: { equals: sku, mode: 'insensitive' } } },
        },
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
              images: true,
              variants: { where: { isActive: true }, include: { images: true } },
            },
          },
          variant: { include: { images: true } },
          transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });

      if (!inventory) return null;
      return normalizeInventoryItem(inventory);
    } catch (err) {
      this.handleError(err, 'InventoryService.getInventoryBySku');
      return null;
    }
  }

  /**
   * ✅ FIX #3: The return type is now `ResolvedInventoryRow` instead
   *    of an implicit union. Previously the `include` parameter was
   *    typed `any`, so TypeScript widened the return type into a
   *    union that lost `.product.name`, `.product.sku`, etc. The
   *    callers below (`generateInventoryBarcode`,
   *    `generateInventoryQRCode`) then failed with dozens of TS2339
   *    "Property 'name' does not exist" errors.
   *
   *    The cast at the return site is safe because every caller
   *    passes `{ product: { include: { images: true } } }`, which is
   *    exactly the shape this type describes.
   */
  private async resolveInventoryRow(
    id: string,
    businessUnitId: string,
    include: any = {}
  ): Promise<ResolvedInventoryRow> {
    let row: any = await this.prisma.inventory.findFirst({
      where: { id, businessUnitId },
      include,
    });

    if (!row) {
      row = await this.prisma.inventory.findFirst({
        where: {
          businessUnitId,
          product: { is: { id } },
        },
        include,
      });
    }

    return (row ?? null) as ResolvedInventoryRow;
  }

  async generateInventoryBarcode(
    inventoryId: string, businessUnitId: string
  ): Promise<{ barcode: string; barcodeUrl: string; qrCodeUrl: string }> {
    try {
      if (!inventoryId || !businessUnitId)
        throw new AppError('Inventory ID and business unit ID are required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const inventory = await this.resolveInventoryRow(
        inventoryId,
        resolvedBU.id,
        { product: { include: { images: true } } }
      );

      if (!inventory) throw new AppError('Inventory item not found', 404);

      const barcode = await this.generateUniqueBarcode(this.prisma);

      if (inventory.product) {
        await this.prisma.product.update({
          where: { id: inventory.product.id },
          data: { barcode },
        });
      }

      const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=EAN-13&dpi=96`;
      const qrData = {
        type: 'INVENTORY_ITEM',
        id: inventory.id,
        productId: inventory.product?.id || '',
        name: inventory.product?.name || 'Unknown',
        sku: inventory.product?.sku || 'N/A',
        barcode,
        location: inventory.location || 'Warehouse',
        quantity: inventory.quantity,
        description: inventory.description || inventory.product?.description || '',
        weight: inventory.weight ?? inventory.product?.weight ?? 0,
        taxRate: inventory.taxRate ?? inventory.product?.taxRate ?? 0,
        timestamp: new Date().toISOString(),
      };
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`;

      return { barcode, barcodeUrl, qrCodeUrl };
    } catch (err) {
      this.handleError(err, 'InventoryService.generateInventoryBarcode');
      throw err;
    }
  }

  async generateInventoryQRCode(
    inventoryId: string, businessUnitId: string
  ): Promise<{ qrCodeUrl: string; qrData: any }> {
    try {
      if (!inventoryId || !businessUnitId)
        throw new AppError('Inventory ID and business unit ID are required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const inventory = await this.resolveInventoryRow(
        inventoryId,
        resolvedBU.id,
        { product: { include: { images: true } } }
      );

      if (!inventory) throw new AppError('Inventory item not found', 404);

      const barcode =
        inventory.product?.barcode ||
        (await this.generateUniqueBarcode(this.prisma));

      const qrData = {
        type: 'INVENTORY_ITEM',
        id: inventory.id,
        productId: inventory.product?.id || '',
        name: inventory.product?.name || 'Unknown',
        sku: inventory.product?.sku || 'N/A',
        barcode,
        location: inventory.location || 'Warehouse',
        quantity: inventory.quantity,
        minStock: inventory.reorderPoint || 5,
        description: inventory.description || inventory.product?.description || '',
        weight: inventory.weight ?? inventory.product?.weight ?? 0,
        taxRate: inventory.taxRate ?? inventory.product?.taxRate ?? 0,
        tags:
          inventory.tags && inventory.tags.length > 0
            ? inventory.tags
            : inventory.product?.tags || [],
        timestamp: new Date().toISOString(),
      };

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`;
      return { qrCodeUrl, qrData };
    } catch (err) {
      this.handleError(err, 'InventoryService.generateInventoryQRCode');
      throw err;
    }
  }

  async bulkGenerateInventoryBarcodes(
    inventoryIds: string[], businessUnitId: string
  ): Promise<{ results: any[]; errors: any[] }> {
    try {
      if (!inventoryIds || inventoryIds.length === 0 || !businessUnitId)
        throw new AppError('Inventory IDs and business unit ID are required', 400);

      const results: any[] = [];
      const errors: any[] = [];

      for (const id of inventoryIds) {
        try {
          const result = await this.generateInventoryBarcode(id, businessUnitId);
          results.push({ id, ...result });
        } catch (err) {
          errors.push({ id, error: toError(err).message });
        }
      }

      return { results, errors };
    } catch (err) {
      this.handleError(err, 'InventoryService.bulkGenerateInventoryBarcodes');
      throw err;
    }
  }

  private async syncInventoryFromProduct(
    productId: string, businessUnitId: string
  ): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        minStock: true, maxStock: true, supplierId: true,
        supplier: { select: { name: true } },
        categoryId: true,
        category: { select: { name: true } },
        images: true,
        description: true, weight: true, taxRate: true, tags: true,
      },
    });

    if (!product) return;

    await this.prisma.inventory.updateMany({
      where: { businessUnitId, productId },
      data: {
        reorderPoint: product.minStock || 5,
        reorderQuantity: product.maxStock || 100,
        supplier: product.supplier?.name || null,
        images: toImageUrls(product.images),
        description: product.description || '',
        weight: product.weight || 0,
        taxRate: product.taxRate || 0,
        tags: product.tags || [],
      },
    });
  }

  private async syncProductFromInventory(inventoryId: string): Promise<void> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: {
        product: { select: { id: true } },
        reorderPoint: true, reorderQuantity: true, location: true,
        images: true, description: true, weight: true, taxRate: true, tags: true,
      },
    });

    if (!inventory || !inventory.product) return;

    await this.prisma.product.update({
      where: { id: inventory.product.id },
      data: {
        minStock: inventory.reorderPoint,
        maxStock: inventory.reorderQuantity,
        images: toImageUpdateInput(toImageUrls(inventory.images)),
        description: inventory.description || '',
        weight: inventory.weight || 0,
        taxRate: inventory.taxRate || 0,
        tags: inventory.tags || [],
      },
    });
  }

  // ============================================
  // GET INVENTORY ITEMS
  // ============================================

  async getInventoryItems(params: {
    page?: number; limit?: number; search?: string;
    businessUnitId?: string; withoutProduct?: boolean;
  }): Promise<{
    items: FlatInventoryItem[]; total: number;
    page: number; limit: number; totalPages: number;
  }> {
    try {
      const { page = 1, limit = 20, search, businessUnitId, withoutProduct } = params;

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);
      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(200, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: any = { businessUnitId: resolvedBU.id, status: 'ACTIVE' };
      if (withoutProduct) where.product = { is: null };

      if (search) {
        where.OR = [
          { product: { is: { name: { contains: search, mode: 'insensitive' } } } },
          { product: { is: { sku: { contains: search, mode: 'insensitive' } } } },
          { product: { is: { barcode: { contains: search, mode: 'insensitive' } } } },
        ];
      }

      const [items, total] = await Promise.all([
        this.prisma.inventory.findMany({
          where, skip, take: validatedLimit,
          orderBy: { updatedAt: 'desc' },
          include: {
            product: { select: PRODUCT_SELECT },
            variant: {
              select: {
                id: true, name: true, sku: true, price: true,
                attributes: true, isActive: true, images: true,
              },
            },
          },
        }),
        this.prisma.inventory.count({ where }),
      ]);

      return {
        items: normalizeInventoryItems(items),
        total, page: validatedPage, limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
      };
    } catch (err) {
      this.handleError(err, 'InventoryService.getInventoryItems');
      throw err;
    }
  }
}

export default InventoryService;
