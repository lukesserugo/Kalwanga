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
  createdAt: string;
  updatedAt: string;
  status?: string;
  businessUnitId?: string;
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
  createdAt: string;
  updatedAt: string;
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
 * This ensures that when inventory items are passed to ProductCard,
 * the product ID is accessible at the top level.
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
        // Also ensure other product fields are available at top level
        name: item.name || item.product.name,
        unitPrice: item.unitPrice || item.product.unitPrice,
        images: item.images || item.product.images || [],
        isActive: item.isActive !== undefined ? item.isActive : item.product?.isActive,
        sku: item.sku || item.product.sku,
        description: item.description || item.product.description,
        category: item.category || item.product.category,
        categoryId: item.categoryId || item.product.categoryId,
        supplier: item.supplier || item.product.supplier,
        supplierId: item.supplierId || item.product.supplierId,
        minStock: item.minStock || item.product.minStock,
        maxStock: item.maxStock || item.product.maxStock,
        featured: item.featured || item.product.featured,
        isDigital: item.isDigital || item.product.isDigital,
        tags: item.tags || item.product.tags || [],
        attributes: item.attributes || item.product.attributes || {},
        notes: item.notes || item.product.notes,
        taxRate: item.taxRate || item.product.taxRate,
        weight: item.weight || item.product.weight,
        costPrice: item.costPrice || item.product.costPrice,
        // Keep the original product reference for backward compatibility
        _product: item.product,
        // Ensure productId is set
        productId: item.product.id,
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
  
  return item;
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

  async getCategorySummary(businessUnitId: string): Promise<Array<{ id: string; name: string; categoryId?: string; count: number; value: number }>> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;
      
      console.log('📤 Fetching category summary with params:', params);
      
      const response = await api.get<any>('/categories', { 
        params: { 
          ...params,
          limit: 100,
          isActive: true,
          includeProducts: true
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
      
      const summaryData = categories.map((cat: any) => {
        let productCount = 0;
        let totalValue = 0;
        
        if (cat.productCount !== undefined) {
          productCount = cat.productCount;
        } else if (cat._count?.products !== undefined) {
          productCount = cat._count.products;
        } else if (cat.products && Array.isArray(cat.products)) {
          productCount = cat.products.length;
          cat.products.forEach((product: any) => {
            const price = product.unitPrice || product.price || 0;
            totalValue += price;
          });
        }
        
        return {
          id: cat.id || cat.categoryId || cat.category,
          name: cat.name || cat.category || 'Uncategorized',
          categoryId: cat.id || cat.categoryId || null,
          count: productCount || 0,
          value: totalValue || 0,
        };
      });
      
      console.log(`📥 Category summary: ${summaryData.length} categories`);
      return summaryData;
      
    } catch (error) {
      console.error('❌ Failed to get category summary:', error);
      return [];
    }
  },

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
   * ✅ FIX: Get inventory list with stats
   * Backend returns: { inventory, total, page, limit, totalPages, stats, appliedFilters }
   * Normalizes product IDs to ensure they're accessible at top level
   */
  async getInventory(params?: GetInventoryParams): Promise<InventoryListResponse> {
    try {
      const cleanParams = { ...params };
      
      // Map frontend sort fields to backend-valid fields
      if (cleanParams.sortBy) {
        if (cleanParams.sortBy === 'name' || cleanParams.sortBy === 'productName') {
          cleanParams.sortByProductName = 'true';
        }
      }
      
      // Sanitize business unit ID
      const sanitizedBusinessUnitId = sanitizeBusinessUnitId(cleanParams.businessUnitId);
      if (sanitizedBusinessUnitId) {
        cleanParams.businessUnitId = sanitizedBusinessUnitId;
      } else {
        delete cleanParams.businessUnitId;
      }
      
      // Remove undefined values
      const cleanedParams = cleanObject(cleanParams);
      
      console.log('📤 Fetching inventory with params:', cleanedParams);
      
      const response = await api.get<any>('/inventory', { params: cleanedParams });
      
      // ✅ FIX: Normalize inventory items to ensure product IDs are accessible
      if (response && response.inventory && Array.isArray(response.inventory)) {
        response.inventory = response.inventory.map(normalizeInventoryItem);
      }
      
      // Also normalize items if they exist in a different format
      if (response && response.items && Array.isArray(response.items)) {
        response.items = response.items.map(normalizeInventoryItem);
      }
      
      return response;
    } catch (error) {
      console.error('❌ Failed to get inventory:', error);
      throw error;
    }
  },

  /**
   * ✅ FIX: Get inventory items with pagination
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
      
      // ✅ FIX: Normalize items to ensure product IDs are accessible
      if (response && response.items && Array.isArray(response.items)) {
        response.items = response.items.map(normalizeInventoryItem);
      }
      
      return response;
    } catch (error) {
      console.error('❌ Failed to get inventory items:', error);
      throw error;
    }
  },

  async getAllInventory(businessUnitId: string): Promise<{ items: any[]; stats: InventoryStats }> {
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
      
      // ✅ FIX: Normalize items to ensure product IDs are accessible
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
          // Ensure inventory array exists for stock status
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

  async getInventoryItemById(id: string, businessUnitId?: string): Promise<any> {
    try {
      const cleanBusinessUnitId = sanitizeBusinessUnitId(businessUnitId);
      const params: any = {};
      if (cleanBusinessUnitId) params.businessUnitId = cleanBusinessUnitId;
      
      const response = await api.get<any>(`/inventory/${id}`, { params });
      
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
    } catch (error) {
      console.error('❌ Failed to get inventory item by ID:', error);
      throw error;
    }
  },

  async getInventoryItem(id: string): Promise<any> {
    try {
      const response = await api.get(`/inventory/${id}`);
      return response ? normalizeInventoryItem(response) : response;
    } catch (error) {
      console.error(`❌ Failed to get inventory item ${id}:`, error);
      throw error;
    }
  },

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

  async deleteProduct(id: string, businessUnitId?: string, userId?: string): Promise<{ message: string }> {
    return this.deleteInventoryItem(id, businessUnitId);
  },

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

  // ============================================
  // RESERVE / RELEASE STOCK OPERATIONS
  // ============================================

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
};

export default inventoryService;
