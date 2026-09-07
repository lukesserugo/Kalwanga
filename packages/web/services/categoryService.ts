// D:\Projects\Kalwanga\packages\web\services\categoryService.ts

import { api } from './api';
import { Category } from '../types';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// Define API response types
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

// ============================================
// BUSINESS UNIT HELPERS
// ============================================

/**
 * Get the current user's business unit ID
 * Tries multiple sources in order of priority
 */
export function getBusinessUnitId(): string {
  // Try to get from localStorage first (set during login)
  try {
    const stored = localStorage.getItem('businessUnitId');
    if (stored && stored !== 'undefined' && stored !== 'null') {
      console.log('✅ Business unit ID from localStorage:', stored);
      return stored;
    }
  } catch (e) {
    console.warn('Failed to read businessUnitId from localStorage:', e);
  }

  // Try to get from user session
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.businessUnitId) {
        console.log('✅ Business unit ID from user object:', user.businessUnitId);
        return user.businessUnitId;
      }
      if (user?.businessUnits?.[0]?.businessUnitId) {
        console.log('✅ Business unit ID from user businessUnits:', user.businessUnits[0].businessUnitId);
        return user.businessUnits[0].businessUnitId;
      }
      if (user?.businessUnits?.[0]?.id) {
        console.log('✅ Business unit ID from user businessUnits id:', user.businessUnits[0].id);
        return user.businessUnits[0].id;
      }
    }
  } catch (e) {
    console.warn('Failed to read user from localStorage:', e);
  }

  // Try to get from sessionStorage
  try {
    const sessionId = sessionStorage.getItem('businessUnitId');
    if (sessionId && sessionId !== 'undefined' && sessionId !== 'null') {
      console.log('✅ Business unit ID from sessionStorage:', sessionId);
      return sessionId;
    }
  } catch (e) {
    console.warn('Failed to read businessUnitId from sessionStorage:', e);
  }

  // Fallback to 'default' - backend will resolve it
  console.warn('⚠️ No business unit ID found, using "default" fallback');
  return 'default';
}

/**
 * Set the business unit ID in storage
 */
export function setBusinessUnitId(businessUnitId: string): void {
  if (!businessUnitId) return;
  
  try {
    localStorage.setItem('businessUnitId', businessUnitId);
    sessionStorage.setItem('businessUnitId', businessUnitId);
    console.log('✅ Business unit ID saved:', businessUnitId);
  } catch (e) {
    console.warn('Failed to save businessUnitId:', e);
  }
}

/**
 * Sanitize business unit ID - filter out invalid values
 */
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

/**
 * Validate if a string is a valid UUID
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// ============================================
// DATA EXTRACTION HELPERS
// ============================================

/**
 * Extract data from API response
 */
function extractData<T>(response: any): T {
  if (!response || typeof response !== 'object') {
    return {} as T;
  }
  
  // If response has success and data property (standard API response)
  if ('success' in response && 'data' in response) {
    return response.data as T;
  }
  
  // If response has data property
  if ('data' in response) {
    return response.data as T;
  }
  
  // If response itself is the data
  return response as T;
}

/**
 * Extract array from API response
 */
function extractArray<T>(response: any): T[] {
  if (!response || typeof response !== 'object') {
    return [];
  }
  
  // If response has success and data property
  if ('success' in response && 'data' in response) {
    const data = response.data;
    if (Array.isArray(data)) {
      return data;
    }
    // Check if data has nested data array
    if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  }
  
  // If response has data property
  if ('data' in response) {
    const data = response.data;
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  }
  
  // If response itself is an array
  if (Array.isArray(response)) {
    return response;
  }
  
  return [];
}

/**
 * Extract pagination info from response
 */
function extractPagination(response: any): { total: number; page: number; totalPages: number; limit: number } {
  if (!response || typeof response !== 'object') {
    return { total: 0, page: 1, totalPages: 0, limit: 10 };
  }
  
  // Check for pagination object
  if ('pagination' in response && response.pagination) {
    return {
      total: response.pagination.total || 0,
      page: response.pagination.page || 1,
      totalPages: response.pagination.totalPages || 0,
      limit: response.pagination.limit || 10,
    };
  }
  
  // Check for direct properties
  if ('total' in response) {
    return {
      total: response.total || 0,
      page: response.page || 1,
      totalPages: response.totalPages || Math.ceil((response.total || 0) / 10),
      limit: response.limit || 10,
    };
  }
  
  return { total: 0, page: 1, totalPages: 0, limit: 10 };
}

// ============================================
// CATEGORY SERVICE
// ============================================

export const categoryService = {
  /**
   * Get all categories - calls GET /categories
   * Returns an array of categories
   */
  async getAllCategories(params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    businessUnitId?: string; 
    parentId?: string;
    isActive?: boolean;
  }): Promise<Category[]> {
    try {
      // 🔥 FIX: Don't use businessUnitId for category filtering
      // Categories should be global/shared across all business units
      const queryParams = {
        ...params,
        // Remove or ignore businessUnitId - we want all categories
        // businessUnitId: params?.businessUnitId || getBusinessUnitId(),
        limit: params?.limit || 100,
      };
      
      // Remove businessUnitId from params if it exists
      delete queryParams.businessUnitId;
      
      console.log('📤 Fetching categories with params:', queryParams);
      const response = await api.get('/categories', { params: queryParams });
      console.log('📥 Categories response:', response);
      
      let categories: Category[] = [];
      
      if (response && typeof response === 'object') {
        if ('success' in response && 'data' in response) {
          const data = response.data;
          if (Array.isArray(data)) {
            categories = data;
          } else if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
            categories = data.data;
          }
        } else if ('data' in response) {
          const data = response.data;
          if (Array.isArray(data)) {
            categories = data;
          }
        } else if (Array.isArray(response)) {
          categories = response;
        }
      }
      
      console.log(`✅ Categories fetched: ${categories.length}`);
      return categories;
    } catch (error) {
      console.error('❌ Failed to fetch categories:', error);
      return [];
    }
  },
  
  /**
   * Get paginated categories - returns paginated response with metadata
   */
  async getPaginatedCategories(params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    businessUnitId?: string; 
    parentId?: string;
    isActive?: boolean;
  }): Promise<PaginatedResponse<Category>> {
    try {
      // Use proper business unit ID resolution
      const businessUnitId = params?.businessUnitId || getBusinessUnitId();
      
      const queryParams = {
        ...params,
        businessUnitId: businessUnitId,
      };
      
      console.log('📤 Fetching paginated categories with params:', queryParams);
      const response = await api.get('/categories', { params: queryParams });
      console.log('📥 Paginated categories response:', response);
      
      // Extract data and pagination
      const data = extractArray<Category>(response);
      const pagination = extractPagination(response);
      
      return {
        data,
        total: pagination.total,
        page: pagination.page,
        totalPages: pagination.totalPages,
        limit: pagination.limit,
      };
    } catch (error) {
      console.error('❌ Failed to fetch paginated categories:', error);
      return {
        data: [],
        total: 0,
        page: params?.page || 1,
        totalPages: 0,
        limit: params?.limit || 10,
      };
    }
  },

  /**
   * Get category by ID - calls GET /categories/:id
   */
  async getCategoryById(id: string): Promise<Category> {
    try {
      if (!id) {
        throw new Error('Category ID is required');
      }
      
      console.log('📤 Fetching category by ID:', id);
      const response = await api.get(`/categories/${id}`);
      const data = extractData<Category>(response);
      if (!data) {
        throw new Error('Category not found');
      }
      console.log('✅ Category fetched:', data.id);
      return data;
    } catch (error) {
      console.error(`❌ Failed to fetch category ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create category - calls POST /categories
   * Handles businessUnitId properly
   */
  async createCategory(data: Partial<Category>): Promise<Category> {
    try {
      // Get proper business unit ID
      const businessUnitId = data.businessUnitId || getBusinessUnitId();
      
      console.log('📤 Creating category with data:', data);
      console.log('📤 Using businessUnitId:', businessUnitId);
      
      // Ensure we have all required fields with proper values
      const payload = {
        name: data.name?.trim() || '',
        description: data.description?.trim() || null,
        parentId: data.parentId || null,
        businessUnitId: businessUnitId,
        isActive: data.isActive !== undefined ? data.isActive : true,
        featured: data.featured || false,
      };
      
      console.log('📤 Sending payload:', payload);
      
      const response = await api.post('/categories', payload);
      console.log('📥 Response status:', response.status || 'unknown');
      
      const result = extractData<Category>(response);
      if (!result) {
        throw new Error('Failed to create category: No data returned');
      }
      
      // Store the business unit ID if it was resolved
      if (result.businessUnitId && result.businessUnitId !== 'default') {
        setBusinessUnitId(result.businessUnitId);
      }
      
      console.log('✅ Category created:', result.id, result.name);
      console.log('✅ Category businessUnitId:', result.businessUnitId);
      
      return result;
    } catch (error: any) {
      console.error('❌ Failed to create category:', error);
      // Re-throw with detailed error message
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Update category - calls PUT /categories/:id
   */
  async updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    try {
      if (!id) {
        throw new Error('Category ID is required');
      }
      
      console.log(`📤 Updating category ${id}:`, data);
      
      // Clean up data before sending
      const payload: any = {};
      if (data.name !== undefined) payload.name = data.name.trim();
      if (data.description !== undefined) payload.description = data.description?.trim() || null;
      if (data.parentId !== undefined) payload.parentId = data.parentId || null;
      if (data.isActive !== undefined) payload.isActive = data.isActive;
      if (data.featured !== undefined) payload.featured = data.featured;
      
      const response = await api.put(`/categories/${id}`, payload);
      const result = extractData<Category>(response);
      if (!result) {
        throw new Error('Failed to update category');
      }
      console.log(`✅ Category ${id} updated`);
      return result;
    } catch (error: any) {
      console.error(`❌ Failed to update category ${id}:`, error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Delete category - calls DELETE /categories/:id
   */
  async deleteCategory(id: string): Promise<{ message: string }> {
    try {
      if (!id) {
        throw new Error('Category ID is required');
      }
      
      console.log(`📤 Deleting category ${id}`);
      const response = await api.delete(`/categories/${id}`);
      const result = extractData<{ message: string }>(response);
      if (result && result.message) {
        console.log(`✅ Category ${id} deleted:`, result.message);
        return result;
      }
      return { message: 'Category deleted successfully' };
    } catch (error: any) {
      console.error(`❌ Failed to delete category ${id}:`, error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Get category tree - calls GET /categories/tree/:businessUnitId
   */
  async getCategoryTree(businessUnitId?: string): Promise<Category[]> {
    try {
      // Use proper business unit ID resolution
      const resolvedBusinessUnitId = businessUnitId || getBusinessUnitId();
      
      if (!resolvedBusinessUnitId || resolvedBusinessUnitId === 'default') {
        console.warn('Business unit ID is required for category tree, using fallback');
        // Try to fetch categories without tree
        return this.getAllCategories({ businessUnitId: resolvedBusinessUnitId });
      }
      
      console.log(`📤 Fetching category tree for ${resolvedBusinessUnitId}`);
      const response = await api.get(`/categories/tree/${resolvedBusinessUnitId}`);
      const result = extractArray<Category>(response);
      console.log(`✅ Category tree fetched: ${result.length} categories`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to fetch category tree:`, error);
      // Fallback to regular categories
      try {
        return this.getAllCategories({ businessUnitId });
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        return [];
      }
    }
  },

  /**
   * Bulk delete categories - calls POST /categories/bulk/delete
   */
  async bulkDeleteCategories(ids: string[]): Promise<{ message: string; deletedCount: number; errors?: string[] }> {
    try {
      if (!ids || ids.length === 0) {
        throw new Error('No category IDs provided');
      }
      
      console.log(`📤 Bulk deleting ${ids.length} categories`);
      const response = await api.post('/categories/bulk/delete', { ids });
      const result = extractData<{ message: string; deletedCount: number; errors?: string[] }>(response);
      console.log(`✅ Bulk delete completed:`, result?.message || 'Success');
      return result || { message: `${ids.length} categories deleted successfully`, deletedCount: ids.length };
    } catch (error: any) {
      console.error('❌ Failed to bulk delete categories:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Toggle category status - calls PATCH /categories/:id/status
   */
  async toggleCategoryStatus(id: string, isActive: boolean): Promise<Category> {
    try {
      if (!id) {
        throw new Error('Category ID is required');
      }
      
      console.log(`📤 Toggling category ${id} status to ${isActive}`);
      const response = await api.patch(`/categories/${id}/status`, { isActive });
      const result = extractData<Category>(response);
      if (!result) {
        throw new Error('Failed to toggle category status');
      }
      console.log(`✅ Category ${id} status toggled to ${isActive}`);
      return result;
    } catch (error: any) {
      console.error(`❌ Failed to toggle category status ${id}:`, error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Get category by name - calls GET /categories/by-name
   */
  async getCategoryByName(name: string, businessUnitId?: string): Promise<Category | null> {
    try {
      if (!name) {
        console.warn('Category name is required');
        return null;
      }
      
      // Use proper business unit ID resolution
      const resolvedBusinessUnitId = businessUnitId || getBusinessUnitId();
      
      console.log(`📤 Fetching category by name: ${name}`);
      const response = await api.get('/categories/by-name', { 
        params: { name, businessUnitId: resolvedBusinessUnitId } 
      });
      const result = extractData<Category>(response);
      console.log(`✅ Category by name fetched:`, result?.id || 'not found');
      return result || null;
    } catch (error) {
      console.error(`❌ Failed to fetch category by name ${name}:`, error);
      return null;
    }
  },

  /**
   * Get category with products - calls GET /categories/:id/with-products
   */
  async getCategoryWithProducts(id: string): Promise<Category & { products: any[]; productCount?: number }> {
    try {
      if (!id) {
        throw new Error('Category ID is required');
      }
      
      console.log(`📤 Fetching category ${id} with products`);
      const response = await api.get(`/categories/${id}/with-products`);
      const result = extractData<Category & { products: any[]; productCount?: number }>(response);
      if (!result) {
        throw new Error('Category with products not found');
      }
      console.log(`✅ Category ${id} with products fetched: ${result.products?.length || 0} products`);
      return result;
    } catch (error: any) {
      console.error(`❌ Failed to fetch category with products ${id}:`, error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Get subcategories - calls GET /categories/:parentId/subcategories
   */
  async getSubcategories(parentId: string): Promise<Category[]> {
    try {
      if (!parentId) {
        throw new Error('Parent category ID is required');
      }
      
      console.log(`📤 Fetching subcategories for parent: ${parentId}`);
      const response = await api.get(`/categories/${parentId}/subcategories`);
      const result = extractArray<Category>(response);
      console.log(`✅ Subcategories fetched: ${result.length}`);
      return result;
    } catch (error: any) {
      console.error(`❌ Failed to fetch subcategories for ${parentId}:`, error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      return [];
    }
  },

  /**
   * Get category products with pagination - calls GET /categories/:id/products
   */
  async getCategoryProducts(id: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<any>> {
    try {
      if (!id) {
        throw new Error('Category ID is required');
      }
      
      console.log(`📤 Fetching products for category ${id}`);
      const response = await api.get(`/categories/${id}/products`, { params });
      const data = extractArray<any>(response);
      const pagination = extractPagination(response);
      
      console.log(`✅ Category products fetched: ${data.length}`);
      return {
        data,
        total: pagination.total,
        page: pagination.page,
        totalPages: pagination.totalPages,
        limit: pagination.limit,
      };
    } catch (error: any) {
      console.error(`❌ Failed to fetch products for category ${id}:`, error);
      return {
        data: [],
        total: 0,
        page: params?.page || 1,
        totalPages: 0,
        limit: params?.limit || 10,
      };
    }
  },

  /**
   * Get category statistics - calls GET /categories/stats/:businessUnitId
   */
  async getCategoryStatistics(businessUnitId?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    withProducts: number;
    withoutProducts: number;
    totalProducts: number;
    averageProductsPerCategory: number;
  }> {
    try {
      // Use proper business unit ID resolution
      const resolvedBusinessUnitId = businessUnitId || getBusinessUnitId();
      
      console.log(`📤 Fetching category statistics for ${resolvedBusinessUnitId}`);
      const response = await api.get(`/categories/stats/${resolvedBusinessUnitId}`);
      const result = extractData<any>(response);
      console.log(`✅ Category statistics fetched`);
      return result || {
        total: 0,
        active: 0,
        inactive: 0,
        withProducts: 0,
        withoutProducts: 0,
        totalProducts: 0,
        averageProductsPerCategory: 0,
      };
    } catch (error) {
      console.error('❌ Failed to fetch category statistics:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        withProducts: 0,
        withoutProducts: 0,
        totalProducts: 0,
        averageProductsPerCategory: 0,
      };
    }
  }
};

export default categoryService;
