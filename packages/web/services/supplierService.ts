// D:\Projects\Kalwanga\packages\web\services\supplierService.ts
import { api } from './api';
import { 
  Supplier, 
  SupplierContact, 
  SupplierProduct,
  SupplierPayment,
  SupplierRating,
  SupplierStatistics,
  SupplierPerformance,
  SupplierOrderHistory,
  SupplierSearchParams,
  SupplierFilterOptions,
  SupplierResponse,
  BulkSupplierOperationResult,
  SupplierImportData,
  SupplierExportOptions,
  PurchaseOrder,
  SupplierSummary
} from '../types/supplier';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// Helper function to extract data from API response
const extractData = <T>(response: any): T => {
  if (response && typeof response === 'object') {
    if ('data' in response) {
      return response.data as T;
    }
    return response as T;
  }
  throw new Error('Invalid response format');
};

// Helper function to extract array data from API response
const extractArrayData = <T>(response: any): T[] => {
  if (response && typeof response === 'object') {
    if ('data' in response && Array.isArray(response.data)) {
      return response.data as T[];
    }
    if (Array.isArray(response)) {
      return response as T[];
    }
    if ('data' in response && response.data && typeof response.data === 'object' && 'data' in response.data) {
      return response.data.data as T[];
    }
  }
  return [];
};

// Helper function to extract paginated response
const extractPaginatedResponse = <T>(response: any, defaultParams?: { page?: number; limit?: number }): PaginatedResponse<T> => {
  if (response && typeof response === 'object') {
    // Check for standard paginated response with data and total
    if ('data' in response && 'total' in response) {
      const data = Array.isArray(response.data) ? response.data : [];
      const total = typeof response.total === 'number' ? response.total : data.length;
      
      return {
        data,
        total,
        page: typeof response.page === 'number' ? response.page : defaultParams?.page || 1,
        totalPages: typeof response.totalPages === 'number' ? response.totalPages : Math.ceil(total / (defaultParams?.limit || 10)) || 1,
        limit: typeof response.limit === 'number' ? response.limit : defaultParams?.limit || 10,
      };
    }
    
    // If response has data property with array
    if ('data' in response && Array.isArray(response.data)) {
      const data = response.data;
      return {
        data,
        total: data.length,
        page: defaultParams?.page || 1,
        totalPages: 1,
        limit: defaultParams?.limit || data.length || 10,
      };
    }
    
    // If response itself is an array
    if (Array.isArray(response)) {
      return {
        data: response,
        total: response.length,
        page: defaultParams?.page || 1,
        totalPages: 1,
        limit: defaultParams?.limit || response.length || 10,
      };
    }
  }
  
  // Default empty response
  return {
    data: [],
    total: 0,
    page: defaultParams?.page || 1,
    totalPages: 0,
    limit: defaultParams?.limit || 10,
  };
};

export const supplierService = {
  // ============================================
  // SUPPLIER CRUD OPERATIONS
  // ============================================

  /**
   * Get all suppliers - calls GET /suppliers
   */
  async getAllSuppliers(params?: SupplierSearchParams): Promise<Supplier[]> {
    try {
      const response = await api.get('/suppliers', { params });
      return extractArrayData<Supplier>(response);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
      return [];
    }
  },

  /**
   * Get paginated suppliers - calls GET /suppliers with pagination
   */
  async getPaginatedSuppliers(params?: SupplierSearchParams): Promise<PaginatedResponse<Supplier>> {
    try {
      const response = await api.get('/suppliers', { params });
      return extractPaginatedResponse<Supplier>(response, params);
    } catch (error) {
      console.error('Failed to fetch paginated suppliers:', error);
      throw error;
    }
  },

  /**
   * Get supplier by ID - calls GET /suppliers/:id
   */
  async getSupplierById(id: string, companyId?: string): Promise<Supplier> {
    try {
      const response = await api.get(`/suppliers/${id}`, { params: { companyId } });
      return extractData<Supplier>(response);
    } catch (error) {
      console.error(`Failed to fetch supplier ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create supplier - calls POST /suppliers
   */
  async createSupplier(data: { 
    name: string; 
    email?: string; 
    phone?: string; 
    address?: string; 
    contactPerson?: string; 
    companyId: string; 
    userId: string;
    isActive?: boolean;
    taxId?: string;
    paymentTerms?: string;
    deliveryTerms?: string;
  }): Promise<Supplier> {
    try {
      const response = await api.post('/suppliers', data);
      return extractData<Supplier>(response);
    } catch (error) {
      console.error('Failed to create supplier:', error);
      throw error;
    }
  },

  /**
   * Update supplier - calls PUT /suppliers/:id
   */
  async updateSupplier(id: string, data: { 
    name?: string; 
    email?: string; 
    phone?: string; 
    address?: string; 
    contactPerson?: string; 
    isActive?: boolean;
    taxId?: string;
    paymentTerms?: string;
    deliveryTerms?: string;
    notes?: string;
  }): Promise<Supplier> {
    try {
      const response = await api.put(`/suppliers/${id}`, data);
      return extractData<Supplier>(response);
    } catch (error) {
      console.error(`Failed to update supplier ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete supplier - calls DELETE /suppliers/:id
   */
  async deleteSupplier(id: string, companyId?: string): Promise<{ message: string }> {
    try {
      const response = await api.delete(`/suppliers/${id}`, { params: { companyId } });
      if (response && typeof response === 'object') {
        if ('data' in response) {
          return response.data as { message: string };
        }
        return response as { message: string };
      }
      return { message: 'Supplier deleted successfully' };
    } catch (error) {
      console.error(`Failed to delete supplier ${id}:`, error);
      throw error;
    }
  },

  /**
   * Toggle supplier status - calls PATCH /suppliers/:id/status
   */
  async toggleSupplierStatus(id: string, isActive: boolean): Promise<Supplier> {
    try {
      const response = await api.patch(`/suppliers/${id}/status`, { isActive });
      return extractData<Supplier>(response);
    } catch (error) {
      console.error(`Failed to toggle supplier status ${id}:`, error);
      throw error;
    }
  },

  // ============================================
  // SUPPLIER SEARCH & FILTERS
  // ============================================

  /**
   * Search suppliers - calls GET /suppliers/search
   */
  async searchSuppliers(params: { query: string; companyId?: string; limit?: number }): Promise<Supplier[]> {
    try {
      const response = await api.get('/suppliers/search', { params });
      return extractArrayData<Supplier>(response);
    } catch (error) {
      console.error('Failed to search suppliers:', error);
      return [];
    }
  },

  /**
   * Filter suppliers - calls GET /suppliers/filter
   */
  async filterSuppliers(filters: SupplierFilterOptions & { companyId?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Supplier>> {
    try {
      const response = await api.get('/suppliers/filter', { params: filters });
      return extractPaginatedResponse<Supplier>(response, filters);
    } catch (error) {
      console.error('Failed to filter suppliers:', error);
      throw error;
    }
  },

  // ============================================
  // SUPPLIER CONTACTS
  // ============================================

  /**
   * Get supplier contacts - calls GET /suppliers/:id/contacts
   */
  async getSupplierContacts(supplierId: string): Promise<SupplierContact[]> {
    try {
      const response = await api.get(`/suppliers/${supplierId}/contacts`);
      return extractArrayData<SupplierContact>(response);
    } catch (error) {
      console.error(`Failed to fetch contacts for supplier ${supplierId}:`, error);
      return [];
    }
  },

  /**
   * Add supplier contact - calls POST /suppliers/:id/contacts
   */
  async addSupplierContact(supplierId: string, data: Omit<SupplierContact, 'id' | 'supplierId' | 'createdAt' | 'updatedAt'>): Promise<SupplierContact> {
    try {
      const response = await api.post(`/suppliers/${supplierId}/contacts`, data);
      return extractData<SupplierContact>(response);
    } catch (error) {
      console.error(`Failed to add contact for supplier ${supplierId}:`, error);
      throw error;
    }
  },

  /**
   * Update supplier contact - calls PUT /suppliers/contacts/:contactId
   */
  async updateSupplierContact(contactId: string, data: Partial<SupplierContact>): Promise<SupplierContact> {
    try {
      const response = await api.put(`/suppliers/contacts/${contactId}`, data);
      return extractData<SupplierContact>(response);
    } catch (error) {
      console.error(`Failed to update contact ${contactId}:`, error);
      throw error;
    }
  },

  /**
   * Delete supplier contact - calls DELETE /suppliers/contacts/:contactId
   */
  async deleteSupplierContact(contactId: string): Promise<{ message: string }> {
    try {
      const response = await api.delete(`/suppliers/contacts/${contactId}`);
      if (response && typeof response === 'object') {
        if ('data' in response) {
          return response.data as { message: string };
        }
        return response as { message: string };
      }
      return { message: 'Contact deleted successfully' };
    } catch (error) {
      console.error(`Failed to delete contact ${contactId}:`, error);
      throw error;
    }
  },

  // ============================================
  // SUPPLIER PRODUCTS
  // ============================================

  /**
   * Get supplier products - calls GET /suppliers/:id/products
   */
  async getSupplierProducts(supplierId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<SupplierProduct>> {
    try {
      const response = await api.get(`/suppliers/${supplierId}/products`, { params });
      return extractPaginatedResponse<SupplierProduct>(response, params);
    } catch (error) {
      console.error(`Failed to fetch products for supplier ${supplierId}:`, error);
      throw error;
    }
  },

  /**
   * Add supplier product - calls POST /suppliers/:id/products
   */
  async addSupplierProduct(supplierId: string, data: Omit<SupplierProduct, 'id' | 'supplierId' | 'createdAt' | 'updatedAt'>): Promise<SupplierProduct> {
    try {
      const response = await api.post(`/suppliers/${supplierId}/products`, data);
      return extractData<SupplierProduct>(response);
    } catch (error) {
      console.error(`Failed to add product for supplier ${supplierId}:`, error);
      throw error;
    }
  },

  /**
   * Update supplier product - calls PUT /suppliers/products/:productId
   */
  async updateSupplierProduct(productId: string, data: Partial<SupplierProduct>): Promise<SupplierProduct> {
    try {
      const response = await api.put(`/suppliers/products/${productId}`, data);
      return extractData<SupplierProduct>(response);
    } catch (error) {
      console.error(`Failed to update product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Delete supplier product - calls DELETE /suppliers/products/:productId
   */
  async deleteSupplierProduct(productId: string): Promise<{ message: string }> {
    try {
      const response = await api.delete(`/suppliers/products/${productId}`);
      if (response && typeof response === 'object') {
        if ('data' in response) {
          return response.data as { message: string };
        }
        return response as { message: string };
      }
      return { message: 'Product removed from supplier successfully' };
    } catch (error) {
      console.error(`Failed to delete product ${productId}:`, error);
      throw error;
    }
  },

  // ============================================
  // SUPPLIER PAYMENTS
  // ============================================

  /**
   * Get supplier payments - calls GET /suppliers/:id/payments
   */
  async getSupplierPayments(supplierId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<SupplierPayment>> {
    try {
      const response = await api.get(`/suppliers/${supplierId}/payments`, { params });
      return extractPaginatedResponse<SupplierPayment>(response, params);
    } catch (error) {
      console.error(`Failed to fetch payments for supplier ${supplierId}:`, error);
      throw error;
    }
  },

  /**
   * Record supplier payment - calls POST /suppliers/:id/payments
   */
  async recordSupplierPayment(supplierId: string, data: Omit<SupplierPayment, 'id' | 'supplierId' | 'createdAt' | 'updatedAt'>): Promise<SupplierPayment> {
    try {
      const response = await api.post(`/suppliers/${supplierId}/payments`, data);
      return extractData<SupplierPayment>(response);
    } catch (error) {
      console.error(`Failed to record payment for supplier ${supplierId}:`, error);
      throw error;
    }
  },

  // ============================================
  // SUPPLIER RATINGS & REVIEWS
  // ============================================

  /**
   * Get supplier ratings - calls GET /suppliers/:id/ratings
   */
  async getSupplierRatings(supplierId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<SupplierRating>> {
    try {
      const response = await api.get(`/suppliers/${supplierId}/ratings`, { params });
      return extractPaginatedResponse<SupplierRating>(response, params);
    } catch (error) {
      console.error(`Failed to fetch ratings for supplier ${supplierId}:`, error);
      throw error;
    }
  },

  /**
   * Rate supplier - calls POST /suppliers/:id/rate
   */
  async rateSupplier(supplierId: string, data: { rating: number; review?: string; businessUnitId: string }): Promise<SupplierRating> {
    try {
      const response = await api.post(`/suppliers/${supplierId}/rate`, data);
      return extractData<SupplierRating>(response);
    } catch (error) {
      console.error(`Failed to rate supplier ${supplierId}:`, error);
      throw error;
    }
  },

  // ============================================
  // SUPPLIER STATISTICS & PERFORMANCE
  // ============================================

  /**
   * Get supplier statistics - calls GET /suppliers/statistics
   */
  async getSupplierStatistics(companyId?: string): Promise<SupplierStatistics> {
    try {
      const response = await api.get('/suppliers/statistics', { params: { companyId } });
      return extractData<SupplierStatistics>(response);
    } catch (error) {
      console.error('Failed to fetch supplier statistics:', error);
      throw error;
    }
  },

  /**
   * Get supplier performance - calls GET /suppliers/:id/performance
   */
  async getSupplierPerformance(supplierId: string, dateRange?: { start: string; end: string }): Promise<SupplierPerformance> {
    try {
      const response = await api.get(`/suppliers/${supplierId}/performance`, { params: dateRange });
      return extractData<SupplierPerformance>(response);
    } catch (error) {
      console.error(`Failed to fetch performance for supplier ${supplierId}:`, error);
      throw error;
    }
  },

  /**
   * Get supplier order history - calls GET /suppliers/:id/orders
   */
  async getSupplierOrderHistory(supplierId: string, params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<SupplierOrderHistory>> {
    try {
      const response = await api.get(`/suppliers/${supplierId}/orders`, { params });
      return extractPaginatedResponse<SupplierOrderHistory>(response, params);
    } catch (error) {
      console.error(`Failed to fetch order history for supplier ${supplierId}:`, error);
      throw error;
    }
  },

  /**
   * Get supplier summary - calls GET /suppliers/:id/summary
   */
  async getSupplierSummary(supplierId: string): Promise<SupplierSummary> {
    try {
      const response = await api.get(`/suppliers/${supplierId}/summary`);
      return extractData<SupplierSummary>(response);
    } catch (error) {
      console.error(`Failed to fetch summary for supplier ${supplierId}:`, error);
      throw error;
    }
  },

  // ============================================
  // BULK OPERATIONS
  // ============================================

  /**
   * Bulk delete suppliers - calls POST /suppliers/bulk/delete
   */
  async bulkDeleteSuppliers(ids: string[], companyId?: string): Promise<{ message: string; deletedCount: number }> {
    try {
      const response = await api.post('/suppliers/bulk/delete', { ids, companyId });
      if (response && typeof response === 'object') {
        if ('data' in response) {
          return response.data as { message: string; deletedCount: number };
        }
        return response as { message: string; deletedCount: number };
      }
      return { message: 'Suppliers deleted successfully', deletedCount: ids.length };
    } catch (error) {
      console.error('Failed to bulk delete suppliers:', error);
      throw error;
    }
  },

  /**
   * Bulk activate suppliers - calls POST /suppliers/bulk/activate
   */
  async bulkActivateSuppliers(ids: string[]): Promise<BulkSupplierOperationResult> {
    try {
      const response = await api.post('/suppliers/bulk/activate', { ids });
      return extractData<BulkSupplierOperationResult>(response);
    } catch (error) {
      console.error('Failed to bulk activate suppliers:', error);
      throw error;
    }
  },

  /**
   * Bulk deactivate suppliers - calls POST /suppliers/bulk/deactivate
   */
  async bulkDeactivateSuppliers(ids: string[]): Promise<BulkSupplierOperationResult> {
    try {
      const response = await api.post('/suppliers/bulk/deactivate', { ids });
      return extractData<BulkSupplierOperationResult>(response);
    } catch (error) {
      console.error('Failed to bulk deactivate suppliers:', error);
      throw error;
    }
  },

  // ============================================
  // EXPORT / IMPORT
  // ============================================

  /**
   * Export suppliers - calls GET /suppliers/export
   */
  async exportSuppliers(options: SupplierExportOptions): Promise<Blob> {
    try {
      const response = await api.download('/suppliers/export', { params: options });
      return response;
    } catch (error) {
      console.error('Failed to export suppliers:', error);
      throw error;
    }
  },

  /**
   * Import suppliers - calls POST /suppliers/import
   */
  async importSuppliers(file: File, companyId: string): Promise<BulkSupplierOperationResult> {
    try {
      const response = await api.upload('/suppliers/import', file, 'file', { companyId });
      return extractData<BulkSupplierOperationResult>(response);
    } catch (error) {
      console.error('Failed to import suppliers:', error);
      throw error;
    }
  },

  /**
   * Download import template - calls GET /suppliers/import/template
   */
  async downloadImportTemplate(): Promise<Blob> {
    try {
      const response = await api.download('/suppliers/import/template');
      return response;
    } catch (error) {
      console.error('Failed to download import template:', error);
      throw error;
    }
  },
};
