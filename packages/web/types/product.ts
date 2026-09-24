// D:\Projects\Kalwanga\packages\web\types\product.ts

import type { BusinessUnit } from './businessUnit';
import type { User } from './user';
import type { Category as CategoryType } from './category';
import type { Supplier as SupplierType } from './supplier';
import type { Inventory } from './inventory';

import {
  ProductStatus,
  ProductType,
  TaxType,
  ReviewStatus,
  WishlistStatus,
  ReportStatus,
} from './enums';

// ============================================
// PRODUCT INTERFACES
// ============================================

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
  category?: CategoryType | null;
  businessUnitId: string;
  businessUnit?: BusinessUnit | null;
  supplierId?: string | null;
  supplier?: SupplierType | null;
  inventoryId?: string | null;

  /**
   * ⚠️ Singular relation. The Prisma model declares
   *     `inventory Inventory? @relation(...)`, so a product has at
   *     most ONE inventory row referenced here. This is different
   *     from `ProductVariant.inventory`, which is `Inventory[]`
   *     because a variant has one row per business unit.
   */
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
}

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

// ============================================
// PRODUCT VARIANT
// ============================================

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

  /**
   * ⚠️ Plural relation on variants. The Prisma model declares
   *     `inventory Inventory[]` on ProductVariant because a variant
   *     has one row per business unit.
   */
  inventory?: Inventory[] | null;

  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ============================================
// PRODUCT VARIANT FORM DATA
// ============================================

export interface ProductVariantFormData {
  id?: string;
  name: string;
  sku: string;
  price: number;
  costPrice?: number | null;
  stock: number;
  attributes: Record<string, any>;
  images?: string[];
  isActive?: boolean;
  location?: string;
}

// ============================================
// PRODUCT VARIANT WITH INVENTORY
// ============================================

export interface ProductVariantWithInventory extends ProductVariant {
  inventory: Inventory[];
  availableStock: number;
  totalStock: number;
}

// ============================================
// PRODUCT REVIEW
// ============================================

export interface ProductReview {
  id: string;
  productId: string;
  product?: Product | null;
  userId: string;
  user?: User | null;
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

export interface HelpfulReview {
  id: string;
  reviewId: string;
  review?: ProductReview | null;
  userId: string;
  user?: User | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewReport {
  id: string;
  reviewId: string;
  review?: ProductReview | null;
  userId: string;
  user?: User | null;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewStats {
  average: number;
  total: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

// ============================================
// WISHLIST
// ============================================

export interface Wishlist {
  id: string;
  userId: string;
  user?: User | null;
  productId: string;
  product?: Product | null;
  status: WishlistStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// RECENTLY VIEWED
// ============================================

export interface RecentlyViewed {
  id: string;
  userId: string;
  user?: User | null;
  productId: string;
  product?: Product | null;
  viewedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// BARCODE INTERFACES
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

// ============================================
// SEARCH & FILTERS
// ============================================

export interface ProductSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  businessUnitId?: string;
  isActive?: boolean;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
  hasVariants?: boolean;
  hasBarcode?: boolean;
  minRating?: number;
  barcode?: string;
}

// ============================================
// PAGINATION
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit?: number;
  };
}

// ============================================
// STATISTICS
// ============================================

export interface ProductStatistics {
  total: number;
  active: number;
  inactive: number;
  featured: number;
  withVariants: number;
  totalProductsWithVariants?: number;
  variantCount?: number;
  totalVariantStock?: number;
  lowStock: number;
  outOfStock: number;
  totalRevenue: number;
  averagePrice: number;
  totalCategories: number;
  totalSuppliers: number;
  totalStockValue?: number;
  totalStockCost?: number;
  potentialProfit?: number;
  withBarcode?: number;
  withoutBarcode?: number;
}

// ============================================
// BULK OPERATIONS
// ============================================

export interface BulkUpdateResult {
  results: Product[];
  errors: Array<{
    id: string;
    message: string;
  }>;
}

export interface BulkOperationResult<T> {
  results: T[];
  errors: Array<{
    row?: number;
    id?: string;
    message: string;
    product?: any;
    variant?: any;
  }>;
}

// ============================================
// IMPORT / EXPORT
// ============================================

export interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
  warnings?: Array<{
    row: number;
    message: string;
  }>;
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'json';
  includeVariants?: boolean;
  includeInventory?: boolean;
  includeCategories?: boolean;
  includeImages?: boolean;
  businessUnitId?: string;
}

// ============================================
// PRODUCT FORM TYPES
// ============================================

export interface ProductFormData {
  name: string;
  sku: string;
  description?: string | null;
  unitPrice: number;
  costPrice?: number | null;
  barcode?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
  isActive: boolean;
  featured?: boolean;
  isDigital: boolean;
  taxRate?: number | null;
  weight?: number | null;
  minStock: number;
  maxStock?: number | null;
  tags: string[];
  images: string[];
  notes?: string | null;
  seo?: ProductSEO | null;
  variants?: ProductVariantFormData[];
  attributes?: Record<string, any>;
  dimensions?: ProductDimensions;
}

// ============================================
// PRODUCT FILTER TYPES
// ============================================

export interface ProductFilterState {
  search: string;
  categoryId: string;
  status: 'all' | 'active' | 'inactive';
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  featured: boolean;
  hasVariants: boolean;
  hasBarcode: boolean;
  minRating: number;
  tags: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// ============================================
// PRODUCT SORT OPTIONS
// ============================================

export interface ProductSortOption {
  label: string;
  value: string;
  field: string;
  order: 'asc' | 'desc';
}

export const PRODUCT_SORT_OPTIONS: ProductSortOption[] = [
  { label: 'Name (A-Z)', value: 'name_asc', field: 'name', order: 'asc' },
  { label: 'Name (Z-A)', value: 'name_desc', field: 'name', order: 'desc' },
  { label: 'Price (Low to High)', value: 'price_asc', field: 'unitPrice', order: 'asc' },
  { label: 'Price (High to Low)', value: 'price_desc', field: 'unitPrice', order: 'desc' },
  { label: 'Newest First', value: 'newest', field: 'createdAt', order: 'desc' },
  { label: 'Oldest First', value: 'oldest', field: 'createdAt', order: 'asc' },
  { label: 'Rating (High to Low)', value: 'rating_desc', field: 'rating', order: 'desc' },
  { label: 'Rating (Low to High)', value: 'rating_asc', field: 'rating', order: 'asc' },
  { label: 'Most Popular', value: 'popular', field: 'saleItems', order: 'desc' },
];

// ============================================
// PRODUCT STATUS HELPERS
// ============================================

export const ProductStatusLabels: Record<ProductStatus, string> = {
  [ProductStatus.DRAFT]: 'Draft',
  [ProductStatus.ACTIVE]: 'Active',
  [ProductStatus.INACTIVE]: 'Inactive',
  [ProductStatus.DISCONTINUED]: 'Discontinued',
};

export const ProductStatusColors: Record<ProductStatus, string> = {
  [ProductStatus.DRAFT]: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  [ProductStatus.ACTIVE]: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  [ProductStatus.INACTIVE]: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  [ProductStatus.DISCONTINUED]: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

export const ProductTypeLabels: Record<ProductType, string> = {
  [ProductType.SIMPLE]: 'Simple',
  [ProductType.VARIABLE]: 'Variable',
  [ProductType.GROUPED]: 'Grouped',
  [ProductType.BUNDLE]: 'Bundle',
  [ProductType.DIGITAL]: 'Digital',
  [ProductType.SERVICE]: 'Service',
};

// ============================================
// INVENTORY HELPERS (internal)
// ============================================
//
// `Product.inventory` is a SINGULAR relation (`Inventory | null`).
// `ProductVariant.inventory` is a PLURAL relation (`Inventory[] | null`).
//
// The two helpers below normalise the two shapes so the rest of this
// file can sum quantities without branching on the shape every time.

/**
 * Summarise a product's single inventory row.
 * Returns zeros when the relation is not populated.
 */
function summariseProductInventory(inventory: Inventory | null | undefined): {
  quantity: number;
  reserved: number;
} {
  if (!inventory) return { quantity: 0, reserved: 0 };
  return {
    quantity: inventory.quantity ?? 0,
    reserved: inventory.reserved ?? 0,
  };
}

/**
 * Summarise a variant's inventory rows (one per business unit).
 * Returns zeros when the relation is not populated.
 */
function summariseVariantInventory(
  inventory: Inventory[] | null | undefined
): {
  quantity: number;
  reserved: number;
} {
  if (!inventory || !Array.isArray(inventory)) {
    return { quantity: 0, reserved: 0 };
  }
  return inventory.reduce(
    (acc, inv) => ({
      quantity: acc.quantity + (inv.quantity ?? 0),
      reserved: acc.reserved + (inv.reserved ?? 0),
    }),
    { quantity: 0, reserved: 0 }
  );
}

// ============================================
// STOCK HELPERS
// ============================================

export function isProductActive(product: Product): boolean {
  return product.isActive === true;
}

export function isProductInStock(product: Product): boolean {
  const { quantity, reserved } = summariseProductInventory(product.inventory);
  const productAvailable = quantity - reserved;

  let variantAvailable = 0;
  if (product.variants && product.variants.length > 0) {
    variantAvailable = product.variants.reduce((sum, variant) => {
      const variantInventory = summariseVariantInventory(variant.inventory);
      const variantStock = variantInventory.quantity || variant.stock || 0;
      const variantReserved = variantInventory.reserved;
      return sum + (variantStock - variantReserved);
    }, 0);
  }

  return productAvailable + variantAvailable > 0;
}

export function isProductLowStock(product: Product): boolean {
  const { quantity } = summariseProductInventory(product.inventory);
  const minStock = product.minStock || 5;
  return quantity > 0 && quantity <= minStock;
}

export function isProductOutOfStock(product: Product): boolean {
  const { quantity } = summariseProductInventory(product.inventory);
  return quantity === 0;
}

export function getProductStockStatus(product: Product): {
  label: string;
  color: string;
  isLow: boolean;
  isOut: boolean;
} {
  const { quantity } = summariseProductInventory(product.inventory);
  const minStock = product.minStock || 5;

  if (quantity === 0) {
    return {
      label: 'Out of Stock',
      color: 'text-red-600 dark:text-red-400',
      isLow: false,
      isOut: true,
    };
  }
  if (quantity <= minStock) {
    return {
      label: 'Low Stock',
      color: 'text-yellow-600 dark:text-yellow-400',
      isLow: true,
      isOut: false,
    };
  }
  return {
    label: 'In Stock',
    color: 'text-green-600 dark:text-green-400',
    isLow: false,
    isOut: false,
  };
}

// ============================================
// PRODUCT UTILITY FUNCTIONS
// ============================================

export function getProductDisplayName(product: Product): string {
  return product.name || product.sku || 'Unnamed Product';
}

export function getProductDisplayPrice(product: Product): string {
  return product.unitPrice !== undefined ? `${product.unitPrice.toFixed(2)}` : '0.00';
}

export function getProductMainImage(product: Product): string | undefined {
  if (product.images && product.images.length > 0) {
    return product.images[0];
  }
  return undefined;
}

export function getProductVariantCount(product: Product): number {
  return product.variants?.length || 0;
}

export function getProductTotalStock(product: Product): number {
  const { quantity } = summariseProductInventory(product.inventory);

  const variantStock =
    product.variants?.reduce((sum, variant) => {
      const variantInventory = summariseVariantInventory(variant.inventory);
      return sum + (variantInventory.quantity || variant.stock || 0);
    }, 0) || 0;

  return quantity + variantStock;
}

export function getProductAvailableStock(product: Product): number {
  const { quantity, reserved } = summariseProductInventory(product.inventory);
  const productAvailable = quantity - reserved;

  const variantAvailable =
    product.variants?.reduce((sum, variant) => {
      const v = summariseVariantInventory(variant.inventory);
      return sum + (v.quantity - v.reserved);
    }, 0) || 0;

  return productAvailable + variantAvailable;
}

// ============================================
// VARIANT UTILITY FUNCTIONS
// ============================================

export function getVariantDisplayName(variant: ProductVariant): string {
  return variant.name || variant.sku || 'Unnamed Variant';
}

export function getVariantDisplayPrice(variant: ProductVariant): string {
  return variant.price !== undefined ? `${variant.price.toFixed(2)}` : '0.00';
}

export function getVariantMainImage(variant: ProductVariant): string | undefined {
  if (variant.images && variant.images.length > 0) {
    return variant.images[0];
  }
  return undefined;
}

export function getVariantStockStatus(variant: ProductVariant): {
  label: string;
  color: string;
  isLow: boolean;
  isOut: boolean;
} {
  const stock = variant.stock || 0;
  if (stock === 0) {
    return {
      label: 'Out of Stock',
      color: 'text-red-600 dark:text-red-400',
      isLow: false,
      isOut: true,
    };
  }
  if (stock <= 5) {
    return {
      label: 'Low Stock',
      color: 'text-yellow-600 dark:text-yellow-400',
      isLow: true,
      isOut: false,
    };
  }
  return {
    label: 'In Stock',
    color: 'text-green-600 dark:text-green-400',
    isLow: false,
    isOut: false,
  };
}

export function getVariantAttributeValue(variant: ProductVariant, key: string): any {
  return variant.attributes?.[key] ?? null;
}

// ============================================
// BARCODE UTILITY FUNCTIONS
// ============================================

export function hasBarcode(product: Product): boolean {
  return !!product.barcode;
}

export function getBarcodeUrl(product: Product): string | undefined {
  if (!product.barcode) return undefined;
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
    product.barcode
  )}&code=EAN-13&dpi=96`;
}

export function getQRCodeUrl(product: Product): string | undefined {
  if (!product.barcode) return undefined;
  const data = {
    product: product.name,
    sku: product.sku,
    barcode: product.barcode,
  };
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
    JSON.stringify(data)
  )}&size=150x150`;
}

// ============================================
// PRODUCT SEARCH PARAMS HELPERS
// ============================================

export function buildProductSearchParams(
  params: Partial<ProductSearchParams>
): URLSearchParams {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'boolean') {
        searchParams.append(key, String(value));
      } else if (Array.isArray(value)) {
        value.forEach((item) => searchParams.append(key, String(item)));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });

  return searchParams;
}

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_PRODUCT: Partial<Product> = {
  isActive: true,
  isDigital: false,
  featured: false,
  minStock: 5,
  images: [],
  tags: [],
};

export const DEFAULT_PRODUCT_FORM_DATA: ProductFormData = {
  name: '',
  sku: '',
  description: null,
  unitPrice: 0,
  costPrice: null,
  barcode: null,
  categoryId: null,
  supplierId: null,
  isActive: true,
  featured: false,
  isDigital: false,
  taxRate: null,
  weight: null,
  minStock: 5,
  maxStock: null,
  tags: [],
  images: [],
  notes: null,
  seo: null,
  variants: [],
  attributes: {},
};

export const DEFAULT_PRODUCT_VARIANT_FORM_DATA: ProductVariantFormData = {
  name: '',
  sku: '',
  price: 0,
  costPrice: null,
  stock: 0,
  attributes: {},
  images: [],
  isActive: true,
};

export const DEFAULT_PRODUCT_FILTER_STATE: ProductFilterState = {
  search: '',
  categoryId: '',
  status: 'all',
  minPrice: '',
  maxPrice: '',
  inStock: false,
  featured: false,
  hasVariants: false,
  hasBarcode: false,
  minRating: 0,
  tags: [],
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

// ============================================
// PRODUCT REVIEW HELPERS
// ============================================

export function getAverageRating(reviews: ProductReview[]): number {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return sum / reviews.length;
}

export function getRatingDistribution(
  reviews: ProductReview[]
): Record<number, number> {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (!reviews || reviews.length === 0) return distribution;

  reviews.forEach((review) => {
    if (review.rating >= 1 && review.rating <= 5) {
      distribution[review.rating] = (distribution[review.rating] || 0) + 1;
    }
  });

  return distribution;
}

export function getReviewStatsFromReviews(reviews: ProductReview[]): ReviewStats {
  const distribution = getRatingDistribution(reviews);
  const total = reviews.length;
  const average = total > 0 ? getAverageRating(reviews) : 0;

  return {
    average,
    total,
    distribution: distribution as {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    },
  };
}

// ============================================
// PRODUCT TYPE GUARDS
// ============================================

export function isSimpleProduct(product: Product): boolean {
  return product.type === ProductType.SIMPLE || !product.type;
}

export function isVariableProduct(product: Product): boolean {
  return product.type === ProductType.VARIABLE;
}

export function isDigitalProduct(product: Product): boolean {
  return product.isDigital === true;
}

export function isPhysicalProduct(product: Product): boolean {
  return !product.isDigital;
}

export function hasVariants(product: Product): boolean {
  return !!(product.variants && product.variants.length > 0);
}

export function hasActiveVariants(product: Product): boolean {
  return !!(product.variants && product.variants.some((v) => v.isActive));
}

export function getActiveVariants(product: Product): ProductVariant[] {
  return product.variants?.filter((v) => v.isActive) || [];
}
