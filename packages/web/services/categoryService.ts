// packages/web/services/categoryService.ts

import { api } from './api';
import type {
  Category,
  CategoryWithProducts,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryStats,
  PaginatedResponse,
} from '../types/category';

export type { Category, CategoryWithProducts };

// ============================================
// BUSINESS UNIT HELPERS
// ============================================

export function getBusinessUnitId(): string {
  try {
    const stored = localStorage.getItem('businessUnitId');
    if (stored && stored !== 'undefined' && stored !== 'null') return stored;
  } catch (e) {
    console.warn('Failed to read businessUnitId from localStorage:', e);
  }

  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.businessUnitId) return user.businessUnitId;
      if (user?.businessUnits?.[0]?.businessUnitId)
        return user.businessUnits[0].businessUnitId;
      if (user?.businessUnits?.[0]?.id) return user.businessUnits[0].id;
    }
  } catch (e) {
    console.warn('Failed to read user from localStorage:', e);
  }

  try {
    const sessionId = sessionStorage.getItem('businessUnitId');
    if (sessionId && sessionId !== 'undefined' && sessionId !== 'null')
      return sessionId;
  } catch (e) {
    console.warn('Failed to read businessUnitId from sessionStorage:', e);
  }

  return 'default';
}

export function setBusinessUnitId(businessUnitId: string): void {
  if (!businessUnitId) return;
  try {
    localStorage.setItem('businessUnitId', businessUnitId);
    sessionStorage.setItem('businessUnitId', businessUnitId);
  } catch (e) {
    console.warn('Failed to save businessUnitId:', e);
  }
}

function sanitizeBusinessUnitId(id?: string): string | undefined {
  if (!id) return undefined;
  if (
    id === 'default' ||
    id === 'default-business-unit' ||
    id === 'undefined' ||
    id === 'null' ||
    id === ''
  )
    return undefined;
  return id;
}

// ============================================
// RESPONSE NORMALIZATION
// ============================================

function extractArray<T>(response: any): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (typeof response !== 'object') return [];

  const tryData = (obj: any): T[] | null => {
    if (!obj) return null;
    if (Array.isArray(obj)) return obj;
    if (Array.isArray(obj.data)) return obj.data;
    if (obj.data && Array.isArray(obj.data.data)) return obj.data.data;
    return null;
  };

  return (
    tryData(response) ??
    tryData(response.data) ??
    tryData(response.categories) ??
    []
  );
}

function extractData<T>(response: any): T | null {
  if (!response || typeof response !== 'object') return null;
  if ('success' in response && 'data' in response) return response.data as T;
  if ('data' in response) return response.data as T;
  return response as T;
}

function extractPagination(response: any) {
  if (!response || typeof response !== 'object')
    return { total: 0, page: 1, totalPages: 0, limit: 20 };

  const src = response.pagination ?? response;
  return {
    total: src.total ?? 0,
    page: src.page ?? 1,
    totalPages: src.totalPages ?? 0,
    limit: src.limit ?? 20,
  };
}

// ============================================
// SERVICE
// ============================================

export const categoryService = {
  // ---------- PUBLIC ----------

  async getPublicCategories(params?: {
    businessUnitId?: string;
    limit?: number;
    search?: string;
    featured?: boolean;
  }): Promise<Category[]> {
    try {
      const query: Record<string, any> = {};
      if (params?.businessUnitId) query.businessUnitId = params.businessUnitId;
      if (params?.limit) query.limit = params.limit;
      if (params?.search) query.search = params.search;
      if (params?.featured) query.featured = true;

      const response = await api.get('/categories/public', { params: query });
      return extractArray<Category>(response);
    } catch (err) {
      console.warn('getPublicCategories failed:', err);
      return [];
    }
  },

  async getPublicCategoryTree(businessUnitId?: string): Promise<Category[]> {
    try {
      const id = businessUnitId || getBusinessUnitId();
      const response = await api.get(`/categories/public/tree/${id}`);
      return extractArray<Category>(response);
    } catch (err) {
      console.warn('getPublicCategoryTree failed:', err);
      return [];
    }
  },

  /**
   * Public category + products + rollups. No auth required.
   * Returns null when the category isn't public or doesn't exist.
   */
  async getPublicCategoryWithProducts(
    id: string,
    params?: { productLimit?: number; includeInactive?: boolean },
  ): Promise<CategoryWithProducts | null> {
    if (!id) return null;
    try {
      const response = await api.get(`/categories/public/${id}/with-products`, {
        params,
      });
      return extractData<CategoryWithProducts>(response);
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      console.warn('getPublicCategoryWithProducts failed:', err);
      return null;
    }
  },

  // ---------- AUTHENTICATED ----------

  async getAllCategories(params?: {
    page?: number;
    limit?: number;
    search?: string;
    businessUnitId?: string;
    parentId?: string;
    isActive?: boolean;
    featured?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<Category[]> {
    try {
      const query: Record<string, any> = {
        ...params,
        limit: params?.limit ?? 100,
      };
      if (params?.businessUnitId) query.businessUnitId = params.businessUnitId;
      const response = await api.get('/categories', { params: query });
      return extractArray<Category>(response);
    } catch (err) {
      console.error('getAllCategories failed:', err);
      return [];
    }
  },

  async getPaginatedCategories(params?: {
    page?: number;
    limit?: number;
    search?: string;
    businessUnitId?: string;
    parentId?: string;
    isActive?: boolean;
    featured?: boolean;
  }): Promise<PaginatedResponse<Category>> {
    try {
      const businessUnitId = params?.businessUnitId || getBusinessUnitId();
      const response = await api.get('/categories', {
        params: { ...params, businessUnitId },
      });
      return {
        data: extractArray<Category>(response),
        ...extractPagination(response),
      };
    } catch (err) {
      console.error('getPaginatedCategories failed:', err);
      return {
        data: [],
        total: 0,
        page: params?.page ?? 1,
        totalPages: 0,
        limit: params?.limit ?? 20,
      };
    }
  },

  async getCategoryById(id: string): Promise<Category> {
    if (!id) throw new Error('Category ID is required');
    const response = await api.get(`/categories/${id}`);
    const data = extractData<Category>(response);
    if (!data) throw new Error('Category not found');
    return data;
  },

  /**
   * Authenticated category + products + rollups.
   * Query params:
   *   productLimit    (default 50, max 200)
   *   includeInactive (default false)
   */
  async getCategoryWithProducts(
    id: string,
    params?: { productLimit?: number; includeInactive?: boolean },
  ): Promise<CategoryWithProducts> {
    if (!id) throw new Error('Category ID is required');
    try {
      const response = await api.get(`/categories/${id}/with-products`, {
        params,
      });
      const data = extractData<CategoryWithProducts>(response);
      if (!data) throw new Error('Category not found');
      return data;
    } catch (error: any) {
      throw new Error(
        error?.response?.data?.message ??
          error?.message ??
          'Failed to fetch category with products',
      );
    }
  },

  async getCategoryBySlug(
    slug: string,
    businessUnitId?: string,
  ): Promise<Category> {
    if (!slug) throw new Error('Category slug is required');
    const response = await api.get(`/categories/by-slug/${slug}`, {
      params: { businessUnitId },
    });
    const data = extractData<Category>(response);
    if (!data) throw new Error('Category not found');
    return data;
  },

  async getCategoryByName(
    name: string,
    businessUnitId?: string,
  ): Promise<Category | null> {
    if (!name) return null;
    try {
      const response = await api.get('/categories/by-name', {
        params: { name, businessUnitId: businessUnitId || getBusinessUnitId() },
      });
      return extractData<Category>(response);
    } catch {
      return null;
    }
  },

  async getCategoryTree(businessUnitId?: string): Promise<Category[]> {
    const id = businessUnitId || getBusinessUnitId();
    try {
      const response = await api.get(`/categories/tree/${id}`);
      return extractArray<Category>(response);
    } catch {
      return this.getAllCategories({ businessUnitId: id });
    }
  },

  async getSubcategories(parentId: string): Promise<Category[]> {
    if (!parentId) throw new Error('Parent category ID is required');
    try {
      const response = await api.get(`/categories/${parentId}/subcategories`);
      return extractArray<Category>(response);
    } catch {
      return [];
    }
  },

  async getCategoryProducts(
    id: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<any>> {
    if (!id) throw new Error('Category ID is required');
    try {
      const response = await api.get(`/categories/${id}/products`, { params });
      return {
        data: extractArray<any>(response),
        ...extractPagination(response),
      };
    } catch {
      return {
        data: [],
        total: 0,
        page: params?.page ?? 1,
        totalPages: 0,
        limit: params?.limit ?? 12,
      };
    }
  },

  async getCategoryStatistics(businessUnitId?: string): Promise<CategoryStats> {
    const id = businessUnitId || getBusinessUnitId();
    const empty: CategoryStats = {
      total: 0,
      active: 0,
      inactive: 0,
      featured: 0,
      withImages: 0,
      withProducts: 0,
      withoutProducts: 0,
      totalProducts: 0,
      averageProductsPerCategory: 0,
    };
    try {
      const response = await api.get(`/categories/stats/${id}`);
      return extractData<CategoryStats>(response) ?? empty;
    } catch {
      return empty;
    }
  },

  // ---------- WRITE ----------

  async createCategory(data: CreateCategoryDto): Promise<Category> {
    const businessUnitId =
      sanitizeBusinessUnitId(data.businessUnitId) || getBusinessUnitId();

    const payload: Record<string, any> = {
      name: data.name?.trim() || '',
      businessUnitId,
    };

    if (data.slug) payload.slug = data.slug.trim();
    if (data.description !== undefined)
      payload.description = data.description?.trim() || null;
    if (data.image !== undefined) payload.image = data.image || null;
    if (data.icon !== undefined) payload.icon = data.icon || null;
    if (data.color !== undefined) payload.color = data.color || null;
    if (data.parentId !== undefined) payload.parentId = data.parentId || null;
    if (data.isActive !== undefined) payload.isActive = data.isActive;
    if (data.featured !== undefined) payload.featured = data.featured;
    if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder;
    if (data.metaTitle !== undefined)
      payload.metaTitle = data.metaTitle || null;
    if (data.metaDescription !== undefined)
      payload.metaDescription = data.metaDescription || null;

    try {
      const response = await api.post('/categories', payload);
      const result = extractData<Category>(response);
      if (!result?.id) throw new Error('Failed to create category');
      if (result.businessUnitId && result.businessUnitId !== 'default')
        setBusinessUnitId(result.businessUnitId);
      return result;
    } catch (error: any) {
      throw new Error(
        error?.response?.data?.message ??
          error?.message ??
          'Failed to create category',
      );
    }
  },

  async updateCategory(id: string, data: UpdateCategoryDto): Promise<Category> {
    if (!id) throw new Error('Category ID is required');

    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.slug !== undefined) payload.slug = data.slug.trim();
    if (data.description !== undefined)
      payload.description = data.description?.trim() || null;
    if (data.image !== undefined) payload.image = data.image || null;
    if (data.icon !== undefined) payload.icon = data.icon || null;
    if (data.color !== undefined) payload.color = data.color || null;
    if (data.parentId !== undefined) payload.parentId = data.parentId || null;
    if (data.isActive !== undefined) payload.isActive = data.isActive;
    if (data.featured !== undefined) payload.featured = data.featured;
    if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder;
    if (data.metaTitle !== undefined)
      payload.metaTitle = data.metaTitle || null;
    if (data.metaDescription !== undefined)
      payload.metaDescription = data.metaDescription || null;

    try {
      const response = await api.put(`/categories/${id}`, payload);
      const result = extractData<Category>(response);
      if (!result) throw new Error('Failed to update category');
      return result;
    } catch (error: any) {
      throw new Error(
        error?.response?.data?.message ??
          error?.message ??
          'Failed to update category',
      );
    }
  },

  async toggleCategoryStatus(id: string, isActive: boolean): Promise<Category> {
    if (!id) throw new Error('Category ID is required');
    const response = await api.patch(`/categories/${id}/status`, { isActive });
    const result = extractData<Category>(response);
    if (!result) throw new Error('Failed to toggle category status');
    return result;
  },

  async deleteCategory(id: string): Promise<{ message: string }> {
    if (!id) throw new Error('Category ID is required');
    try {
      const response = await api.delete(`/categories/${id}`);
      return (
        extractData<{ message: string }>(response) ?? {
          message: 'Category deleted successfully',
        }
      );
    } catch (error: any) {
      throw new Error(
        error?.response?.data?.message ??
          error?.message ??
          'Failed to delete category',
      );
    }
  },

  async bulkDeleteCategories(
    ids: string[],
  ): Promise<{ message: string; deletedCount: number; errors?: string[] }> {
    if (!ids?.length) throw new Error('No category IDs provided');
    try {
      const response = await api.post('/categories/bulk-delete', { ids });
      return (
        extractData<{
          message: string;
          deletedCount: number;
          errors?: string[];
        }>(response) ?? {
          message: `${ids.length} categories deleted successfully`,
          deletedCount: ids.length,
        }
      );
    } catch (error: any) {
      throw new Error(
        error?.response?.data?.message ??
          error?.message ??
          'Failed to bulk delete',
      );
    }
  },
};

export default categoryService;
