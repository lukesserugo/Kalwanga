// D:\Projects\Kalwanga\packages\web\services\productService.ts

import { api } from './api';

import type {
  Product,
  ProductVariant,
  ProductStatistics,
  ImportResult,
} from '../types/product';

// Re-export the models this service returns so callers that import
// them from `../services/productService` keep working. The canonical
// declarations remain in `../types/product`; this file only forwards
// them.
export type { Product, ProductVariant };

// ============================================
// CONSTANTS
// ============================================

const isClient = typeof window !== 'undefined';
const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * localStorage keys that may hold a business unit id, in priority order.
 */
const BU_STORAGE_KEYS = [
  'selectedBusinessUnitId',
  'businessUnitId',
] as const;

/**
 * Values that must never be treated as a real business unit id.
 */
const PLACEHOLDER_BU_VALUES = new Set([
  '',
  'default',
  'default-business-unit',
  'undefined',
  'null',
]);

// ============================================
// RESPONSE NORMALIZATION
// ============================================
//
// The `api` client may hand back any of these shapes depending on
// which middleware wrapped the response:
//
//   1. Raw payload          → Product[]                    (already unwrapped)
//   2. Wrapped              → { data: Product[], pagination }
//   3. Double-wrapped       → { data: { data: Product[], total, ... } }
//   4. Legacy               → { products: Product[], total, page, ... }
//
// Every read method funnels through these helpers so the shape is
// consistent no matter what `api` does today.

interface NormalizedPagination<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

function normalizeList<T>(
  response: any,
  fallbackLimit = 12,
): NormalizedPagination<T> {
  // 1 — Raw array
  if (Array.isArray(response)) {
    return {
      data: response,
      total: response.length,
      page: 1,
      totalPages: 1,
      limit: fallbackLimit,
    };
  }

  // 2 — `{ data: T[], pagination }`
  if (response && Array.isArray(response.data)) {
    return {
      data: response.data,
      total: Number(response.pagination?.total ?? response.data.length),
      page: Number(response.pagination?.page ?? 1),
      totalPages: Number(response.pagination?.totalPages ?? 1),
      limit: Number(response.pagination?.limit ?? fallbackLimit),
    };
  }

  // 3 — `{ data: { data: T[], total, page, ... } }`
  if (
    response &&
    response.data &&
    Array.isArray(response.data.data)
  ) {
    return {
      data: response.data.data,
      total: Number(response.data.total ?? response.data.data.length),
      page: Number(response.data.page ?? 1),
      totalPages: Number(response.data.totalPages ?? 1),
      limit: Number(response.data.limit ?? fallbackLimit),
    };
  }

  // 4 — `{ products: T[], total, page, ... }`
  if (response && Array.isArray(response.products)) {
    return {
      data: response.products,
      total: Number(response.total ?? response.products.length),
      page: Number(response.page ?? 1),
      totalPages: Number(response.totalPages ?? 1),
      limit: Number(response.limit ?? fallbackLimit),
    };
  }

  // 5 — `{ data: { items: T[], ... } }`
  if (
    response &&
    response.data &&
    Array.isArray(response.data.items)
  ) {
    return {
      data: response.data.items,
      total: Number(response.data.total ?? response.data.items.length),
      page: Number(response.data.page ?? 1),
      totalPages: Number(response.data.totalPages ?? 1),
      limit: Number(response.data.limit ?? fallbackLimit),
    };
  }

  return {
    data: [],
    total: 0,
    page: 1,
    totalPages: 1,
    limit: fallbackLimit,
  };
}

/**
 * Extract a single object from any wrapper shape.
 */
function normalizeItem<T>(response: any): T | null {
  if (!response) return null;

  // `{ data: T }` where T is an object with `id`
  if (
    response.data &&
    typeof response.data === 'object' &&
    !Array.isArray(response.data)
  ) {
    if ('id' in response.data) return response.data as T;
  }

  // `{ data: { data: T } }`
  if (
    response.data?.data &&
    typeof response.data.data === 'object' &&
    !Array.isArray(response.data.data) &&
    'id' in response.data.data
  ) {
    return response.data.data as T;
  }

  // `{ product: T }`
  if (response.product && typeof response.product === 'object') {
    return response.product as T;
  }

  // Bare object with id
  if (typeof response === 'object' && 'id' in response) {
    return response as T;
  }

  return null;
}

/**
 * Extract an array of items from any wrapper shape — same rules as
 * normalizeList but without the pagination metadata.
 */
function normalizeArray<T>(response: any): T[] {
  return normalizeList<T>(response).data;
}

// ============================================
// HELPERS
// ============================================

function isRealBusinessUnitId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return !PLACEHOLDER_BU_VALUES.has(trimmed.toLowerCase());
}

function getBusinessUnitId(): string {
  if (!isClient) return 'default';

  for (const key of BU_STORAGE_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (isRealBusinessUnitId(value)) return value;
    } catch {
      /* ignore */
    }
  }

  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const fromUser =
        user?.businessUnitId ||
        user?.businessUnits?.[0]?.businessUnitId ||
        user?.businessUnits?.[0]?.id;
      if (isRealBusinessUnitId(fromUser)) return fromUser;
    }
  } catch {
    /* ignore */
  }

  return 'default';
}

function extractErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    String(error)
  );
}

function cleanProductData(data: Partial<Product>): any {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function cleanProductDataForUpdate(data: Partial<Product>): any {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function generateUniqueSKU(productName?: string, variantName?: string): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();

  if (variantName) {
    const basePrefix =
      (productName || 'PRD')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'PRD';
    const variantPrefix =
      variantName
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'VAR';
    return `${basePrefix}-${variantPrefix}-${timestamp}-${random}`;
  }

  const prefix =
    (productName || 'PRD')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'PRD';
  return `${prefix}-${timestamp}-${random}`;
}

async function checkSKUExists(
  sku: string,
  businessUnitId?: string,
  excludeProductId?: string,
): Promise<boolean> {
  if (!isClient) return false;
  try {
    const bid = businessUnitId || getBusinessUnitId();
    const response = await api.get<any>(
      `/products/check-sku/${encodeURIComponent(sku)}`,
      { params: { businessUnitId: bid, excludeProductId } },
    );

    if (response?.data && typeof response.data === 'object') {
      if ('exists' in response.data) return Boolean(response.data.exists);
    }

    return Boolean(response?.exists);
  } catch (error: any) {
    if (error?.response?.status === 404) return false;
    console.error('Error checking SKU:', extractErrorMessage(error));
    return false;
  }
}

async function ensureUniqueSKU(
  baseSKU: string,
  businessUnitId?: string,
  excludeProductId?: string,
): Promise<string> {
  if (!isClient) return baseSKU;

  let sku = baseSKU;
  let attempts = 0;
  const maxAttempts = 10;

  while (
    (await checkSKUExists(sku, businessUnitId, excludeProductId)) &&
    attempts < maxAttempts
  ) {
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    sku = `${baseSKU}-${suffix}`;
    attempts++;
  }

  return sku;
}

function buHeader(businessUnitId: string): Record<string, string> {
  return { 'x-business-unit-id': businessUnitId };
}

// ============================================
// CART INTEGRATION HELPERS
// ============================================

export function isValidProductId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length === 0) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

function summariseInventory(
  inventory: Product['inventory'],
): { quantity: number; reserved: number } {
  if (!inventory) return { quantity: 0, reserved: 0 };

  if (Array.isArray(inventory)) {
    return inventory.reduce(
      (acc, inv) => ({
        quantity: acc.quantity + (inv.quantity || 0),
        reserved: acc.reserved + (inv.reserved || 0),
      }),
      { quantity: 0, reserved: 0 },
    );
  }

  const single = inventory as { quantity?: number; reserved?: number };
  return {
    quantity: single.quantity || 0,
    reserved: single.reserved || 0,
  };
}

export function getProductStock(product: Product): {
  available: number;
  total: number;
  isInStock: boolean;
  isLowStock: boolean;
  variantStock: number;
} {
  const { quantity, reserved } = summariseInventory(product.inventory);
  const mainStock = quantity - reserved;

  const variantStock = (product.variants || []).reduce((sum, v) => {
    if (v.inventory) {
      const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
      return sum + ((inv?.quantity ?? 0) - (inv?.reserved ?? 0));
    }
    return sum + (v.stock || 0);
  }, 0);

  const totalStock = mainStock + variantStock;

  return {
    available: Math.max(0, totalStock),
    total: totalStock,
    isInStock: totalStock > 0,
    isLowStock: totalStock > 0 && totalStock <= (product.minStock || 5),
    variantStock,
  };
}

async function getProductForCart(productId: string): Promise<Product> {
  if (!isClient) throw new Error('Cannot fetch product on server');
  try {
    const product = await productService.getProductById(productId);
    if (!product || !product.id) throw new Error('Product not found');

    return {
      ...product,
      id: String(product.id).trim(),
      unitPrice: product.unitPrice || 0,
      isActive: product.isActive !== undefined ? product.isActive : true,
    };
  } catch (error) {
    console.error(`Error fetching product for cart ${productId}:`, error);
    throw error;
  }
}

// ============================================
// PRODUCT SERVICE
// ============================================

export const productService = {
  // ============================================
  // SKU UTILITIES
  // ============================================

  generateSKU(productName?: string): string {
    return generateUniqueSKU(productName);
  },

  generateVariantSKU(productName?: string, variantName?: string): string {
    return generateUniqueSKU(productName, variantName);
  },

  async checkSKUExists(
    sku: string,
    businessUnitId?: string,
    excludeProductId?: string,
  ): Promise<boolean> {
    return checkSKUExists(sku, businessUnitId, excludeProductId);
  },

  async ensureUniqueSKU(
    sku: string,
    businessUnitId?: string,
    excludeProductId?: string,
  ): Promise<string> {
    return ensureUniqueSKU(sku, businessUnitId, excludeProductId);
  },

  // ============================================
  // STOCK UTILITIES
  // ============================================
  //
  // ✅ Exposed as a method so callers that only import `productService`
  //    (without destructuring `getProductStock`) can still reach it.
  //    The standalone export above remains available for callers that
  //    prefer `import { getProductStock } from ...`.

  getProductStock,

  // ============================================
  // PRODUCT METHODS
  // ============================================

  async getAllProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    businessUnitId?: string;
    isActive?: boolean;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    inStock?: boolean;
    minRating?: number;
    featured?: boolean;
    hasVariants?: boolean;
    hasBarcode?: boolean;
  }): Promise<{
    data: Product[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    if (!isClient) {
      return {
        data: [],
        total: 0,
        page: 1,
        totalPages: 1,
        limit: params?.limit || 12,
      };
    }

    try {
      const businessUnitId = params?.businessUnitId || getBusinessUnitId();
      const queryParams: any = { ...params, businessUnitId };

      const response = await api.get<any>('/products', {
        params: queryParams,
      });

      return normalizeList<Product>(response, params?.limit || 12);
    } catch (error: any) {
      console.error('❌ Error fetching products:', extractErrorMessage(error));
      throw error;
    }
  },

  async getProductById(id: string): Promise<Product> {
    if (!isClient) return {} as Product;
    try {
      const response = await api.get<any>(`/products/${id}`);
      return normalizeItem<Product>(response) ?? ({} as Product);
    } catch (error) {
      console.error(`Error fetching product ${id}:`, error);
      throw error;
    }
  },

  // ============================================
  // PUBLIC PRODUCTS — storefront, no auth
  // ============================================

  async getPublicProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    featured?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    businessUnitId?: string;
  }): Promise<{
    data: Product[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    if (!isClient) {
      return {
        data: [],
        total: 0,
        page: 1,
        totalPages: 1,
        limit: params?.limit || 12,
      };
    }

    try {
      const businessUnitId = params?.businessUnitId || getBusinessUnitId();
      const queryParams: any = { ...params, businessUnitId };

      const response = await api.get<any>('/products/public', {
        params: queryParams,
      });

      return normalizeList<Product>(response, params?.limit || 12);
    } catch (error: any) {
      console.error(
        '❌ Error fetching public products:',
        extractErrorMessage(error),
      );
      throw error;
    }
  },

  async getPublicProductById(id: string): Promise<Product> {
    if (!isClient) return {} as Product;
    try {
      const response = await api.get<any>(`/products/public/${id}`);
      return normalizeItem<Product>(response) ?? ({} as Product);
    } catch (error) {
      console.error(`Error fetching public product ${id}:`, error);
      throw error;
    }
  },

  async getPublicCategories(businessUnitId?: string): Promise<any[]> {
    if (!isClient) return [];
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/public/categories', {
        params: { businessUnitId: bid },
      });

      return normalizeArray<any>(response);
    } catch (error) {
      console.error('Error fetching public categories:', error);
      return [];
    }
  },

  async getPublicCategoryProducts(
    categoryId: string,
    params?: { page?: number; limit?: number },
  ): Promise<{
    data: Product[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    if (!isClient) {
      return { data: [], total: 0, page: 1, totalPages: 1, limit: 10 };
    }
    try {
      const response = await api.get<any>(
        `/products/public/categories/${categoryId}/products`,
        { params },
      );

      return normalizeList<Product>(response, params?.limit ?? 10);
    } catch (error) {
      console.error(
        `Error fetching public category products ${categoryId}:`,
        error,
      );
      return { data: [], total: 0, page: 1, totalPages: 1, limit: 10 };
    }
  },

  async getPublicFeatured(
    limit = 10,
    businessUnitId?: string,
  ): Promise<Product[]> {
    if (!isClient) return [];
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/public/featured', {
        params: { limit, businessUnitId: bid },
      });
      return normalizeArray<Product>(response);
    } catch (error) {
      console.error('Error fetching public featured:', error);
      return [];
    }
  },

  async getPublicNewArrivals(
    limit = 10,
    businessUnitId?: string,
  ): Promise<Product[]> {
    if (!isClient) return [];
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/public/new-arrivals', {
        params: { limit, businessUnitId: bid },
      });
      return normalizeArray<Product>(response);
    } catch (error) {
      console.error('Error fetching public new arrivals:', error);
      return [];
    }
  },

  async getPublicSearch(
    query: string,
    businessUnitId?: string,
  ): Promise<Product[]> {
    if (!isClient) return [];
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/public/search', {
        params: { query, businessUnitId: bid },
      });
      return normalizeArray<Product>(response);
    } catch (error) {
      console.error('Error searching public products:', error);
      return [];
    }
  },

  async getProductWithStock(
    id: string,
    _businessUnitId?: string,
  ): Promise<
    Product & {
      stock: {
        available: number;
        total: number;
        isInStock: boolean;
        isLowStock: boolean;
      };
    }
  > {
    if (!isClient) throw new Error('Cannot fetch product on server');
    try {
      const product = await this.getProductById(id);
      const stock = getProductStock(product);
      return { ...product, stock };
    } catch (error) {
      console.error(`Error fetching product with stock ${id}:`, error);
      throw error;
    }
  },

  async validateProductForCart(
    productId: string,
    variantId?: string,
  ): Promise<{
    valid: boolean;
    product?: Product;
    error?: string;
    variant?: ProductVariant;
  }> {
    if (!isClient) return { valid: false, error: 'Not on client' };

    try {
      const cleanId = String(productId).trim();
      if (!isValidProductId(cleanId)) {
        return { valid: false, error: 'Invalid product ID format' };
      }

      const product = await this.getProductById(cleanId);
      if (!product || !product.id) {
        return { valid: false, error: 'Product not found' };
      }

      if (!product.isActive) {
        return { valid: false, error: 'Product is not active' };
      }

      if (variantId) {
        const cleanVariantId = String(variantId).trim();
        const variant = (product.variants || []).find(
          (v) => v.id === cleanVariantId,
        );
        if (!variant) {
          return { valid: false, error: 'Variant not found' };
        }
        if (variant.isActive === false) {
          return { valid: false, error: 'Variant is not active' };
        }

        const variantInvRaw = variant.inventory as
          | { quantity?: number; reserved?: number }
          | { quantity?: number; reserved?: number }[]
          | null
          | undefined;

        const variantInv = Array.isArray(variantInvRaw)
          ? variantInvRaw[0] ?? null
          : variantInvRaw ?? null;

        const variantAvailable = variantInv
          ? (variantInv.quantity ?? 0) - (variantInv.reserved ?? 0)
          : variant.stock || 0;

        if (variantAvailable <= 0) {
          return { valid: false, error: 'Variant is out of stock' };
        }
        return { valid: true, product, variant };
      }

      const stock = getProductStock(product);
      if (!stock.isInStock) {
        return { valid: false, error: 'Product is out of stock' };
      }

      return { valid: true, product };
    } catch (error: any) {
      console.error('Error validating product for cart:', error);
      return {
        valid: false,
        error: error?.message || 'Failed to validate product',
      };
    }
  },

  async getProductBySku(sku: string, businessUnitId?: string): Promise<Product> {
    if (!isClient) return {} as Product;
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>(`/products/sku/${sku}`, {
        params: { businessUnitId: bid },
      });
      return normalizeItem<Product>(response) ?? ({} as Product);
    } catch (error) {
      console.error(`Error fetching product by SKU ${sku}:`, error);
      throw error;
    }
  },

  async getProductByBarcode(
    barcode: string,
    businessUnitId?: string,
  ): Promise<Product> {
    if (!isClient) return {} as Product;
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>(`/products/barcode/${barcode}`, {
        params: { businessUnitId: bid },
      });
      return normalizeItem<Product>(response) ?? ({} as Product);
    } catch (error) {
      console.error(`Error fetching product by barcode ${barcode}:`, error);
      throw error;
    }
  },

  // ─────────────────────────────────────────────
  // createProduct
  // ─────────────────────────────────────────────

  async createProduct(
    data: Partial<Product> & {
      inventoryId?: string;
      autoGenerateSKU?: boolean;
    },
  ): Promise<Product> {
    if (!isClient) throw new Error('Cannot create product on server');
    try {
      const resolvedBusinessUnitId =
        data.businessUnitId || getBusinessUnitId();

      if (!isRealBusinessUnitId(resolvedBusinessUnitId)) {
        throw new Error(
          'No valid business unit is selected. Please refresh the page and try again.',
        );
      }
      data.businessUnitId = resolvedBusinessUnitId;

      if (!data.sku || data.sku === 'SKU' || data.sku.trim() === '') {
        data.sku = generateUniqueSKU(data.name);
      } else if (data.autoGenerateSKU) {
        data.sku = generateUniqueSKU(data.name);
      }

      data.sku = data.sku.toUpperCase();

      if (data.images && Array.isArray(data.images)) {
        data.images = data.images
          .map((img) => {
            if (typeof img !== 'string') return PLACEHOLDER_IMAGE;
            if (img === PLACEHOLDER_IMAGE || img.length < 100) return img;
            if (img.startsWith('http://') || img.startsWith('https://')) {
              return img;
            }
            if (img.startsWith('data:image/')) {
              if (img.length > MAX_IMAGE_SIZE_BYTES) {
                console.warn(
                  `⚠️ Image size ${Math.round(
                    img.length / 1024,
                  )}KB, using placeholder`,
                );
                return PLACEHOLDER_IMAGE;
              }
              return img;
            }
            return PLACEHOLDER_IMAGE;
          })
          .filter(Boolean);
      }

      if (data.variants && Array.isArray(data.variants)) {
        data.variants = data.variants.map((variant, index) => {
          let variantImages = variant.images || [];
          if (Array.isArray(variantImages)) {
            variantImages = variantImages
              .map((img) => {
                if (typeof img !== 'string') return PLACEHOLDER_IMAGE;
                if (img === PLACEHOLDER_IMAGE || img.length < 100) return img;
                if (img.startsWith('http://') || img.startsWith('https://')) {
                  return img;
                }
                if (img.startsWith('data:image/')) {
                  if (img.length > MAX_IMAGE_SIZE_BYTES) {
                    console.warn(
                      `⚠️ Variant image size ${Math.round(
                        img.length / 1024,
                      )}KB, using placeholder`,
                    );
                    return PLACEHOLDER_IMAGE;
                  }
                  return img;
                }
                return PLACEHOLDER_IMAGE;
              })
              .filter(Boolean);
          }

          return {
            ...variant,
            sku:
              variant.sku && variant.sku !== 'SKU'
                ? variant.sku.toUpperCase()
                : generateUniqueSKU(
                    data.name,
                    variant.name || `VAR${index + 1}`,
                  ),
            images: variantImages,
          };
        });
      }

      const cleanedData = cleanProductData(data);
      delete cleanedData.autoGenerateSKU;
      cleanedData.businessUnitId = resolvedBusinessUnitId;

      const response = await api.post<any>('/products', cleanedData, {
        headers: buHeader(resolvedBusinessUnitId),
      });

      const product = normalizeItem<Product>(response);
      if (!product || !product.id) {
        console.error('Product creation response missing id:', response);
        throw new Error('Product created but ID not returned');
      }
      return product;
    } catch (error: any) {
      console.error('Error creating product:', extractErrorMessage(error));
      throw error;
    }
  },

  // ─────────────────────────────────────────────
  // createProductFromInventory
  // ─────────────────────────────────────────────

  async createProductFromInventory(
    inventoryId: string,
    data: Partial<Product>,
  ): Promise<Product> {
    if (!isClient) {
      throw new Error('Cannot create product from inventory on server');
    }
    try {
      const resolvedBusinessUnitId =
        data.businessUnitId || getBusinessUnitId();

      if (!isRealBusinessUnitId(resolvedBusinessUnitId)) {
        throw new Error(
          'No valid business unit is selected. Please refresh the page and try again.',
        );
      }

      if (!data.sku || data.sku === 'SKU' || data.sku.trim() === '') {
        data.sku = generateUniqueSKU(data.name);
      }
      data.sku = data.sku.toUpperCase();

      const cleanedData = cleanProductData({
        ...data,
        inventoryId,
        businessUnitId: resolvedBusinessUnitId,
      });

      const response = await api.post<any>('/products', cleanedData, {
        headers: buHeader(resolvedBusinessUnitId),
      });

      const product = normalizeItem<Product>(response);
      if (!product || !product.id) {
        console.error(
          'Product creation from inventory response missing id:',
          response,
        );
        throw new Error('Product created but ID not returned');
      }
      return product;
    } catch (error: any) {
      console.error(
        `❌ [productService] Error creating product from inventory ${inventoryId}:`,
        extractErrorMessage(error),
      );
      throw error;
    }
  },

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    if (!isClient) throw new Error('Cannot update product on server');
    try {
      if (data.variants && Array.isArray(data.variants)) {
        data.variants = data.variants.map((variant) => ({
          ...variant,
          sku: variant.sku ? variant.sku.toUpperCase() : variant.sku,
          images: variant.images || [],
        }));
      }

      const cleanedData = cleanProductDataForUpdate(data);

      const headerBU = isRealBusinessUnitId(data.businessUnitId)
        ? data.businessUnitId
        : undefined;

      const response = await api.put<any>(
        `/products/${id}`,
        cleanedData,
        headerBU ? { headers: buHeader(headerBU) } : undefined,
      );

      return normalizeItem<Product>(response) ?? ({} as Product);
    } catch (error) {
      console.error(`Error updating product ${id}:`, error);
      throw error;
    }
  },

  async deleteProduct(
    id: string,
    force: boolean = false,
  ): Promise<{ message: string; softDeleted?: boolean }> {
    if (!isClient) throw new Error('Cannot delete product on server');
    try {
      const response = await api.delete<any>(`/products/${id}`, {
        params: { force: force ? 'true' : 'false' },
      });
      return (
        response?.data ||
        response || { message: 'Product deleted successfully' }
      );
    } catch (error) {
      console.error(`Error deleting product ${id}:`, error);
      throw error;
    }
  },

  async unlinkProductFromInventory(
    id: string,
    keepInventory: boolean = true,
  ): Promise<{ message: string; softDeleted: boolean }> {
    if (!isClient) throw new Error('Cannot unlink product on server');
    try {
      const response = await api.post<any>(`/products/${id}/unlink-inventory`, {
        keepInventory,
      });
      return (
        response?.data ||
        response || {
          message: 'Product unlinked from inventory',
          softDeleted: true,
        }
      );
    } catch (error) {
      console.error(`Error unlinking product ${id} from inventory:`, error);
      throw error;
    }
  },

  async searchProducts(params: {
    query: string;
    category?: string;
    businessUnitId?: string;
  }): Promise<Product[]> {
    if (!isClient) return [];
    try {
      const bid = params.businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/search', {
        params: { ...params, businessUnitId: bid },
      });
      return normalizeArray<Product>(response);
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  },

  async getProductTags(
    businessUnitId?: string,
  ): Promise<Array<{ name: string; count: number }>> {
    if (!isClient) return [];
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/tags', {
        params: { businessUnitId: bid },
      });
      return normalizeArray<{ name: string; count: number }>(response);
    } catch (error) {
      console.error('Error fetching tags:', error);
      return [];
    }
  },

  // ============================================
  // BARCODE METHODS
  // ============================================

  async generateBarcode(
    productId: string,
    options?: {
      prefix?: string;
      length?: number;
      format?: string;
      includeQR?: boolean;
    },
  ): Promise<any> {
    if (!isClient) throw new Error('Cannot generate barcode on server');
    try {
      const response = await api.post<any>(
        `/products/${productId}/barcode`,
        options || {},
      );
      return response?.data || response;
    } catch (error) {
      console.error(`Error generating barcode for product ${productId}:`, error);
      throw error;
    }
  },

  async generateUniqueBarcode(options?: {
    prefix?: string;
    length?: number;
    format?: string;
    includeQR?: boolean;
  }): Promise<{ barcode: string }> {
    if (!isClient) throw new Error('Cannot generate barcode on server');
    try {
      const response = await api.post<any>(
        '/products/barcode/generate',
        options || {},
      );
      return response?.data || response;
    } catch (error) {
      console.error('Error generating unique barcode:', error);
      throw error;
    }
  },

  async getProductBarcode(productId: string): Promise<any> {
    if (!isClient) return {} as any;
    try {
      const response = await api.get<any>(`/products/${productId}/barcode`);
      return response?.data || response || {};
    } catch (error) {
      console.error(`Error fetching barcode for product ${productId}:`, error);
      throw error;
    }
  },

  async getBarcodeImage(productId: string): Promise<{ barcodeUrl: string }> {
    if (!isClient) return { barcodeUrl: '' };
    try {
      const response = await api.get<any>(
        `/products/${productId}/barcode/image`,
      );
      return response?.data || response || { barcodeUrl: '' };
    } catch (error) {
      console.error(
        `Error fetching barcode image for product ${productId}:`,
        error,
      );
      throw error;
    }
  },

  async getProductQRCode(productId: string): Promise<{ qrCodeUrl: string }> {
    if (!isClient) return { qrCodeUrl: '' };
    try {
      const response = await api.get<any>(`/products/${productId}/qrcode`);
      return response?.data || response || { qrCodeUrl: '' };
    } catch (error) {
      console.error(
        `Error fetching QR code for product ${productId}:`,
        error,
      );
      throw error;
    }
  },

  async generateBarcodeImage(
    barcode: string,
    format?: string,
  ): Promise<{ barcodeUrl: string }> {
    if (!isClient) return { barcodeUrl: '' };
    try {
      const response = await api.post<any>('/products/barcode/image', {
        barcode,
        format,
      });
      return response?.data || response || { barcodeUrl: '' };
    } catch (error) {
      console.error('Error generating barcode image:', error);
      throw error;
    }
  },

  async generateQRCode(data: any): Promise<{ qrCodeUrl: string }> {
    if (!isClient) return { qrCodeUrl: '' };
    try {
      const response = await api.post<any>('/products/qrcode', { data });
      return response?.data || response || { qrCodeUrl: '' };
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  },

  async associateBarcode(
    productId: string,
    barcode: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!isClient) throw new Error('Cannot associate barcode on server');
    try {
      const response = await api.post<any>(
        `/products/${productId}/barcode/associate`,
        { barcode },
      );
      return (
        response?.data ||
        response || {
          success: true,
          message: 'Barcode associated successfully',
        }
      );
    } catch (error) {
      console.error(
        `Error associating barcode with product ${productId}:`,
        error,
      );
      throw error;
    }
  },

  async validateBarcode(
    barcode: string,
    excludeProductId?: string,
  ): Promise<{ valid: boolean; message?: string }> {
    if (!isClient) return { valid: true };
    try {
      const response = await api.post<any>('/products/barcode/validate', {
        barcode,
        excludeProductId,
      });
      return response?.data || response || { valid: true };
    } catch (error: any) {
      if (error?.response?.status === 409) {
        return { valid: false, message: 'Barcode already in use' };
      }
      console.error('Error validating barcode:', error);
      return { valid: true };
    }
  },

  async getProductsWithoutBarcode(params?: any): Promise<{
    data: Product[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    if (!isClient) {
      return { data: [], total: 0, page: 1, totalPages: 1, limit: 10 };
    }
    try {
      const bid = params?.businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/no-barcode', {
        params: { ...params, businessUnitId: bid },
      });
      return normalizeList<Product>(response, params?.limit || 10);
    } catch (error) {
      console.error('Error fetching products without barcode:', error);
      return { data: [], total: 0, page: 1, totalPages: 1, limit: 10 };
    }
  },

  async bulkGenerateBarcodes(
    productIds: string[],
    options?: any,
  ): Promise<{ results: any[]; errors: any[] }> {
    if (!isClient) throw new Error('Cannot bulk generate barcodes on server');
    try {
      const response = await api.post<any>('/products/barcode/bulk-generate', {
        productIds,
        options,
      });
      return response?.data || response || { results: [], errors: [] };
    } catch (error) {
      console.error('Error bulk generating barcodes:', error);
      throw error;
    }
  },

  async scanBarcode(barcode: string, businessUnitId?: string): Promise<any> {
    if (!isClient) throw new Error('Cannot scan barcode on server');
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.post<any>('/products/barcode/scan', {
        barcode,
        businessUnitId: bid,
      });
      return response?.data || response;
    } catch (error) {
      console.error('Error scanning barcode:', error);
      throw error;
    }
  },

  // ============================================
  // FEATURED & RELATED PRODUCTS
  // ============================================

  async getFeaturedProducts(
    limit: number = 10,
    businessUnitId?: string,
  ): Promise<Product[]> {
    if (!isClient) return [];
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/featured', {
        params: { limit, businessUnitId: bid },
      });
      return normalizeArray<Product>(response);
    } catch (error) {
      console.error('Error fetching featured products:', error);
      return [];
    }
  },

  async getRelatedProducts(
    productId: string,
    limit: number = 4,
  ): Promise<Product[]> {
    if (!isClient) return [];
    try {
      const response = await api.get<any>(`/products/${productId}/related`, {
        params: { limit },
      });
      return normalizeArray<Product>(response);
    } catch (error) {
      console.error(
        `Error fetching related products for ${productId}:`,
        error,
      );
      return [];
    }
  },

  async getPopularProducts(
    limit: number = 10,
    businessUnitId?: string,
  ): Promise<Product[]> {
    if (!isClient) return [];
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/popular', {
        params: { limit, businessUnitId: bid },
      });
      return normalizeArray<Product>(response);
    } catch (error) {
      console.error('Error fetching popular products:', error);
      return [];
    }
  },

  async getNewArrivals(
    limit: number = 10,
    businessUnitId?: string,
  ): Promise<Product[]> {
    if (!isClient) return [];
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/new-arrivals', {
        params: { limit, businessUnitId: bid },
      });
      return normalizeArray<Product>(response);
    } catch (error) {
      console.error('Error fetching new arrivals:', error);
      return [];
    }
  },

  async getSalesByProduct(
    productId: string,
    params?: { page?: number; limit?: number },
  ): Promise<any> {
    if (!isClient) {
      return { totalRevenue: 0, totalQuantity: 0, averagePrice: 0, items: [] };
    }
    try {
      const response = await api.get<any>(`/products/${productId}/sales`, {
        params,
      });
      return (
        response?.data ||
        response || {
          totalRevenue: 0,
          totalQuantity: 0,
          averagePrice: 0,
          items: [],
        }
      );
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return {
          totalRevenue: 0,
          totalQuantity: 0,
          averagePrice: 0,
          items: [],
        };
      }
      console.error(`Error fetching sales for product ${productId}:`, error);
      return { totalRevenue: 0, totalQuantity: 0, averagePrice: 0, items: [] };
    }
  },

  // ============================================
  // PRODUCT STATISTICS
  // ============================================

  async getProductStatistics(
    businessUnitId?: string,
  ): Promise<ProductStatistics> {
    const empty: ProductStatistics = {
      total: 0,
      active: 0,
      inactive: 0,
      featured: 0,
      withVariants: 0,
      lowStock: 0,
      outOfStock: 0,
      totalRevenue: 0,
      averagePrice: 0,
      totalCategories: 0,
      totalSuppliers: 0,
      withBarcode: 0,
      withoutBarcode: 0,
    };

    if (!isClient) return empty;
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/statistics', {
        params: { businessUnitId: bid },
      });
      return response?.data || response || empty;
    } catch (error) {
      console.error('Error fetching product statistics:', error);
      return empty;
    }
  },

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async bulkCreateProducts(
    products: Partial<Product>[],
    businessUnitId: string,
  ): Promise<{ results: any[]; errors: any[] }> {
    if (!isClient) throw new Error('Cannot bulk create on server');
    try {
      const bid = businessUnitId || getBusinessUnitId();
      if (!isRealBusinessUnitId(bid)) {
        throw new Error(
          'No valid business unit is selected. Please refresh the page and try again.',
        );
      }

      const processedProducts = products.map((p) => {
        let sku = p.sku;
        if (!sku || sku === 'SKU' || sku.trim() === '') {
          sku = generateUniqueSKU(p.name);
        }
        return cleanProductData({
          ...p,
          sku: sku.toUpperCase(),
          businessUnitId: bid,
        });
      });

      const response = await api.post<any>(
        '/products/bulk',
        {
          products: processedProducts,
          businessUnitId: bid,
        },
        { headers: buHeader(bid) },
      );
      return response?.data || response || { results: [], errors: [] };
    } catch (error) {
      console.error('Error bulk creating products:', error);
      throw error;
    }
  },

  async bulkDeleteProducts(
    productIds: string[],
    businessUnitId: string,
  ): Promise<{ results: any[]; errors: any[] }> {
    if (!isClient) throw new Error('Cannot bulk delete on server');
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.post<any>('/products/bulk/delete', {
        productIds,
        businessUnitId: bid,
      });
      return response?.data || response || { results: [], errors: [] };
    } catch (error) {
      console.error('Error bulk deleting products:', error);
      throw error;
    }
  },

  async bulkActivateProducts(
    productIds: string[],
  ): Promise<{ results: any[]; errors: any[] }> {
    if (!isClient) throw new Error('Cannot bulk activate on server');
    try {
      const response = await api.post<any>('/products/bulk/activate', {
        productIds,
      });
      return response?.data || response || { results: [], errors: [] };
    } catch (error) {
      console.error('Error bulk activating products:', error);
      throw error;
    }
  },

  async bulkDeactivateProducts(
    productIds: string[],
  ): Promise<{ results: any[]; errors: any[] }> {
    if (!isClient) throw new Error('Cannot bulk deactivate on server');
    try {
      const response = await api.post<any>('/products/bulk/deactivate', {
        productIds,
      });
      return response?.data || response || { results: [], errors: [] };
    } catch (error) {
      console.error('Error bulk deactivating products:', error);
      throw error;
    }
  },

  async bulkUpdatePrices(
    updates: Array<{ id: string; price: number }>,
  ): Promise<{ results: any[]; errors: any[] }> {
    if (!isClient) throw new Error('Cannot bulk update prices on server');
    try {
      const response = await api.post<any>('/products/bulk/update-prices', {
        updates,
      });
      return response?.data || response || { results: [], errors: [] };
    } catch (error) {
      console.error('Error bulk updating prices:', error);
      throw error;
    }
  },

  async bulkUpdateStock(
    updates: Array<{ id: string; stock: number }>,
  ): Promise<{ results: any[]; errors: any[] }> {
    if (!isClient) throw new Error('Cannot bulk update stock on server');
    try {
      const response = await api.post<any>('/products/bulk/update-stock', {
        updates,
      });
      return response?.data || response || { results: [], errors: [] };
    } catch (error) {
      console.error('Error bulk updating stock:', error);
      throw error;
    }
  },

  // ============================================
  // VARIANT METHODS
  // ============================================

  async addVariant(
    productId: string,
    data: Partial<ProductVariant>,
  ): Promise<ProductVariant> {
    if (!isClient) throw new Error('Cannot add variant on server');
    try {
      if (!data.sku || data.sku === 'SKU') {
        data.sku = generateUniqueSKU(data.name || 'PRD', 'VAR');
      }
      data.images = data.images || [];

      const response = await api.post<any>(
        `/products/${productId}/variants`,
        data,
      );
      return normalizeItem<ProductVariant>(response) ?? ({} as ProductVariant);
    } catch (error) {
      console.error(`Error adding variant to product ${productId}:`, error);
      throw error;
    }
  },

  async updateVariant(
    variantId: string,
    data: Partial<ProductVariant>,
  ): Promise<ProductVariant> {
    if (!isClient) throw new Error('Cannot update variant on server');
    try {
      if (data.images !== undefined) {
        data.images = data.images || [];
      }

      const response = await api.put<any>(
        `/products/variants/${variantId}`,
        data,
      );
      return normalizeItem<ProductVariant>(response) ?? ({} as ProductVariant);
    } catch (error) {
      console.error(`Error updating variant ${variantId}:`, error);
      throw error;
    }
  },

  async updateVariantStock(
    variantId: string,
    quantity: number,
    note?: string,
  ): Promise<ProductVariant> {
    if (!isClient) throw new Error('Cannot update variant stock on server');
    try {
      const response = await api.patch<any>(
        `/products/variants/${variantId}/stock`,
        { quantity, note },
      );
      return normalizeItem<ProductVariant>(response) ?? ({} as ProductVariant);
    } catch (error) {
      console.error(`Error updating variant stock ${variantId}:`, error);
      throw error;
    }
  },

  async deleteVariant(variantId: string): Promise<{ message: string }> {
    if (!isClient) throw new Error('Cannot delete variant on server');
    try {
      const response = await api.delete<any>(
        `/products/variants/${variantId}`,
      );
      return (
        response?.data ||
        response || { message: 'Variant deleted successfully' }
      );
    } catch (error) {
      console.error(`Error deleting variant ${variantId}:`, error);
      throw error;
    }
  },

  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    if (!isClient) return [];
    try {
      const response = await api.get<any>(`/products/${productId}/variants`);
      return normalizeArray<ProductVariant>(response);
    } catch (error) {
      console.error(
        `Error fetching variants for product ${productId}:`,
        error,
      );
      return [];
    }
  },

  async getVariantById(variantId: string): Promise<ProductVariant> {
    if (!isClient) return {} as ProductVariant;
    try {
      const response = await api.get<any>(`/products/variants/${variantId}`);
      return normalizeItem<ProductVariant>(response) ?? ({} as ProductVariant);
    } catch (error) {
      console.error(`Error fetching variant ${variantId}:`, error);
      throw error;
    }
  },

  async getVariantByBarcode(barcode: string): Promise<ProductVariant> {
    if (!isClient) return {} as ProductVariant;
    try {
      const response = await api.get<any>(
        `/products/variants/barcode/${barcode}`,
      );
      return normalizeItem<ProductVariant>(response) ?? ({} as ProductVariant);
    } catch (error) {
      console.error(`Error fetching variant by barcode ${barcode}:`, error);
      throw error;
    }
  },

  async getVariantBySku(sku: string): Promise<ProductVariant> {
    if (!isClient) return {} as ProductVariant;
    try {
      const response = await api.get<any>(`/products/variants/sku/${sku}`);
      return normalizeItem<ProductVariant>(response) ?? ({} as ProductVariant);
    } catch (error) {
      console.error(`Error fetching variant by SKU ${sku}:`, error);
      throw error;
    }
  },

  // ============================================
  // CATEGORY METHODS
  // ============================================

  async getCategories(params?: {
    businessUnitId?: string;
    isActive?: boolean;
    limit?: number;
  }): Promise<any[]> {
    if (!isClient) return [];
    try {
      const bid = params?.businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/categories', {
        params: { ...params, businessUnitId: bid },
      });
      return normalizeArray<any>(response);
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  async getCategoryById(id: string, businessUnitId?: string): Promise<any> {
    if (!isClient) return {} as any;
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>(`/products/categories/${id}`, {
        params: { businessUnitId: bid },
      });
      return response?.data || response || {};
    } catch (error) {
      console.error(`Error fetching category ${id}:`, error);
      throw error;
    }
  },

  async createCategory(data: any): Promise<any> {
    if (!isClient) throw new Error('Cannot create category on server');
    try {
      const response = await api.post<any>('/products/categories', data);
      return response?.data || response;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  },

  async updateCategory(id: string, data: any): Promise<any> {
    if (!isClient) throw new Error('Cannot update category on server');
    try {
      const response = await api.put<any>(`/products/categories/${id}`, data);
      return response?.data || response;
    } catch (error) {
      console.error(`Error updating category ${id}:`, error);
      throw error;
    }
  },

  async deleteCategory(
    id: string,
    businessUnitId?: string,
  ): Promise<{ message: string }> {
    if (!isClient) throw new Error('Cannot delete category on server');
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.delete<any>(`/products/categories/${id}`, {
        params: { businessUnitId: bid },
      });
      return (
        response?.data ||
        response || { message: 'Category deleted successfully' }
      );
    } catch (error) {
      console.error(`Error deleting category ${id}:`, error);
      throw error;
    }
  },

  async toggleCategoryStatus(id: string, isActive: boolean): Promise<any> {
    if (!isClient) {
      throw new Error('Cannot toggle category status on server');
    }
    try {
      const response = await api.put<any>(`/products/categories/${id}`, {
        isActive,
      });
      return response?.data || response;
    } catch (error) {
      console.error(`Error toggling category status ${id}:`, error);
      throw error;
    }
  },

  async getCategoryProducts(
    categoryId: string,
    params?: { page?: number; limit?: number },
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    if (!isClient) {
      return { data: [], total: 0, page: 1, totalPages: 1, limit: 10 };
    }
    try {
      const response = await api.get<any>(
        `/products/categories/${categoryId}/products`,
        { params },
      );
      return normalizeList<any>(response, params?.limit || 10);
    } catch (error) {
      console.error(
        `Error fetching products for category ${categoryId}:`,
        error,
      );
      return { data: [], total: 0, page: 1, totalPages: 1, limit: 10 };
    }
  },

  async getCategoryTree(businessUnitId?: string): Promise<any[]> {
    if (!isClient) return [];
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const response = await api.get<any>('/products/categories/tree', {
        params: { businessUnitId: bid },
      });
      return normalizeArray<any>(response);
    } catch (error) {
      console.error('Error fetching category tree:', error);
      return [];
    }
  },

  async bulkDeleteCategories(ids: string[]): Promise<{ message: string }> {
    if (!isClient) {
      throw new Error('Cannot bulk delete categories on server');
    }
    try {
      let deleted = 0;
      const errors: string[] = [];
      for (const id of ids) {
        try {
          await this.deleteCategory(id);
          deleted++;
        } catch (err: any) {
          errors.push(`${id}: ${extractErrorMessage(err)}`);
        }
      }
      return {
        message:
          errors.length === 0
            ? `${deleted} categor${deleted === 1 ? 'y' : 'ies'} deleted`
            : `${deleted} deleted, ${errors.length} failed`,
      };
    } catch (error) {
      console.error('Error bulk deleting categories:', error);
      throw error;
    }
  },

  // ============================================
  // SUPPLIER METHODS
  // ============================================

  async getSuppliers(params?: {
    companyId?: string;
    isActive?: boolean;
    limit?: number;
  }): Promise<any[]> {
    if (!isClient) return [];
    try {
      const response = await api.get<any>('/products/suppliers', { params });
      return normalizeArray<any>(response);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      return [];
    }
  },

  async getSupplierById(id: string, companyId?: string): Promise<any> {
    if (!isClient) return {} as any;
    try {
      const response = await api.get<any>(`/products/suppliers/${id}`, {
        params: { companyId },
      });
      return response?.data || response || {};
    } catch (error) {
      console.error(`Error fetching supplier ${id}:`, error);
      throw error;
    }
  },

  async createSupplier(data: any): Promise<any> {
    if (!isClient) throw new Error('Cannot create supplier on server');
    try {
      const response = await api.post<any>('/products/suppliers', data);
      return response?.data || response;
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }
  },

  async updateSupplier(id: string, data: any): Promise<any> {
    if (!isClient) throw new Error('Cannot update supplier on server');
    try {
      const response = await api.put<any>(`/products/suppliers/${id}`, data);
      return response?.data || response;
    } catch (error) {
      console.error(`Error updating supplier ${id}:`, error);
      throw error;
    }
  },

  async deleteSupplier(
    id: string,
    companyId?: string,
  ): Promise<{ message: string }> {
    if (!isClient) throw new Error('Cannot delete supplier on server');
    try {
      const response = await api.delete<any>(`/products/suppliers/${id}`, {
        params: { companyId },
      });
      return (
        response?.data ||
        response || { message: 'Supplier deleted successfully' }
      );
    } catch (error) {
      console.error(`Error deleting supplier ${id}:`, error);
      throw error;
    }
  },

  // ============================================
  // REVIEW METHODS
  // ============================================

  async getProductReviews(
    productId: string,
    params?: { page?: number; limit?: number },
  ): Promise<any> {
    if (!isClient) {
      return { reviews: [], stats: { average: 0, total: 0 } };
    }
    try {
      const response = await api.get<any>(`/products/${productId}/reviews`, {
        params,
      });

      // Handle all shapes
      if (Array.isArray(response)) {
        return {
          reviews: response,
          stats: { average: 0, total: 0 },
        };
      }

      if (Array.isArray(response?.data)) {
        return {
          reviews: response.data,
          stats: response.stats || { average: 0, total: 0 },
          pagination: response.pagination,
        };
      }

      const data = response?.data ?? response;
      return {
        reviews: data?.reviews ?? [],
        stats: data?.stats ?? { average: 0, total: 0 },
        pagination: data?.pagination,
      };
    } catch (error) {
      console.error(`Error fetching reviews for product ${productId}:`, error);
      return { reviews: [], stats: { average: 0, total: 0 } };
    }
  },

  async getReviewStats(productId: string): Promise<any> {
    if (!isClient) {
      return {
        average: 0,
        total: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }
    try {
      const response = await api.get<any>(
        `/products/${productId}/reviews/stats`,
      );
      return (
        response?.data ||
        response || {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        }
      );
    } catch (error) {
      console.error(
        `Error fetching review stats for product ${productId}:`,
        error,
      );
      return {
        average: 0,
        total: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }
  },

  async createProductReview(data: any): Promise<any> {
    if (!isClient) throw new Error('Cannot create review on server');
    try {
      const response = await api.post<any>(
        `/products/${data.productId}/reviews`,
        data,
      );
      return response?.data || response;
    } catch (error) {
      console.error('Error creating product review:', error);
      throw error;
    }
  },

  async updateProductReview(reviewId: string, data: any): Promise<any> {
    if (!isClient) throw new Error('Cannot update review on server');
    try {
      const response = await api.put<any>(
        `/products/reviews/${reviewId}`,
        data,
      );
      return response?.data || response;
    } catch (error) {
      console.error(`Error updating review ${reviewId}:`, error);
      throw error;
    }
  },

  async deleteProductReview(reviewId: string): Promise<{ message: string }> {
    if (!isClient) throw new Error('Cannot delete review on server');
    try {
      const response = await api.delete<any>(`/products/reviews/${reviewId}`);
      return (
        response?.data ||
        response || { message: 'Review deleted successfully' }
      );
    } catch (error) {
      console.error(`Error deleting review ${reviewId}:`, error);
      throw error;
    }
  },

  async verifyReview(reviewId: string): Promise<any> {
    if (!isClient) throw new Error('Cannot verify review on server');
    try {
      const response = await api.patch<any>(
        `/products/reviews/${reviewId}/verify`,
      );
      return response?.data || response;
    } catch (error) {
      console.error(`Error verifying review ${reviewId}:`, error);
      throw error;
    }
  },

  async markReviewHelpful(
    reviewId: string,
  ): Promise<{ helpful: boolean; helpfulCount: number }> {
    if (!isClient) throw new Error('Cannot mark review helpful on server');
    try {
      const response = await api.post<any>(
        `/products/reviews/${reviewId}/helpful`,
      );
      return response?.data || response || { helpful: true, helpfulCount: 0 };
    } catch (error) {
      console.error(`Error marking review ${reviewId} as helpful:`, error);
      throw error;
    }
  },

  async reportReview(
    reviewId: string,
    reason: string,
  ): Promise<{ message: string }> {
    if (!isClient) throw new Error('Cannot report review on server');
    try {
      const response = await api.post<any>(
        `/products/reviews/${reviewId}/report`,
        { reason },
      );
      return (
        response?.data ||
        response || { message: 'Review reported successfully' }
      );
    } catch (error) {
      console.error(`Error reporting review ${reviewId}:`, error);
      throw error;
    }
  },

  // ============================================
  // WISHLIST / FAVORITES
  // ============================================

  async toggleWishlist(productId: string): Promise<{ added: boolean }> {
    if (!isClient) throw new Error('Cannot toggle wishlist on server');
    try {
      const response = await api.post<any>(`/products/wishlist/${productId}`);
      return response?.data || response || { added: false };
    } catch (error) {
      console.error(`Error toggling wishlist for product ${productId}:`, error);
      throw error;
    }
  },

  async getWishlist(): Promise<string[]> {
    if (!isClient) return [];
    try {
      const response = await api.get<any>('/products/wishlist');
      return normalizeArray<string>(response);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      return [];
    }
  },

  async checkWishlist(productId: string): Promise<boolean> {
    if (!isClient) return false;
    try {
      const response = await api.get<any>(
        `/products/wishlist/${productId}/check`,
      );
      if (response && typeof response === 'object') {
        if ('data' in response) return response.data === true;
        if ('success' in response) return response.success === true;
      }
      return Boolean(response);
    } catch (error) {
      console.error(
        `Error checking wishlist for product ${productId}:`,
        error,
      );
      return false;
    }
  },

  async getWishlistCount(): Promise<number> {
    if (!isClient) return 0;
    try {
      const response = await api.get<any>('/products/wishlist/count');
      if (response && typeof response === 'object') {
        if ('data' in response && typeof response.data === 'number') {
          return response.data;
        }
        if ('count' in response && typeof response.count === 'number') {
          return response.count;
        }
      }
      return typeof response === 'number' ? response : 0;
    } catch (error) {
      console.error('Error fetching wishlist count:', error);
      return 0;
    }
  },

  async getWishlistProductIds(): Promise<string[]> {
    if (!isClient) return [];
    try {
      const response = await api.get<any>('/products/wishlist/ids');
      return normalizeArray<string>(response);
    } catch (error) {
      console.error('Error fetching wishlist product IDs:', error);
      return [];
    }
  },

  async clearWishlist(): Promise<{ message: string }> {
    if (!isClient) throw new Error('Cannot clear wishlist on server');
    try {
      const response = await api.delete<any>('/products/wishlist');
      return response?.data || response || { message: 'Wishlist cleared' };
    } catch (error) {
      console.error('Error clearing wishlist:', error);
      throw error;
    }
  },

  // ============================================
  // PRODUCT COMPARE
  // ============================================

  async compareProducts(productIds: string[]): Promise<Product[]> {
    if (!isClient) return [];
    try {
      const response = await api.post<any>('/products/compare', {
        productIds,
      });
      return normalizeArray<Product>(response);
    } catch (error) {
      console.error('Error comparing products:', error);
      return [];
    }
  },

  // ============================================
  // RECENTLY VIEWED
  // ============================================

  async addRecentlyViewed(productId: string): Promise<{ message: string }> {
    if (!isClient) throw new Error('Cannot add recently viewed on server');
    try {
      const response = await api.post<any>(
        `/products/recently-viewed/${productId}`,
      );
      return (
        response?.data ||
        response || { message: 'Added to recently viewed' }
      );
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return { message: 'Recently viewed tracking not available' };
      }
      console.warn('Failed to add to recently viewed:', error?.message);
      return { message: 'Failed to add recently viewed' };
    }
  },

  async getRecentlyViewed(limit: number = 10): Promise<Product[]> {
    if (!isClient) return [];
    try {
      const response = await api.get<any>('/products/recently-viewed', {
        params: { limit },
      });
      return normalizeArray<Product>(response);
    } catch (error: any) {
      if (error?.response?.status === 404) return [];
      console.warn('Failed to get recently viewed:', error?.message);
      return [];
    }
  },

  async clearRecentlyViewed(): Promise<{ message: string }> {
    if (!isClient) {
      throw new Error('Cannot clear recently viewed on server');
    }
    try {
      const response = await api.delete<any>('/products/recently-viewed');
      return (
        response?.data ||
        response || { message: 'Recently viewed cleared' }
      );
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return { message: 'Recently viewed clearing not available' };
      }
      console.warn('Failed to clear recently viewed:', error?.message);
      return { message: 'Failed to clear recently viewed' };
    }
  },

  // ============================================
  // EXPORT / IMPORT
  // ============================================

  async exportProducts(
    format: 'csv' | 'excel' | 'json' = 'csv',
    filters?: any,
  ): Promise<Blob> {
    if (!isClient) throw new Error('Cannot export on server');
    try {
      const response = await api.download(`/products/export`, {
        params: { format, ...filters },
      });
      return response;
    } catch (error) {
      console.error('Error exporting products:', error);
      throw error;
    }
  },

  async importProducts(
    file: File,
    businessUnitId?: string,
  ): Promise<ImportResult> {
    if (!isClient) throw new Error('Cannot import on server');
    try {
      const bid = businessUnitId || getBusinessUnitId();
      const formData = new FormData();
      formData.append('file', file);
      if (isRealBusinessUnitId(bid)) {
        formData.append('businessUnitId', bid);
      }

      const response = await api.upload<any>(
        '/products/import',
        formData as any,
        isRealBusinessUnitId(bid) ? bid : undefined,
      );
      return (
        response?.data ||
        response || {
          success: false,
          imported: 0,
          failed: 0,
          total: 0,
          errors: [],
        }
      );
    } catch (error) {
      console.error('Error importing products:', error);
      throw error;
    }
  },

  async downloadImportTemplate(): Promise<Blob> {
    if (!isClient) throw new Error('Cannot download template on server');
    try {
      const response = await api.download('/products/import/template');
      return response;
    } catch (error) {
      console.error('Error downloading import template:', error);
      throw error;
    }
  },

  async exportProductReviews(
    productId: string,
    format: 'csv' | 'excel' = 'csv',
  ): Promise<Blob> {
    if (!isClient) throw new Error('Cannot export reviews on server');
    try {
      const response = await api.download(
        `/products/${productId}/reviews/export`,
        { params: { format } },
      );
      return response;
    } catch (error) {
      console.error(
        `Error exporting reviews for product ${productId}:`,
        error,
      );
      throw error;
    }
  },
};

export default productService;
