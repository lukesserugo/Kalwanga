// packages/web/services/customerService.ts
import { api } from './api';
import type { Customer, CustomerSearchParams } from '../types';

// ============================================================
// RESPONSE SHAPES
// ============================================================
//
// These mirror the BACKEND exactly. Source of truth:
// packages/backend/src/services/customerService.ts.
//
// ⚠ `CustomerDetail` deliberately does NOT extend `Customer`.
//
//   The backend's `getCustomerById` includes the relations with a
//   narrower projection than the list endpoint:
//
//     • `sales`          — take: 10, items include only
//                          product.{id,name,sku}
//     • `orders`         — take: 10
//     • `giftCards`      — filtered to isActive: true
//     • `loyaltyHistory` — take: 20
//
//   `Customer` (from ../types) declares these with the full
//   relation types (`Sale[]`, `Order[]`, `GiftCard[]`, etc.).
//   `extends Customer` and redeclaring them narrower is a TS2430
//   error. `Omit` expresses the truth: "everything from Customer
//   EXCEPT these four relations, which this interface redeclares
//   with the projection the service actually returns."

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ─────────────────────────────────────────────────────────────
// Customer stats
// ─────────────────────────────────────────────────────────────

/**
 * Mirrors backend `CustomerService.getCustomerStats()`.
 * Do NOT add fields the backend doesn't return.
 */
export interface CustomerStats {
  totalSpent: number;
  totalSales: number;
  averageSaleValue: number;
  totalOrders: number;
  activeGiftCards: number;
  loyaltyPointsEarned: number;
  loyaltyTransactions: number;
  monthlySpent: number;
  monthlySales: number;
  yearlySpent: number;
  yearlySales: number;
}

// ─────────────────────────────────────────────────────────────
// Customer sale (narrowed — the shape `getCustomerById` returns)
// ─────────────────────────────────────────────────────────────

/**
 * Line item as it appears inside `CustomerDetail.sales[].items`.
 *
 * The backend's include selects only `product.{id,name,sku}` — no
 * images, no price, no category. `total` is the line total, not the
 * product's unit price.
 */
export interface CustomerSaleItem {
  id: string;
  quantity: number;
  total: number;
  product?: { id: string; name: string; sku: string } | null;
}

/**
 * Sale as returned by `getCustomerById`.
 *
 * ⚠ This is a NARROWER type than the canonical `Sale` in
 *   `types/sale.ts`. It has:
 *     - only the fields the customer-detail include selects
 *     - `saleDate` typed as `string` (the wire format)
 *     - `items` and `payments` optional (the include for the list
 *       endpoint omits them; only `getCustomerById` pulls items)
 *
 * Do NOT widen this to `Sale` — the full type carries fields
 * (`subtotal`, `tax`, `paidAmount`, `status`, `businessUnitId`, …)
 * that aren't present on every code path.
 */
export interface CustomerSale {
  id: string;
  receiptNumber: string;
  total: number;
  saleDate: string;
  items?: CustomerSaleItem[];
  payments?: Array<{
    id: string;
    paymentMethod: string;
    amount: number;
    status: string;
  }>;
}

// ─────────────────────────────────────────────────────────────
// Loyalty history
// ─────────────────────────────────────────────────────────────

export interface LoyaltyHistoryEntry {
  id: string;
  points: number;
  type: string;
  notes?: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Order (narrowed)
// ─────────────────────────────────────────────────────────────

/**
 * Order as returned by `getCustomerById`.
 *
 * The include doesn't pull `items`, `payments`, or `customer` — only
 * the order row itself. Type it as `unknown` here so callers that
 * need fields must narrow explicitly. If you later need a specific
 * field (`orderNumber`, `status`, `total`), widen this to match the
 * include on the backend.
 */
export type CustomerOrder = unknown;

// ─────────────────────────────────────────────────────────────
// Gift card (narrowed)
// ─────────────────────────────────────────────────────────────

/**
 * Gift card as returned by `getCustomerById` — filtered to
 * `isActive: true`, no further narrowing.
 */
export type CustomerGiftCard = unknown;

// ─────────────────────────────────────────────────────────────
// CustomerDetail
// ─────────────────────────────────────────────────────────────

/**
 * What `GET /customers/:id` returns.
 *
 * Starts from `Customer` and removes the four relations whose
 * projections differ from the list-endpoint type. Redeclaring them
 * with the narrower shapes avoids the TS2430 extends conflict while
 * keeping every other `Customer` field (id, email, name, address,
 * loyaltyPoints, totalSpent, isActive, timestamps, etc.) inherited
 * verbatim.
 */
export interface CustomerDetail
  extends Omit<
    Customer,
    'sales' | 'orders' | 'giftCards' | 'loyaltyHistory'
  > {
  fullName: string;
  salesCount: number;
  ordersCount: number;
  giftCardCount: number;
  sales?: CustomerSale[];
  orders?: CustomerOrder[];
  giftCards?: CustomerGiftCard[];
  loyaltyHistory?: LoyaltyHistoryEntry[];
}

// ─────────────────────────────────────────────────────────────
// Backend envelope shapes (internal)
// ─────────────────────────────────────────────────────────────

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

// ============================================================
// HELPERS
// ============================================================

/**
 * Unwrap nested envelope layers. `api.get<T>` already unwraps the
 * standard `{ success, data }` wrapper — but the SDK was written
 * before that behavior existed and defensively handles a raw axios
 * response. This keeps both paths working.
 */
function unwrap<T = unknown>(input: unknown): T {
  if (!input || typeof input !== 'object') return input as T;

  const obj = input as Record<string, unknown>;
  if ('status' in obj && 'data' in obj && 'headers' in obj) {
    return unwrap<T>(obj.data);
  }
  return input as T;
}

function normalizeListResponse<T>(raw: unknown): PaginatedResponse<T> {
  const body = unwrap<Record<string, unknown>>(raw);

  const items: T[] = Array.isArray(body?.data)
    ? (body.data as T[])
    : Array.isArray(body)
    ? (body as unknown as T[])
    : [];

  const pagination = (body?.pagination ?? body?.meta ?? {}) as Record<
    string,
    unknown
  >;

  const total =
    typeof pagination.total === 'number' ? pagination.total : items.length;
  const limit =
    typeof pagination.limit === 'number'
      ? pagination.limit
      : items.length || 20;
  const page =
    typeof pagination.page === 'number' ? pagination.page : 1;
  const totalPages =
    typeof pagination.totalPages === 'number'
      ? pagination.totalPages
      : Math.max(1, Math.ceil(total / (limit || 1)));

  return { data: items, total, page, limit, totalPages };
}

function normalizeSingleResponse<T>(raw: unknown): T {
  const body = unwrap<Record<string, unknown>>(raw);
  return (body?.data ?? body) as T;
}

// ============================================================
// PAYLOAD SANITIZERS
// ============================================================

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
  data: Partial<Customer>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const key of CUSTOMER_WRITABLE_FIELDS) {
    const value = (data as Record<string, unknown>)[key];
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

function sanitizeQueryParams(
  params?: CustomerSearchParams,
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

// ============================================================
// CUSTOMER SERVICE — mirrors backend routes 1:1
// ============================================================

export const customerService = {
  /** GET /customers */
  async getAllCustomers(
    params?: CustomerSearchParams,
  ): Promise<PaginatedResponse<Customer>> {
    const cleanParams = sanitizeQueryParams(params);
    const res = await api.get<BackendListResponse<Customer>>('/customers', {
      params: cleanParams,
    });
    return normalizeListResponse<Customer>(res);
  },

  /** GET /customers/:id — backend includes sales + loyaltyHistory */
  async getCustomerById(id: string): Promise<CustomerDetail> {
    const res = await api.get<BackendSingleResponse<CustomerDetail>>(
      `/customers/${id}`,
    );
    return normalizeSingleResponse<CustomerDetail>(res);
  },

  /** POST /customers */
  async createCustomer(data: Partial<Customer>): Promise<Customer> {
    const payload = sanitizeCustomerPayload(data);
    const res = await api.post<BackendSingleResponse<Customer>>(
      '/customers',
      payload,
    );
    return normalizeSingleResponse<Customer>(res);
  },

  /** PUT /customers/:id */
  async updateCustomer(
    id: string,
    data: Partial<Customer>,
  ): Promise<Customer> {
    const payload = sanitizeCustomerPayload(data);
    const res = await api.put<BackendSingleResponse<Customer>>(
      `/customers/${id}`,
      payload,
    );
    return normalizeSingleResponse<Customer>(res);
  },

  /** DELETE /customers/:id */
  async deleteCustomer(id: string): Promise<{ message: string }> {
    const res = await api.delete<BackendSingleResponse<null>>(
      `/customers/${id}`,
    );
    const body = unwrap<Record<string, unknown>>(res);
    return {
      message:
        typeof body?.message === 'string'
          ? body.message
          : 'Customer deleted successfully',
    };
  },

  /** POST /customers/:id/loyalty-points/add */
  async addLoyaltyPoints(
    customerId: string,
    points: number,
    reason?: string,
  ): Promise<Customer> {
    const res = await api.post<BackendSingleResponse<Customer>>(
      `/customers/${customerId}/loyalty-points/add`,
      { points, reason },
    );
    return normalizeSingleResponse<Customer>(res);
  },

  /** POST /customers/:id/loyalty-points/redeem */
  async redeemLoyaltyPoints(
    customerId: string,
    points: number,
    reason?: string,
  ): Promise<Customer> {
    const res = await api.post<BackendSingleResponse<Customer>>(
      `/customers/${customerId}/loyalty-points/redeem`,
      { points, reason },
    );
    return normalizeSingleResponse<Customer>(res);
  },

  /** GET /customers/:id/stats — matches backend CustomerStats shape */
  async getCustomerStats(id: string): Promise<CustomerStats> {
    const res = await api.get<BackendSingleResponse<CustomerStats>>(
      `/customers/${id}/stats`,
    );
    return normalizeSingleResponse<CustomerStats>(res);
  },

  /** GET /customers/:id/purchases */
  async getCustomerPurchaseHistory(
    id: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<CustomerSale>> {
    const res = await api.get<BackendListResponse<CustomerSale>>(
      `/customers/${id}/purchases`,
      { params },
    );
    return normalizeListResponse<CustomerSale>(res);
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
      { params: cleanParams },
    );

    const body = unwrap<Record<string, unknown>>(res);
    const items = Array.isArray(body?.data)
      ? (body.data as Customer[])
      : Array.isArray(body)
      ? (body as unknown as Customer[])
      : [];
    return items;
  },

  /** POST /customers/import */
  async importCustomers(
    file: File,
  ): Promise<{ results: Customer[]; errors: unknown[] }> {
    return api.upload<{ results: Customer[]; errors: unknown[] }>(
      '/customers/import',
      file,
    );
  },

  /** GET /customers/export */
  async exportCustomers(format: 'csv' | 'excel' = 'csv'): Promise<Blob> {
    return api.download(`/customers/export?format=${format}`);
  },
};

// Re-export the nested types so consumers that import them from the
// service keep working. The canonical declaration lives here because
// `CustomerDetail` is the type that composes them.
export type {
  Customer,
  CustomerSearchParams,
} from '../types';

export default customerService;
