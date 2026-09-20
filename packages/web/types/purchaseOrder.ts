// D:\Projects\Kalwanga\packages\web\types\purchaseOrder.ts

import type { Supplier } from './supplier';
import type { BusinessUnit } from './businessUnit';
import type { Product, ProductVariant } from './product';

// ============================================
// STATUS
// ============================================
//
// Mirrors the Prisma `PurchaseOrderStatus` enum exactly.
//   DRAFT
//   PENDING
//   APPROVED
//   ORDERED
//   PARTIALLY_RECEIVED
//   RECEIVED
//   CANCELLED
//   COMPLETED

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'COMPLETED';

// ============================================
// PURCHASE ORDER (canonical model)
// ============================================

export interface PurchaseOrder {
  id: string;
  orderNumber: string;

  supplierId: string;
  supplier?: Supplier | null;

  businessUnitId: string;
  businessUnit?: BusinessUnit | null;

  userId: string;
  createdBy?:
    | {
        id: string;
        firstName: string;
        lastName: string;
      }
    | null;

  status: PurchaseOrderStatus;

  subtotal: number;
  tax: number;
  discount: number;
  total: number;

  notes?: string | null;

  orderDate: string;
  expectedDeliveryDate?: string | null;
  receivedDate?: string | null;
  receivedAt?: string | null;
  receivedBy?: string | null;

  items: PurchaseOrderItem[];

  createdAt: string;
  updatedAt: string;
}

// ============================================
// PURCHASE ORDER ITEM (canonical model)
// ============================================

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;

  productId: string;
  product?:
    | {
        id: string;
        name: string;
        sku: string;
        unitPrice: number;
      }
    | null;

  variantId?: string | null;
  variant?: ProductVariant | null;

  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity: number;

  productName: string;
  productSku: string;

  notes?: string | null;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// DTOs
// ============================================

export interface CreatePurchaseOrderDto {
  supplierId: string;
  businessUnitId?: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes?: string;
  expectedDelivery?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface UpdatePurchaseOrderDto {
  supplierId?: string;
  businessUnitId?: string;
  status?: PurchaseOrderStatus;
  notes?: string;
  expectedDeliveryDate?: string | null;
}

export interface ReceivePurchaseOrderDto {
  receivedQuantities: Array<{
    itemId: string;
    quantity: number;
  }>;
}

// ============================================
// SEARCH PARAMS
// ============================================

export interface PurchaseOrderSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  businessUnitId?: string;
  status?: PurchaseOrderStatus;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// RESPONSE ENVELOPES
// ============================================

export interface PurchaseOrderResponse<T = any> {
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

// ============================================
// RE-EXPORTS
// ============================================
//
// Supplier is re-exported here because PurchaseOrder has a `supplier`
// field and some consumers import both together. Its canonical home
// is './supplier'. Re-exporting a symbol that this file did NOT
// declare is legal (unlike the circular-alias case in supplier.ts).

export type { Supplier };
