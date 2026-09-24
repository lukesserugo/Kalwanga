// D:\Projects\Kalwanga\packages\web\types\order.ts

import { Product, ProductVariant } from './product';
import { Customer } from './customer';
import { User } from './user';
import { BusinessUnit } from './businessUnit';
import { Sale } from './sale';
import { Payment } from './payment';
import { Supplier } from './supplier';
import { OrderStatus } from './enums';
import { Receipt } from './invoice';
import { InventoryTransaction } from './inventory';

// ============================================
// ORDER
// ============================================
//
// Mirrors the Prisma `Order` model exactly. Nullable columns are
// typed `| null` so consumers cannot accidentally treat a null
// response field as a string.

export type OrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIAL'
  | 'PROCESSING'
  | 'AUTHORIZED'
  | 'DECLINED';

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;

  subtotal: number;
  tax: number;
  discount: number;
  total: number;

  notes: string | null;
  customerId: string | null;
  customer?: Customer | null;

  businessUnitId: string;
  businessUnit?: BusinessUnit;

  userId: string;
  user?: User;

  items?: OrderItem[];
  payment?: Payment | null;
  sale?: Sale | null;
  receipt?: Receipt | null;

  // Extended fields the controller accepts/returns on write paths.
  // They are written to `notes` (JSON) on the backend and echoed
  // back, so all are optional on the wire.
  priority?: OrderPriority;
  expectedDeliveryDate?: string | null;
  shippingAddress?: string | null;
  paymentMethod?: string | null;
  paymentTerms?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  notes: string | null;

  orderId: string;
  order?: Order;

  productId: string;
  product?: Product;

  variantId: string | null;
  variant?: ProductVariant | null;
}

// ============================================
// QUERY / PAYLOAD TYPES
// ============================================

/**
 * Query params accepted by `GET /orders`.
 * Mirrors `orderController.getAllOrders` exactly.
 */
export interface OrderSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  businessUnitId?: string;
  customerId?: string;
  userId?: string;
  status?: OrderStatus | string;
  priority?: OrderPriority | string;
  paymentStatus?: PaymentStatus | string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  minTotal?: number;
  maxTotal?: number;
  includeDeleted?: boolean;
}

/**
 * Body accepted by `POST /orders`.
 *
 * ⚠ `unitPrice` and `discount` are intentionally absent. The
 * backend's `orderController.createOrder` derives both from
 * `Product.unitPrice` / `ProductVariant.price`. Sending them from
 * the client was a fraud vector, and the backend ignores them
 * anyway.
 */
export interface CreateOrderPayload {
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    notes?: string;
  }>;
  customerId?: string;
  discount?: number;
  tax?: number;
  notes?: string;
  businessUnitId?: string;
  expectedDeliveryDate?: string;
  shippingAddress?: string;
  paymentMethod?: string;
  paymentTerms?: string;
  priority?: OrderPriority;
}

/**
 * Body accepted by `PUT /orders/:id`.
 */
export interface UpdateOrderPayload {
  status?: OrderStatus;
  notes?: string;
  priority?: OrderPriority;
  shippingAddress?: string;
  expectedDeliveryDate?: string;
}

/**
 * Body accepted by `PATCH /orders/:id/status`.
 */
export interface UpdateOrderStatusPayload {
  status: OrderStatus;
  notes?: string;
}

/**
 * Body accepted by `POST /orders/:id/cancel`.
 */
export interface CancelOrderPayload {
  reason: string;
}

/**
 * Body accepted by `PATCH /orders/bulk-status`.
 */
export interface BulkUpdateStatusPayload {
  orderIds: string[];
  status: OrderStatus;
  notes?: string;
}

/**
 * Body accepted by `DELETE /orders/bulk`.
 */
export interface BulkDeleteOrdersPayload {
  orderIds: string[];
}

/**
 * Pagination envelope used by every list response.
 */
export interface OrderPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Backend envelope for `GET /orders`.
 */
export interface OrderListResponse {
  success: true;
  data: Order[];
  pagination: OrderPagination;
  stats?: OrderStats;
}

/**
 * Backend envelope for every single-resource order endpoint.
 */
export interface OrderSingleResponse {
  success: true;
  data: Order;
  message?: string;
}

/**
 * Response from `GET /orders/stats`.
 */
export interface OrderStats {
  totalOrders: number;
  totalValue: number;
  averageOrderValue: number;
  statusBreakdown: Array<{ status: string; count: number }>;
  recentOrders: Order[];
}

/**
 * Response from `GET /orders/dashboard`.
 */
export interface OrderDashboardData {
  todayOrders: number;
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  totalOrders: number;
  recentOrders: Order[];
}

/**
 * Response from `GET /orders/analytics`.
 */
export interface OrderAnalytics {
  range: { startDate: string; endDate: string };
  groupBy: 'day' | 'week' | 'month';
  series: Array<{
    period: string;
    orders: number;
    revenue: number;
    averageOrderValue: number;
  }>;
  totals: {
    orders: number;
    revenue: number;
    averageOrderValue: number;
  };
}

/**
 * Response from `GET /orders/fulfillment`.
 */
export interface OrderFulfillmentStatus {
  pending: number;
  processing: number;
  completed: number;
  cancelled: number;
  onHold: number;
  total: number;
}

/**
 * Response from `GET /orders/:orderId/history`.
 */
export interface OrderHistoryEntry {
  id: string;
  orderId: string;
  action: string;
  fromState?: string | null;
  toState?: string | null;
  userId?: string | null;
  notes?: string | null;
  createdAt: string;
}

/**
 * Response from `GET /orders/:orderId/timeline`.
 */
export interface OrderTimelineEntry {
  label: string;
  timestamp: string;
  description?: string;
  user?: { id: string; firstName: string; lastName: string } | null;
}

// ============================================
// PURCHASE ORDER (unrelated to customer orders)
// ============================================

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier?: Supplier;
  status: string;
  total: number;
  notes?: string | null;
  expectedDelivery?: string | null;
  receivedAt?: string | null;
  receivedBy?: string | null;
  receiver?: User | null;
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
  notes?: string | null;
  purchaseOrderId: string;
  purchaseOrder?: PurchaseOrder;
  productId: string;
  product?: Product;
  variantId?: string | null;
  variant?: ProductVariant | null;
}
