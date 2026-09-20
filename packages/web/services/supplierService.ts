// D:\Projects\Kalwanga\packages\web\services\supplierService.ts

import { api } from './api';

// ============================================
// CANONICAL TYPE IMPORTS
// ============================================
//
// Every domain model comes from `../types/supplier`. The module owns
// Supplier, SupplierContact, SupplierProduct, SupplierPayment,
// SupplierRating, SupplierStatistics, SupplierPerformance,
// SupplierOrderHistory, SupplierSearchParams, SupplierFilterOptions,
// SupplierResponse, BulkSupplierOperationResult, SupplierImportData,
// SupplierExportOptions, and PurchaseOrder (via re-export from
// `./purchaseOrder`).
//
// All imports are type-only so the compiler erases them and no
// runtime cycle forms between this service and the type layer.

import type {
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
  SupplierSummary,
  PurchaseOrder,
} from '../types/supplier';

// Re-export the canonical names so callers that imported them from
// `../services/supplierService` keep compiling. The canonical
// declarations remain in `../types/supplier`.

export type {
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
  SupplierSummary,
  PurchaseOrder,
};

// ============================================
// LOCAL RESPONSE ENVELOPE
// ============================================
//
// This describes the shape the *service* returns to its callers. It
// is not a domain model — the domain model `Supplier` comes from
// `../types/supplier`.

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Placeholder IDs the frontend must NEVER send to the backend.
 * If we see one of these, we throw a clear error before the request
 * leaves the browser — saving a round-trip and surfacing the real
 * problem to the developer/user immediately.
 */
const PLACEHOLDER_COMPANY_IDS = new Set([
  'default',
  'default-company',
  'default-company-id',
  'null',
  'undefined',
  '',
]);

const PLACEHOLDER_USER_IDS = new Set([
  'default',
  'default-user',
  'default-user-id',
  'null',
  'undefined',
  '',
]);

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * A user-facing error class so callers can distinguish between
 * "we rejected this locally" and "the server rejected this".
 */
export class SupplierValidationError extends Error {
  public readonly field: string;
  public readonly code: string;

  constructor(field: string, message: string, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'SupplierValidationError';
    this.field = field;
    this.code = code;
  }
}

/**
 * Log the current call site. Called when a placeholder ID is
 * detected so the developer can immediately see *which* component
 * is still passing "default".
 */
function traceCaller(label: string): void {
  // Only run this in development. In production we don't want
  // the extra stack-trace cost.
  if (process.env.NODE_ENV === 'production') return;

  try {
    const stack = new Error().stack;
    if (!stack) return;

    const lines = stack.split('\n');
    const meaningful = lines
      .slice(2, 8) // skip Error + traceCaller + assertX
      .map((l) => '    ' + l.trim())
      .join('\n');

    console.warn(`[supplierService] ${label} — call stack:\n${meaningful}`);
  } catch {
    /* ignore */
  }
}

/**
 * Ensure a companyId is present and not a placeholder.
 * Throws SupplierValidationError if invalid.
 *
 * NOTE: Declared as a `function` (not an arrow `const`) because
 * TypeScript requires assertion signatures (`asserts x is T`) to be
 * attached to a function declaration or an explicitly-typed const.
 * Using an untyped arrow-function const triggers TS2775.
 */
function assertValidCompanyId(
  companyId: string | undefined | null
): asserts companyId is string {
  if (!companyId || typeof companyId !== 'string') {
    traceCaller('Missing company ID');
    throw new SupplierValidationError(
      'companyId',
      'Company ID is required. Please select a company before continuing.',
      'MISSING_COMPANY_ID'
    );
  }

  const trimmed = companyId.trim();
  if (trimmed === '') {
    traceCaller('Empty company ID');
    throw new SupplierValidationError(
      'companyId',
      'Company ID cannot be empty.',
      'MISSING_COMPANY_ID'
    );
  }

  if (PLACEHOLDER_COMPANY_IDS.has(trimmed.toLowerCase())) {
    traceCaller(`Rejected placeholder companyId="${trimmed}"`);
    throw new SupplierValidationError(
      'companyId',
      `Invalid company ID "${trimmed}". Please select a real company.`,
      'PLACEHOLDER_COMPANY_ID'
    );
  }
}

/**
 * Ensure a userId is present and not a placeholder.
 *
 * NOTE: This only checks the FORMAT/shape of the ID. It accepts both
 * the Prisma User CUID (e.g. "cmu4l93cr00045kc90tx9rzdj") and the
 * Clerk user ID (e.g. "user_3HxSsg839NHqUGCeoZH5MgdlvUw"). The
 * backend is responsible for resolving whichever form is sent.
 */
function assertValidUserId(
  userId: string | undefined | null
): asserts userId is string {
  if (!userId || typeof userId !== 'string') {
    traceCaller('Missing user ID');
    throw new SupplierValidationError(
      'userId',
      'User ID is required. Please log in again.',
      'MISSING_USER_ID'
    );
  }

  const trimmed = userId.trim();
  if (trimmed === '') {
    traceCaller('Empty user ID');
    throw new SupplierValidationError(
      'userId',
      'User ID cannot be empty.',
      'MISSING_USER_ID'
    );
  }

  if (PLACEHOLDER_USER_IDS.has(trimmed.toLowerCase())) {
    traceCaller(`Rejected placeholder userId="${trimmed}"`);
    throw new SupplierValidationError(
      'userId',
      `Invalid user ID "${trimmed}". Please log in again.`,
      'PLACEHOLDER_USER_ID'
    );
  }
}

/**
 * Ensure an entity ID (supplier, contact, product, etc.) is non-empty.
 */
function assertValidId(
  id: string | undefined | null,
  label = 'ID'
): asserts id is string {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    traceCaller(`Missing ${label}`);
    throw new SupplierValidationError(
      'id',
      `${label} is required.`,
      'MISSING_ID'
    );
  }
}

// ============================================
// RESPONSE EXTRACTORS
// ============================================

const extractData = <T>(response: any): T => {
  if (response && typeof response === 'object') {
    if ('data' in response) {
      return response.data as T;
    }
    return response as T;
  }
  throw new Error('Invalid response format');
};

const extractArrayData = <T>(response: any): T[] => {
  if (response && typeof response === 'object') {
    if ('data' in response && Array.isArray(response.data)) {
      return response.data as T[];
    }
    if (Array.isArray(response)) {
      return response as T[];
    }
    if (
      'data' in response &&
      response.data &&
      typeof response.data === 'object' &&
      'data' in response.data &&
      Array.isArray(response.data.data)
    ) {
      return response.data.data as T[];
    }
  }
  return [];
};

const extractPaginatedResponse = <T>(
  response: any,
  defaultParams?: { page?: number; limit?: number }
): PaginatedResponse<T> => {
  if (response && typeof response === 'object') {
    if ('data' in response && 'total' in response) {
      const data = Array.isArray(response.data) ? response.data : [];
      const total =
        typeof response.total === 'number' ? response.total : data.length;

      return {
        data,
        total,
        page:
          typeof response.page === 'number'
            ? response.page
            : defaultParams?.page || 1,
        totalPages:
          typeof response.totalPages === 'number'
            ? response.totalPages
            : Math.ceil(total / (defaultParams?.limit || 10)) || 1,
        limit:
          typeof response.limit === 'number'
            ? response.limit
            : defaultParams?.limit || 10,
      };
    }

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

  return {
    data: [],
    total: 0,
    page: defaultParams?.page || 1,
    totalPages: 0,
    limit: defaultParams?.limit || 10,
  };
};

const extractMessageResponse = (
  response: any,
  fallbackMessage: string
): { message: string } => {
  if (response && typeof response === 'object') {
    if ('data' in response && response.data && typeof response.data === 'object') {
      if ('message' in response.data) {
        return { message: String(response.data.message) };
      }
    }
    if ('message' in response) {
      return { message: String(response.message) };
    }
  }
  return { message: fallbackMessage };
};

// ============================================
// TYPES
// ============================================

/**
 * The shape passed to `createSupplier`. It mirrors the backend's
 * `createSupplierSchema` so TypeScript catches omissions at compile
 * time and Zod catches them at runtime.
 *
 * `companyId` and `userId` are REQUIRED. `companyId` must be a real
 * database CUID. `userId` may be either the Prisma User.id CUID or
 * the Clerk user ID — the backend resolves both.
 */
export interface CreateSupplierInput {
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
  website?: string;
  notes?: string;
  rating?: number;
  creditLimit?: number;
}

export interface UpdateSupplierInput {
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
  website?: string;
  rating?: number;
  creditLimit?: number;
}

// ============================================
// SERVICE
// ============================================

export const supplierService = {
  // ============================================
  // SUPPLIER CRUD OPERATIONS
  // ============================================

  /**
   * Get all suppliers — GET /suppliers
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
   * Get paginated suppliers — GET /suppliers
   */
  async getPaginatedSuppliers(
    params?: SupplierSearchParams
  ): Promise<PaginatedResponse<Supplier>> {
    try {
      const response = await api.get('/suppliers', { params });
      return extractPaginatedResponse<Supplier>(response, params);
    } catch (error) {
      console.error('Failed to fetch paginated suppliers:', error);
      throw error;
    }
  },

  /**
   * Get supplier by ID — GET /suppliers/:id
   */
  async getSupplierById(id: string, companyId?: string): Promise<Supplier> {
    assertValidId(id, 'Supplier ID');
    try {
      const response = await api.get(`/suppliers/${id}`, {
        params: { companyId },
      });
      return extractData<Supplier>(response);
    } catch (error) {
      console.error(`Failed to fetch supplier ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create supplier — POST /suppliers
   *
   * Validates `companyId` and `userId` locally before the request
   * leaves the browser. This is what prevents the backend from ever
   * seeing `"default"` and returning a cryptic foreign-key error.
   *
   * The `userId` may be either:
   *   - a Prisma User.id CUID (e.g. "cmu4l93cr00045kc90tx9rzdj")
   *   - a Clerk user ID         (e.g. "user_3HxSsg839NHqUGCeoZH5MgdlvUw")
   *
   * The backend's `resolveUserId()` resolves both forms against the
   * `User` table (by `id` first, then by `clerkId`).
   */
  async createSupplier(data: CreateSupplierInput): Promise<Supplier> {
    // ---- Local validation (throws SupplierValidationError) ----------
    if (!data.name || data.name.trim().length < 2) {
      throw new SupplierValidationError(
        'name',
        'Supplier name must be at least 2 characters.',
        'INVALID_NAME'
      );
    }

    assertValidCompanyId(data.companyId);
    assertValidUserId(data.userId);

    // ---- Normalise the payload -------------------------------------
    const payload: Record<string, unknown> = {
      name: data.name.trim(),
      companyId: data.companyId.trim(),
      userId: data.userId.trim(),
      isActive: data.isActive ?? true,
    };

    // Only attach optional fields when they have real values.
    if (data.contactPerson?.trim()) payload.contactPerson = data.contactPerson.trim();
    if (data.email?.trim()) payload.email = data.email.trim();
    if (data.phone?.trim()) payload.phone = data.phone.trim();
    if (data.address?.trim()) payload.address = data.address.trim();
    if (data.taxId?.trim()) payload.taxId = data.taxId.trim();
    if (data.notes?.trim()) payload.notes = data.notes.trim();
    if (data.paymentTerms?.trim()) payload.paymentTerms = data.paymentTerms.trim();
    if (data.deliveryTerms?.trim()) payload.deliveryTerms = data.deliveryTerms.trim();
    if (data.website?.trim()) payload.website = data.website.trim();
    if (data.rating !== undefined && data.rating !== null) payload.rating = data.rating;
    if (data.creditLimit !== undefined && data.creditLimit !== null) {
      payload.creditLimit = data.creditLimit;
    }

    console.log('📤 [supplierService] POST /suppliers', payload);

    try {
      const response = await api.post('/suppliers', payload);
      console.log('✅ [supplierService] Supplier created');
      return extractData<Supplier>(response);
    } catch (error) {
      console.error('❌ [supplierService] Failed to create supplier:', error);
      throw error;
    }
  },

  /**
   * Update supplier — PUT /suppliers/:id
   */
  async updateSupplier(
    id: string,
    data: UpdateSupplierInput
  ): Promise<Supplier> {
    assertValidId(id, 'Supplier ID');

    try {
      const response = await api.put(`/suppliers/${id}`, data);
      return extractData<Supplier>(response);
    } catch (error) {
      console.error(`Failed to update supplier ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete supplier — DELETE /suppliers/:id
   */
  async deleteSupplier(
    id: string,
    companyId?: string
  ): Promise<{ message: string }> {
    assertValidId(id, 'Supplier ID');
    try {
      const response = await api.delete(`/suppliers/${id}`, {
        params: { companyId },
      });
      return extractMessageResponse(response, 'Supplier deleted successfully');
    } catch (error) {
      console.error(`Failed to delete supplier ${id}:`, error);
      throw error;
    }
  },

  /**
   * Toggle supplier status — PATCH /suppliers/:id/status
   */
  async toggleSupplierStatus(id: string, isActive: boolean): Promise<Supplier> {
    assertValidId(id, 'Supplier ID');
    if (typeof isActive !== 'boolean') {
      throw new SupplierValidationError(
        'isActive',
        'isActive must be a boolean.',
        'INVALID_IS_ACTIVE'
      );
    }

    try {
      const response = await api.patch(`/suppliers/${id}/status`, {
        isActive,
      });
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
   * Search suppliers — GET /suppliers/search
   */
  async searchSuppliers(params: {
    query: string;
    companyId?: string;
    limit?: number;
  }): Promise<Supplier[]> {
    if (!params.query || params.query.trim() === '') {
      throw new SupplierValidationError(
        'query',
        'Search query is required.',
        'MISSING_QUERY'
      );
    }

    try {
      const response = await api.get('/suppliers/search', { params });
      return extractArrayData<Supplier>(response);
    } catch (error) {
      console.error('Failed to search suppliers:', error);
      return [];
    }
  },

  /**
   * Filter suppliers — GET /suppliers/filter
   */
  async filterSuppliers(
    filters: SupplierFilterOptions & {
      companyId?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedResponse<Supplier>> {
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

  async getSupplierContacts(
    supplierId: string
  ): Promise<SupplierContact[]> {
    assertValidId(supplierId, 'Supplier ID');
    try {
      const response = await api.get(`/suppliers/${supplierId}/contacts`);
      return extractArrayData<SupplierContact>(response);
    } catch (error) {
      console.error(
        `Failed to fetch contacts for supplier ${supplierId}:`,
        error
      );
      return [];
    }
  },

  async addSupplierContact(
    supplierId: string,
    data: Omit<
      SupplierContact,
      'id' | 'supplierId' | 'createdAt' | 'updatedAt'
    >
  ): Promise<SupplierContact> {
    assertValidId(supplierId, 'Supplier ID');
    try {
      const response = await api.post(
        `/suppliers/${supplierId}/contacts`,
        data
      );
      return extractData<SupplierContact>(response);
    } catch (error) {
      console.error(`Failed to add contact for supplier ${supplierId}:`, error);
      throw error;
    }
  },

  async updateSupplierContact(
    contactId: string,
    data: Partial<SupplierContact>
  ): Promise<SupplierContact> {
    assertValidId(contactId, 'Contact ID');
    try {
      const response = await api.put(`/suppliers/contacts/${contactId}`, data);
      return extractData<SupplierContact>(response);
    } catch (error) {
      console.error(`Failed to update contact ${contactId}:`, error);
      throw error;
    }
  },

  async deleteSupplierContact(
    contactId: string
  ): Promise<{ message: string }> {
    assertValidId(contactId, 'Contact ID');
    try {
      const response = await api.delete(`/suppliers/contacts/${contactId}`);
      return extractMessageResponse(response, 'Contact deleted successfully');
    } catch (error) {
      console.error(`Failed to delete contact ${contactId}:`, error);
      throw error;
    }
  },

  // ============================================
  // SUPPLIER PRODUCTS
  // ============================================

  async getSupplierProducts(
    supplierId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<SupplierProduct>> {
    assertValidId(supplierId, 'Supplier ID');
    try {
      const response = await api.get(`/suppliers/${supplierId}/products`, {
        params,
      });
      return extractPaginatedResponse<SupplierProduct>(response, params);
    } catch (error) {
      console.error(
        `Failed to fetch products for supplier ${supplierId}:`,
        error
      );
      throw error;
    }
  },

  async addSupplierProduct(
    supplierId: string,
    data: Omit<
      SupplierProduct,
      'id' | 'supplierId' | 'createdAt' | 'updatedAt'
    >
  ): Promise<SupplierProduct> {
    assertValidId(supplierId, 'Supplier ID');
    try {
      const response = await api.post(
        `/suppliers/${supplierId}/products`,
        data
      );
      return extractData<SupplierProduct>(response);
    } catch (error) {
      console.error(`Failed to add product for supplier ${supplierId}:`, error);
      throw error;
    }
  },

  async updateSupplierProduct(
    productId: string,
    data: Partial<SupplierProduct>
  ): Promise<SupplierProduct> {
    assertValidId(productId, 'Product ID');
    try {
      const response = await api.put(`/suppliers/products/${productId}`, data);
      return extractData<SupplierProduct>(response);
    } catch (error) {
      console.error(`Failed to update product ${productId}:`, error);
      throw error;
    }
  },

  async deleteSupplierProduct(
    productId: string
  ): Promise<{ message: string }> {
    assertValidId(productId, 'Product ID');
    try {
      const response = await api.delete(`/suppliers/products/${productId}`);
      return extractMessageResponse(
        response,
        'Product removed from supplier successfully'
      );
    } catch (error) {
      console.error(`Failed to delete product ${productId}:`, error);
      throw error;
    }
  },

  // ============================================
  // SUPPLIER PAYMENTS
  // ============================================

  async getSupplierPayments(
    supplierId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<SupplierPayment>> {
    assertValidId(supplierId, 'Supplier ID');
    try {
      const response = await api.get(`/suppliers/${supplierId}/payments`, {
        params,
      });
      return extractPaginatedResponse<SupplierPayment>(response, params);
    } catch (error) {
      console.error(
        `Failed to fetch payments for supplier ${supplierId}:`,
        error
      );
      throw error;
    }
  },

  async recordSupplierPayment(
    supplierId: string,
    data: Omit<
      SupplierPayment,
      'id' | 'supplierId' | 'createdAt' | 'updatedAt'
    >
  ): Promise<SupplierPayment> {
    assertValidId(supplierId, 'Supplier ID');
    try {
      const response = await api.post(
        `/suppliers/${supplierId}/payments`,
        data
      );
      return extractData<SupplierPayment>(response);
    } catch (error) {
      console.error(
        `Failed to record payment for supplier ${supplierId}:`,
        error
      );
      throw error;
    }
  },

  // ============================================
  // SUPPLIER RATINGS & REVIEWS
  // ============================================

  async getSupplierRatings(
    supplierId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<SupplierRating>> {
    assertValidId(supplierId, 'Supplier ID');
    try {
      const response = await api.get(`/suppliers/${supplierId}/ratings`, {
        params,
      });
      return extractPaginatedResponse<SupplierRating>(response, params);
    } catch (error) {
      console.error(
        `Failed to fetch ratings for supplier ${supplierId}:`,
        error
      );
      throw error;
    }
  },

  async rateSupplier(
    supplierId: string,
    data: { rating: number; review?: string; businessUnitId: string }
  ): Promise<SupplierRating> {
    assertValidId(supplierId, 'Supplier ID');
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

  async getSupplierStatistics(
    companyId?: string
  ): Promise<SupplierStatistics> {
    try {
      const response = await api.get('/suppliers/statistics', {
        params: { companyId },
      });
      return extractData<SupplierStatistics>(response);
    } catch (error) {
      console.error('Failed to fetch supplier statistics:', error);
      throw error;
    }
  },

  async getSupplierPerformance(
    supplierId: string,
    dateRange?: { start: string; end: string }
  ): Promise<SupplierPerformance> {
    assertValidId(supplierId, 'Supplier ID');
    try {
      const response = await api.get(`/suppliers/${supplierId}/performance`, {
        params: dateRange,
      });
      return extractData<SupplierPerformance>(response);
    } catch (error) {
      console.error(
        `Failed to fetch performance for supplier ${supplierId}:`,
        error
      );
      throw error;
    }
  },

  async getSupplierOrderHistory(
    supplierId: string,
    params?: { page?: number; limit?: number; status?: string }
  ): Promise<PaginatedResponse<SupplierOrderHistory>> {
    assertValidId(supplierId, 'Supplier ID');
    try {
      const response = await api.get(`/suppliers/${supplierId}/orders`, {
        params,
      });
      return extractPaginatedResponse<SupplierOrderHistory>(response, params);
    } catch (error) {
      console.error(
        `Failed to fetch order history for supplier ${supplierId}:`,
        error
      );
      throw error;
    }
  },

  async getSupplierSummary(supplierId: string): Promise<SupplierSummary> {
    assertValidId(supplierId, 'Supplier ID');
    try {
      const response = await api.get(`/suppliers/${supplierId}/summary`);
      return extractData<SupplierSummary>(response);
    } catch (error) {
      console.error(
        `Failed to fetch summary for supplier ${supplierId}:`,
        error
      );
      throw error;
    }
  },

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async bulkDeleteSuppliers(
    ids: string[],
    companyId?: string
  ): Promise<{ message: string; deletedCount: number }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new SupplierValidationError(
        'ids',
        'At least one supplier ID is required.',
        'MISSING_IDS'
      );
    }

    // Filter out nulls/empties before sending.
    const cleanIds = ids
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (cleanIds.length === 0) {
      throw new SupplierValidationError(
        'ids',
        'At least one valid supplier ID is required.',
        'MISSING_IDS'
      );
    }

    try {
      const response = await api.post('/suppliers/bulk/delete', {
        ids: cleanIds,
        companyId,
      });

      if (response && typeof response === 'object') {
        if ('data' in response && response.data && typeof response.data === 'object') {
          const data = response.data as any;
          return {
            message: data.message || 'Suppliers deleted successfully',
            deletedCount:
              typeof data.deletedCount === 'number'
                ? data.deletedCount
                : cleanIds.length,
          };
        }
      }

      return {
        message: 'Suppliers deleted successfully',
        deletedCount: cleanIds.length,
      };
    } catch (error) {
      console.error('Failed to bulk delete suppliers:', error);
      throw error;
    }
  },

  async bulkActivateSuppliers(
    ids: string[]
  ): Promise<BulkSupplierOperationResult> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new SupplierValidationError(
        'ids',
        'At least one supplier ID is required.',
        'MISSING_IDS'
      );
    }

    try {
      const response = await api.post('/suppliers/bulk/activate', { ids });
      return extractData<BulkSupplierOperationResult>(response);
    } catch (error) {
      console.error('Failed to bulk activate suppliers:', error);
      throw error;
    }
  },

  async bulkDeactivateSuppliers(
    ids: string[]
  ): Promise<BulkSupplierOperationResult> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new SupplierValidationError(
        'ids',
        'At least one supplier ID is required.',
        'MISSING_IDS'
      );
    }

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

  async exportSuppliers(options: SupplierExportOptions): Promise<Blob> {
    try {
      const response = await api.download('/suppliers/export', {
        params: options,
      });
      return response;
    } catch (error) {
      console.error('Failed to export suppliers:', error);
      throw error;
    }
  },

  async importSuppliers(
    file: File,
    companyId: string
  ): Promise<BulkSupplierOperationResult> {
    assertValidCompanyId(companyId);

    if (!file) {
      throw new SupplierValidationError(
        'file',
        'Please select a file to import.',
        'MISSING_FILE'
      );
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);

      const response = await api.upload<any>(
        '/suppliers/import',
        formData as any
      );
      return extractData<BulkSupplierOperationResult>(response);
    } catch (error) {
      console.error('Failed to import suppliers:', error);
      throw error;
    }
  },

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

export default supplierService;
