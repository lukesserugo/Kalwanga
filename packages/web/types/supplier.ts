// D:\Projects\Kalwanga\packages\web\types\supplier.ts

// ============================================
// CANONICAL IMPORTS
// ============================================
//
// Every cross-module reference is type-only. The cycle
//   supplier ↔ product, supplier ↔ businessUnit, supplier ↔ user,
//   supplier ↔ purchaseOrder
// is broken at runtime because `import type` is erased.

import type { Company } from './user';
import type { Product } from './product';
import type { BusinessUnit } from './businessUnit';
import type { PurchaseOrder, PurchaseOrderItem } from './purchaseOrder';

// ============================================
// SUPPLIER STATUS
// ============================================

/** Mirrors the Prisma `SupplierStatus` enum. */
export type SupplierStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'PENDING'
  | 'BLACKLISTED';

// ============================================
// SUPPLIER (canonical model)
// ============================================
//
// ⚠️ Shape must match the backend Prisma model exactly. Every nullable
//    column (`String?`) is typed `string | null`, NOT just `string` and
//    NOT `string | undefined`. The backend returns `null` for those
//    columns; a type that says `string | undefined` produces an
//    assignability error the moment a Supplier arrives from the API.

export interface Supplier {
  id: string;

  name: string;

  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;

  address?: string | null;
  taxId?: string | null;
  website?: string | null;
  notes?: string | null;

  paymentTerms?: string | null;
  deliveryTerms?: string | null;

  rating?: number | null;
  creditLimit?: number | null;

  status: SupplierStatus;
  isActive: boolean;

  companyId: string;
  company?: Company;

  createdAt: string;
  updatedAt: string;

  products?: Product[];

  // Denormalised / computed fields some endpoints include
  productCount?: number;
  totalSpent?: number;
  lastOrderDate?: string | null;

  _count?: {
    products?: number;
    purchaseOrders?: number;
  };

  // Optional UI extensions that some screens render
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
  contactPersonPhone?: string | null;
  contactPersonEmail?: string | null;
}

// ============================================
// SUPPLIER CONTACT
// ============================================

export interface SupplierContact {
  id: string;
  supplierId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// SUPPLIER PRODUCT (join row)
// ============================================

export interface SupplierProduct {
  id: string;
  supplierId: string;
  productId: string;

  supplierSku?: string | null;
  unitPrice: number;
  leadTime?: number | null;
  minimumOrderQuantity?: number | null;
  isPreferred: boolean;

  product?: {
    id: string;
    name: string;
    sku: string;
    unitPrice?: number | null;
  } | null;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// SUPPLIER PAYMENT
// ============================================

export type SupplierPaymentStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface SupplierPayment {
  id: string;
  supplierId: string;

  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference?: string | null;
  notes?: string | null;

  status: SupplierPaymentStatus;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// SUPPLIER RATING
// ============================================

export interface SupplierRating {
  id: string;
  supplierId: string;

  rating: number;
  review?: string | null;

  userId: string;
  businessUnitId: string;

  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// SEARCH PARAMS
// ============================================

export interface SupplierSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: string;
  businessUnitId?: string;
  isActive?: boolean;
  status?: SupplierStatus;
  minRating?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SupplierFilterOptions {
  categories?: string[];
  locations?: string[];
  ratingRange?: {
    min: number;
    max: number;
  };
  hasContactPerson?: boolean;
  activeOnly?: boolean;
}

// ============================================
// STATISTICS
// ============================================

export interface SupplierStatistics {
  total: number;
  active: number;
  inactive: number;
  totalSpent: number;
  totalOrders: number;
  averageRating: number;
  topSuppliers: Supplier[];
  recentOrders: number;
  averageLeadTime: number;
}

export interface SupplierSummary {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  rating?: number | null;
  isActive: boolean;
  productCount: number;
  totalSpent: number;
  lastOrderDate?: string | null;
}

export interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  onTimeDeliveryRate: number;
  averageLeadTime: number;
  orderFulfillmentRate: number;
  qualityRating: number;
  responseTime: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  period: {
    start: string;
    end: string;
  };
}

export interface SupplierOrderHistory {
  id: string;
  orderNumber: string;
  orderDate: string;
  total: number;
  status: string;
  itemsCount: number;
  deliveryDate?: string | null;
}

// ============================================
// RESPONSE ENVELOPES
// ============================================

export interface SupplierResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export interface BulkSupplierOperationResult {
  success: boolean;
  total: number;
  processed: number;
  failed: number;
  errors: Array<{
    id?: string;
    row?: number;
    message: string;
  }>;
  results: Supplier[];
}

// ============================================
// IMPORT / EXPORT
// ============================================

export interface SupplierImportData {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
  contactPerson?: string | null;
  contactPersonPhone?: string | null;
  contactPersonEmail?: string | null;
  taxId?: string | null;
  notes?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
}

export interface SupplierExportOptions {
  format: 'csv' | 'excel' | 'json';
  includeContacts?: boolean;
  includeProducts?: boolean;
  includeOrders?: boolean;
  includePayments?: boolean;
  businessUnitId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

// ============================================
// RE-EXPORTS
// ============================================
//
// PurchaseOrder and PurchaseOrderItem live in './purchaseOrder'. They
// are re-exported here so code that imports them from './supplier'
// keeps working.
//
// ⚠️ Do NOT add `export type { Supplier }` to this block.
//    Supplier is declared in THIS file. Re-exporting it from
//    './supplier' makes the alias self-referential and TypeScript
//    reports:
//      "Circular definition of import alias 'Supplier'."
//
//    The rule is: a file may re-export only types it does NOT
//    declare. Since this file declares Supplier, it must not
//    re-export it. Since it does NOT declare PurchaseOrder or
//    PurchaseOrderItem, re-exporting those is correct.

export type { PurchaseOrder, PurchaseOrderItem };
