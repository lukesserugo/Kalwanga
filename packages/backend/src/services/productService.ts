// src/services/productService.ts
// FULLY REWRITTEN — canonical-aligned product service

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { persistImages, persistVariantImages } from '../lib/imageStorage.js';

// ============================================
// ENUMS (mirror of Prisma + canonical enums)
// ============================================

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
export type ProductType =
  | 'SIMPLE'
  | 'VARIABLE'
  | 'GROUPED'
  | 'BUNDLE'
  | 'DIGITAL'
  | 'SERVICE';
export type TaxType = 'INCLUSIVE' | 'EXCLUSIVE' | 'EXEMPT';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
export type WishlistStatus = 'ACTIVE' | 'REMOVED';

// ============================================
// CANONICAL INTERFACES (wire format)
// ============================================

export interface ProductDimensions {
  length: number;
  width: number;
  height: number;
  unit?: 'cm' | 'in' | 'mm';
}

export interface ProductSEO {
  title?: string;
  description?: string;
  slug?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export interface Inventory {
  id: string;
  businessUnitId: string;
  locationId?: string | null;
  quantity: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number;
  location?: string | null;
  shelfNumber?: string | null;
  supplier?: string | null;
  notes?: string | null;
  status: string;
  images: string[];
  description?: string | null;
  weight?: number | null;
  taxRate?: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductReview {
  id: string;
  productId: string;
  product?: Product | null;
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  } | null;
  rating: number;
  title?: string | null;
  comment?: string | null;
  images?: string[];
  isVerified: boolean;
  helpfulCount: number;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  product?: Product | null;
  name: string;
  sku: string;
  price: number;
  costPrice?: number | null;
  stock: number;
  reserved?: number;
  images?: string[];
  attributes: Record<string, any>;
  isActive: boolean;
  /** Singular — matches Prisma and Product.inventory. */
  inventory?: Inventory | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  sku: string;
  barcode?: string | null;
  unitPrice: number;
  costPrice?: number | null;
  taxRate?: number | null;
  minStock: number;
  maxStock?: number | null;
  isActive: boolean;
  isDigital: boolean;
  featured?: boolean;
  weight?: number | null;
  dimensions?: ProductDimensions | null;
  images: string[];
  attributes?: Record<string, any> | null;
  notes?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  categoryId?: string | null;
  category?: any | null;
  businessUnitId: string;
  businessUnit?: any | null;
  supplierId?: string | null;
  supplier?: any | null;
  inventoryId?: string | null;
  inventory?: Inventory | null;
  variants?: ProductVariant[];
  reviews?: ProductReview[];
  tags?: string[];
  seo?: ProductSEO | null;
  status?: ProductStatus;
  type?: ProductType;
  taxType?: TaxType;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  totalStock?: number;
  totalReserved?: number;
  totalAvailable?: number;
  productStock?: number;
  productReserved?: number;
  productAvailable?: number;
  variantStock?: number;
  variantReserved?: number;
  variantAvailable?: number;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  isLowStock?: boolean;
  isOutOfStock?: boolean;
}

// ============================================
// INPUT INTERFACES
// ============================================

export interface BarcodeInfo {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
  productId?: string;
  productName?: string;
  sku?: string;
  price?: number;
  format?: 'EAN-13' | 'UPC-A' | 'CODE128' | 'QR';
  generatedAt?: string;
}

export interface GenerateBarcodeOptions {
  prefix?: string;
  length?: number;
  productName?: string;
  sku?: string;
  format?: 'EAN-13' | 'UPC-A' | 'CODE128' | 'QR';
  includeQR?: boolean;
}

export interface ProductCreateData {
  name: string;
  sku?: string;
  description?: string;
  unitPrice?: number;
  costPrice?: number;
  barcode?: string;
  categoryId?: string;
  category?: string | { id: string };
  businessUnitId: string;
  isActive?: boolean;
  featured?: boolean;
  isDigital?: boolean;
  taxRate?: number;
  weight?: number;
  minStock?: number;
  maxStock?: number;
  tags?: string[];
  images?: string[];
  stock?: number;
  initialStock?: number;
  location?: string;
  supplier?: string;
  supplierId?: string;
  notes?: string;
  attributes?: Record<string, any>;
  seo?: Record<string, any>;
  dimensions?: string;
  variants?: Array<{
    name: string;
    sku?: string;
    price: number;
    costPrice?: number;
    stock: number;
    images?: string[];
    attributes: Record<string, any>;
    isActive?: boolean;
    barcode?: string;
    location?: string;
  }>;
}

export interface ProductUpdateData {
  name?: string;
  description?: string;
  sku?: string;
  barcode?: string;
  unitPrice?: number;
  costPrice?: number;
  taxRate?: number;
  minStock?: number;
  maxStock?: number;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  weight?: number;
  dimensions?: string;
  images?: string[];
  attributes?: Record<string, any>;
  notes?: string;
  tags?: string[];
  seo?: Record<string, any>;
  categoryId?: string | null;
  category?: string | { id: string } | null;
  supplierId?: string | null;
  supplier?: string | null;
  location?: string;
  variants?: Array<{
    id?: string;
    name?: string;
    sku?: string;
    price?: number;
    costPrice?: number;
    stock?: number;
    images?: string[];
    attributes?: Record<string, any>;
    isActive?: boolean;
    barcode?: string;
  }>;
}

export interface VariantCreateData {
  name: string;
  sku?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  images?: string[];
  attributes?: Record<string, any>;
  location?: string;
  isActive?: boolean;
  barcode?: string;
}

export interface VariantUpdateData {
  name?: string;
  sku?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  images?: string[];
  attributes?: Record<string, any>;
  isActive?: boolean;
}

// ============================================
// IMAGE HELPERS
// ============================================
//
// `Product.images`, `ProductVariant.images`, and `ProductReview.images`
// are Prisma RELATIONS (`*Image[]`), not scalar arrays. The wire format
// that consumers expect is `string[]` (URLs). These three helpers bridge
// the two shapes:
//
//   • `toImageUrls`        — flatten a relation array (or string array,
//                            or single string) into `string[]` (read).
//   • `toImageCreateInput` — build a Prisma `create` payload from a URL
//                            list (write, on create).
//   • `toImageUpdateInput` — build a Prisma `update` payload (delete all
//                            + recreate) from a URL list (write, on
//                            update).

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

// ============================================
// NORMALIZATION HELPERS
// ============================================

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return isNaN(n) ? 0 : n;
  }
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    try {
      return (value as any).toNumber();
    } catch {
      return 0;
    }
  }
  return Number(value) || 0;
}

function toJsonObject(value: unknown): Record<string, any> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value as Record<string, any>;
  return null;
}

function toDimensions(value: unknown): ProductDimensions | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as any;
  if (
    typeof v.length === 'number' &&
    typeof v.width === 'number' &&
    typeof v.height === 'number'
  ) {
    return { length: v.length, width: v.width, height: v.height, unit: v.unit };
  }
  return null;
}

function normalizeInventory(raw: any): Inventory | null {
  if (!raw) return null;
  return {
    id: String(raw.id),
    businessUnitId: String(raw.businessUnitId),
    locationId: raw.locationId ?? null,
    quantity: toNumber(raw.quantity),
    reserved: toNumber(raw.reserved),
    available: toNumber(raw.available),
    reorderPoint: toNumber(raw.reorderPoint),
    reorderQuantity: toNumber(raw.reorderQuantity),
    location: raw.location ?? null,
    shelfNumber: raw.shelfNumber ?? null,
    supplier: raw.supplier ?? null,
    notes: raw.notes ?? null,
    status: raw.status ?? 'ACTIVE',
    // Inventory.images is `String[]` (a scalar list, not a relation).
    images: Array.isArray(raw.images) ? raw.images : [],
    description: raw.description ?? null,
    weight: raw.weight != null ? toNumber(raw.weight) : null,
    taxRate: raw.taxRate != null ? toNumber(raw.taxRate) : null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    createdAt:
      raw.createdAt instanceof Date
        ? raw.createdAt.toISOString()
        : String(raw.createdAt ?? ''),
    updatedAt:
      raw.updatedAt instanceof Date
        ? raw.updatedAt.toISOString()
        : String(raw.updatedAt ?? ''),
  };
}

function normalizeReview(raw: any): ProductReview | null {
  if (!raw) return null;
  return {
    id: String(raw.id),
    productId: String(raw.productId),
    userId: String(raw.userId),
    user: raw.user
      ? {
          id: String(raw.user.id),
          firstName: raw.user.firstName ?? '',
          lastName: raw.user.lastName ?? '',
          email: raw.user.email,
        }
      : null,
    rating: toNumber(raw.rating),
    title: raw.title ?? null,
    comment: raw.comment ?? null,
    // ✅ Flatten the `ProductReviewImage[]` relation to URLs.
    images: toImageUrls(raw.images),
    isVerified: Boolean(raw.isVerified),
    helpfulCount: toNumber(raw.helpfulCount),
    status: (raw.status ?? 'PENDING') as ReviewStatus,
    createdAt:
      raw.createdAt instanceof Date
        ? raw.createdAt.toISOString()
        : String(raw.createdAt ?? ''),
    updatedAt:
      raw.updatedAt instanceof Date
        ? raw.updatedAt.toISOString()
        : String(raw.updatedAt ?? ''),
  };
}

function normalizeVariant(raw: any): ProductVariant | null {
  if (!raw) return null;

  return {
    id: String(raw.id),
    productId: String(raw.productId),
    name: raw.name ?? '',
    sku: raw.sku ?? '',
    price: toNumber(raw.price),
    costPrice: raw.costPrice != null ? toNumber(raw.costPrice) : null,
    stock: toNumber(raw.stock),
    reserved: toNumber(raw.reserved ?? 0),
    // ✅ Flatten the `ProductVariantImage[]` relation to URLs.
    images: toImageUrls(raw.images),
    attributes: toJsonObject(raw.attributes) ?? {},
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
    inventory: raw.inventory ? normalizeInventory(raw.inventory) : null,
    createdAt:
      raw.createdAt instanceof Date
        ? raw.createdAt.toISOString()
        : String(raw.createdAt ?? ''),
    updatedAt:
      raw.updatedAt instanceof Date
        ? raw.updatedAt.toISOString()
        : String(raw.updatedAt ?? ''),
    deletedAt: raw.deletedAt
      ? raw.deletedAt instanceof Date
        ? raw.deletedAt.toISOString()
        : String(raw.deletedAt)
      : null,
  };
}

function normalizeProduct(raw: any): Product | null {
  if (!raw) return null;

  const variants = Array.isArray(raw.variants)
    ? raw.variants
        .map(normalizeVariant)
        .filter((x: ProductVariant | null): x is ProductVariant => x !== null)
    : [];

  const reviews = Array.isArray(raw.reviews)
    ? raw.reviews
        .map(normalizeReview)
        .filter((x: ProductReview | null): x is ProductReview => x !== null)
    : [];

  return {
    id: String(raw.id),
    name: raw.name ?? '',
    description: raw.description ?? null,
    sku: raw.sku ?? '',
    barcode: raw.barcode ?? null,
    unitPrice: toNumber(raw.unitPrice),
    costPrice: raw.costPrice != null ? toNumber(raw.costPrice) : null,
    taxRate: raw.taxRate != null ? toNumber(raw.taxRate) : null,
    minStock: toNumber(raw.minStock),
    maxStock: raw.maxStock != null ? toNumber(raw.maxStock) : null,
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
    isDigital: Boolean(raw.isDigital),
    featured: Boolean(raw.featured),
    weight: raw.weight != null ? toNumber(raw.weight) : null,
    dimensions: toDimensions(raw.dimensions),
    // ✅ Flatten the `ProductImage[]` relation to URLs.
    images: toImageUrls(raw.images),
    attributes: toJsonObject(raw.attributes),
    notes: raw.notes ?? null,
    rating: raw.rating != null ? toNumber(raw.rating) : null,
    reviewCount:
      raw.reviewCount != null
        ? toNumber(raw.reviewCount)
        : raw._count?.reviews != null
        ? toNumber(raw._count.reviews)
        : null,
    categoryId: raw.categoryId ?? null,
    category: raw.category ?? null,
    businessUnitId: String(raw.businessUnitId),
    businessUnit: raw.businessUnit ?? null,
    supplierId: raw.supplierId ?? null,
    supplier: raw.supplier ?? null,
    inventoryId: raw.inventoryId ?? null,
    inventory: normalizeInventory(raw.inventory),
    variants,
    reviews,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    seo: toJsonObject(raw.seo),
    status: (raw.status ?? 'ACTIVE') as ProductStatus,
    type: (raw.type ?? 'SIMPLE') as ProductType,
    taxType: (raw.taxType ?? 'EXCLUSIVE') as TaxType,
    createdBy: raw.createdBy ?? null,
    updatedBy: raw.updatedBy ?? null,
    createdAt:
      raw.createdAt instanceof Date
        ? raw.createdAt.toISOString()
        : String(raw.createdAt ?? ''),
    updatedAt:
      raw.updatedAt instanceof Date
        ? raw.updatedAt.toISOString()
        : String(raw.updatedAt ?? ''),
    deletedAt: raw.deletedAt
      ? raw.deletedAt instanceof Date
        ? raw.deletedAt.toISOString()
        : String(raw.deletedAt)
      : null,
  };
}

function computeStockAggregates(
  product: Product
): Pick<
  Product,
  | 'totalStock'
  | 'totalReserved'
  | 'totalAvailable'
  | 'productStock'
  | 'productReserved'
  | 'productAvailable'
  | 'variantStock'
  | 'variantReserved'
  | 'variantAvailable'
  | 'stockStatus'
  | 'isLowStock'
  | 'isOutOfStock'
> {
  const productQty = product.inventory?.quantity ?? 0;
  const productRes = product.inventory?.reserved ?? 0;
  const productAvail = productQty - productRes;

  let variantTotalStock = 0;
  let variantReserved = 0;
  let variantAvailable = 0;

  for (const v of product.variants ?? []) {
    if (v.inventory) {
      variantTotalStock += v.inventory.quantity ?? 0;
      variantReserved += v.inventory.reserved ?? 0;
      variantAvailable +=
        (v.inventory.quantity ?? 0) - (v.inventory.reserved ?? 0);
    } else {
      variantTotalStock += v.stock ?? 0;
      variantAvailable += v.stock ?? 0;
    }
  }

  const totalStock = productQty + variantTotalStock;
  const totalReserved = productRes + variantReserved;
  const totalAvailable = productAvail + variantAvailable;

  let stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
  if (totalAvailable <= 0) stockStatus = 'out_of_stock';
  else if (totalAvailable <= (product.minStock || 5)) stockStatus = 'low_stock';

  return {
    totalStock,
    totalReserved,
    totalAvailable,
    productStock: productQty,
    productReserved: productRes,
    productAvailable: productAvail,
    variantStock: variantTotalStock,
    variantReserved,
    variantAvailable,
    stockStatus,
    isLowStock: stockStatus === 'low_stock',
    isOutOfStock: stockStatus === 'out_of_stock',
  };
}

// ============================================
// SHARED PRISMA INCLUDE SHAPES
// ============================================
//
// ⚠️ `images` is a RELATION on Product, ProductVariant, and ProductReview.
//    Without `images: true` (or `include: { images: ... }`) it comes back
//    `undefined`, and `normalizeProduct` emits `images: []` for every row.

const PRODUCT_LIST_INCLUDE = {
  category: true,
  inventory: true,
  images: true, // ✅ ProductImage[]
  variants: {
    where: { isActive: true },
    include: {
      inventory: true,
      images: true, // ✅ ProductVariantImage[]
    },
  },
  supplier: true,
  _count: {
    select: { saleItems: true, orderItems: true, reviews: true },
  },
} satisfies Prisma.ProductInclude;

const PRODUCT_DETAIL_INCLUDE = {
  category: true,
  inventory: true,
  images: true, // ✅ ProductImage[]
  variants: {
    where: { isActive: true },
    include: {
      inventory: true,
      images: true, // ✅ ProductVariantImage[]
    },
  },
  supplier: true,
  creator: { select: { id: true, firstName: true, lastName: true } },
  updater: { select: { id: true, firstName: true, lastName: true } },
  reviews: {
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      images: { orderBy: { order: 'asc' as const } }, // ✅ ProductReviewImage[]
    },
    orderBy: { createdAt: 'desc' as const },
  },
  _count: {
    select: { saleItems: true, orderItems: true, reviews: true },
  },
} satisfies Prisma.ProductInclude;

// ============================================
// PRODUCT SERVICE
// ============================================

export class ProductService extends BaseService {
  private static readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  private static readonly MAX_IMAGES = 10;
  private static readonly MAX_VARIANTS = 10;
  private static readonly PLACEHOLDER_IMAGE =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private safeEmitProductUpdate(product: any, businessUnitId: string): void {
    try {
      console.log(
        `📦 Product updated: ${product?.name || product?.id} - ${businessUnitId}`
      );
    } catch (error) {
      console.warn('Failed to emit product update:', error);
    }
  }

  private safeEmitInventoryUpdate(inventory: any, businessUnitId: string): void {
    try {
      console.log(`📦 Inventory updated: ${inventory?.id} - ${businessUnitId}`);
    } catch (error) {
      console.warn('Failed to emit inventory update:', error);
    }
  }

  private cleanImages(images: any[]): string[] {
    if (!Array.isArray(images) || images.length === 0) return [];

    const cleaned: string[] = [];
    let validCount = 0;

    for (const img of images) {
      if (validCount >= ProductService.MAX_IMAGES) break;
      if (typeof img !== 'string' || img.length === 0) continue;

      // data URLs are fine here — persistImages() will write them to disk.
      if (
        img.startsWith('data:image/') ||
        img.startsWith('http://') ||
        img.startsWith('https://') ||
        img.startsWith('/')
      ) {
        cleaned.push(img);
        validCount++;
        continue;
      }

      if (/^[A-Za-z0-9+/=\s]+$/.test(img.substring(0, 200))) {
        cleaned.push(`data:image/jpeg;base64,${img}`);
        validCount++;
        continue;
      }

      console.warn(`⚠️ Skipping invalid image: ${img.substring(0, 40)}...`);
    }

    return cleaned;
  }

  private extractCategoryId(
    categoryInput: string | { id: string } | undefined | null
  ): string | null {
    if (!categoryInput) return null;

    if (typeof categoryInput === 'string') {
      const trimmed = categoryInput.trim();
      if (
        !trimmed ||
        trimmed === 'null' ||
        trimmed === 'undefined' ||
        trimmed === ''
      ) {
        return null;
      }
      return trimmed;
    }

    if (
      typeof categoryInput === 'object' &&
      categoryInput !== null &&
      'id' in categoryInput
    ) {
      const id = categoryInput.id;
      if (id && typeof id === 'string') {
        const trimmed = id.trim();
        if (
          !trimmed ||
          trimmed === 'null' ||
          trimmed === 'undefined' ||
          trimmed === ''
        ) {
          return null;
        }
        return trimmed;
      }
    }

    return null;
  }

  private async resolveLocationId(
    businessUnitId: string,
    locationName: string | null | undefined
  ): Promise<string | null> {
    if (!locationName) return null;
    try {
      const location = await this.prisma.location.findFirst({
        where: { businessUnitId, name: locationName, deletedAt: null },
        select: { id: true },
      });
      return location?.id ?? null;
    } catch {
      return null;
    }
  }

  private prepareCreateData(data: ProductCreateData, userId: string): any {
    const categoryId = this.extractCategoryId(data.categoryId || data.category);

    const unitPrice = data.unitPrice ?? 0;
    const costPrice = data.costPrice ?? unitPrice;
    const stock = data.stock ?? data.initialStock ?? 0;

    const images = this.cleanImages(data.images || []);

    let tags: string[] = [];
    if (Array.isArray(data.tags)) {
      tags = data.tags.filter(
        (t: any) => typeof t === 'string' && t.trim().length > 0
      );
    } else if (typeof data.tags === 'string') {
      tags = (data.tags as string)
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean);
    }

    return {
      name: data.name?.trim(),
      description: data.description?.trim() || null,
      sku: this.generateSkuIfNeeded(data),
      barcode: data.barcode || undefined,
      unitPrice: Number(unitPrice),
      costPrice: Number(costPrice),
      taxRate: data.taxRate ? Number(data.taxRate) : 0,
      minStock: data.minStock ? Number(data.minStock) : 5,
      maxStock: data.maxStock ? Number(data.maxStock) : null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isDigital: data.isDigital || false,
      featured: data.featured || false,
      weight: data.weight ? Number(data.weight) : null,
      dimensions: data.dimensions || null,
      images: images,
      attributes: data.attributes || null,
      notes: data.notes?.trim() || null,
      tags: tags,
      seo: data.seo || null,
      rating: 0,
      reviewCount: 0,
      status: 'ACTIVE' as ProductStatus,
      type: 'SIMPLE' as ProductType,
      taxType: 'EXCLUSIVE' as TaxType,
      categoryId: categoryId,
      supplierId: data.supplierId || null,
      supplierName: data.supplier || null,
      businessUnitId: data.businessUnitId,
      createdBy: userId,
      updatedBy: userId,
      stock: Number(stock),
      location: (data.location || 'Warehouse').trim() || 'Warehouse',
    };
  }

  private async validateCategory(
    categoryId: string | null | undefined,
    businessUnitId: string
  ): Promise<string | null> {
    if (!categoryId) return null;

    try {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        console.warn(`⚠️ Category with ID "${categoryId}" not found`);
        return null;
      }

      if (category.businessUnitId !== businessUnitId) {
        console.warn(
          `⚠️ Category "${categoryId}" belongs to different business unit`
        );
        return null;
      }

      return categoryId;
    } catch (error) {
      console.warn(`⚠️ Error validating category:`, error);
      return null;
    }
  }

  private async validateSupplier(
    supplierId: string | null | undefined
  ): Promise<string | null> {
    if (!supplierId) return null;

    try {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier) {
        console.warn(`⚠️ Supplier with ID "${supplierId}" not found`);
        return null;
      }

      return supplierId;
    } catch (error) {
      console.warn(`⚠️ Error validating supplier:`, error);
      return null;
    }
  }

  private async generateUniqueBarcodeInternal(
    prefix: string = 'PRD',
    length: number = 12
  ): Promise<string> {
    let barcode: string;
    let counter = 0;

    do {
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      barcode = `${prefix}${timestamp}${random}`.slice(0, length);
      counter++;

      if (counter > 100) {
        throw new AppError(
          'Failed to generate unique barcode after 100 attempts',
          500
        );
      }
    } while (await this.prisma.product.findFirst({ where: { barcode } }));

    return barcode;
  }

  private generateBarcodeImageUrl(barcode: string, format?: string): string {
    const formatParam = format || 'EAN-13';
    return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
      barcode
    )}&code=${formatParam}&dpi=96`;
  }

  private generateQRCodeUrl(
    name: string,
    sku: string,
    barcode: string
  ): string {
    const data = { product: name, sku, barcode };
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
      JSON.stringify(data)
    )}&size=150x150`;
  }

  private handleServiceError(error: any, methodName: string): never {
    console.error(`❌ Error in ${methodName}:`, error);
    if (error instanceof AppError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new AppError(
          `Duplicate entry: ${error.meta?.target || 'field'} already exists`,
          400
        );
      }
      if (error.code === 'P2003') {
        throw new AppError('Foreign key constraint failed', 400);
      }
      if (error.code === 'P2025') {
        throw new AppError('Record not found', 404);
      }
    }
    throw new AppError(
      `Failed to ${methodName.replace('ProductService.', '')}: ${
        error.message || 'Unknown error'
      }`,
      500
    );
  }

  // ============================================
  // SKU METHODS
  // ============================================

  async checkSKUExists(
    sku: string,
    businessUnitId?: string,
    excludeProductId?: string
  ): Promise<boolean> {
    try {
      const where: any = {
        sku: { equals: sku.toUpperCase(), mode: 'insensitive' },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;
      if (excludeProductId) where.id = { not: excludeProductId };

      const existing = await this.prisma.product.findFirst({ where });
      return !!existing;
    } catch (error) {
      console.error('Error checking SKU:', error);
      return false;
    }
  }

  async ensureUniqueSKU(
    baseSKU: string,
    businessUnitId?: string,
    excludeProductId?: string
  ): Promise<string> {
    let sku = baseSKU.toUpperCase();
    let attempts = 0;
    const maxAttempts = 10;

    while (
      (await this.checkSKUExists(sku, businessUnitId, excludeProductId)) &&
      attempts < maxAttempts
    ) {
      const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
      sku = `${baseSKU.toUpperCase()}-${suffix}`;
      attempts++;
    }

    return sku;
  }

  generateProductSKU(productName?: string): string {
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const prefix =
      (productName || 'PRD')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'PRD';
    return `${prefix}-${timestamp}-${random}`;
  }

  generateVariantSKU(productName?: string, variantName?: string): string {
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const basePrefix =
      (productName || 'PRD')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'PRD';
    const variantPrefix =
      (variantName || 'VAR')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'VAR';
    return `${basePrefix}-${variantPrefix}-${timestamp}-${random}`;
  }

  private generateSkuIfNeeded(data: ProductCreateData): string {
    if (data.sku && data.sku !== 'SKU' && data.sku.trim() !== '') {
      return data.sku.toUpperCase().trim();
    }
    return this.generateProductSKU(data.name);
  }

  // ============================================
  // GET ALL PRODUCTS
  // ============================================

  async getAllProducts(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    businessUnitId?: string | string[];
    isActive?: boolean | string;
    minPrice?: number;
    maxPrice?: number;
    featured?: boolean | string;
    inStock?: boolean | string;
    minRating?: number;
    hasVariants?: boolean | string;
    hasBarcode?: boolean | string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isPublic?: boolean;
  }): Promise<{
    products: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        categoryId,
        businessUnitId,
        isActive,
        minPrice,
        maxPrice,
        featured,
        inStock,
        minRating,
        hasVariants,
        hasBarcode,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        isPublic = false,
      } = params;

      const validatedPage = Math.max(1, Number(page) || 1);
      const validatedLimit = Math.min(200, Math.max(1, Number(limit) || 10));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: Prisma.ProductWhereInput = {};

      if (businessUnitId) {
        if (Array.isArray(businessUnitId)) {
          if (businessUnitId.length > 0) {
            where.businessUnitId = { in: businessUnitId };
          }
        } else {
          where.businessUnitId = businessUnitId;
        }
      }

      if (isPublic) {
        where.isActive = true;
        where.deletedAt = null;
      } else if (isActive !== undefined) {
        where.isActive =
          typeof isActive === 'string' ? isActive === 'true' : isActive;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (categoryId) where.categoryId = categoryId;

      if (featured !== undefined) {
        where.featured =
          typeof featured === 'string' ? featured === 'true' : featured;
      }

      if (hasBarcode !== undefined) {
        const hasBarcodeBool =
          typeof hasBarcode === 'string' ? hasBarcode === 'true' : hasBarcode;
        where.barcode = hasBarcodeBool ? { not: null } : null;
      }

      if (minRating !== undefined && !isNaN(Number(minRating))) {
        where.rating = { gte: Number(minRating) };
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        where.unitPrice = {};
        if (minPrice !== undefined && !isNaN(Number(minPrice))) {
          where.unitPrice.gte = Number(minPrice);
        }
        if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
          where.unitPrice.lte = Number(maxPrice);
        }
      }

      if (hasVariants !== undefined) {
        const hasVariantsBool =
          typeof hasVariants === 'string'
            ? hasVariants === 'true'
            : hasVariants;
        where.variants = hasVariantsBool
          ? { some: { isActive: true } }
          : { none: {} };
      }

      const orderBy: Prisma.ProductOrderByWithRelationInput = {};
      const validSortFields = [
        'name',
        'sku',
        'unitPrice',
        'createdAt',
        'updatedAt',
        'rating',
      ];
      if (validSortFields.includes(sortBy)) {
        (orderBy as any)[sortBy] = sortOrder;
      } else {
        orderBy.createdAt = 'desc';
      }

      let [rawProducts, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take: validatedLimit,
          orderBy,
          include: PRODUCT_LIST_INCLUDE,
        }),
        this.prisma.product.count({ where }),
      ]);

      let products: Product[] = rawProducts
        .map(normalizeProduct)
        .filter((p): p is Product => p !== null);

      if (isPublic) {
        products = products.filter((product) => {
          const stock = computeStockAggregates(product);
          return (stock.totalAvailable ?? 0) > 0;
        });
        total = products.length;
      }

      if (inStock !== undefined) {
        const inStockBool =
          typeof inStock === 'string' ? inStock === 'true' : inStock;
        products = products.filter((product) => {
          const stock = computeStockAggregates(product);
          const available = stock.totalAvailable ?? 0;
          return inStockBool ? available > 0 : available === 0;
        });
        total = products.length;
      }

      const totalPages = Math.max(1, Math.ceil(total / validatedLimit));

      return {
        products,
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages,
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getAllProducts');
    }
  }

  // ============================================
  // GET PRODUCT BY ID
  // ============================================

  async getProductById(id: string): Promise<Product> {
    try {
      const raw = await this.prisma.product.findUnique({
        where: { id },
        include: PRODUCT_DETAIL_INCLUDE,
      });

      if (!raw) throw new AppError('Product not found', 404);

      const product = normalizeProduct(raw);
      if (!product) throw new AppError('Failed to normalize product', 500);

      const aggregates = computeStockAggregates(product);
      return { ...product, ...aggregates };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getProductById');
    }
  }

  // ============================================
  // GET PRODUCT BY SKU / BARCODE
  // ============================================

  async getProductBySku(sku: string, businessUnitId?: string): Promise<Product> {
    try {
      const where: Prisma.ProductWhereInput = {
        sku: { equals: sku, mode: 'insensitive' },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const raw = await this.prisma.product.findFirst({
        where,
        include: PRODUCT_DETAIL_INCLUDE,
      });

      if (!raw) throw new AppError('Product not found', 404);

      const product = normalizeProduct(raw);
      if (!product) throw new AppError('Failed to normalize product', 500);

      const aggregates = computeStockAggregates(product);
      return { ...product, ...aggregates };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getProductBySku');
    }
  }

  async getProductByBarcode(
    barcode: string,
    businessUnitId?: string
  ): Promise<Product> {
    try {
      const where: Prisma.ProductWhereInput = { barcode };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const raw = await this.prisma.product.findFirst({
        where,
        include: PRODUCT_DETAIL_INCLUDE,
      });

      if (!raw) {
        throw new AppError(`Product with barcode "${barcode}" not found`, 404);
      }

      const product = normalizeProduct(raw);
      if (!product) throw new AppError('Failed to normalize product', 500);

      const aggregates = computeStockAggregates(product);
      return { ...product, ...aggregates };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getProductByBarcode'
      );
    }
  }

  // ============================================
  // CREATE PRODUCT
  // ============================================
  //
  // The `businessUnitId` is now **authoritative from the caller**. The
  // controller already validated it against the database before calling
  // this method, so we trust it here. We still validate that it exists
  // and is active as a final safety net, but we never re-resolve it or
  // substitute a different BU.

  async createProduct(
    data: ProductCreateData,
    userId: string
  ): Promise<Product> {
    try {
      if (!data.name) throw new AppError('Product name is required', 400);
      if (!data.businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      // ✅ Trust the caller's BU, but confirm it exists and is active.
      const bu = await this.prisma.businessUnit.findUnique({
        where: { id: data.businessUnitId },
        select: { id: true, isActive: true },
      });
      if (!bu || !bu.isActive) {
        throw new AppError(
          `Business unit "${data.businessUnitId}" not found or inactive`,
          400
        );
      }

      let validUserId: string;
      try {
        let user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          user = await this.prisma.user.findUnique({ where: { clerkId: userId } });
        }
        if (user) {
          validUserId = user.id;
        } else {
          const uniqueId = `system_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 8)}`;
          const newSystemUser = await this.prisma.user.create({
            data: {
              clerkId: uniqueId,
              email: `system+${uniqueId}@example.com`,
              firstName: 'System',
              lastName: 'User',
              role: 'SUPER_ADMIN',
              isActive: true,
            },
          });
          validUserId = newSystemUser.id;
        }
      } catch {
        const anyUser = await this.prisma.user.findFirst();
        if (anyUser) {
          validUserId = anyUser.id;
        } else {
          const uniqueId = `fallback_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 6)}`;
          const newUser = await this.prisma.user.create({
            data: {
              clerkId: uniqueId,
              email: `fallback+${uniqueId}@example.com`,
              firstName: 'Fallback',
              lastName: 'User',
              role: 'SUPER_ADMIN',
              isActive: true,
            },
          });
          validUserId = newUser.id;
        }
      }

      const preparedData = this.prepareCreateData(data, validUserId);

      const existingSku = await this.prisma.product.findFirst({
        where: { sku: { equals: preparedData.sku, mode: 'insensitive' } },
      });
      if (existingSku) {
        preparedData.sku = await this.ensureUniqueSKU(preparedData.sku);
      }

      if (!preparedData.barcode) {
        preparedData.barcode = await this.generateUniqueBarcodeInternal(
          'PRD',
          12
        );
      }
      if (preparedData.barcode) {
        const existingBarcode = await this.prisma.product.findFirst({
          where: { barcode: preparedData.barcode },
        });
        if (existingBarcode) {
          throw new AppError(
            `Product with barcode "${preparedData.barcode}" already exists`,
            400
          );
        }
      }

      preparedData.categoryId = await this.validateCategory(
        preparedData.categoryId,
        data.businessUnitId
      );
      preparedData.supplierId = await this.validateSupplier(
        preparedData.supplierId
      );

      const locationId = await this.resolveLocationId(
        preparedData.businessUnitId,
        preparedData.location
      );

      let variantsToCreate: any[] = [];
      if (data.variants && Array.isArray(data.variants) && data.variants.length > 0) {
        let variantData = data.variants;
        if (variantData.length > ProductService.MAX_VARIANTS) {
          variantData = variantData.slice(0, ProductService.MAX_VARIANTS);
        }

        variantsToCreate = variantData.map((variant, index) => {
          const variantImages = this.cleanImages(variant.images || []);

          let variantSku = variant.sku;
          if (!variantSku || variantSku === 'SKU' || variantSku.trim() === '') {
            variantSku = this.generateVariantSKU(
              data.name,
              variant.name || `VAR${index + 1}`
            );
          }

          return {
            ...variant,
            sku: variantSku.toUpperCase().trim(),
            images: variantImages,
            price: variant.price || data.unitPrice || 0,
            costPrice: variant.costPrice || data.costPrice || 0,
            stock: variant.stock || 0,
            attributes: variant.attributes || {},
            isActive: variant.isActive !== undefined ? variant.isActive : true,
            location: variant.location || preparedData.location,
          };
        });
      }

      const raw = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const inventory = await tx.inventory.create({
            data: {
              businessUnitId: preparedData.businessUnitId,
              locationId,
              quantity: preparedData.stock,
              reserved: 0,
              available: preparedData.stock,
              reorderPoint: preparedData.minStock,
              reorderQuantity: 10,
              location: preparedData.location,
              supplier: preparedData.supplierName || null,
              notes: preparedData.notes || null,
              status: 'ACTIVE',
            },
          });

          // ✅ images is a relation → wrap in `{ create: [...] }`.
          const createdProduct = await tx.product.create({
            data: {
              name: preparedData.name,
              description: preparedData.description,
              sku: preparedData.sku,
              barcode: preparedData.barcode,
              unitPrice: preparedData.unitPrice,
              costPrice: preparedData.costPrice,
              taxRate: preparedData.taxRate,
              minStock: preparedData.minStock,
              maxStock: preparedData.maxStock,
              isActive: preparedData.isActive,
              isDigital: preparedData.isDigital,
              featured: preparedData.featured,
              weight: preparedData.weight,
              dimensions: preparedData.dimensions,
              images: toImageCreateInput(preparedData.images),
              attributes: preparedData.attributes,
              notes: preparedData.notes,
              tags: preparedData.tags,
              seo: preparedData.seo,
              rating: 0,
              reviewCount: 0,
              status: preparedData.status,
              type: preparedData.type,
              taxType: preparedData.taxType,
              categoryId: preparedData.categoryId,
              supplierId: preparedData.supplierId,
              businessUnitId: preparedData.businessUnitId,
              createdBy: validUserId,
              updatedBy: validUserId,
              inventoryId: inventory.id,
            },
          });

          if (preparedData.stock > 0) {
            await tx.inventoryTransaction.create({
              data: {
                transactionType: 'INITIAL',
                quantity: preparedData.stock,
                notes: `Initial stock for product ${createdProduct.name}`,
                productId: createdProduct.id,
                inventoryId: inventory.id,
                businessUnitId: preparedData.businessUnitId,
                userId: validUserId,
              },
            });
          }

          if (variantsToCreate.length > 0) {
            for (const variantData of variantsToCreate) {
              try {
                const existingVariantSku = await tx.productVariant.findFirst({
                  where: { sku: variantData.sku },
                });

                let finalSku = variantData.sku;
                if (existingVariantSku) {
                  finalSku = this.generateVariantSKU(
                    data.name,
                    variantData.name
                  );
                }

                const variantInventoryLocationId = await this.resolveLocationId(
                  preparedData.businessUnitId,
                  variantData.location || preparedData.location
                );

                // ✅ variant images is a relation → wrap.
                const variant = await tx.productVariant.create({
                  data: {
                    productId: createdProduct.id,
                    name: variantData.name,
                    sku: finalSku,
                    price: variantData.price,
                    costPrice: variantData.costPrice || 0,
                    stock: variantData.stock || 0,
                    images: toImageCreateInput(variantData.images || []),
                    attributes: variantData.attributes || {},
                    isActive:
                      variantData.isActive !== undefined
                        ? variantData.isActive
                        : true,
                    barcode: variantData.barcode || null,
                  },
                });

                const variantInventory = await tx.inventory.create({
                  data: {
                    businessUnitId: preparedData.businessUnitId,
                    locationId: variantInventoryLocationId,
                    quantity: variantData.stock || 0,
                    reserved: 0,
                    available: variantData.stock || 0,
                    reorderPoint: 5,
                    reorderQuantity: 10,
                    location: variantData.location || preparedData.location,
                    status: 'ACTIVE',
                  },
                });

                await tx.productVariant.update({
                  where: { id: variant.id },
                  data: { inventoryId: variantInventory.id },
                });

                if ((variantData.stock || 0) > 0) {
                  await tx.inventoryTransaction.create({
                    data: {
                      transactionType: 'INITIAL',
                      quantity: variantData.stock,
                      notes: `Initial stock for variant ${variantData.name}`,
                      productId: createdProduct.id,
                      variantId: variant.id,
                      inventoryId: variantInventory.id,
                      businessUnitId: preparedData.businessUnitId,
                      userId: validUserId,
                    },
                  });
                }
              } catch (variantError) {
                console.error(
                  `❌ Failed to create variant ${variantData.name}:`,
                  variantError
                );
              }
            }

            const createdVariants = await tx.productVariant.count({
              where: { productId: createdProduct.id },
            });

            if (createdVariants > 0) {
              await tx.product.update({
                where: { id: createdProduct.id },
                data: { type: 'VARIABLE' },
              });
            }
          }

          try {
            await tx.auditLog.create({
              data: {
                action: 'CREATE',
                entityType: 'PRODUCT',
                entityId: createdProduct.id,
                userId: validUserId,
                entityName: createdProduct.name,
                changes: {
                  name: createdProduct.name,
                  sku: createdProduct.sku,
                  price: createdProduct.unitPrice,
                  barcode: createdProduct.barcode,
                  inventoryId: inventory.id,
                  variantCount: variantsToCreate.length,
                  categoryId: createdProduct.categoryId,
                  imagesCount: preparedData.images?.length || 0,
                },
                severity: 'INFO',
                businessUnitId: preparedData.businessUnitId,
              },
            });
          } catch (auditError) {
            console.warn('Audit log creation failed:', auditError);
          }

          this.safeEmitProductUpdate(createdProduct, preparedData.businessUnitId);
          this.safeEmitInventoryUpdate(inventory, preparedData.businessUnitId);

          return await tx.product.findUnique({
            where: { id: createdProduct.id },
            include: PRODUCT_DETAIL_INCLUDE,
          });
        }
      );

      if (!raw) throw new AppError('Failed to create product', 500);

      const product = normalizeProduct(raw);
      if (!product) throw new AppError('Failed to normalize created product', 500);

      const aggregates = computeStockAggregates(product);
      return { ...product, ...aggregates };
    } catch (error: any) {
      console.error('❌ Error in createProduct:', error);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = error.meta?.target || 'field';
          throw new AppError(`Duplicate entry: ${target} already exists`, 400);
        }
        if (error.code === 'P2003') {
          throw new AppError(
            'Foreign key constraint failed. Please check category, supplier, or business unit IDs.',
            400
          );
        }
        if (error.code === 'P2025') {
          throw new AppError('Related record not found', 404);
        }
      }

      if (error instanceof AppError) throw error;

      throw new AppError(
        `Failed to create product: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }

  // ============================================
  // UPDATE PRODUCT
  // ============================================

  async updateProduct(
    id: string,
    data: ProductUpdateData,
    userId: string
  ): Promise<Product> {
    try {
      const existing = await this.prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          supplier: true,
          inventory: true,
          variants: { include: { inventory: true } },
        },
      });

      if (!existing) throw new AppError('Product not found', 404);

      let validUserId: string;
      try {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        validUserId = user ? user.id : userId;
      } catch {
        validUserId = userId;
      }

      const updateData: Prisma.ProductUncheckedUpdateInput = {
        updatedBy: validUserId,
        updatedAt: new Date(),
      };

      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.description !== undefined)
        updateData.description = data.description?.trim() || null;

      if (data.sku !== undefined) {
        const sku = data.sku.toUpperCase().trim();
        const dup = await this.prisma.product.findFirst({
          where: { sku: { equals: sku, mode: 'insensitive' }, id: { not: id } },
        });
        if (dup) throw new AppError('Product SKU already exists', 400);
        updateData.sku = sku;
      }

      if (data.barcode !== undefined) {
        const barcode = data.barcode?.trim() || null;
        if (barcode) {
          const dup = await this.prisma.product.findFirst({
            where: { barcode, id: { not: id } },
          });
          if (dup) throw new AppError('Barcode already exists', 400);
        }
        updateData.barcode = barcode;
      }

      if (data.unitPrice !== undefined)
        updateData.unitPrice = Number(data.unitPrice);
      if (data.costPrice !== undefined)
        updateData.costPrice = Number(data.costPrice);
      if (data.taxRate !== undefined) updateData.taxRate = Number(data.taxRate);
      if (data.minStock !== undefined)
        updateData.minStock = Number(data.minStock);
      if (data.maxStock !== undefined)
        updateData.maxStock =
          data.maxStock === null ? null : Number(data.maxStock);
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.isDigital !== undefined) updateData.isDigital = data.isDigital;
      if (data.featured !== undefined) updateData.featured = data.featured;
      if (data.weight !== undefined)
        updateData.weight = data.weight ? Number(data.weight) : null;

      // ✅ images is a relation. `ProductUncheckedUpdateInput` doesn't
      //    accept nested relation writes, so cast just this one
      //    assignment rather than restructuring the whole object.
      if (data.images !== undefined) {
        (updateData as any).images = toImageUpdateInput(
          this.cleanImages(data.images)
        );
      }

      if (data.attributes !== undefined) {
        updateData.attributes =
          data.attributes === null
            ? Prisma.DbNull
            : (data.attributes as Prisma.InputJsonValue);
      }

      if (data.notes !== undefined)
        updateData.notes = data.notes?.trim() || null;

      if (data.tags !== undefined) {
        updateData.tags = Array.isArray(data.tags)
          ? data.tags.filter(
              (t: any) => typeof t === 'string' && t.trim().length > 0
            )
          : [];
      }

      if (data.seo !== undefined) {
        updateData.seo =
          data.seo === null
            ? Prisma.DbNull
            : (data.seo as Prisma.InputJsonValue);
      }

      if (data.categoryId !== undefined) {
        updateData.categoryId = data.categoryId || null;
      } else if (data.category !== undefined) {
        const categoryId = this.extractCategoryId(data.category);
        if (categoryId) {
          updateData.categoryId = categoryId;
        } else if (typeof data.category === 'string') {
          const categories = await this.prisma.category.findMany({
            where: {
              businessUnitId: existing.businessUnitId,
              name: { equals: data.category, mode: 'insensitive' },
            },
          });
          updateData.categoryId =
            categories.length > 0 ? categories[0].id : null;
        } else {
          updateData.categoryId = null;
        }
      }

      if (data.supplierId !== undefined) {
        updateData.supplierId = data.supplierId || null;
      }

      const raw = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updated = await tx.product.update({
            where: { id },
            data: updateData,
            include: PRODUCT_DETAIL_INCLUDE,
          });

          if (
            existing.inventory &&
            (data.minStock !== undefined ||
              data.maxStock !== undefined ||
              data.notes !== undefined ||
              data.location !== undefined ||
              data.supplier !== undefined)
          ) {
            let resolvedLocationId: string | null | undefined = undefined;
            if (data.location !== undefined) {
              resolvedLocationId = await this.resolveLocationId(
                existing.businessUnitId,
                data.location
              );
            }

            await tx.inventory.update({
              where: { id: existing.inventory.id },
              data: {
                ...(data.minStock !== undefined && {
                  reorderPoint: Number(data.minStock),
                }),
                ...(data.maxStock !== undefined && {
                  reorderQuantity: data.maxStock ? Number(data.maxStock) : 10,
                }),
                ...(data.notes !== undefined && { notes: data.notes ?? null }),
                ...(data.location !== undefined && {
                  location: data.location,
                  locationId: resolvedLocationId ?? null,
                }),
                ...(data.supplier !== undefined && {
                  supplier: data.supplier ?? null,
                }),
              },
            });
          }

          if (data.variants && Array.isArray(data.variants)) {
            for (const variantData of data.variants) {
              if (
                variantData &&
                typeof variantData === 'object' &&
                'id' in variantData &&
                variantData.id
              ) {
                const existingVariant = await tx.productVariant.findUnique({
                  where: { id: variantData.id as string },
                  include: { inventory: true },
                });

                if (!existingVariant) continue;

                const variantUpdateData: Prisma.ProductVariantUncheckedUpdateInput =
                  {
                    ...(variantData.name !== undefined && {
                      name: variantData.name,
                    }),
                    ...(variantData.sku !== undefined && {
                      sku: variantData.sku.toUpperCase(),
                    }),
                    ...(variantData.price !== undefined && {
                      price: Number(variantData.price),
                    }),
                    ...(variantData.costPrice !== undefined && {
                      costPrice: Number(variantData.costPrice),
                    }),
                    ...(variantData.stock !== undefined && {
                      stock: Number(variantData.stock),
                    }),
                    ...(variantData.attributes !== undefined && {
                      attributes: variantData.attributes || {},
                    }),
                    ...(variantData.isActive !== undefined && {
                      isActive: variantData.isActive,
                    }),
                    ...(variantData.barcode !== undefined && {
                      barcode: variantData.barcode || null,
                    }),
                  };

                // ✅ variant images is a relation — cast just this write.
                if (variantData.images !== undefined) {
                  (variantUpdateData as any).images = toImageUpdateInput(
                    this.cleanImages(variantData.images || [])
                  );
                }

                await tx.productVariant.update({
                  where: { id: variantData.id as string },
                  data: variantUpdateData,
                });

                if (
                  variantData.stock !== undefined &&
                  existingVariant.inventoryId
                ) {
                  await tx.inventory.update({
                    where: { id: existingVariant.inventoryId },
                    data: {
                      quantity: Number(variantData.stock),
                      available:
                        Number(variantData.stock) -
                        (existingVariant.inventory?.reserved || 0),
                    },
                  });
                }
              }
            }
          }

          try {
            await tx.auditLog.create({
              data: {
                action: 'UPDATE',
                entityType: 'PRODUCT',
                entityId: updated.id,
                userId: validUserId,
                entityName: updated.name,
                changes: { updatedFields: Object.keys(data) },
                severity: 'INFO',
              },
            });
          } catch (auditError) {
            console.warn('Audit log creation skipped:', auditError);
          }

          this.safeEmitProductUpdate(updated, existing.businessUnitId);

          return updated;
        }
      );

      const product = normalizeProduct(raw);
      if (!product) {
        throw new AppError('Failed to normalize updated product', 500);
      }

      const aggregates = computeStockAggregates(product);
      return { ...product, ...aggregates };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.updateProduct');
    }
  }

  async deleteProduct(
    id: string,
    force: boolean = false,
  ): Promise<
    | {
        message: string;
        softDeleted: true;
        forceDeleted: false;
        data: Product;
      }
    | {
        message: string;
        softDeleted: false;
        forceDeleted: true;
        deletedCounts: Record<string, number>;
      }
  > {
    try {
      if (!id || typeof id !== 'string') {
        throw new AppError('Product ID is required', 400);
      }

      const product = await this.prisma.product.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          sku: true,
          businessUnitId: true,
          inventoryId: true,
          variants: {
            select: {
              id: true,
              inventoryId: true,
            },
          },
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      // ── Soft delete (default) ────────────────────────────────────
      if (!force) {
        const raw = await this.prisma.product.update({
          where: { id: product.id },
          data: {
            isActive: false,
            deletedAt: new Date(),
          },
          include: PRODUCT_DETAIL_INCLUDE,
        });

        const normalized = normalizeProduct(raw);
        if (!normalized) {
          throw new AppError('Failed to normalize soft-deleted product', 500);
        }

        this.safeEmitProductUpdate(
          { id: product.id, name: product.name },
          product.businessUnitId,
        );

        return {
          message: 'Product deactivated (soft delete)',
          softDeleted: true,
          forceDeleted: false,
          data: normalized,
        };
      }

      // ── Hard delete (force) ──────────────────────────────────────
      const productId = product.id;
      const variantIds = product.variants.map((v) => v.id);
      const variantInventoryIds = product.variants
        .map((v) => v.inventoryId)
        .filter((x): x is string => typeof x === 'string');

      const counts: Record<string, number> = {};

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Sale / order / return / refund / cart items — variant first.
        if (variantIds.length > 0) {
          counts.saleItemsVariant = (
            await tx.saleItem.deleteMany({
              where: { variantId: { in: variantIds } },
            })
          ).count;

          counts.orderItemsVariant = (
            await tx.orderItem.deleteMany({
              where: { variantId: { in: variantIds } },
            })
          ).count;

          counts.returnItemsVariant = (
            await tx.returnItem.deleteMany({
              where: { variantId: { in: variantIds } },
            })
          ).count;

          counts.refundItemsVariant = (
            await tx.refundItem.deleteMany({
              where: { variantId: { in: variantIds } },
            })
          ).count;

          counts.cartItemsVariant = (
            await tx.cartItem.deleteMany({
              where: { variantId: { in: variantIds } },
            })
          ).count;
        }

        counts.saleItems = (
          await tx.saleItem.deleteMany({ where: { productId } })
        ).count;

        counts.orderItems = (
          await tx.orderItem.deleteMany({ where: { productId } })
        ).count;

        counts.returnItems = (
          await tx.returnItem.deleteMany({ where: { productId } })
        ).count;

        counts.refundItems = (
          await tx.refundItem.deleteMany({ where: { productId } })
        ).count;

        counts.cartItems = (
          await tx.cartItem.deleteMany({ where: { productId } })
        ).count;

        // 2. Reviews — ProductReviewImage cascades.
        counts.reviews = (
          await tx.productReview.deleteMany({ where: { productId } })
        ).count;

        // 3. Wishlist / recently-viewed.
        counts.wishlist = (
          await tx.wishlist.deleteMany({ where: { productId } })
        ).count;

        counts.recentlyViewed = (
          await tx.recentlyViewed.deleteMany({ where: { productId } })
        ).count;

        // 4. Promotions.
        counts.productPromotions = (
          await tx.productPromotion.deleteMany({ where: { productId } })
        ).count;

        // 5. Inventory transactions / issues / PO items — variant first.
        if (variantIds.length > 0) {
          counts.inventoryTransactionsVariant = (
            await tx.inventoryTransaction.deleteMany({
              where: { variantId: { in: variantIds } },
            })
          ).count;

          counts.inventoryIssuesVariant = (
            await tx.inventoryIssue.deleteMany({
              where: { variantId: { in: variantIds } },
            })
          ).count;

          counts.purchaseOrderItemsVariant = (
            await tx.purchaseOrderItem.deleteMany({
              where: { variantId: { in: variantIds } },
            })
          ).count;
        }

        counts.inventoryTransactions = (
          await tx.inventoryTransaction.deleteMany({ where: { productId } })
        ).count;

        counts.inventoryIssues = (
          await tx.inventoryIssue.deleteMany({ where: { productId } })
        ).count;

        counts.purchaseOrderItems = (
          await tx.purchaseOrderItem.deleteMany({ where: { productId } })
        ).count;

        // 6. QR / barcode records tied to product or variants.
        const variantIdSet = variantIds.length > 0 ? variantIds : undefined;

        counts.qrCodes = (
          await tx.qRCodeRecord.deleteMany({
            where: {
              OR: [
                { productId },
                ...(variantIdSet ? [{ variantId: { in: variantIdSet } }] : []),
              ],
            },
          })
        ).count;

        counts.barcodeImages = (
          await tx.barcodeImageRecord.deleteMany({
            where: {
              OR: [
                { productId },
                ...(variantIdSet ? [{ variantId: { in: variantIdSet } }] : []),
              ],
            },
          })
        ).count;

        // 7. Variants — detach inventory FK, then delete inventories.
        if (variantInventoryIds.length > 0) {
          await tx.productVariant.updateMany({
            where: { id: { in: variantIds } },
            data: { inventoryId: null },
          });

          counts.variantInventories = (
            await tx.inventory.deleteMany({
              where: { id: { in: variantInventoryIds } },
            })
          ).count;
        }

        counts.variants = (
          await tx.productVariant.deleteMany({ where: { productId } })
        ).count;

        // 8. Product-level inventory — detach FK, then delete.
        if (product.inventoryId) {
          await tx.product.update({
            where: { id: productId },
            data: { inventoryId: null },
          });

          try {
            await tx.inventory.delete({ where: { id: product.inventoryId } });
            counts.productInventory = 1;
          } catch {
            counts.productInventory = 0;
          }
        }

        // 9. The product itself. ProductImages cascade.
        await tx.product.delete({ where: { id: productId } });

        // 10. Audit log.
        try {
          await tx.auditLog.create({
            data: {
              action: 'DELETE',
              entityType: 'PRODUCT',
              entityId: productId,
              userId: 'system',
              entityName: product.name,
              changes: {
                hardDelete: true,
                deletedAt: new Date().toISOString(),
                variantCount: variantIds.length,
                counts,
              },
              severity: 'HIGH',
              businessUnitId: product.businessUnitId,
            },
          });
        } catch (auditError) {
          console.warn('Audit log creation skipped:', auditError);
        }
      });

      this.safeEmitProductUpdate(
        { id: productId, name: product.name },
        product.businessUnitId,
      );

      return {
        message: 'Product and all related records permanently deleted',
        softDeleted: false,
        forceDeleted: true,
        deletedCounts: counts,
      };
    } catch (error: any) {
      console.error('❌ Error in deleteProduct:', error);

      if (error instanceof AppError) throw error;

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new AppError(
            'Cannot delete product: another record still references it. ' +
              'This should not happen after a full cascade — check for newly added relations.',
            400,
          );
        }
        if (error.code === 'P2025') {
          throw new AppError('Product not found', 404);
        }
      }

      throw new AppError(
        `Failed to delete product: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        500,
      );
    }
  }

  // ============================================
  // UPDATE INVENTORY STOCK
  // ============================================

  async updateInventoryStock(
    inventoryId: string,
    quantity: number,
    userId: string,
    note?: string,
    transactionType: string = 'ADJUSTMENT'
  ): Promise<Inventory> {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id: inventoryId },
        include: { product: true, variant: true },
      });

      if (!inventory) throw new AppError('Inventory not found', 404);
      if (quantity < 0) {
        throw new AppError('Stock quantity cannot be negative', 400);
      }

      const previousQuantity = inventory.quantity;
      const difference = quantity - previousQuantity;

      const updated = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const u = await tx.inventory.update({
            where: { id: inventoryId },
            data: {
              quantity,
              available: quantity - (inventory.reserved || 0),
            },
          });

          const productId = inventory.product?.id;
          const variantId = inventory.variant?.id;
          if (!productId) {
            throw new AppError('Inventory is not linked to a product', 400);
          }

          if (variantId) {
            await tx.productVariant.update({
              where: { id: variantId },
              data: { stock: quantity },
            });
          }

          await tx.inventoryTransaction.create({
            data: {
              transactionType: transactionType as any,
              quantity: Math.abs(difference),
              notes:
                note ||
                `Stock ${transactionType.toLowerCase()} from ${previousQuantity} to ${quantity}`,
              reference: `Inventory update`,
              productId,
              variantId: variantId || null,
              inventoryId: inventory.id,
              businessUnitId: inventory.businessUnitId,
              userId,
            },
          });

          return u;
        }
      );

      this.safeEmitInventoryUpdate(updated, inventory.businessUnitId);

      const normalized = normalizeInventory(updated);
      if (!normalized) throw new AppError('Failed to normalize inventory', 500);
      return normalized;
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.updateInventoryStock'
      );
    }
  }

  // ============================================
  // SYNC PRODUCT WITH INVENTORY
  // ============================================

  async syncProductInventory(
    productId: string,
    _userId: string
  ): Promise<{
    product: Product;
    totalStock: number;
    totalReserved: number;
    totalAvailable: number;
    syncedAt: string;
  }> {
    try {
      const raw = await this.prisma.product.findUnique({
        where: { id: productId },
        include: PRODUCT_DETAIL_INCLUDE,
      });

      if (!raw) throw new AppError('Product not found', 404);

      const product = normalizeProduct(raw);
      if (!product) throw new AppError('Failed to normalize product', 500);

      const aggregates = computeStockAggregates(product);

      this.safeEmitProductUpdate(product, product.businessUnitId);

      return {
        product: { ...product, ...aggregates },
        totalStock: aggregates.totalStock ?? 0,
        totalReserved: aggregates.totalReserved ?? 0,
        totalAvailable: aggregates.totalAvailable ?? 0,
        syncedAt: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.syncProductInventory'
      );
    }
  }

  // ============================================
  // CREATE PRODUCT FROM INVENTORY
  // ============================================
 
  async createProductFromInventory(
    inventoryId: string,
    productData: any,
    userId: string,
  ): Promise<Product & { action: 'created' | 'updated' }> {
    try {
      // ─────────────────────────────────────────────────────────
      // 1. Validate the input id.
      // ─────────────────────────────────────────────────────────
      if (!inventoryId || typeof inventoryId !== 'string') {
        throw new AppError('Inventory ID is required', 400);
      }

      const trimmedInventoryId = inventoryId.trim();
      if (trimmedInventoryId.length === 0) {
        throw new AppError('Inventory ID cannot be empty', 400);
      }

      console.log(
        `🔍 [createProductFromInventory] Looking up inventory "${trimmedInventoryId}"`,
      );

      // ─────────────────────────────────────────────────────────
      // 2. Resolve the inventory row.
      //
      //    We fetch `name` and `sku` from the related product and
      //    variant so the diagnostic logs below can print a
      //    human-readable label. Inventory itself has neither
      //    field — it's a pure stock-tracking record.
      // ─────────────────────────────────────────────────────────
      const inventoryInclude = {
        product: { select: { id: true, name: true, sku: true } },
        variant: { select: { id: true, name: true, sku: true } },
        businessUnit: { select: { id: true, isActive: true } },
      } as const;

      let inventory = await this.prisma.inventory.findUnique({
        where: { id: trimmedInventoryId },
        include: inventoryInclude,
      });

      if (!inventory) {
        inventory = await this.prisma.inventory.findFirst({
          where: { product: { is: { id: trimmedInventoryId } } },
          include: inventoryInclude,
        });

        if (inventory) {
          console.warn(
            `⚠️ [createProductFromInventory] Resolved "${trimmedInventoryId}" ` +
              `through its Product relation to Inventory.id="${inventory.id}"`,
          );
        }
      }

      // ─────────────────────────────────────────────────────────
      // 3. Not found — actionable diagnostics.
      // ─────────────────────────────────────────────────────────
      if (!inventory) {
        let sampleIds: string[] = [];
        try {
          const sample = await this.prisma.inventory.findMany({
            select: {
              id: true,
              location: true,
              quantity: true,
              product: { select: { id: true, name: true, sku: true } },
              variant: { select: { id: true, name: true, sku: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          });

          sampleIds = sample.map((s) => {
            const label =
              s.product?.name ??
              s.variant?.name ??
              s.location ??
              'unlabelled';
            const sku = s.product?.sku ?? s.variant?.sku ?? '';
            const qty = s.quantity ?? 0;
            return `${s.id} (label="${label}", sku="${sku}", qty=${qty})`;
          });
        } catch {
          /* ignore */
        }

        console.error(
          `❌ [createProductFromInventory] Inventory "${trimmedInventoryId}" ` +
            `not found. Sample of existing ids:\n  - ` +
            sampleIds.join('\n  - '),
        );

        throw new AppError(
          `Inventory item "${trimmedInventoryId}" not found. ` +
            `If you refreshed recently, the item may have been ` +
            `deleted. Please refresh the page and pick another ` +
            `inventory item.`,
          404,
        );
      }

      // ✅ Print the product/variant identity, not `inventory.name`.
      const inventoryLabel =
        inventory.product?.name ??
        inventory.variant?.name ??
        inventory.location ??
        'unlabelled';

      console.log(
        `✅ [createProductFromInventory] Found inventory "${inventory.id}" ` +
          `(label="${inventoryLabel}", ` +
          `productId="${inventory.product?.id ?? 'none'}", ` +
          `variantId="${inventory.variant?.id ?? 'none'}", ` +
          `bu="${inventory.businessUnitId}")`,
      );

      // ─────────────────────────────────────────────────────────
      // 4. Resolve the target business unit.
      // ─────────────────────────────────────────────────────────
      const targetBusinessUnitId =
        productData.businessUnitId || inventory.businessUnitId;

      const bu = await this.prisma.businessUnit.findUnique({
        where: { id: targetBusinessUnitId },
        select: { id: true, isActive: true },
      });

      if (!bu || !bu.isActive) {
        throw new AppError(
          `Business unit "${targetBusinessUnitId}" not found or inactive`,
          400,
        );
      }

      // ─────────────────────────────────────────────────────────
      // 5. Upsert: if a product already exists for this inventory
      //    row, update it instead of failing.
      // ─────────────────────────────────────────────────────────
      const existingProduct = await this.prisma.product.findFirst({
        where: { inventoryId: inventory.id },
        select: { id: true, name: true, sku: true },
      });

      if (existingProduct) {
        console.log(
          `ℹ️ [createProductFromInventory] Product already exists for ` +
            `inventory "${inventory.id}" — product "${existingProduct.name}" ` +
            `(${existingProduct.id}). Treating this call as an update.`,
        );

        try {
          const updated = await this.updateProductFromInventory(
            inventory.id,
            { ...productData, businessUnitId: targetBusinessUnitId },
            userId,
          );

          return Object.assign(updated, { action: 'updated' as const });
        } catch (updateErr) {
          const msg =
            updateErr instanceof Error ? updateErr.message : String(updateErr);

          console.error(
            `❌ [createProductFromInventory] Update of existing ` +
              `product "${existingProduct.id}" for inventory ` +
              `"${inventory.id}" failed: ${msg}`,
          );

          if (updateErr instanceof AppError) throw updateErr;

          throw new AppError(
            `Failed to update existing product "${existingProduct.name}" ` +
              `(${existingProduct.id}): ${msg}`,
            500,
          );
        }
      }

      // ─────────────────────────────────────────────────────────
      // 6. No product exists yet — fresh create.
      // ─────────────────────────────────────────────────────────

      // SKU
      let sku = productData.sku;
      if (!sku || sku === 'SKU' || String(sku).trim() === '') {
        sku = this.generateProductSKU(productData.name);
      } else {
        sku = String(sku).toUpperCase();
      }
      sku = await this.ensureUniqueSKU(sku, targetBusinessUnitId);

      // Category
      const categoryId = this.extractCategoryId(
        productData.categoryId || productData.category,
      );

      // ─────────────────────────────────────────────────────────
      // 6a. ✅ Persist images to disk BEFORE the transaction.
      //
      //     `persistImages` decodes base64 data URLs, writes the
      //     bytes to `src/uploads/products/`, and returns short
      //     `/uploads/...` URLs. `persistVariantImages` does the
      //     same for variants under `src/uploads/variants/`.
      //
      //     Any failure to write a file is logged but does not
      //     abort the transaction — the URL is still short enough
      //     for the DB, and the file can be regenerated later.
      // ─────────────────────────────────────────────────────────
      const persistedProductImages = await persistImages(
        productData.images ?? [],
        { subdir: 'products' },
      );

      const persistedVariants: any[] = Array.isArray(productData.variants)
        ? await Promise.all(
            productData.variants.map(async (v: any) => ({
              ...v,
              images:
                v.images !== undefined
                  ? await persistVariantImages(v.images)
                  : [],
            })),
          )
        : [];

      console.log(
        `📸 [createProductFromInventory] Persisted ` +
          `${persistedProductImages.length} product image(s) and ` +
          `${persistedVariants.length} variant(s).`,
      );

      // ─────────────────────────────────────────────────────────
      // 6b. Persist the DB writes inside a single transaction.
      // ─────────────────────────────────────────────────────────
      const raw = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const stillExists = await tx.inventory.findUnique({
            where: { id: inventory!.id },
            select: { id: true, businessUnitId: true },
          });

          if (!stillExists) {
            throw new AppError(
              `Inventory item "${inventory!.id}" was deleted while the ` +
                `product was being created. Please refresh and try again.`,
              409,
            );
          }

          const newProduct = await tx.product.create({
            data: {
              name: productData.name || 'Unnamed Product',
              sku,
              description: productData.description || null,
              unitPrice: productData.unitPrice || 0,
              costPrice: productData.costPrice || 0,
              barcode: productData.barcode || null,
              categoryId: categoryId,
              supplierId: productData.supplierId || null,
              businessUnitId: targetBusinessUnitId,
              isActive:
                productData.isActive !== undefined
                  ? productData.isActive
                  : true,
              featured: productData.featured || false,
              isDigital: productData.isDigital || false,
              taxRate: productData.taxRate || 0,
              weight: productData.weight || null,
              minStock: inventory!.reorderPoint || 5,
              maxStock: inventory!.reorderQuantity || null,
              tags: productData.tags || [],

              // ✅ Use the persisted URLs, not the raw base64.
              images: toImageCreateInput(persistedProductImages),

              notes: productData.notes || inventory!.notes || null,
              attributes: productData.attributes || {},
              seo: productData.seo || {},
              createdBy: userId,
              updatedBy: userId,
              inventoryId: inventory!.id,
            },
            include: {
              inventory: true,
              category: true,
              supplier: true,
            },
          });

          // ─────────────────────────────────────────────────────
          // Variants — iterate the persisted array so each variant
          // gets its on-disk URLs.
          // ─────────────────────────────────────────────────────
          if (persistedVariants.length > 0) {
            for (const variantData of persistedVariants) {
              const variantSku =
                variantData.sku && variantData.sku !== 'SKU'
                  ? String(variantData.sku).toUpperCase()
                  : this.generateVariantSKU(newProduct.sku, variantData.name);

              const variant = await tx.productVariant.create({
                data: {
                  productId: newProduct.id,
                  name: variantData.name,
                  sku: variantSku,
                  price: variantData.price || newProduct.unitPrice,
                  costPrice:
                    variantData.costPrice || newProduct.costPrice || 0,
                  stock: variantData.stock || 0,

                  // ✅ Variant images are persisted URLs.
                  images: toImageCreateInput(variantData.images),

                  attributes: variantData.attributes || {},
                  isActive: true,
                  barcode: variantData.barcode || null,
                },
              });

              const variantInventory = await tx.inventory.create({
                data: {
                  businessUnitId: targetBusinessUnitId,
                  locationId: inventory!.locationId,
                  quantity: variantData.stock || 0,
                  reserved: 0,
                  available: variantData.stock || 0,
                  reorderPoint: 5,
                  reorderQuantity: 10,
                  location: inventory!.location || 'Warehouse',
                  status: 'ACTIVE',
                },
              });

              await tx.productVariant.update({
                where: { id: variant.id },
                data: { inventoryId: variantInventory.id },
              });
            }

            await tx.product.update({
              where: { id: newProduct.id },
              data: { type: 'VARIABLE' },
            });
          }

          try {
            await tx.auditLog.create({
              data: {
                action: 'CREATE',
                entityType: 'PRODUCT',
                entityId: newProduct.id,
                userId,
                entityName: newProduct.name,
                changes: {
                  fromInventory: inventory!.id,
                  name: newProduct.name,
                  sku: newProduct.sku,
                  variantCount: persistedVariants.length,
                  imageCount: persistedProductImages.length,
                },
                severity: 'INFO',
                businessUnitId: targetBusinessUnitId,
              },
            });
          } catch (auditError) {
            console.warn('Audit log creation failed:', auditError);
          }

          return await tx.product.findUnique({
            where: { id: newProduct.id },
            include: PRODUCT_DETAIL_INCLUDE,
          });
        },
      );

      if (!raw) {
        throw new AppError('Failed to create product from inventory', 500);
      }

      const product = normalizeProduct(raw);
      if (!product) throw new AppError('Failed to normalize product', 500);

      const aggregates = computeStockAggregates(product);

      return Object.assign({ ...product, ...aggregates }, {
        action: 'created' as const,
      });
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.createProductFromInventory',
      );
    }
  }

  // ============================================
  // UPDATE PRODUCT FROM INVENTORY
  // ============================================

  async updateProductFromInventory(
    inventoryId: string,
    productData: any,
    userId: string
  ): Promise<Product> {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id: inventoryId },
      });

      if (!inventory) throw new AppError('Inventory item not found', 404);

      const product = await this.prisma.product.findFirst({
        where: { inventoryId: inventory.id },
      });

      if (!product) {
        return this.createProductFromInventory(inventoryId, productData, userId);
      }

      const categoryId = this.extractCategoryId(
        productData.categoryId || productData.category
      );

      // ⬇️⬇️⬇️ FIX: persist base64 product images to disk BEFORE the
      // transaction, so we never write a >8 KB string into the indexed
      // `product_images.url` column.
      const persistedProductImages =
        productData.images !== undefined
          ? await persistImages(productData.images, { subdir: 'products' })
          : undefined;

      // ⬇️⬇️⬇️ FIX: same for every variant image.
      const persistedVariants: any[] | undefined = Array.isArray(
        productData.variants
      )
        ? await Promise.all(
            productData.variants.map(async (v: any) => ({
              ...v,
              images:
                v.images !== undefined
                  ? await persistVariantImages(v.images)
                  : undefined,
            })),
          )
        : undefined;

      const raw = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // ✅ images is a relation → nested update input.
          const updated = await tx.product.update({
            where: { id: product.id },
            data: {
              name: productData.name !== undefined ? productData.name : undefined,
              description:
                productData.description !== undefined
                  ? productData.description
                  : undefined,
              sku:
                productData.sku !== undefined
                  ? productData.sku.toUpperCase()
                  : undefined,
              barcode:
                productData.barcode !== undefined
                  ? productData.barcode
                  : undefined,
              unitPrice:
                productData.unitPrice !== undefined
                  ? Number(productData.unitPrice)
                  : undefined,
              costPrice:
                productData.costPrice !== undefined
                  ? Number(productData.costPrice)
                  : undefined,
              taxRate:
                productData.taxRate !== undefined
                  ? Number(productData.taxRate)
                  : undefined,
              minStock:
                productData.minStock !== undefined
                  ? Number(productData.minStock)
                  : inventory.reorderPoint,
              maxStock:
                productData.maxStock !== undefined
                  ? Number(productData.maxStock)
                  : inventory.reorderQuantity,
              isActive:
                productData.isActive !== undefined
                  ? productData.isActive
                  : undefined,
              isDigital:
                productData.isDigital !== undefined
                  ? productData.isDigital
                  : undefined,
              featured:
                productData.featured !== undefined
                  ? productData.featured
                  : undefined,
              weight:
                productData.weight !== undefined
                  ? Number(productData.weight)
                  : undefined,

              // ✅ FIX: use the persisted URLs, not the raw base64.
              ...(persistedProductImages !== undefined && {
                images: toImageUpdateInput(persistedProductImages),
              } as any),

              attributes:
                productData.attributes !== undefined
                  ? productData.attributes
                  : undefined,
              notes:
                productData.notes !== undefined ? productData.notes : undefined,
              tags: productData.tags !== undefined ? productData.tags : undefined,
              seo: productData.seo !== undefined ? productData.seo : undefined,
              categoryId: categoryId !== undefined ? categoryId : undefined,
              supplierId:
                productData.supplierId !== undefined
                  ? productData.supplierId
                  : undefined,
              updatedBy: userId,
            },
            include: PRODUCT_DETAIL_INCLUDE,
          });

          // ⬇️ Update each variant using the persisted image URLs.
          if (persistedVariants && persistedVariants.length > 0) {
            for (const variantData of persistedVariants) {
              if (!variantData.id) continue;

              const existingVariant = await tx.productVariant.findUnique({
                where: { id: variantData.id },
                include: { inventory: true },
              });
              if (!existingVariant) continue;

              const variantUpdate: Prisma.ProductVariantUncheckedUpdateInput = {
                ...(variantData.name !== undefined && {
                  name: variantData.name,
                }),
                ...(variantData.sku !== undefined && {
                  sku: String(variantData.sku).toUpperCase(),
                }),
                ...(variantData.price !== undefined && {
                  price: Number(variantData.price),
                }),
                ...(variantData.costPrice !== undefined && {
                  costPrice: Number(variantData.costPrice),
                }),
                ...(variantData.stock !== undefined && {
                  stock: Number(variantData.stock),
                }),
                ...(variantData.attributes !== undefined && {
                  attributes: variantData.attributes || {},
                }),
                ...(variantData.isActive !== undefined && {
                  isActive: variantData.isActive,
                }),
                ...(variantData.barcode !== undefined && {
                  barcode: variantData.barcode || null,
                }),
              };

              // ✅ FIX: variant images are persisted URLs, not base64.
              if (variantData.images !== undefined) {
                (variantUpdate as any).images = toImageUpdateInput(
                  variantData.images,
                );
              }

              await tx.productVariant.update({
                where: { id: variantData.id },
                data: variantUpdate,
              });

              if (
                variantData.stock !== undefined &&
                existingVariant.inventoryId
              ) {
                await tx.inventory.update({
                  where: { id: existingVariant.inventoryId },
                  data: {
                    quantity: Number(variantData.stock),
                    available:
                      Number(variantData.stock) -
                      (existingVariant.inventory?.reserved || 0),
                  },
                });
              }
            }
          }

          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              reorderPoint: updated.minStock || 5,
              reorderQuantity: updated.maxStock || 10,
              supplier: productData.supplier || inventory.supplier,
              notes: productData.notes || inventory.notes,
            },
          });

          try {
            await tx.auditLog.create({
              data: {
                action: 'UPDATE',
                entityType: 'PRODUCT',
                entityId: updated.id,
                userId,
                entityName: updated.name,
                changes: { updatedFields: Object.keys(productData) },
                severity: 'INFO',
                businessUnitId: inventory.businessUnitId,
              },
            });
          } catch (auditError) {
            console.warn('Audit log creation skipped:', auditError);
          }

          return updated;
        }
      );

      const normalized = normalizeProduct(raw);
      if (!normalized) throw new AppError('Failed to normalize product', 500);

      const aggregates = computeStockAggregates(normalized);
      return { ...normalized, ...aggregates };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.updateProductFromInventory'
      );
    }
  }

  // ============================================
  // DELETE PRODUCT FROM INVENTORY
  // ============================================

  async deleteProductFromInventory(
    productId: string,
    keepInventory: boolean = true
  ): Promise<{
    message: string;
    softDeleted: boolean;
    data: Product;
  }> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          inventory: true,
          variants: { include: { inventory: true } },
        },
      });

      if (!product) throw new AppError('Product not found', 404);

      const raw = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          for (const variant of product.variants) {
            if (variant.inventory) {
              await tx.productVariant.update({
                where: { id: variant.id },
                data: { inventoryId: null },
              });
            }
          }

          if (product.inventory) {
            await tx.product.update({
              where: { id: product.id },
              data: { inventoryId: null },
            });
          }

          if (!keepInventory && product.inventory) {
            await tx.inventory.delete({ where: { id: product.inventory.id } });
          }

          return await tx.product.update({
            where: { id: productId },
            data: {
              isActive: false,
              deletedAt: new Date(),
              inventoryId: null,
            },
            include: PRODUCT_DETAIL_INCLUDE,
          });
        }
      );

      const normalized = normalizeProduct(raw);
      if (!normalized) throw new AppError('Failed to normalize product', 500);

      return {
        message: keepInventory
          ? 'Product unlinked from inventory'
          : 'Product and inventory deleted',
        softDeleted: true,
        data: normalized,
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.deleteProductFromInventory'
      );
    }
  }

  // ============================================
  // VARIANT METHODS
  // ============================================

  async addVariant(
    productId: string,
    data: VariantCreateData
  ): Promise<ProductVariant> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: { inventory: true },
      });

      if (!product) throw new AppError('Product not found', 404);
      if (!data.name) throw new AppError('Variant name is required', 400);

      const images = this.cleanImages(data.images || []);
      let sku = data.sku;
      if (!sku || sku === 'SKU' || sku.trim() === '') {
        sku = this.generateVariantSKU(product.sku, data.name);
      } else {
        sku = sku.toUpperCase().trim();
      }

      let existingSku = await this.prisma.productVariant.findFirst({
        where: { sku: { equals: sku, mode: 'insensitive' } },
      });
      let skuAttempts = 0;
      while (existingSku && skuAttempts < 5) {
        sku = this.generateVariantSKU(product.sku, data.name);
        existingSku = await this.prisma.productVariant.findFirst({
          where: { sku: { equals: sku, mode: 'insensitive' } },
        });
        skuAttempts++;
      }
      if (existingSku) {
        throw new AppError('Unable to generate unique SKU for variant', 400);
      }

      const price = data.price ?? product.unitPrice;
      const costPrice = data.costPrice ?? product.costPrice ?? price;

      const locationName = data.location || 'Warehouse';
      const locationId = await this.resolveLocationId(
        product.businessUnitId,
        locationName
      );

      const raw = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // ✅ Variant images → relation input.
          const createdVariant = await tx.productVariant.create({
            data: {
              productId,
              name: data.name,
              sku,
              price: Number(price),
              costPrice: Number(costPrice),
              stock: data.stock || 0,
              images: toImageCreateInput(images),
              attributes: data.attributes || {},
              isActive: data.isActive !== undefined ? data.isActive : true,
              barcode: data.barcode || null,
            },
          });

          const inventory = await tx.inventory.create({
            data: {
              businessUnitId: product.businessUnitId,
              locationId,
              quantity: data.stock || 0,
              reserved: 0,
              available: data.stock || 0,
              reorderPoint: 5,
              reorderQuantity: 10,
              location: locationName,
              status: 'ACTIVE',
            },
          });

          await tx.productVariant.update({
            where: { id: createdVariant.id },
            data: { inventoryId: inventory.id },
          });

          if (data.stock && data.stock > 0) {
            await tx.inventoryTransaction.create({
              data: {
                transactionType: 'INITIAL',
                quantity: data.stock,
                notes: `Initial stock for variant ${createdVariant.name}`,
                productId,
                variantId: createdVariant.id,
                inventoryId: inventory.id,
                businessUnitId: product.businessUnitId,
                userId: 'system',
              },
            });
          }

          if (product.type === 'SIMPLE') {
            await tx.product.update({
              where: { id: productId },
              data: { type: 'VARIABLE' },
            });
          }

          this.safeEmitInventoryUpdate(inventory, product.businessUnitId);

          return await tx.productVariant.findUnique({
            where: { id: createdVariant.id },
            include: {
              inventory: true,
              images: { orderBy: { order: 'asc' } },
            },
          });
        }
      );

      if (!raw) throw new AppError('Failed to create variant', 500);

      const variant = normalizeVariant(raw);
      if (!variant) throw new AppError('Failed to normalize variant', 500);

      return variant;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.addVariant');
    }
  }

  async updateVariant(
    variantId: string,
    data: VariantUpdateData
  ): Promise<ProductVariant> {
    try {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          product: { include: { inventory: true } },
          inventory: true,
        },
      });

      if (!variant) throw new AppError('Variant not found', 404);

      if (data.sku && data.sku.toLowerCase() !== variant.sku.toLowerCase()) {
        const existing = await this.prisma.productVariant.findFirst({
          where: {
            sku: { equals: data.sku, mode: 'insensitive' },
            id: { not: variantId },
          },
        });
        if (existing) {
          throw new AppError('Variant SKU already exists', 400);
        }
      }

      const raw = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updateData: Prisma.ProductVariantUncheckedUpdateInput = {};
          if (data.name !== undefined) updateData.name = data.name;
          if (data.sku !== undefined)
            updateData.sku = data.sku.toUpperCase().trim();
          if (data.price !== undefined) updateData.price = Number(data.price);
          if (data.costPrice !== undefined)
            updateData.costPrice = Number(data.costPrice);
          if (data.stock !== undefined) updateData.stock = Number(data.stock);
          if (data.attributes !== undefined)
            updateData.attributes = data.attributes;
          if (data.isActive !== undefined) updateData.isActive = data.isActive;

          // ✅ variant images is a relation → cast just this write.
          if (data.images !== undefined) {
            (updateData as any).images = toImageUpdateInput(
              this.cleanImages(data.images)
            );
          }

          const updated = await tx.productVariant.update({
            where: { id: variantId },
            data: updateData,
            include: {
              inventory: true,
              images: { orderBy: { order: 'asc' } },
            },
          });

          if (data.stock !== undefined && variant.inventory) {
            await tx.inventory.update({
              where: { id: variant.inventory.id },
              data: {
                quantity: Number(data.stock),
                available:
                  Number(data.stock) - (variant.inventory.reserved || 0),
              },
            });
          }

          return updated;
        }
      );

      const normalized = normalizeVariant(raw);
      if (!normalized) throw new AppError('Failed to normalize variant', 500);
      return normalized;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.updateVariant');
    }
  }

  async deleteVariant(variantId: string): Promise<{
    message: string;
    softDeleted: boolean;
    data?: ProductVariant;
  }> {
    try {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          saleItems: true,
          orderItems: true,
          inventory: true,
          product: true,
        },
      });

      if (!variant) throw new AppError('Variant not found', 404);

      const hasSalesOrOrders =
        variant.saleItems.length > 0 || variant.orderItems.length > 0;

      if (hasSalesOrOrders) {
        const updatedVariant = await this.prisma.productVariant.update({
          where: { id: variantId },
          data: { isActive: false },
          include: {
            inventory: true,
            images: { orderBy: { order: 'asc' } },
          },
        });

        const normalized = normalizeVariant(updatedVariant);

        return {
          message: 'Variant deactivated (has associated sales/orders)',
          softDeleted: true,
          data: normalized ?? undefined,
        };
      }

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        if (variant.inventoryId) {
          await tx.inventory.delete({ where: { id: variant.inventoryId } });
        }

        await tx.productVariant.delete({ where: { id: variantId } });

        const remainingVariants = await tx.productVariant.findMany({
          where: { productId: variant.productId, isActive: true },
        });

        if (remainingVariants.length === 0) {
          await tx.product.update({
            where: { id: variant.productId },
            data: { type: 'SIMPLE' },
          });
        }
      });

      return {
        message: 'Variant deleted successfully',
        softDeleted: false,
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.deleteVariant');
    }
  }

  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) throw new AppError('Product not found', 404);

      const raw = await this.prisma.productVariant.findMany({
        where: { productId },
        include: {
          inventory: true,
          images: { orderBy: { order: 'asc' } },
        },
        orderBy: { name: 'asc' },
      });

      return raw
        .map(normalizeVariant)
        .filter((v): v is ProductVariant => v !== null);
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getProductVariants'
      );
    }
  }

  async getVariantById(variantId: string): Promise<ProductVariant> {
    try {
      const raw = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          product: {
            include: {
              category: true,
              supplier: true,
              inventory: true,
              images: { orderBy: { order: 'asc' } },
            },
          },
          inventory: true,
          images: { orderBy: { order: 'asc' } },
          saleItems: {
            take: 5,
            orderBy: { sale: { saleDate: 'desc' } },
          },
        },
      });

      if (!raw) throw new AppError('Variant not found', 404);

      const variant = normalizeVariant(raw);
      if (!variant) throw new AppError('Failed to normalize variant', 500);

      if (raw.product) {
        variant.product = normalizeProduct(raw.product);
      }

      return variant;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getVariantById');
    }
  }

  async getVariantBySku(
    sku: string,
    businessUnitId?: string
  ): Promise<ProductVariant> {
    try {
      const raw = await this.prisma.productVariant.findFirst({
        where: { sku: { equals: sku, mode: 'insensitive' } },
        include: {
          product: {
            include: {
              category: true,
              supplier: true,
              inventory: {
                where: { businessUnitId: businessUnitId || undefined },
              },
              images: { orderBy: { order: 'asc' } },
            },
          },
          inventory: {
            where: { businessUnitId: businessUnitId || undefined },
          },
          images: { orderBy: { order: 'asc' } },
        },
      });

      if (!raw) throw new AppError('Variant not found', 404);

      const variant = normalizeVariant(raw);
      if (!variant) throw new AppError('Failed to normalize variant', 500);
      if (raw.product) {
        variant.product = normalizeProduct(raw.product);
      }
      return variant;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getVariantBySku');
    }
  }

  async getVariantByBarcode(
    barcode: string,
    businessUnitId?: string
  ): Promise<Product | ProductVariant> {
    try {
      if (!barcode) throw new AppError('Barcode is required', 400);

      const product = await this.prisma.product.findFirst({
        where: {
          barcode,
          ...(businessUnitId ? { businessUnitId } : {}),
        },
        include: PRODUCT_DETAIL_INCLUDE,
      });

      if (product) {
        const normalized = normalizeProduct(product);
        if (
          normalized &&
          normalized.variants &&
          normalized.variants.length === 1
        ) {
          const singleVariant = normalized.variants[0];
          return {
            ...singleVariant,
            product: { ...normalized, variants: undefined },
          };
        }
        if (normalized) return normalized;
      }

      const raw = await this.prisma.productVariant.findFirst({
        where: {
          sku: { equals: barcode, mode: 'insensitive' },
          ...(businessUnitId ? { product: { businessUnitId } } : {}),
        },
        include: {
          product: {
            include: {
              category: true,
              supplier: true,
              inventory: {
                where: { businessUnitId: businessUnitId || undefined },
              },
              images: { orderBy: { order: 'asc' } },
            },
          },
          inventory: {
            where: { businessUnitId: businessUnitId || undefined },
          },
          images: { orderBy: { order: 'asc' } },
        },
      });

      if (!raw) {
        throw new AppError(
          `No product or variant found for barcode/SKU "${barcode}"`,
          404
        );
      }

      const variant = normalizeVariant(raw);
      if (!variant) throw new AppError('Failed to normalize variant', 500);
      if (raw.product) {
        variant.product = normalizeProduct(raw.product);
      }
      return variant;
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getVariantByBarcode'
      );
    }
  }

  async bulkCreateVariants(
    productId: string,
    variants: VariantCreateData[]
  ): Promise<{
    results: ProductVariant[];
    errors: Array<{ variant: any; message: string }>;
  }> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: { inventory: true },
      });

      if (!product) throw new AppError('Product not found', 404);

      const results: ProductVariant[] = [];
      const errors: Array<{ variant: any; message: string }> = [];

      // Validate + normalise each variant before opening the tx.
      const prepared: Array<{
        data: VariantCreateData;
        images: string[];
        sku: string;
        locationName: string;
        locationId: string | null;
      }> = [];

      for (const variantData of variants) {
        try {
          if (!variantData.name) {
            throw new AppError('Variant name is required', 400);
          }

          const images = this.cleanImages(variantData.images || []);
          let sku = variantData.sku;
          if (!sku || sku === 'SKU' || sku.trim() === '') {
            sku = this.generateVariantSKU(product.sku, variantData.name);
          } else {
            sku = sku.toUpperCase().trim();
          }

          const locationName = variantData.location || 'Warehouse';
          const locationId = await this.resolveLocationId(
            product.businessUnitId,
            locationName,
          );

          prepared.push({ data: variantData, images, sku, locationName, locationId });
        } catch (err) {
          errors.push({
            variant: variantData,
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      if (prepared.length === 0) {
        return { results, errors };
      }

      // One transaction for all valid variants.
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Ensure SKUs are unique within the batch AND against the DB.
        for (const item of prepared) {
          let sku = item.sku;
          let attempts = 0;
          while (attempts < 5) {
            const clash = await tx.productVariant.findFirst({
              where: { sku: { equals: sku, mode: 'insensitive' } },
              select: { id: true },
            });
            if (!clash) break;
            sku = this.generateVariantSKU(product.sku, item.data.name);
            attempts++;
          }
          if (attempts >= 5) {
            throw new AppError(
              `Unable to generate a unique SKU for variant "${item.data.name}"`,
              400,
            );
          }
          item.sku = sku;

          const price = item.data.price ?? product.unitPrice;
          const costPrice = item.data.costPrice ?? product.costPrice ?? price;

          const createdVariant = await tx.productVariant.create({
            data: {
              productId,
              name: item.data.name,
              sku: item.sku,
              price: Number(price),
              costPrice: Number(costPrice),
              stock: item.data.stock || 0,
              images: toImageCreateInput(item.images),
              attributes: item.data.attributes || {},
              isActive:
                item.data.isActive !== undefined ? item.data.isActive : true,
              barcode: item.data.barcode || null,
            },
          });

          const inventory = await tx.inventory.create({
            data: {
              businessUnitId: product.businessUnitId,
              locationId: item.locationId,
              quantity: item.data.stock || 0,
              reserved: 0,
              available: item.data.stock || 0,
              reorderPoint: 5,
              reorderQuantity: 10,
              location: item.locationName,
              status: 'ACTIVE',
            },
          });

          await tx.productVariant.update({
            where: { id: createdVariant.id },
            data: { inventoryId: inventory.id },
          });

          if (item.data.stock && item.data.stock > 0) {
            await tx.inventoryTransaction.create({
              data: {
                transactionType: 'INITIAL',
                quantity: item.data.stock,
                notes: `Initial stock for variant ${createdVariant.name}`,
                productId,
                variantId: createdVariant.id,
                inventoryId: inventory.id,
                businessUnitId: product.businessUnitId,
                userId: 'system',
              },
            });
          }

          const full = await tx.productVariant.findUnique({
            where: { id: createdVariant.id },
            include: {
              inventory: true,
              images: { orderBy: { order: 'asc' } },
            },
          });

          const normalized = full ? normalizeVariant(full) : null;
          if (normalized) results.push(normalized);
        }

        if (product.type === 'SIMPLE' && results.length > 0) {
          await tx.product.update({
            where: { id: productId },
            data: { type: 'VARIABLE' },
          });
        }
      });

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkCreateVariants'
      );
    }
  }

  async bulkDeleteVariants(variantIds: string[]): Promise<{
    results: any[];
    errors: Array<{ id: string; message: string }>;
  }> {
    try {
      const results: any[] = [];
      const errors: Array<{ id: string; message: string }> = [];

      for (const id of variantIds) {
        try {
          const result = await this.deleteVariant(id);
          results.push(result);
        } catch (error) {
          errors.push({
            id,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkDeleteVariants'
      );
    }
  }

  async updateVariantStock(
    variantId: string,
    quantity: number,
    userId: string,
    note?: string
  ): Promise<ProductVariant> {
    try {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true, inventory: true },
      });

      if (!variant) throw new AppError('Variant not found', 404);
      if (quantity < 0) {
        throw new AppError('Stock quantity cannot be negative', 400);
      }

      const raw = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updated = await tx.productVariant.update({
            where: { id: variantId },
            data: { stock: quantity },
            include: {
              inventory: true,
              images: { orderBy: { order: 'asc' } },
            },
          });

          if (variant.inventory) {
            await tx.inventory.update({
              where: { id: variant.inventory.id },
              data: {
                quantity,
                available: quantity - (variant.inventory.reserved || 0),
              },
            });

            const previousStock = variant.stock || 0;
            const difference = quantity - previousStock;

            await tx.inventoryTransaction.create({
              data: {
                transactionType: difference >= 0 ? 'RESTOCK' : 'ADJUSTMENT',
                quantity: Math.abs(difference),
                notes:
                  note || `Stock updated from ${previousStock} to ${quantity}`,
                reference: `Variant stock update`,
                productId: variant.productId,
                variantId,
                inventoryId: variant.inventory.id,
                businessUnitId: variant.product.businessUnitId,
                userId,
              },
            });
          }

          return updated;
        }
      );

      const normalized = normalizeVariant(raw);
      if (!normalized) throw new AppError('Failed to normalize variant', 500);
      return normalized;
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.updateVariantStock'
      );
    }
  }

  // ============================================
  // BARCODE METHODS
  // ============================================

  async generateUniqueBarcode(
    options?: GenerateBarcodeOptions
  ): Promise<{ barcode: string }> {
    try {
      const prefix = options?.prefix || 'PRD';
      const length = options?.length || 12;
      const barcode = await this.generateUniqueBarcodeInternal(prefix, length);
      return { barcode };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.generateUniqueBarcode'
      );
    }
  }

  async generateBarcode(
    productId: string,
    options?: GenerateBarcodeOptions
  ): Promise<BarcodeInfo> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) throw new AppError('Product not found', 404);

      const barcode = await this.generateUniqueBarcodeInternal(
        options?.prefix || 'PRD',
        options?.length || 12
      );

      await this.prisma.product.update({
        where: { id: productId },
        data: { barcode },
      });

      return {
        barcode,
        barcodeUrl: this.generateBarcodeImageUrl(barcode, options?.format),
        qrCodeUrl: this.generateQRCodeUrl(product.name, product.sku, barcode),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        price: product.unitPrice,
        format:
          (options?.format as 'EAN-13' | 'UPC-A' | 'CODE128' | 'QR') ||
          'EAN-13',
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.generateBarcode');
    }
  }

  async getProductBarcode(productId: string): Promise<BarcodeInfo> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          unitPrice: true,
        },
      });

      if (!product) throw new AppError('Product not found', 404);
      if (!product.barcode)
        throw new AppError('Product does not have a barcode', 404);

      return {
        barcode: product.barcode,
        barcodeUrl: this.generateBarcodeImageUrl(product.barcode),
        qrCodeUrl: this.generateQRCodeUrl(
          product.name,
          product.sku,
          product.barcode
        ),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        price: product.unitPrice,
        format: 'EAN-13',
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getProductBarcode');
    }
  }

  async getBarcodeImage(productId: string): Promise<{ barcodeUrl: string }> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { barcode: true },
      });

      if (!product) throw new AppError('Product not found', 404);
      if (!product.barcode)
        throw new AppError('Product does not have a barcode', 404);

      return { barcodeUrl: this.generateBarcodeImageUrl(product.barcode) };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getBarcodeImage');
    }
  }

  async getProductQRCode(productId: string): Promise<{ qrCodeUrl: string }> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          unitPrice: true,
        },
      });

      if (!product) throw new AppError('Product not found', 404);
      if (!product.barcode)
        throw new AppError('Product does not have a barcode', 404);

      return {
        qrCodeUrl: this.generateQRCodeUrl(
          product.name,
          product.sku,
          product.barcode
        ),
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getProductQRCode');
    }
  }

  async generateBarcodeImage(
    barcode: string,
    format?: string
  ): Promise<{ barcodeUrl: string }> {
    try {
      if (!barcode) throw new AppError('Barcode is required', 400);
      return { barcodeUrl: this.generateBarcodeImageUrl(barcode, format) };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.generateBarcodeImage'
      );
    }
  }

  async generateQRCode(data: any): Promise<{ qrCodeUrl: string }> {
    try {
      if (!data) throw new AppError('QR code data is required', 400);
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
        JSON.stringify(data)
      )}&size=200x200`;
      return { qrCodeUrl };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.generateQRCode');
    }
  }

  async associateBarcode(
    productId: string,
    barcode: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) throw new AppError('Product not found', 404);

      const existing = await this.prisma.product.findFirst({
        where: { barcode, id: { not: productId } },
      });

      if (existing) {
        throw new AppError('Barcode is already assigned to another product', 409);
      }

      await this.prisma.product.update({
        where: { id: productId },
        data: { barcode },
      });

      return { success: true, message: 'Barcode associated successfully' };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.associateBarcode');
    }
  }

  async validateBarcode(
    barcode: string,
    excludeProductId?: string
  ): Promise<{ valid: boolean; message?: string }> {
    try {
      if (!barcode) return { valid: false, message: 'Barcode is required' };

      const where: any = { barcode };
      if (excludeProductId) where.id = { not: excludeProductId };

      const existing = await this.prisma.product.findFirst({ where });
      if (existing) {
        return { valid: false, message: 'Barcode is already in use' };
      }
      return { valid: true };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.validateBarcode');
    }
  }

  async getProductsWithoutBarcode(params: {
    businessUnitId: string;
    page?: number;
    limit?: number;
  }): Promise<{
    products: Product[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    try {
      const { businessUnitId, page = 1, limit = 20 } = params;
      const skip = (Number(page) - 1) * Number(limit);

      const where: Prisma.ProductWhereInput = {
        businessUnitId,
        barcode: null,
        isActive: true,
      };

      const [rawProducts, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take: Number(limit),
          include: PRODUCT_LIST_INCLUDE,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.product.count({ where }),
      ]);

      const products = rawProducts
        .map(normalizeProduct)
        .filter((p): p is Product => p !== null);

      return {
        products,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)) || 1,
        limit: Number(limit),
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getProductsWithoutBarcode'
      );
    }
  }

  async bulkGenerateBarcodes(
    productIds: string[],
    options?: GenerateBarcodeOptions
  ): Promise<{ results: BarcodeInfo[]; errors: any[] }> {
    try {
      const results: BarcodeInfo[] = [];
      const errors: Array<{ id: string; message: string }> = [];

      for (const id of productIds) {
        try {
          const result = await this.generateBarcode(id, options);
          results.push(result);
        } catch (error) {
          errors.push({
            id,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkGenerateBarcodes'
      );
    }
  }

  async scanBarcode(
    barcode: string,
    businessUnitId: string
  ): Promise<{
    product: Product;
    inventory?: { quantity: number; reserved: number; available: number };
    barcodeInfo: BarcodeInfo;
    variant?: ProductVariant;
  }> {
    try {
      if (!barcode) throw new AppError('Barcode is required', 400);

      let rawProduct = await this.prisma.product.findFirst({
        where: { barcode, businessUnitId },
        include: PRODUCT_DETAIL_INCLUDE,
      });

      let rawVariant: any = null;

      if (!rawProduct) {
        rawVariant = await this.prisma.productVariant.findFirst({
          where: {
            sku: { equals: barcode, mode: 'insensitive' },
            product: { businessUnitId },
          },
          include: {
            product: { include: PRODUCT_DETAIL_INCLUDE },
            inventory: true,
            images: { orderBy: { order: 'asc' } },
          },
        });

        if (rawVariant) {
          rawProduct = rawVariant.product;
        }
      }

      if (!rawProduct) {
        throw new AppError(
          `Product not found for barcode/SKU "${barcode}"`,
          404
        );
      }

      const product = normalizeProduct(rawProduct);
      if (!product) throw new AppError('Failed to normalize product', 500);

      const aggregates = computeStockAggregates(product);
      const withAggregates: Product = { ...product, ...aggregates };

      let barcodeInfo: BarcodeInfo;
      try {
        barcodeInfo = await this.getProductBarcode(product.id);
      } catch {
        barcodeInfo = {
          barcode: product.barcode || barcode,
          barcodeUrl: this.generateBarcodeImageUrl(product.barcode || barcode),
          qrCodeUrl: this.generateQRCodeUrl(
            product.name,
            product.sku,
            product.barcode || barcode
          ),
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          price: product.unitPrice,
          format: 'EAN-13',
          generatedAt: new Date().toISOString(),
        };
      }

      const variant = rawVariant
        ? normalizeVariant(rawVariant) ?? undefined
        : undefined;

      return {
        product: withAggregates,
        variant,
        inventory: product.inventory
          ? {
              quantity: product.inventory.quantity,
              reserved: product.inventory.reserved,
              available: product.inventory.available,
            }
          : undefined,
        barcodeInfo,
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.scanBarcode');
    }
  }

  // ============================================
  // FEATURED & POPULAR PRODUCTS
  // ============================================

  async getFeaturedProducts(
    limit: number = 10,
    businessUnitId?: string
  ): Promise<Product[]> {
    try {
      const where: Prisma.ProductWhereInput = { isActive: true };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const raw = await this.prisma.product.findMany({
        where,
        take: Math.min(Number(limit) || 10, 50),
        orderBy: { rating: 'desc' },
        include: PRODUCT_LIST_INCLUDE,
      });

      return raw
        .map(normalizeProduct)
        .filter((p): p is Product => p !== null);
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getFeaturedProducts'
      );
    }
  }

  async getPopularProducts(
    limit: number = 10,
    businessUnitId?: string
  ): Promise<Product[]> {
    try {
      const where: Prisma.ProductWhereInput = { isActive: true };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const raw = await this.prisma.product.findMany({
        where,
        take: Math.min(Number(limit) || 10, 50),
        orderBy: { rating: 'desc' },
        include: PRODUCT_LIST_INCLUDE,
      });

      return raw
        .map(normalizeProduct)
        .filter((p): p is Product => p !== null);
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getPopularProducts'
      );
    }
  }

  async getNewArrivals(
    limit: number = 10,
    businessUnitId?: string
  ): Promise<Product[]> {
    try {
      const where: Prisma.ProductWhereInput = { isActive: true };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const raw = await this.prisma.product.findMany({
        where,
        take: Math.min(Number(limit) || 10, 50),
        orderBy: { createdAt: 'desc' },
        include: PRODUCT_LIST_INCLUDE,
      });

      return raw
        .map(normalizeProduct)
        .filter((p): p is Product => p !== null);
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getNewArrivals');
    }
  }

  async getRelatedProducts(
    productId: string,
    limit: number = 4
  ): Promise<Product[]> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { categoryId: true, tags: true, businessUnitId: true },
      });

      if (!product) throw new AppError('Product not found', 404);

      const where: Prisma.ProductWhereInput = {
        id: { not: productId },
        isActive: true,
        businessUnitId: product.businessUnitId,
      };

      const orConditions: Prisma.ProductWhereInput[] = [];
      if (product.categoryId) {
        orConditions.push({ categoryId: product.categoryId });
      }
      if (product.tags && product.tags.length > 0) {
        orConditions.push({ tags: { hasSome: product.tags } });
      }
      if (orConditions.length > 0) where.OR = orConditions;

      let raw = await this.prisma.product.findMany({
        where,
        take: Math.min(Number(limit) || 4, 20),
        orderBy: { rating: 'desc' },
        include: PRODUCT_LIST_INCLUDE,
      });

      if (raw.length === 0) {
        raw = await this.prisma.product.findMany({
          where: {
            id: { not: productId },
            isActive: true,
            businessUnitId: product.businessUnitId,
          },
          take: Math.min(Number(limit) || 4, 20),
          orderBy: { createdAt: 'desc' },
          include: PRODUCT_LIST_INCLUDE,
        });
      }

      return raw
        .map(normalizeProduct)
        .filter((p): p is Product => p !== null);
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getRelatedProducts');
    }
  }

  async getProductStatistics(businessUnitId?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    featured: number;
    withVariants: number;
    totalProductsWithVariants: number;
    variantCount: number;
    totalVariantStock: number;
    lowStock: number;
    outOfStock: number;
    totalRevenue: number;
    averagePrice: number;
    totalCategories: number;
    totalSuppliers: number;
    totalStockValue: number;
    totalStockCost: number;
    potentialProfit: number;
    withBarcode: number;
    withoutBarcode: number;
  }> {
    try {
      const where: Prisma.ProductWhereInput = {};
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const raw = await this.prisma.product.findMany({
        where: { ...where, isActive: true },
        include: {
          inventory: true,
          variants: { include: { inventory: true } },
        },
      });

      let lowStockCount = 0;
      let outOfStockCount = 0;
      let totalStockValue = 0;
      let totalStockCost = 0;
      let withBarcode = 0;
      let withoutBarcode = 0;
      let variantCount = 0;
      let totalVariantStock = 0;

      for (const product of raw) {
        if (product.barcode) withBarcode++;
        else withoutBarcode++;

        if (product.inventory) {
          const quantity = product.inventory.quantity || 0;
          const minStock = product.minStock || 5;

          if (quantity === 0) outOfStockCount++;
          else if (quantity <= minStock) lowStockCount++;

          totalStockValue += quantity * (product.unitPrice || 0);
          totalStockCost += quantity * (product.costPrice || 0);
        }

        if (product.variants && product.variants.length > 0) {
          variantCount += product.variants.length;
          for (const variant of product.variants) {
            if (variant.inventory) {
              const inv = variant.inventory;
              totalVariantStock += inv.quantity || 0;
              totalStockValue += (inv.quantity || 0) * (variant.price || 0);
              totalStockCost += (inv.quantity || 0) * (variant.costPrice || 0);
            }
          }
        }
      }

      const [total, active, inactive, featured, withVariants, totalProductsWithVariants] =
        await Promise.all([
          this.prisma.product.count({ where }),
          this.prisma.product.count({ where: { ...where, isActive: true } }),
          this.prisma.product.count({ where: { ...where, isActive: false } }),
          this.prisma.product.count({ where: { ...where, featured: true } }),
          this.prisma.product.count({
            where: {
              ...where,
              isActive: true,
              variants: { some: { isActive: true } },
            },
          }),
          this.prisma.product.count({
            where: { ...where, isActive: true, variants: { some: {} } },
          }),
        ]);

      const [totalCategories, totalSuppliers] = await Promise.all([
        businessUnitId
          ? this.prisma.category.count({ where: { businessUnitId } })
          : this.prisma.category.count(),
        this.prisma.supplier.count(),
      ]);

      return {
        total,
        active,
        inactive,
        featured,
        withVariants,
        totalProductsWithVariants,
        variantCount,
        totalVariantStock,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        totalRevenue: 0,
        averagePrice:
          total > 0
            ? raw.reduce((sum, p) => sum + (p.unitPrice || 0), 0) / total
            : 0,
        totalCategories,
        totalSuppliers,
        totalStockValue,
        totalStockCost,
        potentialProfit: totalStockValue - totalStockCost,
        withBarcode,
        withoutBarcode,
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getProductStatistics'
      );
    }
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async bulkCreateProducts(
    products: any[],
    businessUnitId: string,
    userId: string
  ): Promise<{
    results: Product[];
    errors: Array<{ product: any; error: string }>;
  }> {
    try {
      const results: Product[] = [];
      const errors: Array<{ product: any; error: string }> = [];

      for (const productData of products) {
        try {
          if (
            !productData.sku ||
            productData.sku === 'SKU' ||
            productData.sku.trim() === ''
          ) {
            productData.sku = this.generateProductSKU(productData.name);
          }

          const product = await this.createProduct(
            { ...productData, businessUnitId },
            userId
          );
          results.push(product);
        } catch (error) {
          errors.push({
            product: productData,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkCreateProducts'
      );
    }
  }

  async bulkUpdatePrices(
    updates: Array<{ id: string; price: number }>
  ): Promise<{
    results: Product[];
    errors: Array<{ id: string; message: string }>;
  }> {
    try {
      const results: Product[] = [];
      const errors: Array<{ id: string; message: string }> = [];

      for (const update of updates) {
        try {
          if (!update.id || update.price === undefined || update.price < 0) {
            throw new Error('Invalid update data');
          }

          const raw = await this.prisma.product.update({
            where: { id: update.id },
            data: { unitPrice: update.price },
            include: PRODUCT_LIST_INCLUDE,
          });

          const normalized = normalizeProduct(raw);
          if (normalized) results.push(normalized);
        } catch (error) {
          errors.push({
            id: update.id || 'unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.bulkUpdatePrices');
    }
  }

  async bulkUpdateStock(
    updates: Array<{ id: string; stock: number }>
  ): Promise<{
    results: Product[];
    errors: Array<{ id: string; message: string }>;
  }> {
    try {
      const results: Product[] = [];
      const errors: Array<{ id: string; message: string }> = [];

      for (const update of updates) {
        try {
          if (!update.id || update.stock === undefined || update.stock < 0) {
            throw new Error('Invalid update data');
          }

          const product = await this.prisma.product.findUnique({
            where: { id: update.id },
            include: { inventory: true },
          });

          if (!product) throw new Error('Product not found');

          if (product.inventory) {
            await this.prisma.inventory.update({
              where: { id: product.inventory.id },
              data: {
                quantity: update.stock,
                available: update.stock - (product.inventory.reserved || 0),
              },
            });
          } else {
            const inventory = await this.prisma.inventory.create({
              data: {
                businessUnitId: product.businessUnitId,
                quantity: update.stock,
                reserved: 0,
                available: update.stock,
                reorderPoint: product.minStock || 5,
                reorderQuantity: 10,
                location: 'Warehouse',
                status: 'ACTIVE',
              },
            });
            await this.prisma.product.update({
              where: { id: update.id },
              data: { inventoryId: inventory.id },
            });
          }

          const raw = await this.prisma.product.findUnique({
            where: { id: update.id },
            include: PRODUCT_LIST_INCLUDE,
          });

          const normalized = normalizeProduct(raw);
          if (normalized) results.push(normalized);
        } catch (error) {
          errors.push({
            id: update.id || 'unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.bulkUpdateStock');
    }
  }

  async bulkDeleteProducts(
    productIds: string[],
    _businessUnitId: string
  ): Promise<{
    results: any[];
    errors: Array<{ id: string; error: string }>;
  }> {
    try {
      const results: any[] = [];
      const errors: Array<{ id: string; error: string }> = [];

      for (const id of productIds) {
        try {
          const result = await this.deleteProduct(id);
          results.push(result);
        } catch (error) {
          errors.push({
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkDeleteProducts'
      );
    }
  }

  async bulkActivateProducts(
    productIds: string[]
  ): Promise<{
    results: Product[];
    errors: Array<{ id: string; error: string }>;
  }> {
    try {
      const results: Product[] = [];
      const errors: Array<{ id: string; error: string }> = [];

      for (const id of productIds) {
        try {
          const raw = await this.prisma.product.update({
            where: { id },
            data: { isActive: true, updatedAt: new Date() },
            include: PRODUCT_LIST_INCLUDE,
          });
          const normalized = normalizeProduct(raw);
          if (normalized) results.push(normalized);
        } catch (error) {
          errors.push({
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkActivateProducts'
      );
    }
  }

  async bulkDeactivateProducts(
    productIds: string[]
  ): Promise<{
    results: Product[];
    errors: Array<{ id: string; error: string }>;
  }> {
    try {
      const results: Product[] = [];
      const errors: Array<{ id: string; error: string }> = [];

      for (const id of productIds) {
        try {
          const raw = await this.prisma.product.update({
            where: { id },
            data: { isActive: false, updatedAt: new Date() },
            include: PRODUCT_LIST_INCLUDE,
          });
          const normalized = normalizeProduct(raw);
          if (normalized) results.push(normalized);
        } catch (error) {
          errors.push({
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkDeactivateProducts'
      );
    }
  }

  // ============================================
  // CATEGORY METHODS
  // ============================================

  async getCategories(businessUnitId: string): Promise<any[]> {
    try {
      return await this.prisma.category.findMany({
        where: { businessUnitId },
        include: {
          _count: { select: { products: true, children: true } },
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getCategories');
    }
  }

  async getCategoryById(id: string, businessUnitId: string): Promise<any> {
    try {
      const category = await this.prisma.category.findFirst({
        where: { id, businessUnitId },
        include: {
          products: {
            select: {
              id: true,
              name: true,
              sku: true,
              unitPrice: true,
              images: true,
            },
          },
          _count: { select: { products: true } },
        },
      });

      if (!category) throw new AppError('Category not found', 404);
      return category;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getCategoryById');
    }
  }

  async getCategoryTree(businessUnitId: string): Promise<any[]> {
    try {
      const categories = await this.prisma.category.findMany({
        where: { businessUnitId },
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
      });

      const buildTree = (items: any[], parentId: string | null = null): any[] =>
        items
          .filter((item: any) => item.parentId === parentId)
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            parentId: item.parentId,
            isActive: item.isActive,
            productCount: item._count?.products || 0,
            children: buildTree(items, item.id),
          }));

      return buildTree(categories);
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getCategoryTree');
    }
  }

  async getCategoryProducts(
    categoryId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    products: Product[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    try {
      const { page = 1, limit = 10 } = params || {};
      const skip = (Number(page) - 1) * Number(limit);

      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) throw new AppError('Category not found', 404);

      const [rawProducts, total] = await Promise.all([
        this.prisma.product.findMany({
          where: { categoryId, isActive: true },
          skip,
          take: Number(limit),
          orderBy: { name: 'asc' },
          include: PRODUCT_LIST_INCLUDE,
        }),
        this.prisma.product.count({
          where: { categoryId, isActive: true },
        }),
      ]);

      return {
        products: rawProducts
          .map(normalizeProduct)
          .filter((p): p is Product => p !== null),
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)) || 1,
        limit: Number(limit),
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getCategoryProducts'
      );
    }
  }

  async createCategory(data: {
    name: string;
    description?: string;
    parentId?: string;
    businessUnitId: string;
    userId: string;
    featured?: boolean;
    isActive?: boolean;
  }): Promise<any> {
    try {
      const existing = await this.prisma.category.findFirst({
        where: {
          name: { equals: data.name, mode: 'insensitive' },
          businessUnitId: data.businessUnitId,
        },
      });

      if (existing) {
        throw new AppError('Category with this name already exists', 400);
      }

      if (data.parentId) {
        const parent = await this.prisma.category.findUnique({
          where: { id: data.parentId },
        });
        if (!parent) throw new AppError('Parent category not found', 404);
        if (parent.businessUnitId !== data.businessUnitId) {
          throw new AppError(
            'Parent category must be in the same business unit',
            400
          );
        }
      }

      return await this.prisma.category.create({
        data: {
          name: data.name,
          description: data.description,
          parentId: data.parentId || null,
          businessUnitId: data.businessUnitId,
          isActive: data.isActive !== undefined ? data.isActive : true,
          featured: data.featured || false,
        },
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.createCategory');
    }
  }

  async updateCategory(
    id: string,
    data: {
      name?: string;
      description?: string;
      parentId?: string;
      featured?: boolean;
      isActive?: boolean;
    }
  ): Promise<any> {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
      });
      if (!category) throw new AppError('Category not found', 404);

      if (data.name && data.name.toLowerCase() !== category.name.toLowerCase()) {
        const existing = await this.prisma.category.findFirst({
          where: {
            name: { equals: data.name, mode: 'insensitive' },
            businessUnitId: category.businessUnitId,
            id: { not: id },
          },
        });
        if (existing) {
          throw new AppError('Category with this name already exists', 400);
        }
      }

      if (data.parentId) {
        if (data.parentId === id) {
          throw new AppError('Category cannot be its own parent', 400);
        }
        const parent = await this.prisma.category.findUnique({
          where: { id: data.parentId },
        });
        if (!parent) throw new AppError('Parent category not found', 404);
        if (parent.businessUnitId !== category.businessUnitId) {
          throw new AppError(
            'Parent category must be in the same business unit',
            400
          );
        }
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.parentId !== undefined)
        updateData.parentId = data.parentId || null;
      if (data.featured !== undefined) updateData.featured = data.featured;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      return await this.prisma.category.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.updateCategory');
    }
  }

  async deleteCategory(id: string, businessUnitId: string): Promise<any> {
    try {
      const category = await this.prisma.category.findFirst({
        where: { id, businessUnitId },
        include: { products: true, children: true },
      });
      if (!category) throw new AppError('Category not found', 404);
      if (category.products.length > 0) {
        throw new AppError(
          'Cannot delete category with associated products',
          400
        );
      }
      if (category.children.length > 0) {
        throw new AppError('Cannot delete category with child categories', 400);
      }
      return await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.deleteCategory');
    }
  }

  // ============================================
  // SUPPLIER METHODS
  // ============================================

  async getSuppliers(companyId: string): Promise<any[]> {
    try {
      return await this.prisma.supplier.findMany({
        where: { companyId },
        include: {
          _count: { select: { products: true, purchaseOrders: true } },
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getSuppliers');
    }
  }

  async getSupplierById(id: string, companyId: string): Promise<any> {
    try {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id, companyId },
        include: {
          products: {
            select: { id: true, name: true, sku: true, unitPrice: true },
          },
          purchaseOrders: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          _count: { select: { products: true, purchaseOrders: true } },
        },
      });

      if (!supplier) throw new AppError('Supplier not found', 404);
      return supplier;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getSupplierById');
    }
  }

  async getSupplierProducts(
    supplierId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    products: Product[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    try {
      const { page = 1, limit = 10 } = params || {};
      const skip = (Number(page) - 1) * Number(limit);

      const supplier = await this.prisma.supplier.findUnique({
        where: { id: supplierId },
      });
      if (!supplier) throw new AppError('Supplier not found', 404);

      const [rawProducts, total] = await Promise.all([
        this.prisma.product.findMany({
          where: { supplierId, isActive: true },
          skip,
          take: Number(limit),
          orderBy: { name: 'asc' },
          include: PRODUCT_LIST_INCLUDE,
        }),
        this.prisma.product.count({
          where: { supplierId, isActive: true },
        }),
      ]);

      return {
        products: rawProducts
          .map(normalizeProduct)
          .filter((p): p is Product => p !== null),
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)) || 1,
        limit: Number(limit),
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getSupplierProducts'
      );
    }
  }

  async createSupplier(data: {
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address?: string;
    taxId?: string;
    notes?: string;
    isActive?: boolean;
    companyId: string;
    userId: string;
  }): Promise<any> {
    try {
      const existing = await this.prisma.supplier.findFirst({
        where: {
          name: { equals: data.name, mode: 'insensitive' },
          companyId: data.companyId,
        },
      });
      if (existing) {
        throw new AppError('Supplier with this name already exists', 400);
      }

      return await this.prisma.supplier.create({
        data: {
          name: data.name,
          contactPerson: data.contactPerson,
          email: data.email,
          phone: data.phone,
          address: data.address || null,
          taxId: data.taxId || null,
          notes: data.notes || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
          companyId: data.companyId,
        },
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.createSupplier');
    }
  }

  async updateSupplier(id: string, data: any): Promise<any> {
    try {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
      });
      if (!supplier) throw new AppError('Supplier not found', 404);

      if (data.name && data.name.toLowerCase() !== supplier.name.toLowerCase()) {
        const existing = await this.prisma.supplier.findFirst({
          where: {
            name: { equals: data.name, mode: 'insensitive' },
            companyId: supplier.companyId,
            id: { not: id },
          },
        });
        if (existing) {
          throw new AppError('Supplier with this name already exists', 400);
        }
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.contactPerson !== undefined)
        updateData.contactPerson = data.contactPerson;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.address !== undefined) updateData.address = data.address || null;
      if (data.taxId !== undefined) updateData.taxId = data.taxId || null;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      return await this.prisma.supplier.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.updateSupplier');
    }
  }

  async deleteSupplier(id: string, companyId: string): Promise<any> {
    try {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id, companyId },
        include: { products: true, purchaseOrders: true },
      });
      if (!supplier) throw new AppError('Supplier not found', 404);
      if (supplier.products.length > 0) {
        throw new AppError(
          'Cannot delete supplier with associated products',
          400
        );
      }
      if (supplier.purchaseOrders.length > 0) {
        throw new AppError(
          'Cannot delete supplier with associated purchase orders',
          400
        );
      }
      return await this.prisma.supplier.delete({ where: { id } });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.deleteSupplier');
    }
  }

  // ============================================
  // REVIEW METHODS
  // ============================================

  async getProductReviews(
    productId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    reviews: ProductReview[];
    stats: { average: number; total: number; distribution: Record<number, number> };
    pagination: { total: number; page: number; totalPages: number; limit: number };
  }> {
    try {
      const { page = 1, limit = 10 } = params || {};
      const skip = (Number(page) - 1) * Number(limit);

      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new AppError('Product not found', 404);

      const [rawReviews, total] = await Promise.all([
        this.prisma.productReview.findMany({
          where: { productId },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            // ✅ fetch the review images relation so normalizeReview can flatten it
            images: { orderBy: { order: 'asc' } },
          },
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.productReview.count({ where: { productId } }),
      ]);

      const reviews = rawReviews
        .map(normalizeReview)
        .filter((r): r is ProductReview => r !== null);

      const stats = await this.getReviewStats(productId);

      return {
        reviews,
        stats,
        pagination: {
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)) || 1,
          limit: Number(limit),
        },
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getProductReviews'
      );
    }
  }

  async getReviewStats(productId: string): Promise<{
    average: number;
    total: number;
    distribution: Record<number, number>;
  }> {
    try {
      const result = await this.prisma.productReview.groupBy({
        by: ['rating'],
        where: { productId },
        _count: true,
      });

      const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let total = 0;
      let sum = 0;

      for (const item of result) {
        distribution[item.rating] = item._count;
        total += item._count;
        sum += item.rating * item._count;
      }

      return {
        average: total > 0 ? sum / total : 0,
        total,
        distribution,
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getReviewStats');
    }
  }

  async createProductReview(data: {
    productId: string;
    userId: string;
    rating: number;
    title?: string;
    comment?: string;
    images?: string[];
  }): Promise<ProductReview> {
    try {
      if (data.rating < 1 || data.rating > 5) {
        throw new AppError('Rating must be between 1 and 5', 400);
      }

      const product = await this.prisma.product.findUnique({
        where: { id: data.productId },
      });
      if (!product) throw new AppError('Product not found', 404);

      const existing = await this.prisma.productReview.findFirst({
        where: { productId: data.productId, userId: data.userId },
      });
      if (existing) {
        throw new AppError('You have already reviewed this product', 400);
      }

      const hasPurchased = await this.prisma.saleItem.findFirst({
        where: {
          productId: data.productId,
          sale: { userId: data.userId, status: 'COMPLETED' },
        },
      });

      // ✅ review images is a relation → nested create (only when
      //    images are actually provided).
      const raw = await this.prisma.productReview.create({
        data: {
          productId: data.productId,
          userId: data.userId,
          rating: data.rating,
          title: data.title || null,
          comment: data.comment || null,
          ...(data.images && data.images.length > 0
            ? { images: toImageCreateInput(data.images) }
            : {}),
          isVerified: !!hasPurchased,
          helpfulCount: 0,
          status: 'PENDING',
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          images: { orderBy: { order: 'asc' } },
        },
      });

      await this.updateProductRating(data.productId);

      const review = normalizeReview(raw);
      if (!review) throw new AppError('Failed to normalize review', 500);
      return review;
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.createProductReview'
      );
    }
  }

  async updateProductReview(
    reviewId: string,
    data: any,
    userId: string
  ): Promise<ProductReview> {
    try {
      const review = await this.prisma.productReview.findUnique({
        where: { id: reviewId },
      });
      if (!review) throw new AppError('Review not found', 404);
      if (review.userId !== userId) {
        throw new AppError('You are not authorized to update this review', 403);
      }

      const updateData: any = {};
      if (data.rating !== undefined) updateData.rating = data.rating;
      if (data.title !== undefined) updateData.title = data.title || null;
      if (data.comment !== undefined) updateData.comment = data.comment || null;
      if (data.images !== undefined)
        updateData.images = toImageUpdateInput(data.images);

      const raw = await this.prisma.productReview.update({
        where: { id: reviewId },
        data: updateData,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          images: { orderBy: { order: 'asc' } },
        },
      });

      if (data.rating && data.rating !== review.rating) {
        await this.updateProductRating(review.productId);
      }

      const normalized = normalizeReview(raw);
      if (!normalized) throw new AppError('Failed to normalize review', 500);
      return normalized;
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.updateProductReview'
      );
    }
  }

  async deleteProductReview(
    reviewId: string,
    userId?: string
  ): Promise<{ message: string }> {
    try {
      const review = await this.prisma.productReview.findUnique({
        where: { id: reviewId },
      });
      if (!review) throw new AppError('Review not found', 404);

      if (userId && review.userId !== userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (!user || user.role !== 'SUPER_ADMIN') {
          throw new AppError(
            'You are not authorized to delete this review',
            403
          );
        }
      }

      const productId = review.productId;
      await this.prisma.productReview.delete({ where: { id: reviewId } });
      await this.updateProductRating(productId);

      return { message: 'Review deleted successfully' };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.deleteProductReview'
      );
    }
  }

  async verifyReview(reviewId: string): Promise<ProductReview> {
    try {
      const review = await this.prisma.productReview.findUnique({
        where: { id: reviewId },
      });
      if (!review) throw new AppError('Review not found', 404);

      const raw = await this.prisma.productReview.update({
        where: { id: reviewId },
        data: { isVerified: true },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          images: { orderBy: { order: 'asc' } },
        },
      });

      const normalized = normalizeReview(raw);
      if (!normalized) throw new AppError('Failed to normalize review', 500);
      return normalized;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.verifyReview');
    }
  }

  async markReviewHelpful(
    reviewId: string,
    _userId: string
  ): Promise<{ helpful: boolean; helpfulCount: number }> {
    try {
      const review = await this.prisma.productReview.findUnique({
        where: { id: reviewId },
      });
      if (!review) throw new AppError('Review not found', 404);

      const updated = await this.prisma.productReview.update({
        where: { id: reviewId },
        data: { helpfulCount: { increment: 1 } },
      });

      return { helpful: true, helpfulCount: updated.helpfulCount };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.markReviewHelpful'
      );
    }
  }

  async reportReview(
    reviewId: string,
    _reason: string,
    _userId: string
  ): Promise<{ message: string }> {
    try {
      const review = await this.prisma.productReview.findUnique({
        where: { id: reviewId },
      });
      if (!review) throw new AppError('Review not found', 404);
      return { message: 'Review reported successfully' };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.reportReview');
    }
  }

  async updateProductRating(productId: string): Promise<void> {
    try {
      const result = await this.prisma.productReview.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: true,
      });

      await this.prisma.product.update({
        where: { id: productId },
        data: {
          rating: result._avg.rating || 0,
          reviewCount: result._count || 0,
        },
      });
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.updateProductRating'
      );
    }
  }

  // ============================================
  // SEARCH
  // ============================================

  async searchProducts(params: {
    query: string;
    category?: string;
    businessUnitId?: string;
  }): Promise<Product[]> {
    try {
      const where: Prisma.ProductWhereInput = {
        isActive: true,
        OR: [
          { name: { contains: params.query, mode: 'insensitive' } },
          { sku: { contains: params.query, mode: 'insensitive' } },
          { barcode: { contains: params.query, mode: 'insensitive' } },
        ],
      };
      if (params.category) where.categoryId = params.category;
      if (params.businessUnitId) where.businessUnitId = params.businessUnitId;

      const raw = await this.prisma.product.findMany({
        where,
        take: 20,
        include: PRODUCT_LIST_INCLUDE,
        orderBy: { name: 'asc' },
      });

      return raw
        .map(normalizeProduct)
        .filter((p): p is Product => p !== null);
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.searchProducts');
    }
  }

  // ============================================
  // WISHLIST METHODS
  // ============================================

  async toggleWishlist(
    userId: string,
    productId: string
  ): Promise<{ added: boolean; message: string }> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new AppError('Product not found', 404);

      const existing = await this.prisma.wishlist.findUnique({
        where: { userId_productId: { userId, productId } },
      });

      if (existing) {
        await this.prisma.wishlist.delete({
          where: { userId_productId: { userId, productId } },
        });
        return { added: false, message: 'Removed from wishlist' };
      }

      await this.prisma.wishlist.create({
        data: { userId, productId, status: 'ACTIVE' },
      });

      return { added: true, message: 'Added to wishlist' };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.toggleWishlist');
    }
  }

  async getWishlist(
    userId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    products: Product[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    try {
      const { page = 1, limit = 20 } = params || {};
      const skip = (Number(page) - 1) * Number(limit);

      const [items, total] = await Promise.all([
        this.prisma.wishlist.findMany({
          where: { userId, status: 'ACTIVE' },
          skip,
          take: Number(limit),
          include: {
            product: { include: PRODUCT_LIST_INCLUDE },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.wishlist.count({ where: { userId, status: 'ACTIVE' } }),
      ]);

      const products = items
        .map((item) => {
          const normalized = normalizeProduct(item.product);
          if (!normalized) return null;
          return {
            ...normalized,
            wishlistId: item.id,
            addedAt: item.createdAt.toISOString(),
          } as Product & { wishlistId: string; addedAt: string };
        })
        .filter(
          (p): p is Product & { wishlistId: string; addedAt: string } =>
            p !== null
        );

      return {
        products,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)) || 1,
        limit: Number(limit),
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getWishlist');
    }
  }

  async checkWishlist(userId: string, productId: string): Promise<boolean> {
    try {
      const item = await this.prisma.wishlist.findUnique({
        where: { userId_productId: { userId, productId } },
      });
      return !!item;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.checkWishlist');
    }
  }

  async getWishlistCount(userId: string): Promise<number> {
    try {
      return await this.prisma.wishlist.count({
        where: { userId, status: 'ACTIVE' },
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getWishlistCount');
    }
  }

  async getWishlistProductIds(userId: string): Promise<string[]> {
    try {
      const items = await this.prisma.wishlist.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { productId: true },
      });
      return items.map((item) => item.productId);
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getWishlistProductIds'
      );
    }
  }

  async clearWishlist(userId: string): Promise<{ message: string }> {
    try {
      await this.prisma.wishlist.deleteMany({ where: { userId } });
      return { message: 'Wishlist cleared' };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.clearWishlist');
    }
  }

  // ============================================
  // RECENTLY VIEWED
  // ============================================

  async addRecentlyViewed(
    userId: string,
    productId: string
  ): Promise<{ message: string }> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new AppError('Product not found', 404);

      await this.prisma.recentlyViewed.upsert({
        where: { userId_productId: { userId, productId } },
        update: { viewedAt: new Date() },
        create: { userId, productId, viewedAt: new Date() },
      });

      return { message: 'Added to recently viewed' };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.addRecentlyViewed'
      );
    }
  }

  async getRecentlyViewed(
    userId: string,
    limit: number = 10
  ): Promise<Product[]> {
    try {
      const items = await this.prisma.recentlyViewed.findMany({
        where: { userId },
        take: Math.min(Number(limit) || 10, 50),
        orderBy: { viewedAt: 'desc' },
        include: {
          product: { include: PRODUCT_LIST_INCLUDE },
        },
      });

      return items
        .map((item) => normalizeProduct(item.product))
        .filter((p): p is Product => p !== null);
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getRecentlyViewed'
      );
    }
  }

  async clearRecentlyViewed(userId: string): Promise<{ message: string }> {
    try {
      await this.prisma.recentlyViewed.deleteMany({ where: { userId } });
      return { message: 'Recently viewed cleared' };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.clearRecentlyViewed'
      );
    }
  }

  // ============================================
  // COMPARE
  // ============================================

  async compareProducts(productIds: string[]): Promise<Product[]> {
    try {
      if (!productIds || productIds.length < 2) {
        throw new AppError(
          'At least 2 products are required for comparison',
          400
        );
      }

      const raw = await this.prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        include: {
          ...PRODUCT_DETAIL_INCLUDE,
          reviews: {
            select: { rating: true, comment: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      if (raw.length !== productIds.length) {
        throw new AppError('Some products not found', 404);
      }

      return raw
        .map(normalizeProduct)
        .filter((p): p is Product => p !== null);
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.compareProducts');
    }
  }
}

export const productService = new ProductService();
