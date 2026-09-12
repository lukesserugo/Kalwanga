// packages/web/services/customerService.ts
import { api } from './api';
import { Customer, CustomerSearchParams } from '../types';

// ─────────────────────────────────────────────────────────────
// Response shapes
// ─────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

interface BackendListResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface BackendSingleResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Peel off any accidental double-wrapping. Your `api.ts` may return
 * either:
 *   (a) the raw backend body: { success, data, pagination }
 *   (b) that body already unwrapped: { data, pagination }
 *   (c) an Axios response: { data: { success, data, pagination }, ... }
 *
 * This function returns the shape we actually care about, regardless
 * of how many layers the transport added.
 */
function unwrap<T = any>(input: any): T {
  if (!input || typeof input !== 'object') return input as T;

  // Case (c): an Axios-like response where `.data` is the backend body
  if ('status' in input && 'data' in input && 'headers' in input) {
    return unwrap<T>((input as any).data);
  }

  return input as T;
}

/**
 * Normalizes the list response into the PaginatedResponse shape the
 * UI expects. Never throws — always returns a valid (possibly empty)
 * object so the caller can render a proper empty state.
 */
function normalizeListResponse<T>(raw: any): PaginatedResponse<T> {
  const body = unwrap<any>(raw);

  // Backend may return { success, data: [...], pagination: {...} }
  // or      may return { data: [...], pagination: {...} }
  // or      may return an array directly
  const items: T[] = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body)
    ? body
    : [];

  const pagination = body?.pagination ?? body?.meta ?? {};

  return {
    data: items,
    total:
      typeof pagination.total === 'number' ? pagination.total : items.length,
    page: typeof pagination.page === 'number' ? pagination.page : 1,
    limit: typeof pagination.limit === 'number' ? pagination.limit : items.length || 20,
    totalPages:
      typeof pagination.totalPages === 'number'
        ? pagination.totalPages
        : Math.max(1, Math.ceil((pagination.total ?? items.length) / (pagination.limit ?? items.length ?? 20))),
  };
}

/**
 * Normalizes a single-entity response: strips wrappers and returns
 * just the payload.
 */
function normalizeSingleResponse<T>(raw: any): T {
  const body = unwrap<any>(raw);
  return (body?.data ?? body) as T;
}

// ─────────────────────────────────────────────────────────────
// Write-side sanitizer
// ─────────────────────────────────────────────────────────────

const CUSTOMER_WRITABLE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'address',
  'city',
  'state',
  'zipCode',
  'country',
  'notes',
  'isActive',
] as const;

function sanitizeCustomerPayload(
  data: Partial<Customer>
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const key of CUSTOMER_WRITABLE_FIELDS) {
    const value = (data as any)[key];
    if (value !== undefined) {
      clean[key] = value;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('🧹 Sanitized payload:', clean);
    if ('companyId' in clean) {
      console.error('❌ BUG: companyId leaked into sanitized payload');
    }
  }

  return clean;
}

// ─────────────────────────────────────────────────────────────
// Read-side sanitizer — drops undefined/null/empty/'default'
// from query params so we never send them on the wire.
// ─────────────────────────────────────────────────────────────

function sanitizeQueryParams(
  params?: CustomerSearchParams
): Record<string, unknown> {
  if (!params) return {};

  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (key === 'companyId' && value === 'default') continue;
    clean[key] = value;
  }

  return clean;
}

// ─────────────────────────────────────────────────────────────
// Customer service
// ─────────────────────────────────────────────────────────────

export const customerService = {
  /**
   * GET /customers
   * Backend scopes by req.user.companyId. Do not send companyId from here.
   */
  async getAllCustomers(
    params?: CustomerSearchParams
  ): Promise<PaginatedResponse<Customer>> {
    const cleanParams = sanitizeQueryParams(params);

    const res = await api.get<BackendListResponse<Customer>>('/customers', {
      params: cleanParams,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 raw res from api.get:', res);
    }

    return normalizeListResponse<Customer>(res);
  },

  /** GET /customers/:id */
  async getCustomerById(id: string): Promise<Customer> {
    const res = await api.get<BackendSingleResponse<Customer>>(
      `/customers/${id}`
    );
    return normalizeSingleResponse<Customer>(res);
  },

  /** POST /customers */
  async createCustomer(data: Partial<Customer>): Promise<Customer> {
    const payload = sanitizeCustomerPayload(data);
    const res = await api.post<BackendSingleResponse<Customer>>(
      '/customers',
      payload
    );
    return normalizeSingleResponse<Customer>(res);
  },

  /** PUT /customers/:id */
  async updateCustomer(
    id: string,
    data: Partial<Customer>
  ): Promise<Customer> {
    const payload = sanitizeCustomerPayload(data);
    const res = await api.put<BackendSingleResponse<Customer>>(
      `/customers/${id}`,
      payload
    );
    return normalizeSingleResponse<Customer>(res);
  },

  /** DELETE /customers/:id */
  async deleteCustomer(id: string): Promise<{ message: string }> {
    const res = await api.delete<BackendSingleResponse<null>>(
      `/customers/${id}`
    );
    const body = unwrap<any>(res);
    return { message: body?.message || 'Customer deleted successfully' };
  },

  /** POST /customers/:id/loyalty-points/add */
  async addLoyaltyPoints(
    customerId: string,
    points: number,
    reason?: string
  ): Promise<Customer> {
    const res = await api.post<BackendSingleResponse<Customer>>(
      `/customers/${customerId}/loyalty-points/add`,
      { points, reason }
    );
    return normalizeSingleResponse<Customer>(res);
  },

  /** POST /customers/:id/loyalty-points/redeem */
  async redeemLoyaltyPoints(
    customerId: string,
    points: number,
    reason?: string
  ): Promise<Customer> {
    const res = await api.post<BackendSingleResponse<Customer>>(
      `/customers/${customerId}/loyalty-points/redeem`,
      { points, reason }
    );
    return normalizeSingleResponse<Customer>(res);
  },

  /** GET /customers/:id/stats */
  async getCustomerStats(id: string): Promise<{
    totalOrders: number;
    totalSpent: number;
    averageSaleValue: number;
    totalSales: number;
    activeGiftCards: number;
    loyaltyPointsEarned: number;
    monthlySpent: number;
    monthlySales: number;
    yearlySpent: number;
    yearlySales: number;
  }> {
    const res = await api.get<BackendSingleResponse<any>>(
      `/customers/${id}/stats`
    );
    return normalizeSingleResponse<any>(res);
  },

  /** GET /customers/search?q=... */
  async searchCustomers(params: {
    query: string;
    limit?: number;
  }): Promise<Customer[]> {
    const cleanParams: Record<string, unknown> = { q: params.query };
    if (params.limit !== undefined) cleanParams.limit = params.limit;

    const res = await api.get<BackendSingleResponse<Customer[]>>(
      '/customers/search',
      { params: cleanParams }
    );

    const body = unwrap<any>(res);
    const items = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body)
      ? body
      : [];
    return items;
  },

  /** POST /customers/import */
  async importCustomers(
    file: File
  ): Promise<{ results: Customer[]; errors: any[] }> {
    return api.upload<{ results: Customer[]; errors: any[] }>(
      '/customers/import',
      file
    );
  },

  /** GET /customers/export */
  async exportCustomers(format: 'csv' | 'excel' = 'csv'): Promise<Blob> {
    return api.download(`/customers/export?format=${format}`);
  },
};

export default customerService;
