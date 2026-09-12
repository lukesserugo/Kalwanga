// D:\Projects\Kalwanga\packages\web\services\inventoryService.ts
// PART 1 of 2

import { api } from './api';

// ============================================
// TYPES - Match Backend Response Structures
// ============================================

export interface Inventory {
  id: string;
  productId: string | null;
  product: any | null;
  variantId: string | null;
  variant: any | null;
  name: string;
  sku: string;
  barcode: string | null;
  quantity: number;
  reserved: number;
  available: number;
  unitPrice: number;
  costPrice: number;
  category: string;
  categoryId: string | null;
  supplier: string | null;
  supplierId: string | null;
  reorderPoint: number;
  location: string;
  notes: string | null;
  hasProduct: boolean;
  images: string[];
  description: string | null;
  weight: number;
  taxRate: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  status?: string;
  businessUnitId?: string;
  maxStock?: number;
  minStock?: number;
  stock?: number;
  price?: number;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  reorderQuantity?: number;
}

export interface InventoryItemResponse {
  id: string;
  productId: string | null;
  product: any | null;
  variantId: string | null;
  variant: any | null;
  name: string;
  sku: string;
  barcode: string | null;
  quantity: number;
  reserved: number;
  available: number;
  unitPrice: number;
  costPrice: number;
  category: string;
  categoryId: string | null;
  supplier: string | null;
  supplierId: string | null;
  reorderPoint: number;
  location: string;
  notes: string | null;
  hasProduct: boolean;
  images: string[];
  description: string | null;
  weight: number;
  taxRate: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  maxStock?: number;
  minStock?: number;
  stock?: number;
  price?: number;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  reorderQuantity?: number;
}

export interface InventoryItemsResponse {
  items: InventoryItemResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InventoryListResponse {
  inventory: any[];
  items?: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: InventoryStats;
  appliedFilters: {
    search: string | null;
    category: string | null;
    location: string | null;
    status: string | null;
    lowStock: boolean;
  };
}

export interface InventoryStats {
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

export interface InventoryTransaction {
  id: string;
  transactionType: string;
  quantity: number;
  notes: string | null;
  reference: string | null;
  productId: string;
  variantId: string | null;
  inventoryId: string;
  businessUnitId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  product?: { id: string; name: string; sku: string };
  variant?: { id: string; name: string; sku: string };
  user?: { id: string; firstName: string; lastName: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  stats?: InventoryStats;
}

export interface CreateItemData {
  name: string;
  sku?: string;
  unitPrice?: number;
  quantity?: number;
  minStock?: number;
  maxStock?: number;
  category?: string;
  categoryId?: string;
  location?: string;
  supplier?: string;
  supplierId?: string;
  notes?: string;
  description?: string;
  barcode?: string;
  businessUnitId?: string;
  userId?: string;
  unit?: string;
  costPrice?: number;
  taxRate?: number;
  weight?: number;
  images?: string[];
  tags?: string[];
  isActive?: boolean;
  featured?: boolean;
  isDigital?: boolean;
  productType?: 'SIMPLE' | 'VARIABLE' | 'GROUPED' | 'BUNDLE' | 'DIGITAL' | 'SERVICE';
  variantAttributes?: Record<string, any>;
  variants?: Array<{
    name: string;
    sku: string;
    price: number;
    costPrice?: number;
    stock?: number;
    attributes: Record<string, any>;
    images?: string[];
  }>;
}

export interface UpdateItemData {
  name?: string;
  sku?: string;
  unitPrice?: number;
  quantity?: number;
  minStock?: number;
  maxStock?: number;
  category?: string;
  categoryId?: string;
  location?: string;
  supplier?: string;
  supplierId?: string;
  notes?: string;
  description?: string;
  barcode?: string;
  businessUnitId?: string;
  userId?: string;
  unit?: string;
  costPrice?: number;
  taxRate?: number;
  weight?: number;
  images?: string[];
  tags?: string[];
  isActive?: boolean;
  featured?: boolean;
  isDigital?: boolean;
  productType?: 'SIMPLE' | 'VARIABLE' | 'GROUPED' | 'BUNDLE' | 'DIGITAL' | 'SERVICE';
}

export interface IssueItemData {
  issuedTo: string;
  quantity: number;
  purpose?: string;
  remarks?: string;
  expectedReturnDate?: string;
}

export interface ReturnItemData {
  quantity?: number;
  returnDate?: string;
  remarks?: string;
}

export interface RestockItemData {
  quantity: number;
  supplier?: string;
  unitPrice?: number;
  purchaseDate?: string;
  notes?: string;
  invoiceNumber?: string;
}

export interface UpdateStockData {
  quantity: number;
  transactionType?: string;
  notes?: string;
  reference?: string;
}

export interface TransferStockData {
  productId: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  notes?: string;
  businessUnitId: string;
  variantId?: string;
}

export interface InventorySummary {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue: number;
  totalCost: number;
  potentialProfit: number;
  categories: Array<{ category: string; count: number; value: number }>;
  locations: Array<{ location: string; count: number; value: number }>;
  stockStatus: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
}

export interface InventoryValue {
  totalValue: number;
  totalCost: number;
  profitMargin: number;
  byLocation: Array<{ location: string; value: number; cost: number }>;
  byCategory: Array<{ category: string; value: number; cost: number }>;
}

export interface BulkUpdateResult {
  results: any[];
  errors: any[];
  summary: { total: number; succeeded: number; failed: number };
}

export interface InventoryMovementParams {
  productId?: string;
  businessUnitId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface InventoryTransactionParams {
  page?: number;
  limit?: number;
  productId?: string;
  businessUnitId?: string;
  transactionType?: string;
  startDate?: string;
  endDate?: string;
}

export type ExportFormat = 'csv' | 'excel' | 'json';

export interface InventorySearchFilters {
  search?: string;
  categoryId?: string;
  location?: string;
  supplier?: string;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  lowStock?: boolean;
  hasBarcode?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  businessUnitId?: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  productCount?: number;
  childrenCount?: number;
  hasChildren?: boolean;
  parentId?: string | null;
}

export interface SupplierOption {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface GetInventoryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  category?: string;
  location?: string;
  status?: string;
  lowStock?: boolean;
  businessUnitId?: string;
  sortByProductName?: string;
}

export interface GetAllInventoryResponse {
  items: any[];
  stats: InventoryStats;
}

// ============================================
// HELPER FUNCTIONS
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
 * Read the canonical businessUnitId from localStorage.
 * Matches the key that api.ts and useAuth/usePermission write.
 */
function getBusinessUnitIdFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('businessUnitId');
    if (stored && stored !== 'default' && stored !== 'null' && stored !== 'undefined') {
      return stored;
    }
  } catch (_e) {
    /* ignore */
  }

  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.businessUnitId && user.businessUnitId !== 'default') {
        return user.businessUnitId;
      }
      const fromArray = user?.businessUnits?.[0]?.businessUnitId;
      if (fromArray && fromArray !== 'default') {
        return fromArray;
      }
    }
  } catch (_e) {
    /* ignore */
  }

  return null;
}

/**
 * Resolve the effective business unit ID for a request.
 * Order: explicit param → storage fallback → undefined.
 */
function resolveBusinessUnitId(explicit?: string): string | undefined {
  const sanitized = sanitizeBusinessUnitId(explicit);
  if (sanitized) return sanitized;
  const stored = getBusinessUnitIdFromStorage();
  return stored || undefined;
}

/**
 * Public helper: get the currently selected business unit ID.
 * Useful for components that need to pass it explicitly into a call.
 */
export function getCurrentBusinessUnitId(): string | null {
  return getBusinessUnitIdFromStorage();
}

function cleanObject<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

/**
 * Normalize inventory item to ensure product ID is available at top level.
 * Handles images, description, weight, taxRate, tags.
 * Matches the backend normalization exactly.
 */
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
        weight: item.weight !== undefined ? item.weight : item.product.weight,
        taxRate: item.taxRate !== undefined ? item.taxRate : item.product.taxRate,
        tags:
          item.tags && item.tags.length > 0
            ? item.tags
            : item.product.tags || [],
        isActive:
          item.isActive !== undefined ? item.isActive : item.product?.isActive,
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
        price: item.price || item.unitPrice || item.product?.unitPrice || 0,
        available:
          item.available !== undefined
            ? item.available
            : (item.quantity || 0) - (item.reserved || 0),
        status: item.status || item.product?.status || 'ACTIVE',
        businessUnitId: item.businessUnitId || item.product?.businessUnitId,
        createdAt: item.createdAt || item.product?.createdAt,
        updatedAt: item.updatedAt || item.product?.updatedAt,
        reorderQuantity:
          item.reorderQuantity || item.product?.maxStock || 10,
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
    item.inventory = [
      {
        quantity: item.quantity || item.stock || 0,
        reserved: item.reserved || 0,
      },
    ];
  }

  if (item && item.quantity !== undefined && item.stock === undefined) {
    item.stock = item.quantity;
  }

  if (item && item.available === undefined) {
    item.available = (item.quantity || 0) - (item.reserved || 0);
  }

  if (item && !item.images) {
    item.images = [];
  }

  if (item && !item.tags) {
    item.tags = [];
  }

  if (item && item.price === undefined) {
    item.price = item.unitPrice || 0;
  }

  if (item && item.reorderQuantity === undefined) {
    item.reorderQuantity = item.maxStock || 10;
  }

  if (item && item.maxStock === undefined) {
    item.maxStock = 100;
  }

  if (item && item.minStock === undefined) {
    item.minStock = item.reorderPoint || 5;
  }

  if (item && item.isActive === undefined) {
    item.isActive = true;
  }

  if (item && item.isDigital === undefined) {
    item.isDigital = false;
  }

  if (item && item.featured === undefined) {
    item.featured = false;
  }

  if (item && item.status === undefined) {
    item.status =
      item.quantity === 0
        ? 'out_of_stock'
        : item.quantity <= (item.reorderPoint || 5)
        ? 'low_stock'
        : 'ACTIVE';
  }

  return item;
}

function normalizeInventoryItems(items: any[]): any[] {
  if (!items || !Array.isArray(items)) return [];
  return items.map(normalizeInventoryItem);
}

// ============================================
// INVENTORY SERVICE
// ============================================

export const inventoryService = {
  // ============================================
  // REFERENCE DATA ENDPOINTS
  // ============================================

  async getCategories(businessUnitId?: string): Promise<CategoryOption[]> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;

      console.log('📤 Fetching categories with params:', params);

      const response = await api.get<any>('/categories', {
        params: { ...params, limit: 100, isActive: true },
      });

      let categoriesData: any[] = [];

      if (response) {
        if (response.data && Array.isArray(response.data)) {
          categoriesData = response.data;
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          categoriesData = response.data.data;
        } else if (response.data?.items && Array.isArray(response.data.items)) {
          categoriesData = response.data.items;
        } else if (Array.isArray(response)) {
          categoriesData = response;
        }
      }

      const formattedCategories = categoriesData.map((cat: any) => ({
        id: cat.id || cat.categoryId || cat.category,
        name: cat.name || cat.category || 'Uncategorized',
        productCount: cat.productCount || cat._count?.products || 0,
        childrenCount: cat.childrenCount || cat._count?.children || 0,
        hasChildren: (cat.childrenCount || cat._count?.children || 0) > 0,
        parentId: cat.parentId || null,
      }));

      console.log(`✅ Categories fetched: ${formattedCategories.length}`);
      return formattedCategories;
    } catch (error: any) {
      console.error('❌ Failed to get categories:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
        params: error?.config?.params,
      });
      return [];
    }
  },

  async getCategorySummary(
    businessUnitId: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      categoryId?: string;
      count: number;
      value: number;
    }>
  > {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;

      console.log('📤 Fetching category summary with params:', params);

      const response = await api.get<any>('/inventory/category-summary', {
        params: { ...params, limit: 100, isActive: true },
      });

      let categories: any[] = [];
      if (response) {
        if (response.data && Array.isArray(response.data)) {
          categories = response.data;
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          categories = response.data.data;
        } else if (response.data?.items && Array.isArray(response.data.items)) {
          categories = response.data.items;
        } else if (Array.isArray(response)) {
          categories = response;
        }
      }

      const summaryData = categories.map((cat: any) => ({
        id: cat.id || cat.categoryId || cat.category,
        name: cat.name || cat.category || 'Uncategorized',
        categoryId: cat.id || cat.categoryId || null,
        count: cat.count || 0,
        value: cat.value || 0,
      }));

      console.log(`📥 Category summary: ${summaryData.length} categories`);
      return summaryData;
    } catch (error: any) {
      console.error('❌ Failed to get category summary:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
        params: error?.config?.params,
      });
      return [];
    }
  },

  async getSuppliers(businessUnitId?: string): Promise<SupplierOption[]> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;

      console.log('📤 Fetching suppliers with params:', params);
      const response = await api.get<any>('/inventory/suppliers', { params });

      let suppliersData: any[] = [];

      if (Array.isArray(response)) {
        suppliersData = response;
      } else if (response?.data && Array.isArray(response.data)) {
        suppliersData = response.data;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        suppliersData = response.data.data;
      } else if (response?.data?.items && Array.isArray(response.data.items)) {
        suppliersData = response.data.items;
      }

      if (suppliersData && suppliersData.length > 0) {
        console.log(`✅ Suppliers found: ${suppliersData.length}`);
        return suppliersData;
      }

      console.warn('⚠️ No suppliers found');
      return [];
    } catch (error: any) {
      console.error('❌ Failed to get suppliers:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
        params: error?.config?.params,
      });
      return [];
    }
  },

  // ============================================
  // GET ENDPOINTS
  // ============================================

  async getInventory(params?: GetInventoryParams): Promise<InventoryListResponse> {
    try {
      const cleanParams: any = { ...params };

      if (cleanParams.sortBy) {
        if (
          cleanParams.sortBy === 'name' ||
          cleanParams.sortBy === 'productName'
        ) {
          cleanParams.sortByProductName = 'true';
        }
      }

      const resolvedBusinessUnitId = resolveBusinessUnitId(
        cleanParams.businessUnitId
      );
      if (resolvedBusinessUnitId) {
        cleanParams.businessUnitId = resolvedBusinessUnitId;
      } else {
        delete cleanParams.businessUnitId;
      }

      const cleanedParams = cleanObject(cleanParams);

      console.log('📤 Fetching inventory with params:', cleanedParams);

      const response = await api.get<any>('/inventory/items', {
        params: cleanedParams,
      });

      if (Array.isArray(response)) {
        return {
          inventory: response.map(normalizeInventoryItem),
          items: response.map(normalizeInventoryItem),
          total: response.length,
          page: 1,
          limit: response.length || 10,
          totalPages: 1,
          stats: {} as InventoryStats,
          appliedFilters: {
            search: null,
            category: null,
            location: null,
            status: null,
            lowStock: false,
          },
        };
      }

      if (!response || typeof response !== 'object') {
        console.warn(
          '⚠️ getInventory: unexpected response shape, returning empty',
          response
        );
        return {
          inventory: [],
          items: [],
          total: 0,
          page: 1,
          limit: cleanParams.limit || 10,
          totalPages: 1,
          stats: {} as InventoryStats,
          appliedFilters: {
            search: null,
            category: null,
            location: null,
            status: null,
            lowStock: false,
          },
        };
      }

      if (Array.isArray(response.items) && !response.inventory) {
        const normalized = response.items.map(normalizeInventoryItem);
        response.inventory = normalized;
        response.items = normalized;
      }

      if (Array.isArray(response.inventory)) {
        const normalized = response.inventory.map(normalizeInventoryItem);
        response.inventory = normalized;
        if (!Array.isArray(response.items)) {
          response.items = normalized;
        }
      }

      if (Array.isArray(response.data) && !response.inventory) {
        const normalized = response.data.map(normalizeInventoryItem);
        response.inventory = normalized;
        response.items = normalized;
      }

      if (
        response.data &&
        typeof response.data === 'object' &&
        Array.isArray(response.data.inventory) &&
        !response.inventory
      ) {
        const normalized = response.data.inventory.map(normalizeInventoryItem);
        response.inventory = normalized;
        response.items = normalized;
      }

      if (!Array.isArray(response.inventory)) {
        response.inventory = [];
      }
      if (!Array.isArray(response.items)) {
        response.items = response.inventory;
      }
      if (typeof response.total !== 'number') {
        response.total = response.inventory.length;
      }
      if (typeof response.page !== 'number') {
        response.page = cleanParams.page || 1;
      }
      if (typeof response.limit !== 'number') {
        response.limit = cleanParams.limit || 10;
      }
      if (typeof response.totalPages !== 'number') {
        response.totalPages = Math.max(
          1,
          Math.ceil(response.total / response.limit)
        );
      }
      if (!response.stats || typeof response.stats !== 'object') {
        response.stats = {} as InventoryStats;
      }
      if (!response.appliedFilters) {
        response.appliedFilters = {
          search: null,
          category: null,
          location: null,
          status: null,
          lowStock: false,
        };
      }

      console.log(
        `✅ getInventory: businessUnitId="${
          resolvedBusinessUnitId ?? 'auto'
        }", items=${response.inventory.length}, total=${response.total}`
      );

      return response as InventoryListResponse;
    } catch (error: any) {
      console.error('❌ Failed to get inventory:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
        params: error?.config?.params,
      });
      throw error;
    }
  },

  async getInventoryItems(params?: {
    page?: number;
    limit?: number;
    search?: string;
    businessUnitId?: string;
    withoutProduct?: boolean;
  }): Promise<InventoryItemsResponse> {
    try {
      const cleanParams: any = { ...params };

      const resolvedBusinessUnitId = resolveBusinessUnitId(
        cleanParams.businessUnitId
      );
      if (resolvedBusinessUnitId) {
        cleanParams.businessUnitId = resolvedBusinessUnitId;
      } else {
        delete cleanParams.businessUnitId;
      }

      const cleanedParams = cleanObject(cleanParams);

      console.log('📤 Fetching inventory items with params:', cleanedParams);

      const response = await api.get<any>('/inventory/items', {
        params: cleanedParams,
      });

      if (Array.isArray(response)) {
        const normalized = response.map(normalizeInventoryItem);
        return {
          items: normalized,
          total: normalized.length,
          page: 1,
          limit: normalized.length || cleanParams.limit || 20,
          totalPages: 1,
        };
      }

      if (!response || typeof response !== 'object') {
        console.warn(
          '⚠️ getInventoryItems: unexpected response shape, returning empty',
          response
        );
        return {
          items: [],
          total: 0,
          page: cleanParams.page || 1,
          limit: cleanParams.limit || 20,
          totalPages: 1,
        };
      }

      if (Array.isArray(response.items)) {
        response.items = response.items.map(normalizeInventoryItem);
      }

      if (!Array.isArray(response.items) && Array.isArray(response.data)) {
        response.items = response.data.map(normalizeInventoryItem);
      }

      if (
        !Array.isArray(response.items) &&
        Array.isArray(response.inventory)
      ) {
        response.items = response.inventory.map(normalizeInventoryItem);
      }

      if (
        !Array.isArray(response.items) &&
        response.data &&
        typeof response.data === 'object' &&
        Array.isArray(response.data.items)
      ) {
        response.items = response.data.items.map(normalizeInventoryItem);
      }

      if (!Array.isArray(response.items)) {
        response.items = [];
      }
      if (typeof response.total !== 'number') {
        response.total = response.items.length;
      }
      if (typeof response.page !== 'number') {
        response.page = cleanParams.page || 1;
      }
      if (typeof response.limit !== 'number') {
        response.limit = cleanParams.limit || 20;
      }
      if (typeof response.totalPages !== 'number') {
        response.totalPages = Math.max(
          1,
          Math.ceil(response.total / response.limit)
        );
      }

      console.log(
        `✅ getInventoryItems: businessUnitId="${
          resolvedBusinessUnitId ?? 'auto'
        }", items=${response.items.length}, total=${response.total}`
      );

      return response as InventoryItemsResponse;
    } catch (error: any) {
      console.error('❌ Failed to get inventory items:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
        params: error?.config?.params,
      });
      throw error;
    }
  },

  async getAllInventory(businessUnitId: string): Promise<GetAllInventoryResponse> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;

      console.log('📤 getAllInventory - businessUnitId:', cleanBusinessUnitId);

      const response = await api.get<any>('/inventory/all', { params });

      console.log('📥 getAllInventory response:', response);

      let items: any[] = [];
      let stats: InventoryStats = {} as InventoryStats;

      if (response) {
        if (response.items && Array.isArray(response.items)) {
          items = response.items;
          stats = response.stats || ({} as InventoryStats);
        } else if (response.data && Array.isArray(response.data)) {
          items = response.data;
          stats = response.stats || ({} as InventoryStats);
        } else if (
          response.success &&
          response.data &&
          Array.isArray(response.data)
        ) {
          items = response.data;
          stats = response.stats || ({} as InventoryStats);
        } else if (Array.isArray(response)) {
          items = response;
        }
      }

      const normalizedItems = items.map((item: any) => {
        const normalized = normalizeInventoryItem(item);
        return {
          ...normalized,
          name: normalized.name || normalized.product?.name || 'Unknown Product',
          sku: normalized.sku || normalized.product?.sku || 'N/A',
          quantity: normalized.quantity || normalized.stock || 0,
          price:
            normalized.price ||
            normalized.unitPrice ||
            normalized.product?.unitPrice ||
            0,
          stock: normalized.stock || normalized.quantity || 0,
          productId:
            normalized.productId || normalized.product?.id || normalized.id,
          images: normalized.images || [],
          description: normalized.description || null,
          weight: normalized.weight || 0,
          taxRate: normalized.taxRate || 0,
          tags: normalized.tags || [],
          inventory: normalized.inventory || [
            {
              quantity: normalized.quantity || 0,
              reserved: normalized.reserved || 0,
            },
          ],
        };
      });

      console.log(`✅ getAllInventory returning ${normalizedItems.length} items`);
      return { items: normalizedItems, stats };
    } catch (error: any) {
      console.error('❌ Failed to get all inventory:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
        params: error?.config?.params,
      });
      return { items: [], stats: {} as InventoryStats };
    }
  },

  async getInventoryByProduct(
    productId: string,
    businessUnitId: string,
    variantId?: string
  ): Promise<any> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;
      if (variantId) params.variantId = variantId;

      const response = await api.get<any>(`/inventory/product/${productId}`, {
        params,
      });
      return response ? normalizeInventoryItem(response) : response;
    } catch (error: any) {
      console.error('❌ Failed to get inventory by product:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
        params: error?.config?.params,
      });
      throw error;
    }
  },

  async getInventoryByBarcode(
    barcode: string,
    businessUnitId?: string
  ): Promise<any> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;

      const response = await api.get<any>(`/inventory/barcode/${barcode}`, {
        params,
      });
      return response ? normalizeInventoryItem(response) : response;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      console.error(`❌ Failed to get inventory by barcode ${barcode}:`, {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async getInventoryBySku(sku: string, businessUnitId?: string): Promise<any> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;

      const response = await api.get<any>(`/inventory/sku/${sku}`, { params });
      return response ? normalizeInventoryItem(response) : response;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      console.error(`❌ Failed to get inventory by SKU ${sku}:`, {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async getInventoryItemById(id: string, businessUnitId?: string): Promise<any> {
    try {
      if (!id) {
        throw new Error('Inventory ID is required');
      }

      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;

      const response = await api.get<any>(`/inventory/items/${id}`, { params });

      let result = null;
      if (response) {
        if (response.data) {
          result = response.data;
        } else if (response.success && response.data) {
          result = response.data;
        } else if (response.id) {
          result = response;
        }
      }

      return result ? normalizeInventoryItem(result) : null;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        console.warn(`⚠️ Inventory item ${id} not found`);
        return null;
      }
      console.error('❌ Failed to get inventory item by ID:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async getInventoryItem(id: string): Promise<any> {
    try {
      if (!id) {
        throw new Error('Inventory ID is required');
      }

      const response = await api.get(`/inventory/items/${id}`);
      return response ? normalizeInventoryItem(response) : response;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        console.warn(`⚠️ Inventory item ${id} not found`);
        return null;
      }
      console.error(`❌ Failed to get inventory item ${id}:`, {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async getLowStockItems(businessUnitId: string): Promise<any[]> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/low-stock', {
        params: { businessUnitId: cleanBusinessUnitId },
      });
      const data = response?.data || response || [];
      return Array.isArray(data) ? data.map(normalizeInventoryItem) : [];
    } catch (error: any) {
      console.error('❌ Failed to get low stock items:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async getOutOfStockItems(businessUnitId: string): Promise<any[]> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/out-of-stock', {
        params: { businessUnitId: cleanBusinessUnitId },
      });
      const data = response?.data || response || [];
      return Array.isArray(data) ? data.map(normalizeInventoryItem) : [];
    } catch (error: any) {
      console.error('❌ Failed to get out of stock items:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async getInventoryValue(businessUnitId: string): Promise<InventoryValue> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/value', {
        params: { businessUnitId: cleanBusinessUnitId },
      });
      return response?.data || response;
    } catch (error: any) {
      console.error('❌ Failed to get inventory value:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async getInventoryTransactions(
    params?: InventoryTransactionParams
  ): Promise<PaginatedResponse<InventoryTransaction>> {
    try {
      const cleanParams: any = { ...params };
      const sanitizedBusinessUnitId = resolveBusinessUnitId(
        cleanParams.businessUnitId
      );

      if (sanitizedBusinessUnitId) {
        cleanParams.businessUnitId = sanitizedBusinessUnitId;
      } else {
        delete cleanParams.businessUnitId;
      }

      const cleanedParams = cleanObject(cleanParams);
      const response = await api.get<any>('/inventory/transactions', {
        params: cleanedParams,
      });

      if (!response || typeof response !== 'object') {
        return {
          data: [],
          total: 0,
          page: cleanParams.page || 1,
          limit: cleanParams.limit || 20,
          totalPages: 1,
        };
      }
      if (!Array.isArray(response.data)) {
        response.data = Array.isArray(response.transactions)
          ? response.transactions
          : Array.isArray(response.items)
          ? response.items
          : [];
      }
      if (typeof response.total !== 'number')
        response.total = response.data.length;
      if (typeof response.page !== 'number')
        response.page = cleanParams.page || 1;
      if (typeof response.limit !== 'number')
        response.limit = cleanParams.limit || 20;
      if (typeof response.totalPages !== 'number') {
        response.totalPages = Math.max(
          1,
          Math.ceil(response.total / response.limit)
        );
      }
      return response as PaginatedResponse<InventoryTransaction>;
    } catch (error: any) {
      console.error('❌ Failed to get inventory transactions:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
        params: error?.config?.params,
      });
      throw error;
    }
  },

  async getInventoryByLocation(
    location: string,
    businessUnitId: string
  ): Promise<any[]> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.get<any>(`/inventory/location/${location}`, {
        params: { businessUnitId: cleanBusinessUnitId },
      });
      const data = response?.data || response || [];
      return Array.isArray(data) ? data.map(normalizeInventoryItem) : [];
    } catch (error: any) {
      console.error('❌ Failed to get inventory by location:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async getInventoryByCategory(
    category: string,
    businessUnitId: string
  ): Promise<any[]> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.get<any>(`/inventory/category/${category}`, {
        params: { businessUnitId: cleanBusinessUnitId },
      });
      const data = response?.data || response || [];
      return Array.isArray(data) ? data.map(normalizeInventoryItem) : [];
    } catch (error: any) {
      console.error('❌ Failed to get inventory by category:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async searchInventory(
    query: string,
    businessUnitId: string,
    filters?: InventorySearchFilters
  ): Promise<any[]> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const params: any = { query, businessUnitId: cleanBusinessUnitId };
      if (filters) Object.assign(params, filters);

      const cleanedParams = cleanObject(params);
      const response = await api.get<any>('/inventory/search', {
        params: cleanedParams,
      });
      const data = response?.data || response || [];
      return Array.isArray(data) ? data.map(normalizeInventoryItem) : [];
    } catch (error: any) {
      console.error('❌ Failed to search inventory:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async searchProducts(params: {
    query: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    businessUnitId: string;
  }): Promise<any[]> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(params.businessUnitId);
      const cleanParams = { ...params, businessUnitId: cleanBusinessUnitId };
      const cleanedParams = cleanObject(cleanParams);
      const response = await api.get<any>('/inventory/search', {
        params: cleanedParams,
      });
      const data = response?.data || response || [];
      return Array.isArray(data) ? data.map(normalizeInventoryItem) : [];
    } catch (error: any) {
      console.error('❌ Failed to search products:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
        params: error?.config?.params,
      });
      return [];
    }
  },

  async getInventorySummary(businessUnitId: string): Promise<InventorySummary> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;

      const response = await api.get<any>('/inventory/summary', { params });
      return response?.data || response;
    } catch (error: any) {
      console.error('❌ Failed to get inventory summary:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async getTotalItems(businessUnitId: string): Promise<number> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/total', {
        params: { businessUnitId: cleanBusinessUnitId },
      });
      return response?.data || response || 0;
    } catch (error: any) {
      console.error('❌ Failed to get total items:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async getStockMovements(
    params: InventoryMovementParams
  ): Promise<InventoryTransaction[]> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(params.businessUnitId);
      const cleanParams = { ...params, businessUnitId: cleanBusinessUnitId };
      const cleanedParams = cleanObject(cleanParams);

      const response = await api.get<any>('/inventory/movements', {
        params: cleanedParams,
      });
      return response?.data || response || [];
    } catch (error: any) {
      console.error('❌ Failed to get stock movements:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async getInventoryStats(businessUnitId: string): Promise<InventoryStats> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/stats', {
        params: { businessUnitId: cleanBusinessUnitId },
      });
      return response?.data || response;
    } catch (error: any) {
      console.error('❌ Failed to get inventory stats:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async getInventoryReport(
    businessUnitId: string,
    params?: {
      includeInactive?: boolean;
      categoryId?: string;
      location?: string;
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<any> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const queryParams: any = { businessUnitId: cleanBusinessUnitId };
      if (params) {
        if (params.includeInactive !== undefined)
          queryParams.includeInactive = params.includeInactive;
        if (params.categoryId) queryParams.categoryId = params.categoryId;
        if (params.location) queryParams.location = params.location;
        if (params.dateRange) {
          queryParams.startDate = params.dateRange.start?.toISOString();
          queryParams.endDate = params.dateRange.end?.toISOString();
        }
      }
      const response = await api.get<any>('/inventory/report', {
        params: cleanObject(queryParams),
      });
      return response?.data || response;
    } catch (error: any) {
      console.error('❌ Failed to get inventory report:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async createItem(data: CreateItemData): Promise<any> {
    try {
      console.log('📤 Creating inventory item with data:', data);
      if (!data.name) throw new Error('Item name is required');

      const cleanBusinessUnitId = resolveBusinessUnitId(data.businessUnitId);

      const payload = {
        name: data.name.trim(),
        sku: data.sku?.trim() || undefined,
        unitPrice: typeof data.unitPrice === 'number' ? data.unitPrice : 0,
        costPrice:
          typeof data.costPrice === 'number' ? data.costPrice : undefined,
        quantity: typeof data.quantity === 'number' ? data.quantity : 0,
        minStock: typeof data.minStock === 'number' ? data.minStock : 5,
        maxStock: typeof data.maxStock === 'number' ? data.maxStock : 100,
        category: data.category?.trim() || undefined,
        categoryId: data.categoryId || undefined,
        location: data.location || 'Warehouse',
        supplier: data.supplier?.trim() || undefined,
        supplierId: data.supplierId || undefined,
        notes: data.notes?.trim() || undefined,
        description: data.description?.trim() || undefined,
        barcode: data.barcode?.trim() || undefined,
        unit: data.unit || 'each',
        weight: typeof data.weight === 'number' ? data.weight : undefined,
        taxRate: typeof data.taxRate === 'number' ? data.taxRate : undefined,
        tags: data.tags || [],
        images: data.images || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
        featured: data.featured || false,
        isDigital: data.isDigital || false,
        businessUnitId: cleanBusinessUnitId || undefined,
        userId: data.userId,
      };

      const cleanedPayload = cleanObject(payload);
      const response = await api.post<any>('/inventory/items', cleanedPayload);
      console.log('✅ Inventory item created successfully');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to create inventory item:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async createInventory(data: any): Promise<any> {
    try {
      const cleanData = { ...data };
      const sanitizedBusinessUnitId = resolveBusinessUnitId(
        cleanData.businessUnitId
      );

      if (sanitizedBusinessUnitId) {
        cleanData.businessUnitId = sanitizedBusinessUnitId;
      } else {
        delete cleanData.businessUnitId;
      }

      const cleanedData = cleanObject(cleanData);
      const response = await api.post('/inventory', cleanedData);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to create inventory:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async createProductWithInventory(data: CreateItemData): Promise<any> {
    try {
      console.log('📤 Creating product with inventory:', data);

      const cleanBusinessUnitId = resolveBusinessUnitId(data.businessUnitId);

      const payload = {
        name: data.name.trim(),
        sku: data.sku?.trim() || undefined,
        unitPrice: typeof data.unitPrice === 'number' ? data.unitPrice : 0,
        costPrice:
          typeof data.costPrice === 'number' ? data.costPrice : undefined,
        stock: typeof data.quantity === 'number' ? data.quantity : 0,
        reorderPoint: typeof data.minStock === 'number' ? data.minStock : 5,
        category: data.category?.trim() || undefined,
        categoryId: data.categoryId || undefined,
        location: data.location || 'Warehouse',
        supplier: data.supplier?.trim() || undefined,
        supplierId: data.supplierId || undefined,
        description: data.description?.trim() || undefined,
        barcode: data.barcode?.trim() || undefined,
        images: data.images || [],
        weight: typeof data.weight === 'number' ? data.weight : undefined,
        taxRate: typeof data.taxRate === 'number' ? data.taxRate : undefined,
        tags: data.tags || [],
        businessUnitId: cleanBusinessUnitId || undefined,
        userId: data.userId,
      };

      const cleanedPayload = cleanObject(payload);
      const response = await api.post<any>(
        '/inventory/products',
        cleanedPayload
      );
      console.log('✅ Product with inventory created successfully');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to create product with inventory:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  // ============================================
  // UPDATE ENDPOINTS
  // ============================================

  async updateItem(id: string, data: UpdateItemData): Promise<any> {
    try {
      console.log(`📤 Updating inventory item ${id}:`, data);

      const cleanBusinessUnitId = resolveBusinessUnitId(data.businessUnitId);

      const payload: any = {};
      if (data.name !== undefined) payload.name = data.name.trim();
      if (data.sku !== undefined) payload.sku = data.sku.trim();
      if (data.unitPrice !== undefined) payload.unitPrice = data.unitPrice;
      if (data.costPrice !== undefined) payload.costPrice = data.costPrice;
      if (data.quantity !== undefined) payload.quantity = data.quantity;
      if (data.minStock !== undefined) payload.minStock = data.minStock;
      if (data.maxStock !== undefined) payload.maxStock = data.maxStock;
      if (data.category !== undefined) payload.category = data.category.trim();
      if (data.categoryId !== undefined) payload.categoryId = data.categoryId;
      if (data.location !== undefined) payload.location = data.location;
      if (data.supplier !== undefined) payload.supplier = data.supplier.trim();
      if (data.supplierId !== undefined) payload.supplierId = data.supplierId;
      if (data.notes !== undefined) payload.notes = data.notes.trim();
      if (data.description !== undefined)
        payload.description = data.description.trim();
      if (data.barcode !== undefined) payload.barcode = data.barcode.trim();
      if (data.unit !== undefined) payload.unit = data.unit;
      if (data.weight !== undefined) payload.weight = data.weight;
      if (data.taxRate !== undefined) payload.taxRate = data.taxRate;
      if (data.tags !== undefined) payload.tags = data.tags;
      if (data.images !== undefined) payload.images = data.images;
      if (data.isActive !== undefined) payload.isActive = data.isActive;
      if (data.featured !== undefined) payload.featured = data.featured;
      if (data.isDigital !== undefined) payload.isDigital = data.isDigital;
      if (data.productType !== undefined)
        payload.productType = data.productType;
      if (cleanBusinessUnitId) payload.businessUnitId = cleanBusinessUnitId;

      const cleanedPayload = cleanObject(payload);
      const response = await api.put<any>(
        `/inventory/items/${id}`,
        cleanedPayload
      );
      console.log(`✅ Inventory item ${id} updated successfully`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update inventory item ${id}:`, {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async updateInventory(id: string, data: any): Promise<any> {
    try {
      const cleanData = { ...data };
      const sanitizedBusinessUnitId = resolveBusinessUnitId(
        cleanData.businessUnitId
      );

      if (sanitizedBusinessUnitId) {
        cleanData.businessUnitId = sanitizedBusinessUnitId;
      } else {
        delete cleanData.businessUnitId;
      }

      const cleanedData = cleanObject(cleanData);
      const response = await api.put(`/inventory/${id}`, cleanedData);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update inventory ${id}:`, {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async updateProduct(id: string, data: any): Promise<any> {
    return this.updateInventory(id, data);
  },

  async updateStock(id: string, data: UpdateStockData): Promise<any> {
    try {
      const payload = {
        quantity: data.quantity,
        transactionType: data.transactionType || 'ADJUSTMENT',
        notes: data.notes,
        reference: data.reference,
      };
      const cleanedPayload = cleanObject(payload);

      const response = await api.patch<any>(
        `/inventory/items/${id}/stock`,
        cleanedPayload
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update stock for item ${id}:`, {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async bulkUpdateStock(
    updates: Array<{
      id: string;
      quantity: number;
      transactionType?: string;
      notes?: string;
    }>
  ): Promise<BulkUpdateResult> {
    try {
      console.log(`📤 Bulk updating stock for ${updates.length} items`);

      const cleanedUpdates = updates.map((update) => cleanObject(update));
      const response = await api.patch<BulkUpdateResult>(
        '/inventory/bulk/stock',
        { updates: cleanedUpdates }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to bulk update stock:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async bulkDeleteItems(ids: string[]): Promise<BulkUpdateResult> {
    try {
      console.log(`📤 Bulk deleting ${ids.length} inventory items`);

      const response = await api.delete<BulkUpdateResult>(
        '/inventory/bulk/items',
        { data: { ids } }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to bulk delete inventory items:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async bulkCreateItems(items: CreateItemData[]): Promise<BulkUpdateResult> {
    try {
      const cleanedItems = items.map((item) => {
        const cleanBusinessUnitId = resolveBusinessUnitId(
          item.businessUnitId
        );
        const cleanItem = {
          ...item,
          businessUnitId: cleanBusinessUnitId,
        };
        return cleanObject(cleanItem);
      });

      const response = await api.post<BulkUpdateResult>(
        '/inventory/bulk/items',
        { items: cleanedItems }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to bulk create inventory items:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  // ============================================
  // DELETE ENDPOINTS
  // ============================================

  async deleteInventoryItem(
    id: string,
    businessUnitId?: string
  ): Promise<{ message: string }> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;

      const response = await api.delete<{ message: string }>(
        `/inventory/items/${id}`,
        { params }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to delete inventory item ${id}:`, {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async deleteProduct(
    id: string,
    businessUnitId?: string,
    userId?: string
  ): Promise<{ message: string }> {
    return this.deleteInventoryItem(id, businessUnitId);
  },

  async deleteInventory(id: string): Promise<any> {
    try {
      const response = await api.delete(`/inventory/${id}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to delete inventory ${id}:`, {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  // ============================================
  // STOCK OPERATIONS - ISSUE, RETURN, RESTOCK
  // ============================================

  async issueItem(id: string, data: IssueItemData): Promise<any> {
    try {
      const cleanedData = cleanObject(data);
      const response = await api.post<any>(
        `/inventory/items/${id}/issue`,
        cleanedData
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to issue item ${id}:`, {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async returnItem(id: string, data: ReturnItemData): Promise<any> {
    try {
      const cleanedData = cleanObject(data);
      const response = await api.post<any>(
        `/inventory/items/${id}/return`,
        cleanedData
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to return item ${id}:`, {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async restockItem(id: string, data: RestockItemData): Promise<any> {
    try {
      const cleanedData = cleanObject(data);
      const response = await api.post<any>(
        `/inventory/items/${id}/restock`,
        cleanedData
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to restock item ${id}:`, {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  // ============================================
  // BARCODE / QR CODE OPERATIONS
  // ============================================

  async generateInventoryBarcode(
    inventoryId: string,
    businessUnitId: string
  ): Promise<{ barcode: string; barcodeUrl: string; qrCodeUrl: string }> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.post<any>(
        `/inventory/${inventoryId}/generate-barcode`,
        { businessUnitId: cleanBusinessUnitId }
      );
      return response?.data || response;
    } catch (error: any) {
      console.error(
        `❌ Failed to generate barcode for inventory item ${inventoryId}:`,
        {
          message: error?.response?.data?.message || error?.message,
          status: error?.response?.status,
          url: error?.config?.url,
        }
      );
      throw error;
    }
  },

  async generateInventoryQRCode(
    inventoryId: string,
    businessUnitId: string
  ): Promise<{ qrCodeUrl: string; qrData: any }> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.post<any>(
        `/inventory/${inventoryId}/generate-qr`,
        { businessUnitId: cleanBusinessUnitId }
      );
      return response?.data || response;
    } catch (error: any) {
      console.error(
        `❌ Failed to generate QR code for inventory item ${inventoryId}:`,
        {
          message: error?.response?.data?.message || error?.message,
          status: error?.response?.status,
          url: error?.config?.url,
        }
      );
      throw error;
    }
  },

  async bulkGenerateInventoryBarcodes(
    ids: string[],
    businessUnitId: string
  ): Promise<{ results: any[]; errors: any[] }> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.post<any>(
        '/inventory/bulk/generate-barcodes',
        { ids, businessUnitId: cleanBusinessUnitId }
      );
      return response?.data || response || { results: [], errors: [] };
    } catch (error: any) {
      console.error('❌ Failed to bulk generate inventory barcodes:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async scanInventory(barcode: string, businessUnitId: string): Promise<any> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.post<any>('/inventory/scan', {
        barcode,
        businessUnitId: cleanBusinessUnitId,
      });
      return response?.data || response;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      console.error('❌ Failed to scan inventory item:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  // ============================================
  // RESERVE / RELEASE / TRANSFER STOCK OPERATIONS
  // ============================================

  async reserveStock(
    productId: string,
    quantity: number,
    businessUnitId: string,
    variantId?: string
  ): Promise<any> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const payload = {
        productId,
        quantity,
        businessUnitId: cleanBusinessUnitId,
        variantId,
      };
      const cleanedPayload = cleanObject(payload);
      const response = await api.post<any>('/inventory/reserve', cleanedPayload);
      return response;
    } catch (error: any) {
      console.error(
        `❌ Failed to reserve stock for product ${productId}:`,
        {
          message: error?.response?.data?.message || error?.message,
          status: error?.response?.status,
          url: error?.config?.url,
        }
      );
      throw error;
    }
  },

  async releaseReservedStock(
    productId: string,
    quantity: number,
    businessUnitId: string,
    variantId?: string
  ): Promise<any> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const payload = {
        productId,
        quantity,
        businessUnitId: cleanBusinessUnitId,
        variantId,
      };
      const cleanedPayload = cleanObject(payload);
      const response = await api.post<any>('/inventory/release', cleanedPayload);
      return response;
    } catch (error: any) {
      console.error(
        `❌ Failed to release reserved stock for product ${productId}:`,
        {
          message: error?.response?.data?.message || error?.message,
          status: error?.response?.status,
          url: error?.config?.url,
        }
      );
      throw error;
    }
  },

  async transferStock(data: TransferStockData): Promise<any> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(data.businessUnitId);
      const cleanData = { ...data, businessUnitId: cleanBusinessUnitId };
      const cleanedData = cleanObject(cleanData);
      const response = await api.post<any>('/inventory/transfer', cleanedData);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to transfer stock:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  // ============================================
  // EXPORT OPERATIONS
  // ============================================

  async exportInventory(
    businessUnitId: string,
    format: ExportFormat = 'csv',
    filters?: InventorySearchFilters
  ): Promise<Blob> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const params: any = { businessUnitId: cleanBusinessUnitId, format };
      if (filters) Object.assign(params, filters);

      const cleanedParams = cleanObject(params);
      const queryString = new URLSearchParams(cleanedParams).toString();
      const response = await api.download(`/inventory/export?${queryString}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to export inventory as ${format}:`, {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async exportInventoryToFile(
    businessUnitId: string,
    format: ExportFormat = 'json'
  ): Promise<{
    filePath: string;
    fileName: string;
    format: string;
    totalRecords: number;
  }> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/export/file', {
        params: { businessUnitId: cleanBusinessUnitId, format },
      });
      return response?.data || response;
    } catch (error: any) {
      console.error('❌ Failed to export inventory to file:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  async syncInventoryFromProduct(
    productId: string,
    businessUnitId: string
  ): Promise<any> {
    try {
      const cleanBusinessUnitId = resolveBusinessUnitId(businessUnitId);
      const response = await api.post<any>('/inventory/sync/product', {
        productId,
        businessUnitId: cleanBusinessUnitId,
      });
      return response;
    } catch (error: any) {
      console.error('❌ Error syncing inventory from product:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  async syncProductFromInventory(inventoryId: string): Promise<any> {
    try {
      const response = await api.post<any>(
        `/inventory/${inventoryId}/sync/product`
      );
      return response;
    } catch (error: any) {
      console.error('❌ Error syncing product from inventory:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      throw error;
    }
  },

  // ============================================
  // LEGACY / BACKWARD COMPATIBILITY
  // ============================================

  async getSummary(businessUnitId: string): Promise<InventorySummary> {
    return this.getInventorySummary(businessUnitId);
  },

  async getValue(businessUnitId: string): Promise<InventoryValue> {
    return this.getInventoryValue(businessUnitId);
  },

  async getLowStock(businessUnitId: string): Promise<any[]> {
    return this.getLowStockItems(businessUnitId);
  },

  async getOutOfStock(businessUnitId: string): Promise<any[]> {
    return this.getOutOfStockItems(businessUnitId);
  },

  // ============================================
  // UTILITY METHODS
  // ============================================

  getStockStatus(item: Inventory): string {
    if (!item) return 'unknown';
    const available = item.available || 0;
    const reorderPoint = item.reorderPoint || 5;

    if (available <= 0) return 'out_of_stock';
    if (available <= reorderPoint) return 'low_stock';
    return 'in_stock';
  },

  getStockBadgeColor(status: string): string {
    switch (status) {
      case 'out_of_stock':
        return 'danger';
      case 'low_stock':
        return 'warning';
      case 'in_stock':
        return 'success';
      default:
        return 'secondary';
    }
  },

  isLowStock(item: Inventory): boolean {
    if (!item) return false;
    const available = item.available || 0;
    const reorderPoint = item.reorderPoint || 5;
    return available > 0 && available <= reorderPoint;
  },

  isOutOfStock(item: Inventory): boolean {
    if (!item) return false;
    return (item.available || 0) <= 0;
  },

  getStockPercentage(item: Inventory): number {
    if (!item) return 0;
    const maxStock = typeof item.maxStock === 'number' ? item.maxStock : 100;
    const available = typeof item.available === 'number' ? item.available : 0;
    return Math.min(100, (available / maxStock) * 100);
  },
};

export default inventoryService;

// ===== END PART 2 of 2 — FILE COMPLETE =====
