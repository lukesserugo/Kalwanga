// D:\Projects\Kalwanga\packages\web\types\businessUnit.ts

import {
  UserRole,
  BusinessUnitType,
  AuditAction,
  AuditSeverity,
  SortOrder,
  getEnumValues,
  isValidEnumValue,
  getEnumLabel,
  getEnumOptions,
} from './enums';

// ============================================
// CANONICAL IMPORTS
// ============================================
//
// Every cross-cutting model is imported from the module that OWNS it.
// This file MUST NOT redeclare User, Company, Product, ProductVariant,
// Category, Supplier, or Inventory. If you find yourself needing to
// add a field to one of them, edit the file where it lives — not here.
//
// Ownership map (do not deviate):
//   User, Company            → ./user
//   Product, ProductVariant  → ./product
//   Category                 → ./category
//   Supplier                 → ./supplier
//   Inventory                → ./inventory
//
// All model imports are `import type` so the compiler erases them and
// the runtime cycles
//   businessUnit ↔ user, businessUnit ↔ product,
//   businessUnit ↔ category, businessUnit ↔ supplier,
//   businessUnit ↔ inventory
// never actually load.

import type { User, Company } from './user';
import type { Product, ProductVariant } from './product';
import type { Category } from './category';
import type { Supplier } from './supplier';
import type { Inventory } from './inventory';

// ============================================
// BUSINESS UNIT
// ============================================

export interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  companyId: string;
  isActive: boolean;
  type?: BusinessUnitType;
  /**
   * ISO 4217 settlement currency.
   *
   * This is the AUTHORITATIVE ledger currency for every cart, sale,
   * payment, receipt, and report belonging to this business unit.
   * Resolved server-side through the registry in
   * `packages/backend/src/lib/currencies.ts` — never hardcoded on the
   * client.
   *
   * Changing it goes through `PATCH /business-units/:id/currency`
   * (see `changeBusinessUnitCurrency` in the admin currency settings
   * page), which runs a dirty-record check and, when the BU has any
   * non-terminal carts, sales, payments, orders, or invoices, requires
   * an explicit conversion rate.
   */
  currency?: string;
  /**
   * Display symbol for `currency`, derived at read time from the
   * registry. NEVER persisted — the code is the single source of
   * truth; the symbol is a view. If the registry has no symbol for
   * the code, the code itself stands in.
   */
  currencySymbol?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  company?: Company;
  users?: BusinessUnitUser[];
  products?: Product[];
  inventory?: Inventory[];
  _count?: {
    products: number;
    inventory: number;
    sales: number;
    customers: number;
    userBusinessUnits: number;
  };
}

export interface BusinessUnitUser {
  id: string;
  userId: string;
  businessUnitId: string;
  role: UserRole | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: User;
  businessUnit?: BusinessUnit;
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

export interface BusinessUnitDetails extends BusinessUnit {
  products: Product[];
  inventory: Inventory[];
  users: BusinessUnitUser[];
  counts: {
    products: number;
    inventory: number;
    sales: number;
    userBusinessUnits: number;
  };
}

// ============================================
// DTOs
// ============================================

export interface CreateBusinessUnitDto {
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  companyId: string;
  isActive?: boolean;
  type?: BusinessUnitType;
  /**
   * ISO 4217 settlement currency for the new business unit.
   *
   * Must be a `settlementAllowed: true` code per the backend registry.
   * The backend rejects unknown or display-only codes with a 400. When
   * omitted, the platform default (`DEFAULT_CURRENCY_CODE`) applies.
   *
   * Set at creation time. Changing it later goes through
   * `PATCH /business-units/:id/currency`, not through
   * `UpdateBusinessUnitDto`.
   */
  currency?: string;
}

export interface UpdateBusinessUnitDto {
  name?: string;
  code?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
  type?: BusinessUnitType;
  // ⚠ `currency` is intentionally NOT declared here.
  //
  //   Currency changes do not go through this DTO. They go through
  //   `PATCH /business-units/:id/currency`, which runs a dirty-record
  //   check and, when the BU has non-terminal records, requires an
  //   explicit conversion rate. Sending `currency` on this DTO would
  //   either silently swap (clean BU, no audit trail beyond the
  //   generic PUT) or 409 with no way to collect a rate on the client.
  //
  //   If a future refactor needs to send currency on PUT, that is a
  //   decision that must be made deliberately — do not just add the
  //   field back. The dedicated endpoint exists for a reason.
}

export interface AddUserToBusinessUnitDto {
  userId: string;
  role: UserRole | string;
}

export interface RemoveUserFromBusinessUnitDto {
  userId: string;
}

export interface BulkDeleteBusinessUnitsDto {
  ids: string[];
}

/**
 * Body accepted by `PATCH /business-units/:id/currency`.
 *
 * This is the ONLY DTO that carries a currency change. It is not
 * `UpdateBusinessUnitDto` — currency changes have different semantics
 * (dirty-record gating, optional conversion rate) and deserve their
 * own shape.
 */
export interface ChangeBusinessUnitCurrencyDto {
  /** The target settlement currency (3-char ISO 4217 code). */
  targetCurrency: string;
  /**
   * When the BU has dirty records, the admin must set this to `true`
   * to acknowledge that a conversion will run. Without it, the service
   * logs a blocked-change audit entry and returns 409 with the dirty
   * counts.
   */
  acknowledgeDirtyRecords?: boolean;
  /**
   * Rate to apply for the conversion (`from → to`). Required when
   * dirty records exist and `acknowledgeDirtyRecords` is `true`.
   * Ignored otherwise.
   */
  conversionRate?: number;
  /** Optional reason for the audit log. */
  reason?: string | null;
}

/**
 * Body accepted by `POST /business-units/:id/currency/convert`.
 *
 * Same shape as `ChangeBusinessUnitCurrencyDto`, but the service
 * forces `acknowledgeDirtyRecords` to `true` — this endpoint exists
 * specifically to run a conversion, so acknowledgement is implied.
 * `conversionRate` remains required.
 */
export interface ConvertBusinessUnitCurrencyDto {
  targetCurrency: string;
  conversionRate: number;
  reason?: string | null;
}

/**
 * Response shape from `GET /business-units/:id/currency/preview`.
 *
 * Read-only. Never mutates. `suggestedRate` may be `null` when no
 * provider rate is available — the admin can still supply a manual
 * rate.
 */
export interface BusinessUnitCurrencyPreview {
  businessUnitId: string;
  currentCurrency: string;
  targetCurrency: string;
  dirtyCounts: {
    carts: number;
    sales: number;
    payments: number;
    orders: number;
    invoices: number;
  };
  suggestedRate: number | null;
  rateSource: string | null;
}

/**
 * Response shape from `PATCH /business-units/:id/currency` and
 * `POST /business-units/:id/currency/convert`.
 *
 * `mode` distinguishes the two paths the service can take:
 *   • `simple`   — the BU was clean, currency was swapped directly.
 *   • `migrated` — the BU had dirty records, a conversion ran.
 */
export interface BusinessUnitCurrencyChangeResult {
  businessUnit: BusinessUnit | null;
  mode: 'simple' | 'migrated';
  fromCurrency: string;
  toCurrency: string;
  dirtyCounts?: {
    carts: number;
    sales: number;
    payments: number;
    orders: number;
    invoices: number;
  };
  conversionRate?: number;
  convertedRecords?: {
    carts: number;
    sales: number;
    payments: number;
    orders: number;
    invoices: number;
  };
}

// ============================================
// QUERY PARAMS
// ============================================

export interface BusinessUnitQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: string;
  isActive?: boolean;
  type?: BusinessUnitType;
  sortBy?: string;
  sortOrder?: SortOrder;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface BusinessUnitListResponse {
  data: BusinessUnit[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface BusinessUnitResponse {
  success: boolean;
  data: BusinessUnit;
  message?: string;
}

export interface BusinessUnitStatsResponse {
  success: boolean;
  data: BusinessUnitStats;
}

export interface BulkDeleteResponse {
  success: boolean;
  data: {
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
  };
  message: string;
}

// ============================================
// VALIDATION
// ============================================
//
// Accepts the same shapes the backend accepts:
//   • CUIDs (Prisma default):  c + 24 alphanumeric chars
//   • UUIDs:                   8-4-4-4-12 hex
//   • Clerk IDs:               user_...
//   • Simple IDs:              letters/digits/_/- between 10 and 50 chars

export function isValidBusinessUnitId(id: string): boolean {
  if (!id || id === 'default') return false;

  const RESERVED = new Set([
    'users',
    'reports',
    'settings',
    'stats',
    'details',
    'company',
    'code',
    'bulk-delete',
    'ensure',
    'test',
    'new',
    'edit',
    'current',
    'currency',
  ]);
  if (RESERVED.has(id.toLowerCase())) return false;

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

export function isValidBusinessUnitIdOrFallback(id: string): boolean {
  if (id === 'default') return true;
  return isValidBusinessUnitId(id);
}

export function isValidBusinessUnitCode(code: string): boolean {
  return /^[A-Z0-9]{2,20}$/.test(code.toUpperCase());
}

export function isValidBusinessUnitName(name: string): boolean {
  return name.trim().length >= 1 && name.trim().length <= 100;
}

export function isValidBusinessUnitEmail(email?: string | null): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidBusinessUnitPhone(phone?: string | null): boolean {
  if (!phone) return true;
  return phone.trim().length >= 5 && phone.trim().length <= 20;
}

// ============================================
// TYPE GUARDS
// ============================================

export function isBusinessUnit(obj: unknown): obj is BusinessUnit {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'name' in obj &&
    'code' in obj &&
    'companyId' in obj
  );
}

export function isBusinessUnitUser(obj: unknown): obj is BusinessUnitUser {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'userId' in obj &&
    'businessUnitId' in obj &&
    'role' in obj
  );
}

export function isBusinessUnitStats(obj: unknown): obj is BusinessUnitStats {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'products' in obj &&
    'sales' in obj &&
    'totalRevenue' in obj
  );
}

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_BUSINESS_UNIT: Partial<BusinessUnit> = {
  isActive: true,
  address: null,
  phone: null,
  email: null,
  type: BusinessUnitType.STORE,
};

export const DEFAULT_BUSINESS_UNIT_STATS: BusinessUnitStats = {
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

export const DEFAULT_BUSINESS_UNIT_PAGINATION = {
  page: 1,
  limit: 10,
  totalPages: 1,
  total: 0,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getBusinessUnitTypeLabel(type?: BusinessUnitType): string {
  if (!type) return 'Unknown';
  const labels: Record<BusinessUnitType, string> = {
    [BusinessUnitType.HEADQUARTERS]: 'Headquarters',
    [BusinessUnitType.BRANCH]: 'Branch',
    [BusinessUnitType.WAREHOUSE]: 'Warehouse',
    [BusinessUnitType.STORE]: 'Store',
  };
  return labels[type] || type;
}

export function getBusinessUnitStatusLabel(isActive: boolean): string {
  return isActive ? 'Active' : 'Inactive';
}

export function getBusinessUnitStatusColor(isActive: boolean): string {
  return isActive ? 'green' : 'red';
}

export function formatBusinessUnitAddress(businessUnit: BusinessUnit): string {
  return businessUnit.address ?? '';
}

export function getBusinessUnitDisplayName(businessUnit: BusinessUnit): string {
  return `${businessUnit.name} (${businessUnit.code})`;
}

export function getBusinessUnitShortName(businessUnit: BusinessUnit): string {
  return businessUnit.name;
}

/**
 * Derive the display symbol for a business unit's currency.
 *
 * ⚠ This is a FALLBACK for contexts that cannot call `Intl` (CSV
 *   exports, plain-text emails). Everywhere else, prefer rendering
 *   the code via `Intl.NumberFormat` — the browser's own formatting
 *   is more robust across locales than prefixing a symbol.
 *
 * Returns:
 *   1. `businessUnit.currencySymbol` when the backend supplied one.
 *   2. `businessUnit.currency` when there is no symbol.
 *   3. The empty string when the BU has no currency at all.
 */
export function getBusinessUnitCurrencySymbol(
  businessUnit: BusinessUnit
): string {
  return businessUnit.currencySymbol ?? businessUnit.currency ?? '';
}

/**
 * Derive the code to pass to `Intl.NumberFormat` for a business unit.
 *
 * Returns the BU's currency, or `undefined` when the BU has none. A
 * caller that receives `undefined` should NOT fall back to a
 * hardcoded literal — it should skip formatting or render a `—`.
 */
export function getBusinessUnitCurrency(
  businessUnit: BusinessUnit
): string | undefined {
  return businessUnit.currency ?? undefined;
}

// ============================================
// ROLE HELPERS
// ============================================

export function userHasRole(
  user: BusinessUnitUser | undefined,
  role: UserRole | string
): boolean {
  if (!user) return false;
  return user.role === role;
}

export function userIsAdmin(user: BusinessUnitUser | undefined): boolean {
  if (!user) return false;
  return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
}

export function userIsManager(user: BusinessUnitUser | undefined): boolean {
  if (!user) return false;
  return user.role === UserRole.MANAGER || userIsAdmin(user);
}

// ============================================
// RE-EXPORTS (backward compatibility)
// ============================================

export {
  UserRole,
  BusinessUnitType,
  AuditAction,
  AuditSeverity,
  SortOrder,
  getEnumValues,
  isValidEnumValue,
  getEnumLabel,
  getEnumOptions,
};
