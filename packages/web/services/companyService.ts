// D:\Projects\Kalwanga\packages\web\services\companyService.ts

import { api } from './api';
import type { Company, CompanyStats, CreateCompanyDto, UpdateCompanyDto } from '../types/company';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ============================================
// TYPE GUARDS & HELPERS
// ============================================

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function hasDataProperty(response: unknown): response is { data: unknown } {
  return isObject(response) && 'data' in response;
}

function hasPaginationProperty(response: unknown): response is { pagination: unknown } {
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

function hasCompaniesProperty(response: unknown): response is { companies: unknown } {
  return isObject(response) && 'companies' in response;
}

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
  
  if (hasCompaniesProperty(response)) {
    return response.companies as T;
  }
  
  return response as T;
}

function extractArray<T>(response: unknown): T[] {
  if (!isObject(response)) {
    return [];
  }
  
  // Check for success wrapper with data
  if (hasSuccessProperty(response) && hasDataProperty(response)) {
    const data = response.data;
    if (Array.isArray(data)) {
      return data as T[];
    }
    if (isObject(data) && hasDataProperty(data) && Array.isArray(data.data)) {
      return data.data as T[];
    }
    if (isObject(data) && hasCompaniesProperty(data) && Array.isArray(data.companies)) {
      return data.companies as T[];
    }
    return [];
  }
  
  // Check for data property
  if (hasDataProperty(response)) {
    const data = response.data;
    if (Array.isArray(data)) {
      return data as T[];
    }
    if (isObject(data) && hasDataProperty(data) && Array.isArray(data.data)) {
      return data.data as T[];
    }
    if (isObject(data) && hasCompaniesProperty(data) && Array.isArray(data.companies)) {
      return data.companies as T[];
    }
    return [];
  }
  
  // Check for companies property directly
  if (hasCompaniesProperty(response)) {
    const companies = response.companies;
    if (Array.isArray(companies)) {
      return companies as T[];
    }
    return [];
  }
  
  // Check if response itself is an array
  if (Array.isArray(response)) {
    return response as T[];
  }
  
  return [];
}

function extractPagination(response: unknown): { total: number; page: number; totalPages: number; limit: number } {
  if (!isObject(response)) {
    return { total: 0, page: 1, totalPages: 0, limit: 10 };
  }
  
  // Check for pagination property
  if (hasPaginationProperty(response) && isObject(response.pagination)) {
    const pagination = response.pagination;
    return {
      total: ('total' in pagination ? Number(pagination.total) : 0) || 0,
      page: ('page' in pagination ? Number(pagination.page) : 1) || 1,
      totalPages: ('totalPages' in pagination ? Number(pagination.totalPages) : 0) || 0,
      limit: ('limit' in pagination ? Number(pagination.limit) : 10) || 10,
    };
  }
  
  // Check for direct pagination properties
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
  
  // Check for data wrapper with pagination
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

// ============================================
// COMPANY SERVICE
// ============================================

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
      const response = await api.get('/companies', { params });
      
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
      console.error('Failed to fetch companies:', error);
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
   * GET /companies
   * Get all companies (raw response, for internal use)
   */
  async getAllRaw(): Promise<any> {
    try {
      const response = await api.get('/companies');
      return response;
    } catch (error) {
      console.error('Failed to fetch companies:', error);
      throw error;
    }
  },

  /**
   * GET /companies/:id
   * Get company by ID with full details including business units
   */
  async getById(id: string): Promise<Company> {
    try {
      if (!id) {
        throw new Error('Company ID is required');
      }
      
      const response = await api.get(`/companies/${id}`);
      const result = extractData<Company>(response);
      
      if (!result || !hasIdProperty(result)) {
        throw new Error('Company not found');
      }
      
      // Store the company ID for future use
      if (result.id) {
        this.setCompanyId(result.id);
        localStorage.setItem('companyId', result.id);
      }
      
      return result;
    } catch (error) {
      console.error(`Failed to fetch company ${id}:`, error);
      throw error;
    }
  },

  /**
   * GET /companies/email/:email
   * Get company by email
   */
  async getByEmail(email: string): Promise<Company> {
    try {
      if (!email) {
        throw new Error('Email is required');
      }
      
      const response = await api.get(`/companies/email/${email}`);
      const result = extractData<Company>(response);
      
      if (!result || !hasIdProperty(result)) {
        throw new Error('Company not found');
      }
      
      return result;
    } catch (error) {
      console.error(`Failed to fetch company by email ${email}:`, error);
      throw error;
    }
  },

  /**
   * GET /companies/default
   * Get or create default company
   */
  async getOrCreateDefault(): Promise<Company> {
    try {
      const response = await api.get('/companies/default');
      const result = extractData<Company>(response);
      
      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to get default company');
      }
      
      // Store the company ID
      if (result.id) {
        this.setCompanyId(result.id);
        localStorage.setItem('companyId', result.id);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to get or create default company:', error);
      throw error;
    }
  },

  /**
   * GET /companies/:id/stats
   * Get company statistics
   */
  async getStats(id: string): Promise<CompanyStats> {
    try {
      if (!id) {
        throw new Error('Company ID is required');
      }
      
      const response = await api.get(`/companies/${id}/stats`);
      const result = extractData<CompanyStats>(response);
      
      if (!result || typeof result !== 'object') {
        return {
          totalUsers: 0,
          totalBusinessUnits: 0,
          totalProducts: 0,
          totalSales: 0,
          totalRevenue: 0,
          totalCustomers: 0,
          totalSuppliers: 0,
        };
      }
      
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
      console.error(`Failed to fetch stats for company ${id}:`, error);
      return {
        totalUsers: 0,
        totalBusinessUnits: 0,
        totalProducts: 0,
        totalSales: 0,
        totalRevenue: 0,
        totalCustomers: 0,
        totalSuppliers: 0,
      };
    }
  },

  /**
   * GET /companies/:id/settings
   * Get company settings
   */
  async getSettings(id: string): Promise<{ settings: any; salesSettings: any }> {
    try {
      if (!id) {
        throw new Error('Company ID is required');
      }
      
      const response = await api.get(`/companies/${id}/settings`);
      const result = extractData<{ settings: any; salesSettings: any }>(response);
      
      if (!result) {
        return { settings: null, salesSettings: null };
      }
      
      return result;
    } catch (error) {
      console.error(`Failed to fetch settings for company ${id}:`, error);
      return { settings: null, salesSettings: null };
    }
  },

  /**
   * PUT /companies/:id/settings
   * Update company settings
   */
  async updateSettings(id: string, data: any): Promise<any> {
    try {
      if (!id) {
        throw new Error('Company ID is required');
      }
      
      const response = await api.put(`/companies/${id}/settings`, data);
      const result = extractData<any>(response);
      
      if (!result) {
        throw new Error('Failed to update company settings');
      }
      
      return result;
    } catch (error) {
      console.error(`Failed to update settings for company ${id}:`, error);
      throw error;
    }
  },

  /**
   * POST /companies
   * Create a new company with default business unit
   */
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
      
      // Store the company ID
      if (result.id) {
        this.setCompanyId(result.id);
        localStorage.setItem('companyId', result.id);
      }
      
      // Store business unit ID if returned
      if (result.businessUnits && result.businessUnits.length > 0) {
        const businessUnitId = result.businessUnits[0].id;
        localStorage.setItem('businessUnitId', businessUnitId);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to create company:', error);
      throw error;
    }
  },

  /**
   * PUT /companies/:id
   * Update a company
   */
  async update(id: string, data: UpdateCompanyDto): Promise<Company> {
    try {
      if (!id) {
        throw new Error('Company ID is required');
      }
      
      const response = await api.put(`/companies/${id}`, data);
      const result = extractData<Company>(response);
      
      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to update company');
      }
      
      return result;
    } catch (error) {
      console.error(`Failed to update company ${id}:`, error);
      throw error;
    }
  },

  /**
   * DELETE /companies/:id
   * Delete a company
   */
  async delete(id: string): Promise<{ message: string }> {
    try {
      if (!id) {
        throw new Error('Company ID is required');
      }
      
      const response = await api.delete(`/companies/${id}`);
      const result = extractData<{ message: string }>(response);
      
      if (result && hasMessageProperty(result)) {
        return { message: String(result.message) };
      }
      
      if (hasMessageProperty(response)) {
        return { message: String(response.message) };
      }
      
      return { message: 'Company deleted successfully' };
    } catch (error) {
      console.error(`Failed to delete company ${id}:`, error);
      throw error;
    }
  },

  /**
   * POST /companies/ensure-user
   * Ensure a user has a company
   */
  async ensureUserCompany(userId: string): Promise<Company> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      const response = await api.post('/companies/ensure-user', { userId });
      const result = extractData<Company>(response);
      
      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to ensure user company');
      }
      
      // Store the company ID
      if (result.id) {
        this.setCompanyId(result.id);
        localStorage.setItem('companyId', result.id);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to ensure user company:', error);
      throw error;
    }
  },

  /**
   * POST /companies/:id/business-units
   * Add a business unit to a company
   */
  async addBusinessUnit(companyId: string, data: {
    name: string;
    code: string;
    address?: string;
    phone?: string;
    email?: string;
    type?: string;
  }): Promise<any> {
    try {
      if (!companyId) {
        throw new Error('Company ID is required');
      }
      if (!data.name || !data.code) {
        throw new Error('Business unit name and code are required');
      }
      
      const response = await api.post(`/companies/${companyId}/business-units`, data);
      const result = extractData<any>(response);
      
      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to add business unit');
      }
      
      return result;
    } catch (error) {
      console.error(`Failed to add business unit to company ${companyId}:`, error);
      throw error;
    }
  },

  /**
   * GET /companies/:id/default-business-unit
   * Get the default business unit for a company
   */
  async getDefaultBusinessUnit(companyId: string): Promise<any> {
    try {
      if (!companyId) {
        throw new Error('Company ID is required');
      }
      
      const response = await api.get(`/companies/${companyId}/default-business-unit`);
      const result = extractData<any>(response);
      
      return result;
    } catch (error) {
      console.error(`Failed to get default business unit for company ${companyId}:`, error);
      return null;
    }
  },

  /**
   * GET /companies/by-business-unit/:businessUnitId
   * Get company by business unit ID
   */
  async getCompanyByBusinessUnitId(businessUnitId: string): Promise<Company> {
    try {
      if (!businessUnitId) {
        throw new Error('Business unit ID is required');
      }
      
      const response = await api.get(`/companies/by-business-unit/${businessUnitId}`);
      const result = extractData<Company>(response);
      
      if (!result || !hasIdProperty(result)) {
        throw new Error('Company not found for this business unit');
      }
      
      return result;
    } catch (error) {
      console.error(`Failed to get company by business unit ${businessUnitId}:`, error);
      throw error;
    }
  },

  // ============================================
  // Helper Functions
  // ============================================

  /**
   * Get company ID from storage
   */
  getCompanyId(): string {
    // Try from localStorage first
    try {
      const stored = localStorage.getItem('companyId');
      if (stored && stored !== 'undefined' && stored !== 'null' && stored.length > 10) {
        return stored;
      }
    } catch (_e) {
      // Ignore
    }

    // Try from user object
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user?.companyId && user.companyId.length > 10) {
          return user.companyId;
        }
      }
    } catch (_e) {
      // Ignore
    }

    // Try from Clerk user metadata
    try {
      const clerkUserStr = localStorage.getItem('clerk-user');
      if (clerkUserStr) {
        const clerkUser = JSON.parse(clerkUserStr);
        if (clerkUser?.publicMetadata?.companyId) {
          return clerkUser.publicMetadata.companyId;
        }
      }
    } catch (_e) {
      // Ignore
    }

    return '';
  },

  /**
   * Get company ID from storage with fallback to fetch
   */
  async getCompanyIdWithFallback(): Promise<string> {
    const stored = this.getCompanyId();
    if (stored) {
      return stored;
    }
    
    // Try to get from API
    try {
      const companies = await this.getAll({ limit: 1 });
      if (companies.data && companies.data.length > 0) {
        const companyId = companies.data[0].id;
        this.setCompanyId(companyId);
        localStorage.setItem('companyId', companyId);
        return companyId;
      }
    } catch (_e) {
      // Ignore
    }
    
    // Try to get or create default
    try {
      const defaultCompany = await this.getOrCreateDefault();
      if (defaultCompany && defaultCompany.id) {
        return defaultCompany.id;
      }
    } catch (_e) {
      // Ignore
    }
    
    return '';
  },

  /**
   * Get business unit ID from storage
   */
  getBusinessUnitId(): string {
    try {
      const stored = localStorage.getItem('businessUnitId');
      if (stored && stored !== 'undefined' && stored !== 'null' && stored.length > 10) {
        return stored;
      }
    } catch (_e) {
      // Ignore
    }
    return '';
  },

  /**
   * Set company ID in storage
   */
  setCompanyId(companyId: string): void {
    if (!companyId) return;
    try {
      localStorage.setItem('companyId', companyId);
    } catch (_e) {
      // Ignore
    }
  },

  /**
   * Set business unit ID in storage
   */
  setBusinessUnitId(businessUnitId: string): void {
    if (!businessUnitId) return;
    try {
      localStorage.setItem('businessUnitId', businessUnitId);
    } catch (_e) {
      // Ignore
    }
  },

  /**
   * Clear company ID from storage
   */
  clearCompanyId(): void {
    try {
      localStorage.removeItem('companyId');
    } catch (_e) {
      // Ignore
    }
  },

  /**
   * Clear all company-related data from storage
   */
  clearAll(): void {
    try {
      localStorage.removeItem('companyId');
      localStorage.removeItem('businessUnitId');
    } catch (_e) {
      // Ignore
    }
  },

  /**
   * Check if a company ID is valid
   */
  isValidCompanyId(id: string): boolean {
    if (!id) return false;
    // CUID format: starts with 'c' and is 25 characters
    const cuidRegex = /^c[a-z0-9]{24}$/i;
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return cuidRegex.test(id) || uuidRegex.test(id);
  },

  /**
   * Get company name from ID (useful for display)
   */
  async getCompanyName(id: string): Promise<string> {
    try {
      const company = await this.getById(id);
      return company.name;
    } catch (error) {
      console.error(`Failed to get company name for ${id}:`, error);
      return 'Unknown Company';
    }
  },

  /**
   * Get multiple companies by IDs
   */
  async getCompaniesByIds(ids: string[]): Promise<Company[]> {
    try {
      if (!ids || ids.length === 0) return [];
      
      // Since we don't have a bulk endpoint, fetch individually
      const promises = ids.map(id => this.getById(id));
      const results = await Promise.allSettled(promises);
      
      return results
        .filter((result): result is PromiseFulfilledResult<Company> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value);
    } catch (error) {
      console.error('Failed to get companies by IDs:', error);
      return [];
    }
  },

  /**
   * Search companies with advanced filters
   */
  async search(params: {
    query: string;
    limit?: number;
    page?: number;
    isActive?: boolean;
  }): Promise<PaginatedResponse<Company>> {
    try {
      const response = await api.get('/companies/search', { params });
      
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
      console.error('Failed to search companies:', error);
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
   * Export companies data
   */
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
      console.error('Failed to export companies:', error);
      throw error;
    }
  },

  /**
   * Get active companies only
   */
  async getActiveCompanies(): Promise<Company[]> {
    try {
      const response = await this.getAll({ isActive: true });
      return response.data;
    } catch (error) {
      console.error('Failed to get active companies:', error);
      return [];
    }
  },

  /**
   * Get company by name
   */
  async getCompanyByName(name: string): Promise<Company | null> {
    try {
      if (!name) {
        throw new Error('Company name is required');
      }
      
      const response = await this.getAll({ search: name, limit: 1 });
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch (error) {
      console.error(`Failed to get company by name ${name}:`, error);
      return null;
    }
  },
};

export default companyService;
