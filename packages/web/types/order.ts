// D:\Projects\Kalwanga\packages\web\types\order.ts
import { Product, ProductVariant } from './product';
import { Customer } from './customer';
import { BusinessUnit, User } from './user';
import { Sale } from './sale';
import { Payment } from './payment';
import { Supplier } from './supplier';
import { OrderStatus } from './enums'; // Import from enums.ts
import { Receipt } from './invoice';
import { InventoryTransaction } from './inventory';

// ============================================
// ORDER
// ============================================

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  customerId?: string;
  customer?: Customer;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  userId: string;
  user?: User;
  items?: OrderItem[];
  payment?: Payment;
  sale?: Sale;
  receipt?: Receipt;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
  orderId: string;
  order?: Order;
  productId: string;
  product?: Product;
  variantId?: string;
  variant?: ProductVariant;
}

// ============================================
// ORDER SEARCH PARAMS
// ============================================

/**
 * Query params accepted by `GET /orders`.
 * Mirrors the backend's `orderController.getAllOrders` signature.
 */
export interface OrderSearchParams {
  /** Page number (1-indexed). Default: 1 */
  page?: number;

  /** Items per page. Default: 10, Max: 100 */
  limit?: number;

  /** Free-text search across order number, customer name/email, notes */
  search?: string;

  /** Tenant scope — usually resolved server-side from the auth token */
  businessUnitId?: string;

  /** Filter by customer ID */
  customerId?: string;

  /** Filter by user (cashier) ID */
  userId?: string;

  /** Filter by order status */
  status?: OrderStatus | string;

  /** Filter by priority */
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string;

  /** Filter by payment status */
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIAL' | string;

  /** ISO date string — inclusive lower bound on createdAt */
  startDate?: string;

  /** ISO date string — inclusive upper bound on createdAt */
  endDate?: string;

  /** Sort field: 'createdAt' | 'updatedAt' | 'orderNumber' | 'total' | 'status' */
  sortBy?: string;

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';

  /** Minimum order total (inclusive) */
  minTotal?: number;

  /** Maximum order total (inclusive) */
  maxTotal?: number;

  /** Include soft-deleted orders (represented as CANCELLED server-side) */
  includeDeleted?: boolean;
}

// ============================================
// PURCHASE ORDER (unrelated to customer orders — kept for compatibility)
// ============================================

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier?: Supplier;
  status: string;
  total: number;
  notes?: string;
  expectedDelivery?: string;
  receivedAt?: string;
  receivedBy?: string;
  receiver?: User;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  userId: string;
  user?: User;
  items?: PurchaseOrderItem[];
  inventoryTransactions?: InventoryTransaction[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  receivedQuantity: number;
  notes?: string;
  purchaseOrderId: string;
  purchaseOrder?: PurchaseOrder;
  productId: string;
  product?: Product;
  variantId?: string;
  variant?: ProductVariant;
}
