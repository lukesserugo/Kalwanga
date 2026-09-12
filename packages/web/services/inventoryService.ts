// D:\Projects\Kalwanga\packages\web\services\inventoryService.ts

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
  // ✅ UPDATED: Added new fields
  images: string[];
  description: string | null;
  weight: number;
  taxRate: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  status?: string;
  businessUnitId?: string;
  // ✅ FIX: Added missing fields for stock calculations and compatibility
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
  // ✅ UPDATED: Added new fields
  images: string[];
  description: string | null;
  weight: number;
  taxRate: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  // ✅ FIX: Added missing fields
  maxStock?: number;
  minStock?: number;
  stock?: number;
  price?: number;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  reorderQuantity?: number;
}

// ✅ FIX: This matches what getInventoryItems actually returns from backend
export interface InventoryItemsResponse {
  items: InventoryItemResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ✅ FIX: This matches what getInventory actually returns from backend
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
  if (businessUnitId === 'default' || 
      businessUnitId === 'default-business-unit' ||
      businessUnitId === 'undefined' ||
      businessUnitId === 'null' ||
      businessUnitId === '') {
    return undefined;
  }
  return businessUnitId;
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
 * ✅ FIX: Normalize inventory item to ensure product ID is available at top level
 * ✅ UPDATED: Now properly handles images, description, weight, taxRate, tags
 * ✅ UNIFIED: Matches backend normalization exactly
 */
function normalizeInventoryItem(item: any): any {
  if (!item) return item;
  
  // If item has a product object with an id, ensure top-level id exists
  if (item.product && item.product.id) {
    // If top-level id is missing or different, use product.id
    if (!item.id || item.id !== item.product.id) {
      return {
        ...item,
        id: item.product.id,
        // Copy product fields to top level with fallback
        name: item.name || item.product.name,
        unitPrice: item.unitPrice || item.product.unitPrice,
        // Use inventory images first, then product images
        images: (item.images && item.images.length > 0) ? item.images : (item.product.images || []),
        // Use inventory description first, then product description
        description: item.description || item.product.description,
        // Use inventory weight first, then product weight
        weight: item.weight !== undefined ? item.weight : item.product.weight,
        // Use inventory taxRate first, then product taxRate
        taxRate: item.taxRate !== undefined ? item.taxRate : item.product.taxRate,
        // Use inventory tags first, then product tags
        tags: (item.tags && item.tags.length > 0) ? item.tags : (item.product.tags || []),
        isActive: item.isActive !== undefined ? item.isActive : item.product?.isActive,
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
        // Keep the original product reference for backward compatibility
        _product: item.product,
        // Ensure productId is set
        productId: item.product.id,
        // Ensure inventory array exists for stock status
        inventory: item.inventory || [{
          quantity: item.quantity || item.product?.stock || 0,
          reserved: item.reserved || 0,
        }],
        // Ensure stock field exists for compatibility
        stock: item.quantity || item.stock || 0,
        // Ensure price field exists
        price: item.price || item.unitPrice || item.product?.unitPrice || 0,
        // Ensure available field exists
        available: item.available !== undefined ? item.available : 
          (item.quantity || 0) - (item.reserved || 0),
        // Ensure status field exists
        status: item.status || item.product?.status || 'ACTIVE',
        // Ensure businessUnitId is set
        businessUnitId: item.businessUnitId || item.product?.businessUnitId,
        // Ensure createdAt and updatedAt
        createdAt: item.createdAt || item.product?.createdAt,
        updatedAt: item.updatedAt || item.product?.updatedAt,
        // Ensure reorderQuantity exists
        reorderQuantity: item.reorderQuantity || item.product?.maxStock || 10,
      };
    }
  }
  
  // If item has an inventoryId but no top-level id
  if (!item.id && item.inventoryId) {
    return {
      ...item,
      id: item.inventoryId,
    };
  }
  
  // If item has a productId but no top-level id
  if (!item.id && item.productId) {
    return {
      ...item,
      id: item.productId,
    };
  }
  
  // Ensure inventory array exists
  if (item && !item.inventory) {
    item.inventory = [{
      quantity: item.quantity || item.stock || 0,
      reserved: item.reserved || 0,
    }];
  }
  
  // Ensure stock field exists
  if (item && item.quantity !== undefined && item.stock === undefined) {
    item.stock = item.quantity;
  }
  
  // Ensure available field exists
  if (item && item.available === undefined) {
    item.available = (item.quantity || 0) - (item.reserved || 0);
  }
  
  // Ensure images is always an array
  if (item && !item.images) {
    item.images = [];
  }
  
  // Ensure tags is always an array
  if (item && !item.tags) {
    item.tags = [];
  }
  
  // Ensure price field exists
  if (item && item.price === undefined) {
    item.price = item.unitPrice || 0;
  }
  
  // Ensure reorderQuantity exists
  if (item && item.reorderQuantity === undefined) {
    item.reorderQuantity = item.maxStock || 10;
  }
  
  // Ensure maxStock exists
  if (item && item.maxStock === undefined) {
    item.maxStock = 100;
  }
  
  // Ensure minStock exists
  if (item && item.minStock === undefined) {
    item.minStock = item.reorderPoint || 5;
  }
  
  // Ensure isActive exists
  if (item && item.isActive === undefined) {
    item.isActive = true;
  }
  
  // Ensure isDigital exists
  if (item && item.isDigital === undefined) {
    item.isDigital = false;
  }
  
  // Ensure featured exists
  if (item && item.featured === undefined) {
    item.featured = false;
  }
  
  // Ensure status exists
  if (item && item.status === undefined) {
    item.status = item.quantity === 0 ? 'out_of_stock' : 
                  item.quantity <= (item.reorderPoint || 5) ? 'low_stock' : 'ACTIVE';
  }
  
  return item;
}

/**
 * Normalize an array of inventory items
 */
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

  /**
   * Get categories for dropdown
   */
  async getCategories(businessUnitId?: string): Promise<CategoryOption[]> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;

      console.log('📤 Fetching categories with params:', params);
      
      const response = await api.get<any>('/categories', { 
        params: { 
          ...params,
          limit: 100,
          isActive: true 
        } 
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
      
    } catch (error) {
      console.error('❌ Failed to get categories:', error);
      return [];
    }
  },

  /**
   * Get category summary with counts and values
   */
  async getCategorySummary(businessUnitId: string): Promise<Array<{ id: string; name: string; categoryId?: string; count: number; value: number }>> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;
      
      console.log('📤 Fetching category summary with params:', params);
      
      const response = await api.get<any>('/inventory/category-summary', { 
        params: { 
          ...params,
          limit: 100,
          isActive: true,
        } 
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
      
    } catch (error) {
      console.error('❌ Failed to get category summary:', error);
      return [];
    }
  },

  /**
   * Get suppliers for dropdown
   */
  async getSuppliers(businessUnitId?: string): Promise<SupplierOption[]> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
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
    } catch (error) {
      console.error('❌ Failed to get suppliers:', error);
      return [];
    }
  },

  // ============================================
  // GET ENDPOINTS - READ OPERATIONS
  // ============================================

  /**
   * Get inventory list with stats
   * ✅ FIXED: Uses /inventory/items endpoint and returns proper structure
   */
  async getInventory(params?: GetInventoryParams): Promise<InventoryListResponse> {
    try {
      const cleanParams = { ...params };
      
      if (cleanParams.sortBy) {
        if (cleanParams.sortBy === 'name' || cleanParams.sortBy === 'productName') {
          cleanParams.sortByProductName = 'true';
        }
      }
      
      const sanitizedBusinessUnitId = sanitizeBusinessUnitId(cleanParams.businessUnitId);
      if (sanitizedBusinessUnitId) {
        cleanParams.businessUnitId = sanitizedBusinessUnitId;
      } else {
        delete cleanParams.businessUnitId;
      }
      
      const cleanedParams = cleanObject(cleanParams);
      
      console.log('📤 Fetching inventory with params:', cleanedParams);
      
      const response = await api.get<any>('/inventory/items', { params: cleanedParams });
      
      // Handle different response structures
      if (Array.isArray(response)) {
        return {
          inventory: response.map(normalizeInventoryItem),
          total: response.length,
          page: 1,
          limit: response.length,
          totalPages: 1,
          stats: {} as InventoryStats,
          appliedFilters: { search: null, category: null, location: null, status: null, lowStock: false },
        };
      }
      
      // If response has items but not inventory, map it
      if (response && response.items && Array.isArray(response.items) && !response.inventory) {
        response.inventory = response.items.map(normalizeInventoryItem);
      }
      
      // If response has inventory, normalize it
      if (response && response.inventory && Array.isArray(response.inventory)) {
        response.inventory = response.inventory.map(normalizeInventoryItem);
      }
      
      // If response has data but not inventory, map it
      if (response && response.data && Array.isArray(response.data) && !response.inventory) {
        response.inventory = response.data.map(normalizeInventoryItem);
      }
      
      // Ensure stats exists
      if (response && !response.stats) {
        response.stats = {} as InventoryStats;
      }
      
      // Ensure appliedFilters exists
      if (response && !response.appliedFilters) {
        response.appliedFilters = { search: null, category: null, location: null, status: null, lowStock: false };
      }
      
      return response;
    } catch (error) {
      console.error('❌ Failed to get inventory:', error);
      throw error;
    }
  },

  /**
   * Get inventory items with pagination
   * Backend returns: { items, total, page, limit, totalPages }
   * Normalizes product IDs to ensure they're accessible at top level
   */
  async getInventoryItems(params?: {
    page?: number;
    limit?: number;
    search?: string;
    businessUnitId?: string;
    withoutProduct?: boolean;
  }): Promise<InventoryItemsResponse> {
    try {
      const cleanParams = { ...params };
      const sanitizedBusinessUnitId = sanitizeBusinessUnitId(cleanParams.businessUnitId);
      
      if (sanitizedBusinessUnitId) {
        cleanParams.businessUnitId = sanitizedBusinessUnitId;
      } else {
        delete cleanParams.businessUnitId;
      }
      
      const cleanedParams = cleanObject(cleanParams);
      console.log('📤 Fetching inventory items with params:', cleanedParams);
      
      const response = await api.get<any>('/inventory/items', { params: cleanedParams });
      
      // Normalize items to ensure product IDs are accessible
      if (response && response.items && Array.isArray(response.items)) {
        response.items = response.items.map(normalizeInventoryItem);
      }
      
      return response;
    } catch (error) {
      console.error('❌ Failed to get inventory items:', error);
      throw error;
    }
  },

  /**
   * Get all inventory items with stats
   */
  async getAllInventory(businessUnitId: string): Promise<GetAllInventoryResponse> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
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
          stats = response.stats || {} as InventoryStats;
        } else if (response.data && Array.isArray(response.data)) {
          items = response.data;
          stats = response.stats || {} as InventoryStats;
        } else if (response.success && response.data && Array.isArray(response.data)) {
          items = response.data;
          stats = response.stats || {} as InventoryStats;
        } else if (Array.isArray(response)) {
          items = response;
        }
      }
      
      // Normalize items to ensure product IDs are accessible
      const normalizedItems = items.map((item: any) => {
        const normalized = normalizeInventoryItem(item);
        return {
          ...normalized,
          name: normalized.name || normalized.product?.name || 'Unknown Product',
          sku: normalized.sku || normalized.product?.sku || 'N/A',
          quantity: normalized.quantity || normalized.stock || 0,
          price: normalized.price || normalized.unitPrice || normalized.product?.unitPrice || 0,
          stock: normalized.stock || normalized.quantity || 0,
          productId: normalized.productId || normalized.product?.id || normalized.id,
          images: normalized.images || [],
          description: normalized.description || null,
          weight: normalized.weight || 0,
          taxRate: normalized.taxRate || 0,
          tags: normalized.tags || [],
          inventory: normalized.inventory || [{
            quantity: normalized.quantity || 0,
            reserved: normalized.reserved || 0,
          }],
        };
      });
      
      console.log(`✅ getAllInventory returning ${normalizedItems.length} items`);
      return { items: normalizedItems, stats };
    } catch (error) {
      console.error('❌ Failed to get all inventory:', error);
      return { items: [], stats: {} as InventoryStats };
    }
  },

  /**
   * Get inventory by product ID
   */
  async getInventoryByProduct(productId: string, businessUnitId: string, variantId?: string): Promise<any> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;
      if (variantId) params.variantId = variantId;
      
      const response = await api.get<any>(`/inventory/product/${productId}`, { params });
      return response ? normalizeInventoryItem(response) : response;
    } catch (error) {
      console.error('❌ Failed to get inventory by product:', error);
      throw error;
    }
  },

  /**
   * Get inventory by barcode
   */
  async getInventoryByBarcode(barcode: string, businessUnitId?: string): Promise<any> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;
      
      const response = await api.get<any>(`/inventory/barcode/${barcode}`, { params });
      return response ? normalizeInventoryItem(response) : response;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      console.error(`❌ Failed to get inventory by barcode ${barcode}:`, error);
      throw error;
    }
  },

  /**
   * Get inventory by SKU
   */
  async getInventoryBySku(sku: string, businessUnitId?: string): Promise<any> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;
      
      const response = await api.get<any>(`/inventory/sku/${sku}`, { params });
      return response ? normalizeInventoryItem(response) : response;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      console.error(`❌ Failed to get inventory by SKU ${sku}:`, error);
      throw error;
    }
  },

  /**
   * Get inventory item by ID
   */
  async getInventoryItemById(id: string, businessUnitId?: string): Promise<any> {
    try {
      if (!id) {
        throw new Error('Inventory ID is required');
      }
      
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
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
      console.error('❌ Failed to get inventory item by ID:', error);
      throw error;
    }
  },

  /**
   * Get inventory item (legacy)
   */
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
      console.error(`❌ Failed to get inventory item ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get low stock items
   */
  async getLowStockItems(businessUnitId: string): Promise<any[]> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/low-stock', { params: { businessUnitId: cleanBusinessUnitId } });
      const data = response?.data || response || [];
      return Array.isArray(data) ? data.map(normalizeInventoryItem) : [];
    } catch (error) {
      console.error('❌ Failed to get low stock items:', error);
      throw error;
    }
  },

  /**
   * Get out of stock items
   */
  async getOutOfStockItems(businessUnitId: string): Promise<any[]> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/out-of-stock', { params: { businessUnitId: cleanBusinessUnitId } });
      const data = response?.data || response || [];
      return Array.isArray(data) ? data.map(normalizeInventoryItem) : [];
    } catch (error) {
      console.error('❌ Failed to get out of stock items:', error);
      throw error;
    }
  },

  /**
   * Get inventory value
   */
  async getInventoryValue(businessUnitId: string): Promise<InventoryValue> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/value', { params: { businessUnitId: cleanBusinessUnitId } });
      return response?.data || response;
    } catch (error) {
      console.error('❌ Failed to get inventory value:', error);
      throw error;
    }
  },

  /**
   * Get inventory transactions
   */
  async getInventoryTransactions(params?: InventoryTransactionParams): Promise<PaginatedResponse<InventoryTransaction>> {
    try {
      const cleanParams = { ...params };
      const sanitizedBusinessUnitId = sanitizeBusinessUnitId(cleanParams.businessUnitId);
      
      if (sanitizedBusinessUnitId) {
        cleanParams.businessUnitId = sanitizedBusinessUnitId;
      } else {
        delete cleanParams.businessUnitId;
      }
      
      const cleanedParams = cleanObject(cleanParams);
      const response = await api.get<PaginatedResponse<InventoryTransaction>>('/inventory/transactions', { params: cleanedParams });
      return response;
    } catch (error) {
      console.error('❌ Failed to get inventory transactions:', error);
      throw error;
    }
  },

  /**
   * Get inventory by location
   */
  async getInventoryByLocation(location: string, businessUnitId: string): Promise<any[]> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.get<any>(`/inventory/location/${location}`, { params: { businessUnitId: cleanBusinessUnitId } });
      const data = response?.data || response || [];
      return Array.isArray(data) ? data.map(normalizeInventoryItem) : [];
    } catch (error) {
      console.error('❌ Failed to get inventory by location:', error);
      throw error;
    }
  },

  /**
   * Get inventory by category
   */
  async getInventoryByCategory(category: string, businessUnitId: string): Promise<any[]> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.get<any>(`/inventory/category/${category}`, { params: { businessUnitId: cleanBusinessUnitId } });
      const data = response?.data || response || [];
      return Array.isArray(data) ? data.map(normalizeInventoryItem) : [];
    } catch (error) {
      console.error('❌ Failed to get inventory by category:', error);
      throw error;
    }
  },

  /**
   * Search inventory
   */
  async searchInventory(query: string, businessUnitId: string, filters?: InventorySearchFilters): Promise<any[]> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const params: any = { query, businessUnitId: cleanBusinessUnitId };
      if (filters) Object.assign(params, filters);
      
      const cleanedParams = cleanObject(params);
      const response = await api.get<any>('/inventory/search', { params: cleanedParams });
      const data = response?.data || response || [];
      return Array.isArray(data) ? data.map(normalizeInventoryItem) : [];
    } catch (error) {
      console.error('❌ Failed to search inventory:', error);
      throw error;
    }
  },

  /**
   * Search products
   */
  async searchProducts(params: {
    query: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    businessUnitId: string;
  }): Promise<any[]> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(params.businessUnitId);
      const cleanParams = { ...params, businessUnitId: cleanBusinessUnitId };
      const cleanedParams = cleanObject(cleanParams);
      const response = await api.get<any>('/inventory/search', { params: cleanedParams });
      const data = response?.data || response || [];
      return Array.isArray(data) ? data.map(normalizeInventoryItem) : [];
    } catch (error) {
      console.error('❌ Failed to search products:', error);
      return [];
    }
  },

  /**
   * Get inventory summary
   */
  async getInventorySummary(businessUnitId: string): Promise<InventorySummary> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;
      
      const response = await api.get<any>('/inventory/summary', { params });
      return response?.data || response;
    } catch (error) {
      console.error('❌ Failed to get inventory summary:', error);
      throw error;
    }
  },

  /**
   * Get total items count
   */
  async getTotalItems(businessUnitId: string): Promise<number> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/total', { params: { businessUnitId: cleanBusinessUnitId } });
      return response?.data || response || 0;
    } catch (error) {
      console.error('❌ Failed to get total items:', error);
      throw error;
    }
  },

  /**
   * Get stock movements
   */
  async getStockMovements(params: InventoryMovementParams): Promise<InventoryTransaction[]> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(params.businessUnitId);
      const cleanParams = { ...params, businessUnitId: cleanBusinessUnitId };
      const cleanedParams = cleanObject(cleanParams);
      
      const response = await api.get<any>('/inventory/movements', { params: cleanedParams });
      return response?.data || response || [];
    } catch (error) {
      console.error('❌ Failed to get stock movements:', error);
      throw error;
    }
  },

  /**
   * Get inventory stats
   */
  async getInventoryStats(businessUnitId: string): Promise<InventoryStats> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/stats', { params: { businessUnitId: cleanBusinessUnitId } });
      return response?.data || response;
    } catch (error) {
      console.error('❌ Failed to get inventory stats:', error);
      throw error;
    }
  },

  /**
   * Get inventory report
   */
  async getInventoryReport(businessUnitId: string, params?: {
    includeInactive?: boolean;
    categoryId?: string;
    location?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<any> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/report', { 
        params: { businessUnitId: cleanBusinessUnitId, ...params } 
      });
      return response?.data || response;
    } catch (error) {
      console.error('❌ Failed to get inventory report:', error);
      throw error;
    }
  },

  // ============================================
  // CREATE ENDPOINTS
  // ============================================

  /**
   * Create inventory item
   */
  async createItem(data: CreateItemData): Promise<any> {
    try {
      console.log('📤 Creating inventory item with data:', data);
      if (!data.name) throw new Error('Item name is required');
      
      const cleanBusinessUnitId = sanitizeBusinessUnitId(data.businessUnitId);
      
      const payload = {
        name: data.name.trim(),
        sku: data.sku?.trim() || undefined,
        unitPrice: typeof data.unitPrice === 'number' ? data.unitPrice : 0,
        costPrice: typeof data.costPrice === 'number' ? data.costPrice : undefined,
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
    } catch (error) {
      console.error('❌ Failed to create inventory item:', error);
      throw error;
    }
  },

  /**
   * Create inventory (legacy)
   */
  async createInventory(data: any): Promise<any> {
    try {
      const cleanData = { ...data };
      const sanitizedBusinessUnitId = sanitizeBusinessUnitId(cleanData.businessUnitId);
      
      if (sanitizedBusinessUnitId) {
        cleanData.businessUnitId = sanitizedBusinessUnitId;
      } else {
        delete cleanData.businessUnitId;
      }
      
      const cleanedData = cleanObject(cleanData);
      const response = await api.post('/inventory', cleanedData);
      return response;
    } catch (error) {
      console.error('❌ Failed to create inventory:', error);
      throw error;
    }
  },

  /**
   * Create product with inventory
   */
  async createProductWithInventory(data: CreateItemData): Promise<any> {
    try {
      console.log('📤 Creating product with inventory:', data);
      
      const cleanBusinessUnitId = sanitizeBusinessUnitId(data.businessUnitId);
      
      const payload = {
        name: data.name.trim(),
        sku: data.sku?.trim() || undefined,
        unitPrice: typeof data.unitPrice === 'number' ? data.unitPrice : 0,
        costPrice: typeof data.costPrice === 'number' ? data.costPrice : undefined,
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
      const response = await api.post<any>('/inventory/products', cleanedPayload);
      console.log('✅ Product with inventory created successfully');
      return response;
    } catch (error) {
      console.error('❌ Failed to create product with inventory:', error);
      throw error;
    }
  },

  // ============================================
  // UPDATE ENDPOINTS
  // ============================================

  /**
   * Update inventory item
   */
  async updateItem(id: string, data: UpdateItemData): Promise<any> {
    try {
      console.log(`📤 Updating inventory item ${id}:`, data);
      
      const cleanBusinessUnitId = sanitizeBusinessUnitId(data.businessUnitId);
      
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
      if (data.description !== undefined) payload.description = data.description.trim();
      if (data.barcode !== undefined) payload.barcode = data.barcode.trim();
      if (data.unit !== undefined) payload.unit = data.unit;
      if (data.weight !== undefined) payload.weight = data.weight;
      if (data.taxRate !== undefined) payload.taxRate = data.taxRate;
      if (data.tags !== undefined) payload.tags = data.tags;
      if (data.images !== undefined) payload.images = data.images;
      if (data.isActive !== undefined) payload.isActive = data.isActive;
      if (data.featured !== undefined) payload.featured = data.featured;
      if (data.isDigital !== undefined) payload.isDigital = data.isDigital;
      if (data.productType !== undefined) payload.productType = data.productType;
      if (cleanBusinessUnitId) payload.businessUnitId = cleanBusinessUnitId;
      
      const cleanedPayload = cleanObject(payload);
      const response = await api.put<any>(`/inventory/items/${id}`, cleanedPayload);
      console.log(`✅ Inventory item ${id} updated successfully`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to update inventory item ${id}:`, error);
      throw error;
    }
  },

  /**
   * Update inventory (legacy)
   */
  async updateInventory(id: string, data: any): Promise<any> {
    try {
      const cleanData = { ...data };
      const sanitizedBusinessUnitId = sanitizeBusinessUnitId(cleanData.businessUnitId);
      
      if (sanitizedBusinessUnitId) {
        cleanData.businessUnitId = sanitizedBusinessUnitId;
      } else {
        delete cleanData.businessUnitId;
      }
      
      const cleanedData = cleanObject(cleanData);
      const response = await api.put(`/inventory/${id}`, cleanedData);
      return response;
    } catch (error) {
      console.error(`❌ Failed to update inventory ${id}:`, error);
      throw error;
    }
  },

  /**
   * Update product (alias for updateInventory)
   */
  async updateProduct(id: string, data: any): Promise<any> {
    return this.updateInventory(id, data);
  },

  /**
   * Update stock for an item
   */
  async updateStock(id: string, data: UpdateStockData): Promise<any> {
    try {
      const payload = {
        quantity: data.quantity,
        transactionType: data.transactionType || 'ADJUSTMENT',
        notes: data.notes,
        reference: data.reference,
      };
      const cleanedPayload = cleanObject(payload);
      
      const response = await api.patch<any>(`/inventory/items/${id}/stock`, cleanedPayload);
      return response;
    } catch (error) {
      console.error(`❌ Failed to update stock for item ${id}:`, error);
      throw error;
    }
  },

  // ============================================
  // DELETE ENDPOINTS
  // ============================================

  /**
   * Bulk update stock
   */
  async bulkUpdateStock(updates: Array<{ id: string; quantity: number; transactionType?: string; notes?: string }>): Promise<BulkUpdateResult> {
    try {
      console.log(`📤 Bulk updating stock for ${updates.length} items`);
      
      const cleanedUpdates = updates.map(update => cleanObject(update));
      const response = await api.patch<BulkUpdateResult>('/inventory/bulk/stock', { updates: cleanedUpdates });
      return response;
    } catch (error) {
      console.error('❌ Failed to bulk update stock:', error);
      throw error;
    }
  },

  /**
   * Bulk delete items
   */
  async bulkDeleteItems(ids: string[]): Promise<BulkUpdateResult> {
    try {
      console.log(`📤 Bulk deleting ${ids.length} inventory items`);
      
      const response = await api.delete<BulkUpdateResult>('/inventory/bulk/items', { data: { ids } });
      return response;
    } catch (error) {
      console.error('❌ Failed to bulk delete inventory items:', error);
      throw error;
    }
  },

  /**
   * Delete inventory item
   */
  async deleteInventoryItem(id: string, businessUnitId?: string): Promise<{ message: string }> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;
      
      const response = await api.delete<{ message: string }>(`/inventory/items/${id}`, { params });
      return response;
    } catch (error) {
      console.error(`❌ Failed to delete inventory item ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete product (alias for deleteInventoryItem)
   */
  async deleteProduct(id: string, businessUnitId?: string, userId?: string): Promise<{ message: string }> {
    return this.deleteInventoryItem(id, businessUnitId);
  },

  /**
   * Delete inventory (legacy)
   */
  async deleteInventory(id: string): Promise<any> {
    try {
      const response = await api.delete(`/inventory/${id}`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to delete inventory ${id}:`, error);
      throw error;
    }
  },

  // ============================================
  // STOCK OPERATIONS - ISSUE, RETURN, RESTOCK
  // ============================================

  /**
   * Issue item
   */
  async issueItem(id: string, data: IssueItemData): Promise<any> {
    try {
      const cleanedData = cleanObject(data);
      const response = await api.post<any>(`/inventory/items/${id}/issue`, cleanedData);
      return response;
    } catch (error) {
      console.error(`❌ Failed to issue item ${id}:`, error);
      throw error;
    }
  },

  /**
   * Return item
   */
  async returnItem(id: string, data: ReturnItemData): Promise<any> {
    try {
      const cleanedData = cleanObject(data);
      const response = await api.post<any>(`/inventory/items/${id}/return`, cleanedData);
      return response;
    } catch (error) {
      console.error(`❌ Failed to return item ${id}:`, error);
      throw error;
    }
  },

  /**
   * Restock item
   */
  async restockItem(id: string, data: RestockItemData): Promise<any> {
    try {
      const cleanedData = cleanObject(data);
      const response = await api.post<any>(`/inventory/items/${id}/restock`, cleanedData);
      return response;
    } catch (error) {
      console.error(`❌ Failed to restock item ${id}:`, error);
      throw error;
    }
  },

  // ============================================
  // BARCODE / QR CODE OPERATIONS
  // ============================================

  /**
   * Generate barcode for inventory item
   */
  async generateInventoryBarcode(inventoryId: string, businessUnitId: string): Promise<{
    barcode: string;
    barcodeUrl: string;
    qrCodeUrl: string;
  }> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.post<any>(`/inventory/${inventoryId}/generate-barcode`, { 
        businessUnitId: cleanBusinessUnitId 
      });
      return response?.data || response;
    } catch (error) {
      console.error(`❌ Failed to generate barcode for inventory item ${inventoryId}:`, error);
      throw error;
    }
  },

  /**
   * Generate QR code for inventory item
   */
  async generateInventoryQRCode(inventoryId: string, businessUnitId: string): Promise<{
    qrCodeUrl: string;
    qrData: any;
  }> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.post<any>(`/inventory/${inventoryId}/generate-qr`, { 
        businessUnitId: cleanBusinessUnitId 
      });
      return response?.data || response;
    } catch (error) {
      console.error(`❌ Failed to generate QR code for inventory item ${inventoryId}:`, error);
      throw error;
    }
  },

  /**
   * Bulk generate barcodes
   */
  async bulkGenerateInventoryBarcodes(ids: string[], businessUnitId: string): Promise<{ results: any[]; errors: any[] }> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.post<any>('/inventory/bulk/generate-barcodes', { 
        ids, 
        businessUnitId: cleanBusinessUnitId 
      });
      return response?.data || response || { results: [], errors: [] };
    } catch (error) {
      console.error('❌ Failed to bulk generate inventory barcodes:', error);
      throw error;
    }
  },

  /**
   * Scan inventory item
   */
  async scanInventory(barcode: string, businessUnitId: string): Promise<any> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.post<any>('/inventory/scan', { 
        barcode, 
        businessUnitId: cleanBusinessUnitId 
      });
      return response?.data || response;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      console.error(`❌ Failed to scan inventory item:`, error);
      throw error;
    }
  },

  // ============================================
  // RESERVE / RELEASE STOCK OPERATIONS
  // ============================================

  /**
   * Reserve stock
   */
  async reserveStock(productId: string, quantity: number, businessUnitId: string, variantId?: string): Promise<any> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const payload = { productId, quantity, businessUnitId: cleanBusinessUnitId, variantId };
      const cleanedPayload = cleanObject(payload);
      const response = await api.post<any>('/inventory/reserve', cleanedPayload);
      return response;
    } catch (error) {
      console.error(`❌ Failed to reserve stock for product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Release reserved stock
   */
  async releaseReservedStock(productId: string, quantity: number, businessUnitId: string, variantId?: string): Promise<any> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const payload = { productId, quantity, businessUnitId: cleanBusinessUnitId, variantId };
      const cleanedPayload = cleanObject(payload);
      const response = await api.post<any>('/inventory/release', cleanedPayload);
      return response;
    } catch (error) {
      console.error(`❌ Failed to release reserved stock for product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Transfer stock
   */
  async transferStock(data: TransferStockData): Promise<any> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(data.businessUnitId);
      const cleanData = { ...data, businessUnitId: cleanBusinessUnitId };
      const cleanedData = cleanObject(cleanData);
      const response = await api.post<any>('/inventory/transfer', cleanedData);
      return response;
    } catch (error) {
      console.error('❌ Failed to transfer stock:', error);
      throw error;
    }
  },

  // ============================================
  // BULK OPERATIONS
  // ============================================

  /**
   * Bulk create items
   */
  async bulkCreateItems(items: CreateItemData[]): Promise<BulkUpdateResult> {
    try {
      const cleanedItems = items.map(item => {
        const cleanBusinessUnitId = sanitizeBusinessUnitId(item.businessUnitId);
        const cleanItem = { ...item, businessUnitId: cleanBusinessUnitId };
        return cleanObject(cleanItem);
      });
      
      const response = await api.post<BulkUpdateResult>('/inventory/bulk/items', { items: cleanedItems });
      return response;
    } catch (error) {
      console.error('❌ Failed to bulk create inventory items:', error);
      throw error;
    }
  },

  // ============================================
  // EXPORT OPERATIONS
  // ============================================

  /**
   * Export inventory as blob
   */
  async exportInventory(businessUnitId: string, format: ExportFormat = 'csv', filters?: InventorySearchFilters): Promise<Blob> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const params: any = { businessUnitId: cleanBusinessUnitId, format };
      if (filters) Object.assign(params, filters);
      
      const cleanedParams = cleanObject(params);
      const queryString = new URLSearchParams(cleanedParams).toString();
      const response = await api.download(`/inventory/export?${queryString}`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to export inventory as ${format}:`, error);
      throw error;
    }
  },

  /**
   * Export inventory to file
   */
  async exportInventoryToFile(businessUnitId: string, format: ExportFormat = 'json'): Promise<{ filePath: string; fileName: string; format: string; totalRecords: number }> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.get<any>('/inventory/export/file', {
        params: { businessUnitId: cleanBusinessUnitId, format }
      });
      return response?.data || response;
    } catch (error) {
      console.error(`❌ Failed to export inventory to file:`, error);
      throw error;
    }
  },

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  /**
   * Sync inventory from product
   */
  async syncInventoryFromProduct(productId: string, businessUnitId: string): Promise<any> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const response = await api.post<any>('/inventory/sync/product', {
        productId,
        businessUnitId: cleanBusinessUnitId,
      });
      return response;
    } catch (error) {
      console.error('❌ Error syncing inventory from product:', error);
      throw error;
    }
  },

  /**
   * Sync product from inventory
   */
  async syncProductFromInventory(inventoryId: string): Promise<any> {
    try {
      const response = await api.post<any>(`/inventory/${inventoryId}/sync/product`);
      return response;
    } catch (error) {
      console.error('❌ Error syncing product from inventory:', error);
      throw error;
    }
  },

  // ============================================
  // LEGACY / BACKWARD COMPATIBILITY
  // ============================================

  /**
   * Get summary (legacy)
   */
  async getSummary(businessUnitId: string): Promise<InventorySummary> {
    return this.getInventorySummary(businessUnitId);
  },

  /**
   * Get value (legacy)
   */
  async getValue(businessUnitId: string): Promise<InventoryValue> {
    return this.getInventoryValue(businessUnitId);
  },

  /**
   * Get low stock (legacy)
   */
  async getLowStock(businessUnitId: string): Promise<any[]> {
    return this.getLowStockItems(businessUnitId);
  },

  /**
   * Get out of stock (legacy)
   */
  async getOutOfStock(businessUnitId: string): Promise<any[]> {
    return this.getOutOfStockItems(businessUnitId);
  },

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get stock level status for an item
   */
  getStockStatus(item: Inventory): string {
    if (!item) return 'unknown';
    const available = item.available || 0;
    const reorderPoint = item.reorderPoint || 5;
    
    if (available <= 0) return 'out_of_stock';
    if (available <= reorderPoint) return 'low_stock';
    return 'in_stock';
  },

  /**
   * Get stock level badge color
   */
  getStockBadgeColor(status: string): string {
    switch (status) {
      case 'out_of_stock': return 'danger';
      case 'low_stock': return 'warning';
      case 'in_stock': return 'success';
      default: return 'secondary';
    }
  },

  /**
   * Check if item is low stock
   */
  isLowStock(item: Inventory): boolean {
    if (!item) return false;
    const available = item.available || 0;
    const reorderPoint = item.reorderPoint || 5;
    return available > 0 && available <= reorderPoint;
  },

  /**
   * Check if item is out of stock
   */
  isOutOfStock(item: Inventory): boolean {
    if (!item) return false;
    return (item.available || 0) <= 0;
  },

  /**
   * Calculate stock percentage
   * ✅ FIXED: Uses maxStock with fallback
   */
  getStockPercentage(item: Inventory): number {
    if (!item) return 0;
    // ✅ FIXED: Use maxStock or fallback to 100
    const maxStock = typeof item.maxStock === 'number' ? item.maxStock : 100;
    const available = typeof item.available === 'number' ? item.available : 0;
    // Ensure we don't exceed 100%
    return Math.min(100, (available / maxStock) * 100);
  },
};

export default inventoryService;
