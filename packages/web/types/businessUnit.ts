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
}

export interface UpdateBusinessUnitDto {
  name?: string;
  code?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
  type?: BusinessUnitType;
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
