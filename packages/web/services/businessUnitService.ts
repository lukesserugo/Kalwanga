// D:\Projects\Kalwanga\packages\web\services\businessUnitService.ts

import { api } from './api';
import type { BusinessUnit, User } from '../types';

// ============================================
// TYPES
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface BulkDeleteResult {
  deletedCount: number;
  softDeletedCount: number;
  errors: string[];
  results: Array<{
    id: string;
    success: boolean;
    message: string;
    softDeleted?: boolean;
  }>;
  totalProcessed: number;
}

export interface BusinessUnitStats {
  products: number;
  inventoryTotal: number;
  sales: number;
  totalRevenue: number;
  totalCustomers: number;
  totalEmployees: number;
  lowStockItems: number;
  outOfStockItems: number;
  monthlyRevenue: number;
  monthlySales: number;
}

export interface BusinessUnitUser {
  id: string;
  userId: string;
  businessUnitId: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

export interface BusinessUnitDetails {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  companyId: string;
  isActive: boolean;
  type?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  products: any[];
  inventory: any[];
  users: BusinessUnitUser[];
  counts: {
    products: number;
    inventory: number;
    sales: number;
    users: number;
  };
}

// ============================================
// BUSINESS UNIT ID HELPERS
// ============================================

export function getBusinessUnitId(): string {
  try {
    const stored = localStorage.getItem('businessUnitId');
    if (
      stored &&
      stored !== 'undefined' &&
      stored !== 'null' &&
      stored !== 'default'
    ) {
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
      if (
        user?.businessUnits?.[0]?.businessUnitId &&
        user.businessUnits[0].businessUnitId !== 'default'
      ) {
        return user.businessUnits[0].businessUnitId;
      }
      if (
        user?.businessUnits?.[0]?.id &&
        user.businessUnits[0].id !== 'default'
      ) {
        return user.businessUnits[0].id;
      }
    }
  } catch (_e) {
    /* ignore */
  }

  try {
    const sessionId = sessionStorage.getItem('businessUnitId');
    if (
      sessionId &&
      sessionId !== 'undefined' &&
      sessionId !== 'null' &&
      sessionId !== 'default'
    ) {
      return sessionId;
    }
  } catch (_e) {
    /* ignore */
  }

  return '';
}

export function setBusinessUnitId(businessUnitId: string): void {
  if (!businessUnitId || businessUnitId === 'default') return;

  try {
    localStorage.setItem('businessUnitId', businessUnitId);
    sessionStorage.setItem('businessUnitId', businessUnitId);
  } catch (_e) {
    /* ignore */
  }
}

export function clearBusinessUnitId(): void {
  try {
    localStorage.removeItem('businessUnitId');
    sessionStorage.removeItem('businessUnitId');
  } catch (_e) {
    /* ignore */
  }
}

export function isValidID(id: string): boolean {
  if (!id || id === 'default') return false;

  const cuidRegex = /^c[a-z0-9]{24}$/i;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const clerkIdRegex = /^user_[a-zA-Z0-9]{20,}$/;
  const simpleIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;

  return (
    cuidRegex.test(id) ||
    uuidRegex.test(id) ||
    clerkIdRegex.test(id) ||
    simpleIdRegex.test(id)
  );
}

export function isValidUUID(id: string): boolean {
  return isValidID(id);
}

// ============================================
// TYPE GUARDS
// ============================================

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function hasDataProperty(response: unknown): response is { data: unknown } {
  return isObject(response) && 'data' in response;
}

function hasPaginationProperty(
  response: unknown
): response is { pagination: unknown } {
  return isObject(response) && 'pagination' in response;
}

function hasSuccessProperty(
  response: unknown
): response is { success: unknown } {
  return isObject(response) && 'success' in response;
}

function hasMessageProperty(
  response: unknown
): response is { message: unknown } {
  return isObject(response) && 'message' in response;
}

function hasIdProperty(obj: unknown): obj is { id: string } {
  return isObject(obj) && 'id' in obj && typeof obj.id === 'string';
}

// ============================================
// ERROR LOGGING
// ============================================

function logError(context: string, error: unknown): void {
  const err = error as any;
  console.error(context, {
    message: err?.response?.data?.message || err?.message,
    status: err?.response?.status,
    url: err?.config?.url,
    params: err?.config?.params,
  });
}

// ============================================
// RESPONSE EXTRACTORS
// ============================================

function extractData<T>(response: unknown): T | null {
  if (!isObject(response)) {
    return null;
  }

  if (hasSuccessProperty(response) && hasDataProperty(response)) {
    return response.data as T;
  }

  if (hasDataProperty(response)) {
    return response.data as T;
  }

  return response as T;
}

function extractArray<T>(response: unknown): T[] {
  if (!isObject(response)) {
    return [];
  }

  if (hasSuccessProperty(response) && hasDataProperty(response)) {
    const data = response.data;
    if (Array.isArray(data)) {
      return data as T[];
    }
    if (isObject(data) && hasDataProperty(data) && Array.isArray(data.data)) {
      return data.data as T[];
    }
    if (
      isObject(data) &&
      'businessUnits' in data &&
      Array.isArray(data.businessUnits)
    ) {
      return data.businessUnits as T[];
    }
    return [];
  }

  if (hasDataProperty(response)) {
    const data = response.data;
    if (Array.isArray(data)) {
      return data as T[];
    }
    if (isObject(data) && hasDataProperty(data) && Array.isArray(data.data)) {
      return data.data as T[];
    }
    if (
      isObject(data) &&
      'businessUnits' in data &&
      Array.isArray(data.businessUnits)
    ) {
      return data.businessUnits as T[];
    }
    return [];
  }

  if (Array.isArray(response)) {
    return response as T[];
  }

  return [];
}

function extractPagination(response: unknown): {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
} {
  if (!isObject(response)) {
    return { total: 0, page: 1, totalPages: 0, limit: 10 };
  }

  if (hasPaginationProperty(response) && isObject(response.pagination)) {
    const pagination = response.pagination;
    return {
      total: ('total' in pagination ? Number(pagination.total) : 0) || 0,
      page: ('page' in pagination ? Number(pagination.page) : 1) || 1,
      totalPages:
        ('totalPages' in pagination ? Number(pagination.totalPages) : 0) || 0,
      limit: ('limit' in pagination ? Number(pagination.limit) : 10) || 10,
    };
  }

  if ('total' in response) {
    const total = Number(response.total) || 0;
    const limit = ('limit' in response ? Number(response.limit) : 10) || 10;
    return {
      total,
      page: ('page' in response ? Number(response.page) : 1) || 1,
      totalPages: Math.ceil(total / limit) || 1,
      limit,
    };
  }

  return { total: 0, page: 1, totalPages: 0, limit: 10 };
}

// ============================================
// BUSINESS UNIT SERVICE
// ============================================

export const businessUnitService = {
  /**
   * Get all business units (paginated).
   *
   * ✅ FIXED: Defaults to active-only + most-recent-first so the first
   *    unit returned is the newest, active, non-deleted unit — matching
   *    the fallback order in the backend controllers.
   */
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    companyId?: string;
    isActive?: boolean;
    includeDeleted?: boolean;
  }): Promise<PaginatedResponse<BusinessUnit>> {
    try {
      const queryParams: Record<string, any> = {
        page: params?.page || 1,
        limit: params?.limit || 10,
        isActive: params?.isActive !== undefined ? params.isActive : true,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      if (params?.search) queryParams.search = params.search;
      if (params?.companyId) queryParams.companyId = params.companyId;

      if (params?.includeDeleted === true) {
        queryParams.includeDeleted = true;
        // When explicitly asking for deleted units, don't force isActive
        delete queryParams.isActive;
      }

      const response = await api.get('/business-units', { params: queryParams });

      const data = extractArray<BusinessUnit>(response);
      const pagination = extractPagination(response);

      return {
        data,
        total: pagination.total,
        page: pagination.page,
        totalPages: pagination.totalPages,
        limit: pagination.limit,
      };
    } catch (error) {
      logError('❌ Failed to fetch business units:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<BusinessUnit> {
    try {
      if (!id || id === 'default') {
        throw new Error('Business unit ID is required');
      }

      const response = await api.get(`/business-units/${id}`);
      const result = extractData<BusinessUnit>(response);

      if (!result || !hasIdProperty(result)) {
        throw new Error('Business unit not found');
      }

      return result;
    } catch (error) {
      logError(`❌ Failed to fetch business unit ${id}:`, error);
      throw error;
    }
  },

  async create(
    data: Partial<BusinessUnit> & { type?: string }
  ): Promise<BusinessUnit> {
    try {
      if (!data.name?.trim()) {
        throw new Error('Business unit name is required');
      }
      if (!data.code?.trim()) {
        throw new Error('Business unit code is required');
      }
      if (!data.companyId || data.companyId === 'default') {
        throw new Error('Company ID is required');
      }

      const payload: Record<string, any> = {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        companyId: data.companyId,
        isActive: data.isActive !== undefined ? data.isActive : true,
        type: data.type || 'STORE',
      };

      const response = await api.post('/business-units', payload);
      const result = extractData<BusinessUnit>(response);

      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to create business unit: Invalid response');
      }

      return result;
    } catch (error) {
      logError('❌ Failed to create business unit:', error);
      throw error;
    }
  },

  async update(
    id: string,
    data: Partial<BusinessUnit> & { type?: string }
  ): Promise<BusinessUnit> {
    try {
      if (!id || id === 'default') {
        throw new Error('Business unit ID is required');
      }

      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name.trim();
      if (data.code !== undefined) payload.code = data.code.trim().toUpperCase();
      if (data.address !== undefined) payload.address = data.address || null;
      if (data.phone !== undefined) payload.phone = data.phone || null;
      if (data.email !== undefined) payload.email = data.email || null;
      if (data.isActive !== undefined) payload.isActive = data.isActive;
      if (data.type !== undefined) payload.type = data.type;

      const response = await api.put(`/business-units/${id}`, payload);
      const result = extractData<BusinessUnit>(response);

      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to update business unit: Invalid response');
      }

      return result;
    } catch (error) {
      logError(`❌ Failed to update business unit ${id}:`, error);
      throw error;
    }
  },

  async delete(id: string): Promise<{ message: string }> {
    try {
      if (!id || id === 'default') {
        throw new Error('Business unit ID is required');
      }

      const response = await api.delete(`/business-units/${id}`);

      if (
        hasDataProperty(response) &&
        isObject(response.data) &&
        hasMessageProperty(response.data)
      ) {
        return { message: String(response.data.message) };
      }

      if (hasMessageProperty(response)) {
        return { message: String(response.message) };
      }

      return { message: 'Business unit deleted successfully' };
    } catch (error) {
      logError(`❌ Failed to delete business unit ${id}:`, error);
      throw error;
    }
  },

  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    try {
      if (!ids || ids.length === 0) {
        throw new Error('At least one business unit ID is required');
      }

      const invalidIds = ids.filter(
        (id) => id !== 'default' && !isValidID(id)
      );
      if (invalidIds.length > 0) {
        throw new Error(`Invalid ID format for IDs: ${invalidIds.join(', ')}`);
      }

      const response = await api.post('/business-units/bulk-delete', { ids });
      const result = extractData<BulkDeleteResult>(response);

      if (!result || typeof result !== 'object') {
        return {
          deletedCount: 0,
          softDeletedCount: 0,
          errors: ['Invalid response from server'],
          results: [],
          totalProcessed: 0,
        };
      }

      return {
        deletedCount: result.deletedCount || 0,
        softDeletedCount: result.softDeletedCount || 0,
        errors: result.errors || [],
        results: result.results || [],
        totalProcessed:
          result.totalProcessed ||
          (result.deletedCount || 0) + (result.softDeletedCount || 0),
      };
    } catch (error) {
      logError('❌ Failed to bulk delete business units:', error);
      throw error;
    }
  },

  async getStats(id: string): Promise<BusinessUnitStats> {
    try {
      if (!id || id === 'default') {
        throw new Error('Business unit ID is required');
      }

      const response = await api.get(`/business-units/${id}/stats`);
      const result = extractData<BusinessUnitStats>(response);

      if (!result || typeof result !== 'object') {
        return {
          products: 0,
          inventoryTotal: 0,
          sales: 0,
          totalRevenue: 0,
          totalCustomers: 0,
          totalEmployees: 0,
          lowStockItems: 0,
          outOfStockItems: 0,
          monthlyRevenue: 0,
          monthlySales: 0,
        };
      }

      return {
        products: result.products || 0,
        inventoryTotal: result.inventoryTotal || 0,
        sales: result.sales || 0,
        totalRevenue: result.totalRevenue || 0,
        totalCustomers: result.totalCustomers || 0,
        totalEmployees: result.totalEmployees || 0,
        lowStockItems: result.lowStockItems || 0,
        outOfStockItems: result.outOfStockItems || 0,
        monthlyRevenue: result.monthlyRevenue || 0,
        monthlySales: result.monthlySales || 0,
      };
    } catch (error) {
      logError(`❌ Failed to fetch stats for business unit ${id}:`, error);
      throw error;
    }
  },

  async getBusinessUnitUsers(
    businessUnitId: string
  ): Promise<BusinessUnitUser[]> {
    try {
      if (!businessUnitId || businessUnitId === 'default') {
        throw new Error('Business unit ID is required');
      }

      const response = await api.get(
        `/business-units/${businessUnitId}/users`
      );
      return extractArray<BusinessUnitUser>(response);
    } catch (error) {
      logError(
        `❌ Failed to fetch users for business unit ${businessUnitId}:`,
        error
      );
      throw error;
    }
  },

  async addUserToBusinessUnit(
    businessUnitId: string,
    userId: string,
    role: string
  ): Promise<BusinessUnitUser> {
    try {
      if (!businessUnitId || businessUnitId === 'default') {
        throw new Error('Business unit ID is required');
      }
      if (!userId) {
        throw new Error('User ID is required');
      }
      if (!role) {
        throw new Error('Role is required');
      }

      const response = await api.post(
        `/business-units/${businessUnitId}/users`,
        { userId, role }
      );

      const result = extractData<BusinessUnitUser>(response);

      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to add user: Invalid response');
      }

      return result;
    } catch (error) {
      logError('❌ Failed to add user to business unit:', error);
      throw error;
    }
  },

  async removeUserFromBusinessUnit(
    businessUnitId: string,
    userId: string
  ): Promise<{ message: string }> {
    try {
      if (!businessUnitId || businessUnitId === 'default') {
        throw new Error('Business unit ID is required');
      }
      if (!userId) {
        throw new Error('User ID is required');
      }

      const response = await api.delete(
        `/business-units/${businessUnitId}/users/${userId}`
      );

      if (
        hasDataProperty(response) &&
        isObject(response.data) &&
        hasMessageProperty(response.data)
      ) {
        return { message: String(response.data.message) };
      }

      if (hasMessageProperty(response)) {
        return { message: String(response.message) };
      }

      return { message: 'User removed from business unit successfully' };
    } catch (error) {
      logError('❌ Failed to remove user from business unit:', error);
      throw error;
    }
  },

  async getOrCreateDefaultBusinessUnit(
    companyId: string
  ): Promise<BusinessUnit> {
    try {
      if (!companyId || companyId === 'default') {
        throw new Error('Company ID is required');
      }

      const response = await api.get(`/business-units/default/${companyId}`);
      const result = extractData<BusinessUnit>(response);

      if (!result || !hasIdProperty(result)) {
        throw new Error(
          'Failed to get default business unit: Invalid response'
        );
      }

      if (result.id && result.id !== 'default') {
        setBusinessUnitId(result.id);
      }

      return result;
    } catch (error) {
      logError('❌ Failed to get or create default business unit:', error);
      throw error;
    }
  },

  async getByCompany(companyId: string): Promise<BusinessUnit[]> {
    try {
      if (!companyId || companyId === 'default') {
        throw new Error('Company ID is required');
      }

      const response = await api.get(`/business-units/company/${companyId}`);
      return extractArray<BusinessUnit>(response);
    } catch (error) {
      logError(
        `❌ Failed to fetch business units for company ${companyId}:`,
        error
      );
      throw error;
    }
  },

  async ensureUserBusinessUnit(
    userId: string,
    companyId: string
  ): Promise<BusinessUnit> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      if (!companyId || companyId === 'default') {
        throw new Error('Company ID is required');
      }

      const response = await api.post('/business-units/ensure', {
        userId,
        companyId,
      });
      const result = extractData<BusinessUnit>(response);

      if (!result || !hasIdProperty(result)) {
        throw new Error(
          'Failed to ensure user business unit: Invalid response'
        );
      }

      if (result.id && result.id !== 'default') {
        setBusinessUnitId(result.id);
      }

      return result;
    } catch (error) {
      logError('❌ Failed to ensure user business unit:', error);
      throw error;
    }
  },

  /**
   * Get business unit by code.
   *
   * ✅ FIXED: Now calls the correct path-param route
   *    (`/business-units/code/:code`) instead of the previous query-param
   *    call (`/business-units/code?code=...`) which always 404'd.
   */
  async getByCode(
    code: string,
    companyId?: string
  ): Promise<BusinessUnit | null> {
    try {
      if (!code) {
        throw new Error('Business unit code is required');
      }

      const normalizedCode = code.toUpperCase().trim();
      const params: Record<string, string> = {};
      if (companyId) params.companyId = companyId;

      const response = await api.get(
        `/business-units/code/${encodeURIComponent(normalizedCode)}`,
        Object.keys(params).length > 0 ? { params } : undefined
      );

      const result = extractData<BusinessUnit>(response);

      if (!result || !hasIdProperty(result)) {
        return null;
      }

      return result;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null;
      }
      logError(`❌ Failed to fetch business unit by code ${code}:`, error);
      return null;
    }
  },

  async getWithDetails(id: string): Promise<BusinessUnitDetails> {
    try {
      if (!id || id === 'default') {
        throw new Error('Business unit ID is required');
      }

      const response = await api.get(`/business-units/${id}/details`);
      const result = extractData<BusinessUnitDetails>(response);

      if (!result || !hasIdProperty(result)) {
        throw new Error(
          'Failed to get business unit details: Invalid response'
        );
      }

      return {
        id: result.id,
        name: result.name || '',
        code: result.code || '',
        address: result.address || null,
        phone: result.phone || null,
        email: result.email || null,
        companyId: result.companyId || '',
        isActive: result.isActive !== undefined ? result.isActive : true,
        type: result.type || 'STORE',
        createdAt: result.createdAt || new Date().toISOString(),
        updatedAt: result.updatedAt || new Date().toISOString(),
        deletedAt: result.deletedAt || null,
        products: result.products || [],
        inventory: result.inventory || [],
        users: result.users || [],
        counts: result.counts || {
          products: 0,
          inventory: 0,
          sales: 0,
          users: 0,
        },
      };
    } catch (error) {
      logError(`❌ Failed to fetch business unit details ${id}:`, error);
      throw error;
    }
  },

  // ============================================
  // ALIAS METHODS
  // ============================================

  async getAllBusinessUnits(params?: {
    page?: number;
    limit?: number;
    search?: string;
    companyId?: string;
    isActive?: boolean;
    includeDeleted?: boolean;
  }): Promise<PaginatedResponse<BusinessUnit>> {
    return this.getAll(params);
  },

  async getBusinessUnitById(id: string): Promise<BusinessUnit> {
    return this.getById(id);
  },

  async createBusinessUnit(
    data: Partial<BusinessUnit> & { type?: string }
  ): Promise<BusinessUnit> {
    return this.create(data);
  },

  async updateBusinessUnit(
    id: string,
    data: Partial<BusinessUnit> & { type?: string }
  ): Promise<BusinessUnit> {
    return this.update(id, data);
  },

  async deleteBusinessUnit(id: string): Promise<{ message: string }> {
    return this.delete(id);
  },

  async getBusinessUnitStats(id: string): Promise<BusinessUnitStats> {
    return this.getStats(id);
  },

  async bulkDeleteBusinessUnits(ids: string[]): Promise<BulkDeleteResult> {
    return this.bulkDelete(ids);
  },

  async getUsers(businessUnitId: string): Promise<BusinessUnitUser[]> {
    return this.getBusinessUnitUsers(businessUnitId);
  },

  async addUser(
    businessUnitId: string,
    userId: string,
    role: string
  ): Promise<BusinessUnitUser> {
    return this.addUserToBusinessUnit(businessUnitId, userId, role);
  },

  async removeUser(
    businessUnitId: string,
    userId: string
  ): Promise<{ message: string }> {
    return this.removeUserFromBusinessUnit(businessUnitId, userId);
  },
};

export default businessUnitService;
