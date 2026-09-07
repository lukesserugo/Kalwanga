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
  getEnumOptions
} from './enums';

// ============================================
// TYPE IMPORTS (Referenced from other type files)
// ============================================

export interface User {
  id: string;
  clerkId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  isActive: boolean;
  avatar?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  businessUnitId?: string;
  businessUnits?: BusinessUnitUser[];
  permissions?: string[];
  companyId?: string;
}

export interface Company {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  taxId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  businessUnits?: BusinessUnit[];
  users?: User[];
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  unitPrice: number;
  costPrice: number;
  taxRate: number;
  minStock: number;
  maxStock?: number;
  isActive: boolean;
  isDigital: boolean;
  featured: boolean;
  weight?: number;
  dimensions?: string;
  images: string[];
  attributes?: Record<string, any>;
  notes?: string;
  tags: string[];
  seo?: Record<string, any>;
  rating: number;
  reviewCount: number;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'DRAFT';
  type: 'SIMPLE' | 'VARIABLE' | 'DIGITAL' | 'SERVICE';
  taxType: 'EXCLUSIVE' | 'INCLUSIVE' | 'NONE';
  categoryId?: string;
  supplierId?: string;
  businessUnitId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  supplier?: Supplier;
  inventory?: Inventory[];
  variants?: ProductVariant[];
}

export interface Inventory {
  id: string;
  productId: string;
  variantId?: string;
  businessUnitId: string;
  quantity: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number;
  location: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  createdAt: string;
  updatedAt: string;
  product?: Product;
  variant?: ProductVariant;
  businessUnit?: BusinessUnit;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  costPrice: number;
  stock: number;
  images: string[];
  attributes: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  inventory?: Inventory[];
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  businessUnitId: string;
  isActive: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  parent?: Category;
  children?: Category[];
  products?: Product[];
  productCount?: number;
  childCount?: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  website?: string;
  notes?: string;
  rating?: number;
  isActive: boolean;
  companyId: string;
  paymentTerms?: string;
  creditLimit?: number;
  createdAt: string;
  updatedAt: string;
  products?: Product[];
}

// ============================================
// BUSINESS UNIT TYPES
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
// VALIDATION FUNCTIONS
// ============================================

export function isValidBusinessUnitId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
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
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
  if (!businessUnit.address) return '';
  return businessUnit.address;
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

export function userHasRole(user: BusinessUnitUser | undefined, role: UserRole | string): boolean {
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
// EXPORT ALL
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
  getEnumOptions
};
