// D:\Projects\Kalwanga\packages\web\services\companyService.ts

import { api } from './api';
import type {
  Company,
  CompanyStats,
  CreateCompanyDto,
  UpdateCompanyDto,
} from '../types/company';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ============================================================
// TYPE GUARDS (unchanged)
// ============================================================

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
function hasSuccessProperty(response: unknown): response is { success: unknown } {
  return isObject(response) && 'success' in response;
}
function hasMessageProperty(response: unknown): response is { message: unknown } {
  return isObject(response) && 'message' in response;
}
function hasIdProperty(obj: unknown): obj is { id: string } {
  return isObject(obj) && 'id' in obj && typeof obj.id === 'string';
}
function hasCompaniesProperty(
  response: unknown
): response is { companies: unknown } {
  return isObject(response) && 'companies' in response;
}

// ============================================================
// RESERVED ROUTE GUARD (unchanged, except 'reports' added)
// ============================================================
const RESERVED_ROUTE_IDS = new Set([
  'settings',
  'default',
  'search',
  'email',
  'by-business-unit',
  'ensure-user',
  'bulk',
  'export',
  'activity',
  'stats',
  'business-units',
  'default-business-unit',
  'new',
  'edit',
  'reports', // ✅ added — matches the new GET /companies/reports route
]);

function isReservedRouteId(id: string | undefined | null): boolean {
  if (!id) return false;
  return RESERVED_ROUTE_IDS.has(id);
}

function logError(context: string, error: unknown): void {
  const err = error as any;
  console.error(context, {
    message: err?.response?.data?.message || err?.message,
    status: err?.response?.status,
    url: err?.config?.url,
    params: err?.config?.params,
  });
}

function extractData<T>(response: unknown): T | null {
  if (!isObject(response)) return null;
  if (hasSuccessProperty(response) && hasDataProperty(response)) {
    return response.data as T;
  }
  if (hasDataProperty(response)) return response.data as T;
  if (hasCompaniesProperty(response)) return response.companies as T;
  return response as T;
}

function extractArray<T>(response: unknown): T[] {
  if (!isObject(response)) return [];
  if (hasSuccessProperty(response) && hasDataProperty(response)) {
    const data = response.data;
    if (Array.isArray(data)) return data as T[];
    if (isObject(data) && hasDataProperty(data) && Array.isArray(data.data)) {
      return data.data as T[];
    }
    if (
      isObject(data) &&
      hasCompaniesProperty(data) &&
      Array.isArray(data.companies)
    ) {
      return data.companies as T[];
    }
    return [];
  }
  if (hasDataProperty(response)) {
    const data = response.data;
    if (Array.isArray(data)) return data as T[];
    if (isObject(data) && hasDataProperty(data) && Array.isArray(data.data)) {
      return data.data as T[];
    }
    if (
      isObject(data) &&
      hasCompaniesProperty(data) &&
      Array.isArray(data.companies)
    ) {
      return data.companies as T[];
    }
    return [];
  }
  if (hasCompaniesProperty(response)) {
    const companies = response.companies;
    if (Array.isArray(companies)) return companies as T[];
    return [];
  }
  if (Array.isArray(response)) return response as T[];
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
  if (hasDataProperty(response) && isObject(response.data)) {
    const data = response.data;
    if ('total' in data) {
      const total = Number(data.total) || 0;
      const limit = ('limit' in data ? Number(data.limit) : 10) || 10;
      return {
        total,
        page: ('page' in data ? Number(data.page) : 1) || 1,
        totalPages: Math.ceil(total / limit) || 1,
        limit,
      };
    }
  }
  return { total: 0, page: 1, totalPages: 0, limit: 10 };
}

// ============================================================
// REQUEST DEDUPLICATION
// Concurrent callers of the same URL share one in-flight promise.
// This kills loops where 20 components all call getAll() at once.
// ============================================================

type PendingMap = Map<string, Promise<any>>;
const pendingRequests: PendingMap = new Map();

function requestKey(method: string, url: string, params?: any): string {
  const p = params ? JSON.stringify(params) : '';
  return `${method}::${url}::${p}`;
}

async function dedupedGet<T>(
  url: string,
  params?: Record<string, unknown>
): Promise<T> {
  const key = requestKey('GET', url, params);
  const existing = pendingRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = api
    .get(url, { params })
    .finally(() => {
      // Clean up after the request settles so a *later* call can refetch.
      pendingRequests.delete(key);
    });
  pendingRequests.set(key, promise);
  return promise as Promise<T>;
}

// ============================================================
// SHORT-LIVED CACHE
// Prevents a burst of identical calls within a few seconds
// (e.g. React StrictMode double-mount, layout+page both loading).
// ============================================================

interface CacheEntry {
  value: any;
  expiresAt: number;
}
const responseCache = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 5000; // 5 seconds

function cachedGet<T>(
  url: string,
  params?: Record<string, unknown>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const key = requestKey('GET', url, params);
  const now = Date.now();
  const hit = responseCache.get(key);
  if (hit && hit.expiresAt > now) {
    return Promise.resolve(hit.value as T);
  }
  return dedupedGet<T>(url, params).then((value) => {
    responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  });
}

function invalidateCompanyCaches(): void {
  for (const key of Array.from(responseCache.keys())) {
    if (key.includes('/companies')) {
      responseCache.delete(key);
    }
  }
}

// ============================================================
// MEMOIZED COMPANY ID LOOKUP
// Ensures getCompanyIdWithFallback() only hits the network once.
// ============================================================

let companyIdPromise: Promise<string> | null = null;

// ============================================================
// COMPANY SERVICE
// ============================================================

export const companyService = {
  /**
   * GET /companies
   * Get all companies with pagination
   */
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<PaginatedResponse<Company>> {
    try {
      const response = await cachedGet<any>('/companies', params as any);

      const data = extractArray<Company>(response);
      const pagination = extractPagination(response);

      return {
        data,
        total: pagination.total,
        page: pagination.page,
        totalPages: pagination.totalPages,
        limit: pagination.limit,
      };
    } catch (error) {
      logError('Failed to fetch companies:', error);
      return {
        data: [],
        total: 0,
        page: params?.page || 1,
        totalPages: 0,
        limit: params?.limit || 10,
      };
    }
  },

  async getAllRaw(): Promise<any> {
    try {
      return await api.get('/companies');
    } catch (error) {
      logError('Failed to fetch companies:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Company> {
    try {
      if (!id) throw new Error('Company ID is required');
      if (isReservedRouteId(id)) {
        throw new Error(
          `Invalid company ID: "${id}" is a reserved route segment, not a company identifier`
        );
      }
      const response = await cachedGet<any>(`/companies/${id}`);
      const result = extractData<Company>(response);
      if (!result || !hasIdProperty(result)) {
        throw new Error('Company not found');
      }
      if (result.id) this.setCompanyId(result.id);
      return result;
    } catch (error) {
      logError(`Failed to fetch company ${id}:`, error);
      throw error;
    }
  },

  async getByEmail(email: string): Promise<Company> {
    try {
      if (!email) throw new Error('Email is required');
      const response = await cachedGet<any>(`/companies/email/${email}`);
      const result = extractData<Company>(response);
      if (!result || !hasIdProperty(result)) {
        throw new Error('Company not found');
      }
      return result;
    } catch (error) {
      logError(`Failed to fetch company by email ${email}:`, error);
      throw error;
    }
  },

  async getOrCreateDefault(): Promise<Company> {
    try {
      const response = await cachedGet<any>('/companies/default');
      const result = extractData<Company>(response);
      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to get default company');
      }
      if (result.id) this.setCompanyId(result.id);
      return result;
    } catch (error) {
      logError('Failed to get or create default company:', error);
      throw error;
    }
  },

  async getStats(id: string): Promise<CompanyStats> {
    const empty: CompanyStats = {
      totalUsers: 0,
      totalBusinessUnits: 0,
      totalProducts: 0,
      totalSales: 0,
      totalRevenue: 0,
      totalCustomers: 0,
      totalSuppliers: 0,
    };
    try {
      if (!id || isReservedRouteId(id)) return empty;
      const response = await cachedGet<any>(`/companies/${id}/stats`);
      const result = extractData<CompanyStats>(response);
      if (!result || typeof result !== 'object') return empty;
      return {
        totalUsers: result.totalUsers || 0,
        totalBusinessUnits: result.totalBusinessUnits || 0,
        totalProducts: result.totalProducts || 0,
        totalSales: result.totalSales || 0,
        totalRevenue: result.totalRevenue || 0,
        totalCustomers: result.totalCustomers || 0,
        totalSuppliers: result.totalSuppliers || 0,
      };
    } catch (error) {
      logError(`Failed to fetch stats for company ${id}:`, error);
      return empty;
    }
  },

  // ============================================================
  // ✅ NEW: AGGREGATE REPORTS
  // GET /companies/reports
  //
  // Returns a dashboard-shaped object. The backend route is
  // registered BEFORE /:id, so this never collides with
  // getById('reports').
  //
  // Supported query params:
  //   - companyId       (scope to a single company)
  //   - startDate       (ISO string, inclusive)
  //   - endDate         (ISO string, inclusive)
  //   - includeInactive (boolean, default false)
  // ============================================================
  async getReports(params?: {
    companyId?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    includeInactive?: boolean;
  }): Promise<{
    totalCompanies: number;
    activeCompanies: number;
    inactiveCompanies: number;
    totalBusinessUnits: number;
    totalUsers: number;
    totalCustomers: number;
    totalSuppliers: number;
    totalProducts: number;
    totalRevenue: number;
    totalSales: number;
    companiesByCurrency: Array<{ currency: string; count: number }>;
    companiesByMonth: Array<{ month: string; count: number }>;
    companies: Array<{
      id: string;
      name: string;
      email: string;
      isActive: boolean;
      currency: string;
      createdAt: string;
      businessUnitCount: number;
      userCount: number;
      customerCount: number;
      supplierCount: number;
    }>;
    period: { startDate: string | null; endDate: string | null } | null;
    generatedAt: string;
  }> {
    const empty = {
      totalCompanies: 0,
      activeCompanies: 0,
      inactiveCompanies: 0,
      totalBusinessUnits: 0,
      totalUsers: 0,
      totalCustomers: 0,
      totalSuppliers: 0,
      totalProducts: 0,
      totalRevenue: 0,
      totalSales: 0,
      companiesByCurrency: [] as Array<{ currency: string; count: number }>,
      companiesByMonth: [] as Array<{ month: string; count: number }>,
      companies: [] as Array<{
        id: string;
        name: string;
        email: string;
        isActive: boolean;
        currency: string;
        createdAt: string;
        businessUnitCount: number;
        userCount: number;
        customerCount: number;
        supplierCount: number;
      }>,
      period: null as { startDate: string | null; endDate: string | null } | null,
      generatedAt: new Date().toISOString(),
    };

    try {
      // Normalize dates to ISO strings so the query-string
      // serialization is stable (and dedupe/cache keys match).
      const queryParams: Record<string, unknown> = {};
      if (params?.companyId) queryParams.companyId = params.companyId;
      if (params?.startDate) {
        queryParams.startDate =
          typeof params.startDate === 'string'
            ? params.startDate
            : params.startDate.toISOString();
      }
      if (params?.endDate) {
        queryParams.endDate =
          typeof params.endDate === 'string'
            ? params.endDate
            : params.endDate.toISOString();
      }
      if (params?.includeInactive !== undefined) {
        queryParams.includeInactive = params.includeInactive;
      }

      const response = await cachedGet<any>(
        '/companies/reports',
        queryParams
      );

      const result = extractData<any>(response);
      if (!result || typeof result !== 'object') {
        return empty;
      }

      return {
        totalCompanies: result.totalCompanies || 0,
        activeCompanies: result.activeCompanies || 0,
        inactiveCompanies:
          result.inactiveCompanies ??
          (result.totalCompanies || 0) - (result.activeCompanies || 0),
        totalBusinessUnits: result.totalBusinessUnits || 0,
        totalUsers: result.totalUsers || 0,
        totalCustomers: result.totalCustomers || 0,
        totalSuppliers: result.totalSuppliers || 0,
        totalProducts: result.totalProducts || 0,
        totalRevenue: result.totalRevenue || 0,
        totalSales: result.totalSales || 0,
        companiesByCurrency: Array.isArray(result.companiesByCurrency)
          ? result.companiesByCurrency
          : [],
        companiesByMonth: Array.isArray(result.companiesByMonth)
          ? result.companiesByMonth
          : [],
        companies: Array.isArray(result.companies) ? result.companies : [],
        period: result.period ?? null,
        generatedAt: result.generatedAt || new Date().toISOString(),
      };
    } catch (error) {
      logError('Failed to fetch company reports:', error);
      return empty;
    }
  },

  async getSettings(
    id: string
  ): Promise<{ settings: any; salesSettings: any }> {
    const empty = { settings: null, salesSettings: null };
    try {
      if (!id) throw new Error('Company ID is required');
      if (isReservedRouteId(id)) {
        throw new Error(
          `Invalid company ID: "${id}" is a reserved route segment, not a company identifier`
        );
      }
      const response = await cachedGet<any>(`/companies/${id}/settings`);
      const result = extractData<{ settings: any; salesSettings: any }>(
        response
      );
      return result || empty;
    } catch (error) {
      logError(`Failed to fetch settings for company ${id}:`, error);
      return empty;
    }
  },

  async updateSettings(
    id: string,
    data: { settings?: any; salesSettings?: any }
  ): Promise<any> {
    try {
      if (!id) throw new Error('Company ID is required');
      if (isReservedRouteId(id)) {
        throw new Error(
          `Invalid company ID: "${id}" is a reserved route segment, not a company identifier`
        );
      }
      const response = await api.put(`/companies/${id}/settings`, data);
      const result = extractData<any>(response);
      if (!result) throw new Error('Failed to update company settings');
      invalidateCompanyCaches();
      return result;
    } catch (error) {
      logError(`Failed to update settings for company ${id}:`, error);
      throw error;
    }
  },

  async create(data: CreateCompanyDto): Promise<Company> {
    try {
      if (!data.name || !data.email || !data.phone) {
        throw new Error('Name, email, and phone are required');
      }
      const payload: any = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        taxId: data.taxId,
        currency: data.currency || 'USD',
        timezone: data.timezone || 'UTC',
        logo: data.logo,
        isActive: data.isActive !== undefined ? data.isActive : true,
      };
      const response = await api.post('/companies', payload);
      const result = extractData<Company>(response);
      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to create company');
      }
      if (result.id) this.setCompanyId(result.id);
      if (result.businessUnits && result.businessUnits.length > 0) {
        localStorage.setItem('businessUnitId', result.businessUnits[0].id);
      }
      invalidateCompanyCaches();
      return result;
    } catch (error) {
      logError('Failed to create company:', error);
      throw error;
    }
  },

  async update(id: string, data: UpdateCompanyDto): Promise<Company> {
    try {
      if (!id || isReservedRouteId(id)) {
        throw new Error('Valid Company ID is required');
      }
      const response = await api.put(`/companies/${id}`, data);
      const result = extractData<Company>(response);
      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to update company');
      }
      invalidateCompanyCaches();
      return result;
    } catch (error) {
      logError(`Failed to update company ${id}:`, error);
      throw error;
    }
  },

  async delete(id: string): Promise<{ message: string }> {
    try {
      if (!id || isReservedRouteId(id)) {
        throw new Error('Valid Company ID is required');
      }
      const response = await api.delete(`/companies/${id}`);
      const result = extractData<{ message: string }>(response);
      invalidateCompanyCaches();
      if (result && hasMessageProperty(result)) {
        return { message: String(result.message) };
      }
      if (hasMessageProperty(response)) {
        return { message: String(response.message) };
      }
      return { message: 'Company deleted successfully' };
    } catch (error) {
      logError(`Failed to delete company ${id}:`, error);
      throw error;
    }
  },

  async ensureUserCompany(userId: string): Promise<Company> {
    try {
      if (!userId) throw new Error('User ID is required');
      const response = await api.post('/companies/ensure-user', { userId });
      const result = extractData<Company>(response);
      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to ensure user company');
      }
      if (result.id) this.setCompanyId(result.id);
      invalidateCompanyCaches();
      return result;
    } catch (error) {
      logError('Failed to ensure user company:', error);
      throw error;
    }
  },

  async addBusinessUnit(
    companyId: string,
    data: {
      name: string;
      code: string;
      address?: string;
      phone?: string;
      email?: string;
      type?: string;
    }
  ): Promise<any> {
    try {
      if (!companyId || isReservedRouteId(companyId)) {
        throw new Error('Valid Company ID is required');
      }
      if (!data.name || !data.code) {
        throw new Error('Business unit name and code are required');
      }
      const response = await api.post(
        `/companies/${companyId}/business-units`,
        data
      );
      const result = extractData<any>(response);
      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to add business unit');
      }
      invalidateCompanyCaches();
      return result;
    } catch (error) {
      logError(`Failed to add business unit to company ${companyId}:`, error);
      throw error;
    }
  },

  async getDefaultBusinessUnit(companyId: string): Promise<any> {
    try {
      if (!companyId || isReservedRouteId(companyId)) return null;
      const response = await cachedGet<any>(
        `/companies/${companyId}/default-business-unit`
      );
      return extractData<any>(response);
    } catch (error) {
      logError(
        `Failed to get default business unit for company ${companyId}:`,
        error
      );
      return null;
    }
  },

  async getCompanyByBusinessUnitId(businessUnitId: string): Promise<Company> {
    try {
      if (!businessUnitId) throw new Error('Business unit ID is required');
      const response = await cachedGet<any>(
        `/companies/by-business-unit/${businessUnitId}`
      );
      const result = extractData<Company>(response);
      if (!result || !hasIdProperty(result)) {
        throw new Error('Company not found for this business unit');
      }
      return result;
    } catch (error) {
      logError(
        `Failed to get company by business unit ${businessUnitId}:`,
        error
      );
      throw error;
    }
  },

  // ============================================
  // Helper Functions
  // ============================================

  getCompanyId(): string {
    try {
      const stored = localStorage.getItem('companyId');
      if (
        stored &&
        stored !== 'undefined' &&
        stored !== 'null' &&
        stored.length > 10 &&
        !isReservedRouteId(stored)
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
        if (
          user?.companyId &&
          user.companyId.length > 10 &&
          !isReservedRouteId(user.companyId)
        ) {
          return user.companyId;
        }
      }
    } catch (_e) {
      /* ignore */
    }
    try {
      const clerkUserStr = localStorage.getItem('clerk-user');
      if (clerkUserStr) {
        const clerkUser = JSON.parse(clerkUserStr);
        const cid = clerkUser?.publicMetadata?.companyId;
        if (cid && !isReservedRouteId(cid)) return cid;
      }
    } catch (_e) {
      /* ignore */
    }
    return '';
  },

  // ============================================================
  // MEMOIZED — only one in-flight lookup at a time
  // ============================================================
  async getCompanyIdWithFallback(): Promise<string> {
    const stored = this.getCompanyId();
    if (stored) return stored;

    if (companyIdPromise) return companyIdPromise;

    companyIdPromise = (async () => {
      try {
        const companies = await this.getAll({ limit: 1 });
        if (companies.data && companies.data.length > 0) {
          const companyId = companies.data[0].id;
          this.setCompanyId(companyId);
          return companyId;
        }
      } catch (_e) {
        /* ignore */
      }

      try {
        const defaultCompany = await this.getOrCreateDefault();
        if (defaultCompany && defaultCompany.id) {
          return defaultCompany.id;
        }
      } catch (_e) {
        /* ignore */
      }

      return '';
    })();

    try {
      const result = await companyIdPromise;
      return result;
    } finally {
      // Reset so a later call (after login/logout) can retry.
      companyIdPromise = null;
    }
  },

  getBusinessUnitId(): string {
    try {
      const stored = localStorage.getItem('businessUnitId');
      if (
        stored &&
        stored !== 'undefined' &&
        stored !== 'null' &&
        stored.length > 10
      ) {
        return stored;
      }
    } catch (_e) {
      /* ignore */
    }
    return '';
  },

  setCompanyId(companyId: string): void {
    if (!companyId || isReservedRouteId(companyId)) return;
    try {
      localStorage.setItem('companyId', companyId);
    } catch (_e) {
      /* ignore */
    }
  },

  setBusinessUnitId(businessUnitId: string): void {
    if (!businessUnitId) return;
    try {
      localStorage.setItem('businessUnitId', businessUnitId);
    } catch (_e) {
      /* ignore */
    }
  },

  clearCompanyId(): void {
    try {
      localStorage.removeItem('companyId');
    } catch (_e) {
      /* ignore */
    }
    companyIdPromise = null;
  },

  clearAll(): void {
    try {
      localStorage.removeItem('companyId');
      localStorage.removeItem('businessUnitId');
    } catch (_e) {
      /* ignore */
    }
    companyIdPromise = null;
  },

  isValidCompanyId(id: string): boolean {
    if (!id) return false;
    if (isReservedRouteId(id)) return false;
    const cuidRegex = /^c[a-z0-9]{24}$/i;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return cuidRegex.test(id) || uuidRegex.test(id);
  },

  async getCompanyName(id: string): Promise<string> {
    try {
      const company = await this.getById(id);
      return company.name;
    } catch (error) {
      logError(`Failed to get company name for ${id}:`, error);
      return 'Unknown Company';
    }
  },

  async getCompaniesByIds(ids: string[]): Promise<Company[]> {
    try {
      if (!ids || ids.length === 0) return [];
      const promises = ids.map((id) => this.getById(id));
      const results = await Promise.allSettled(promises);
      return results
        .filter(
          (result): result is PromiseFulfilledResult<Company> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value);
    } catch (error) {
      logError('Failed to get companies by IDs:', error);
      return [];
    }
  },

  async search(params: {
    query: string;
    limit?: number;
    page?: number;
    isActive?: boolean;
  }): Promise<PaginatedResponse<Company>> {
    try {
      const response = await cachedGet<any>('/companies/search', params as any);
      const data = extractArray<Company>(response);
      const pagination = extractPagination(response);
      return {
        data,
        total: pagination.total,
        page: pagination.page,
        totalPages: pagination.totalPages,
        limit: pagination.limit,
      };
    } catch (error) {
      logError('Failed to search companies:', error);
      return {
        data: [],
        total: 0,
        page: params?.page || 1,
        totalPages: 0,
        limit: params?.limit || 10,
      };
    }
  },

  async exportCompanies(params?: {
    format?: 'csv' | 'excel' | 'json';
    search?: string;
    isActive?: boolean;
  }): Promise<Blob> {
    try {
      const response = await api.get('/companies/export', {
        params,
        responseType: 'blob',
      });
      return response as Blob;
    } catch (error) {
      logError('Failed to export companies:', error);
      throw error;
    }
  },

  async getActiveCompanies(): Promise<Company[]> {
    try {
      const response = await this.getAll({ isActive: true });
      return response.data;
    } catch (error) {
      logError('Failed to get active companies:', error);
      return [];
    }
  },

  async getCompanyByName(name: string): Promise<Company | null> {
    try {
      if (!name) throw new Error('Company name is required');
      const response = await this.getAll({ search: name, limit: 1 });
      if (response.data && response.data.length > 0) return response.data[0];
      return null;
    } catch (error) {
      logError(`Failed to get company by name ${name}:`, error);
      return null;
    }
  },
};

export default companyService;
