// D:\Projects\Kalwanga\packages\web\types\sale.ts

// Use `import type` for type-only imports to avoid circular dependencies
import type { Product, ProductVariant } from './product';
import type { Customer } from './customer';
import type { BusinessUnit, User } from './user';
import type { Payment } from './payment';
import type { Order } from './order';

// Import from invoice for Receipt
import type { Receipt, Invoice } from './invoice';

// Import from inventory for InventoryTransaction
import type { InventoryTransaction } from './inventory';

// Import from customer for GiftCardTransaction and LoyaltyHistory
import type { GiftCardTransaction, LoyaltyHistory } from './customer';

// Import from bookkeeping for TaxRecord
import type { TaxRecord } from './bookkeeping';

// Import from register for CashRegister and CashRegisterSession
import type { CashRegister, CashRegisterSession } from './register';

// ============================================
// SALE STATUS ENUMS
// ============================================

export type SaleStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'ON_HOLD'
  | 'VOID'
  | 'DELETED';

export type PaymentMethod =
  | 'CASH'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'MOBILE_MONEY'
  | 'BANK_TRANSFER'
  | 'GIFT_CARD'
  | 'LOYALTY_POINTS'
  | 'CRYPTO'
  | 'CHECK';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIAL'
  | 'PROCESSING'
  | 'AUTHORIZED'
  | 'DECLINED';

/**
 * Discount category stored on `Sale.discountType`. Mirrors the
 * backend's Prisma `DiscountType` enum exactly, and the frontend
 * `services/saleService.ts` union — all three must stay in sync.
 *
 *   - 'PERCENTAGE' — applied from a percentage-based promotion
 *   - 'FIXED'      — applied from a fixed-amount promotion
 *   - 'LOYALTY'    — discount came entirely from loyalty points
 *   - 'MANUAL'     — free-form discount (mixed sources / bare discount)
 *
 * ⚠ Do NOT add values here that are not in the Prisma enum. Any
 * value that reaches the database but isn't a member of the Postgres
 * enum will be rejected at insert time with an "invalid input value
 * for enum" error.
 */
export type DiscountType =
  | 'PERCENTAGE'
  | 'FIXED'
  | 'LOYALTY'
  | 'MANUAL';

/**
 * Runtime list of the enum members. Handy for validation and for
 * rendering a `<select>` of discount types. Mirrors the Prisma enum
 * member order.
 */
export const DISCOUNT_TYPE_VALUES: readonly DiscountType[] = [
  'PERCENTAGE',
  'FIXED',
  'LOYALTY',
  'MANUAL',
] as const;

/**
 * Human-readable labels for each discount type. Centralized so every
 * screen renders the same wording.
 */
export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: 'Percentage off',
  FIXED: 'Fixed amount off',
  LOYALTY: 'Loyalty points',
  MANUAL: 'Manual discount',
};

/**
 * Type guard for the discount type union. Useful for narrowing an
 * arbitrary string coming off the wire before rendering a label.
 */
export function isDiscountType(value: unknown): value is DiscountType {
  if (typeof value !== 'string') return false;
  return (DISCOUNT_TYPE_VALUES as readonly string[]).includes(value);
}

/**
 * Promotion / loyalty passthrough fields shared by every create
 * path. All optional. When omitted, the backend infers
 * `discountType` from the underlying sources and leaves the rest
 * at their model defaults.
 */
export interface PromotionPassthrough {
  discountType?: DiscountType | null;
  promotionCode?: string | null;
  promotionDiscount?: number;
}

/**
 * Promotion / loyalty breakdown as returned on a `Sale` row and
 * inside receipt payloads.
 *
 * The `Sale` interface already carries these fields directly.
 * This standalone interface exists so consumers that want to pass
 * just the breakdown around — without the rest of a `Sale` — have
 * a named shape to reach for.
 *
 * `discountType` is typed as `DiscountType | string | null` on the
 * READ side to remain compatible with:
 *   1. sales created before the enum migration ran (whose column was
 *      a free-form TEXT at the time), and
 *   2. any future enum member the frontend hasn't been updated to
 *      know about yet.
 *
 * Narrow it with `isDiscountType()` before rendering a label.
 */
export interface SaleBreakdown {
  discountType?: DiscountType | string | null;
  promotionCode?: string | null;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
}

// ============================================
// MAIN SALE INTERFACE
// ============================================

export interface Sale {
  id: string;
  receiptNumber: string;
  subtotal: number;
  tax: number;
  discount: number;

  // ── Promotion / loyalty audit fields ─────────────────────────
  //
  // Persisted by the backend on every create path
  // (`SaleService.createSale`, `SaleService.createSaleFromCart`,
  // `CheckoutService.processCheckout`). All optional so this
  // interface stays compatible with sales created before the
  // migration added the columns.
  //
  //   discountType      — PERCENTAGE | FIXED | LOYALTY | MANUAL (or a
  //                       legacy string on pre-migration rows; narrow
  //                       with `isDiscountType` before rendering)
  //   promotionCode     — the code that was applied, if any
  //   promotionDiscount — the promotion's currency contribution
  //   loyaltyPointsUsed — points burned on this sale
  //   loyaltyDiscount   — the currency value of those points
  //
  discountType?: DiscountType | string | null;
  promotionCode?: string | null;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;

  total: number;
  paidAmount: number;
  changeAmount: number;
  notes?: string | null;
  status: SaleStatus;
  saleDate: string | Date;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  userId: string;
  user?: User;
  customerId?: string | null;
  customer?: Customer;
  items?: SaleItem[];
  payments?: Payment[];
  orderId?: string | null;
  order?: Order;
  cashRegisterId?: string | null;
  cashRegister?: CashRegister;
  cashRegisterSessionId?: string | null;
  cashRegisterSession?: CashRegisterSession;
  invoiceId?: string | null;
  invoice?: Invoice;
  receipt?: Receipt;
  voidedAt?: string | Date | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  cancelledAt?: string | Date | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  completedAt?: string | Date | null;
  inventoryTransactions?: InventoryTransaction[];
  giftCardTransactions?: GiftCardTransaction[];
  loyaltyHistories?: LoyaltyHistory[];
  taxRecords?: TaxRecord[];
  returns?: Return[];
  refunds?: Refund[];
  qrCodes?: QRCodeRecord[];
  createdAt: string | Date;
  updatedAt: string | Date;
  /**
   * Optional idempotency key the sale was created with. Only present
   * on sales that were created with a key — older rows and
   * non-idempotent create paths leave this undefined.
   */
  idempotencyKey?: string | null;
}

// ============================================
// SALE ITEM INTERFACE
// ============================================

export interface SaleItem {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string | null;
  saleId: string;
  sale?: Sale;
  productId: string;
  product?: Product;
  variantId?: string | null;
  variant?: ProductVariant;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

// ============================================
// RETURN INTERFACES
// ============================================

export interface Return {
  id: string;
  returnNumber: string;
  saleId: string;
  sale?: Sale;
  customerId?: string | null;
  customer?: Customer;
  userId: string;
  user?: User;
  processedBy?: string | null;
  processedByUser?: User | null;
  reason: string;
  status: string;
  returnType: string;
  refundMethod: string;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string | null;
  items?: ReturnItem[];
  refund?: Refund | null;
  processedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  companyId: string;
  businessUnitId: string;
  company?: Company;
  businessUnit?: BusinessUnit;
}

export interface ReturnItem {
  id: string;
  returnId: string;
  return?: Return;
  productId: string;
  product?: Product;
  variantId?: string | null;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  total: number;
  reason?: string | null;
  condition: string;
  notes?: string | null;
  createdAt: string | Date;
}

// ============================================
// REFUND INTERFACES
// ============================================

export interface Refund {
  id: string;
  refundNumber: string;
  saleId: string;
  sale?: Sale;
  returnId?: string | null;
  return?: Return | null;
  customerId?: string | null;
  customer?: Customer;
  userId: string;
  user?: User;
  processedBy?: string | null;
  processedByUser?: User | null;
  reason: string;
  status: string;
  refundMethod: string;
  refundType: string;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string | null;
  paymentId?: string | null;
  payment?: Payment;
  items?: RefundItem[];
  processedAt?: string | Date | null;
  completedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  companyId: string;
  businessUnitId: string;
  company?: Company;
  businessUnit?: BusinessUnit;
}

export interface RefundItem {
  id: string;
  refundId: string;
  refund?: Refund;
  productId: string;
  product?: Product;
  variantId?: string | null;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  total: number;
  reason?: string | null;
  notes?: string | null;
  createdAt: string | Date;
}

// ============================================
// QR CODE INTERFACE
// ============================================

export interface QRCodeRecord {
  id: string;
  code: string;
  data: string;
  type: string;
  imageUrl?: string | null;
  isActive: boolean;
  scans: number;
  lastScanned?: string | Date | null;
  expiresAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  productId?: string | null;
  product?: Product;
  variantId?: string | null;
  variant?: ProductVariant;
  businessUnitId?: string | null;
  businessUnit?: BusinessUnit;
  createdBy?: string | null;
  creator?: User;
  saleId?: string | null;
  sale?: Sale;
  receiptId?: string | null;
  receipt?: Receipt;
}

// ============================================
// SEARCH AND FILTER PARAMS
// ============================================

export interface SaleSearchParams {
  search?: string;
  businessUnitId?: string;
  customerId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  status?: SaleStatus | string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// STATISTICS INTERFACES
// ============================================

export interface SaleStats {
  totalSales: number;
  totalRevenue: number;
  totalSubtotal: number;
  totalTax: number;
  totalDiscount: number;
  averageTicket: number;
  topProducts: Array<{
    productId: string;
    name?: string;
    quantity: number;
    total: number;
  }>;
}

export interface SalesAnalyticsParams {
  startDate?: string;
  endDate?: string;
  view?: 'daily' | 'weekly' | 'monthly';
  businessUnitId?: string;
}

export interface SalesAnalyticsResponse {
  revenueTrend: Array<{
    date: string;
    revenue: number;
    sales: number;
  }>;
  distribution: Array<{
    name: string;
    value: number;
  }>;
  peakHours: Array<{
    hour: number;
    sales: number;
    revenue: number;
  }>;
  customerInsights: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
  };
  bestCategory: string;
  bestCategorySales: number;
  averageOrderValue: number;
  averageItems: number;
  retentionRate: number;
  conversionRate: number;
  totalVisitors: number;
  topProducts: Array<{
    id: string;
    name?: string;
    quantity: number;
    revenue: number;
  }>;
}

// ============================================
// SETTINGS INTERFACES
// ============================================

export interface SalesSettings {
  taxRate: number;
  discountEnabled: boolean;
  maxDiscount: number;
  loyaltyPointsEnabled: boolean;
  pointsPerDollar: number;
  autoPrintReceipt: boolean;
  emailReceipts: boolean;
  receiptFooter: string;
  defaultPaymentMethod: string;
  currencySymbol: string;
  currencyCode: string;
  invoicePrefix: string;
  receiptPrefix: string;
}

// ============================================
// DASHBOARD STATS INTERFACE
// ============================================

export interface DashboardStats {
  totalRevenue: number;
  totalSales: number;
  totalCustomers: number;
  totalProducts: number;
  totalInventory: number;
  recentSales: Sale[];
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  salesTrend: Array<{
    date: string;
    revenue: number;
  }>;
}

// ============================================
// EXPORT PARAMS INTERFACE
// ============================================

export interface ExportSalesParams {
  startDate?: string;
  endDate?: string;
  businessUnitId?: string;
  format: 'CSV' | 'EXCEL' | 'PDF' | 'JSON';
}

// ============================================
// CHECKOUT RELATED INTERFACES
// ============================================

export interface CheckoutData extends PromotionPassthrough {
  cartId: string;
  customerId?: string;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  discount?: number;
  notes?: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  applyLoyaltyPoints?: boolean;
  businessUnitId?: string;
  /**
   * Idempotency key. When supplied, the same value sent twice results
   * in the same sale being returned — no duplicate.
   */
  idempotencyKey?: string;
}

export interface CheckoutResponse {
  sale: Sale;
  payment: Payment;
  receipt: {
    receiptNumber: string;
    items: SaleItem[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paidAmount: number;
    changeAmount: number;
    customerId?: string;
    businessUnitId: string;
    createdAt: string | Date;
    paymentMethod: PaymentMethod;

    // ── Promotion / loyalty breakdown ──────────────────────────
    // Populated by the backend's `buildReceiptShape`, which forwards
    // the corresponding columns from the `Sale` row.
    //
    // `discountType` stays widened to `DiscountType | string | null`
    // so responses from a pre-migration backend still type-check.
    // Narrow it with `isDiscountType` before rendering a label.
    discountType?: DiscountType | string | null;
    promotionCode?: string | null;
    promotionDiscount?: number;
    loyaltyPointsUsed?: number;
    loyaltyDiscount?: number;
  };
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  changeAmount: number;
}

export interface CheckoutSummary {
  items: Array<{
    id: string;
    productId: string;
    product?: Product;
    variant?: ProductVariant;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  loyaltyPointsAvailable: number;
  loyaltyPointsRedeemable: number;
  maxLoyaltyDiscount: number;
  customerId?: string;
}

export interface CheckoutStats {
  totalSales: number;
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  averageOrderValue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  salesByPaymentMethod: Record<string, number>;
  salesByDate: Array<{
    date: string;
    count: number;
    revenue: number;
  }>;
  recentSales: Sale[];
}

export interface ValidateCheckoutRequest {
  cartId: string;
  paymentMethod: PaymentMethod;
  paidAmount: number;
}

export interface ValidateCheckoutResponse {
  valid: boolean;
  errors?: Array<{ field: string; message: string }>;
  warnings?: Array<{ field: string; message: string }>;
}

export interface ProcessPaymentRequest {
  paymentMethod: PaymentMethod;
  paymentDetails?: Record<string, any>;
}

export interface CancelCheckoutRequest {
  reason?: string;
}

export interface EmailReceiptRequest {
  email?: string;
}

export interface CalculateTotalsRequest {
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
  }>;
  discount?: number;
  taxRate?: number;
}

export interface CalculateTotalsResponse {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

// ============================================
// PAYMENT METHOD INTERFACE
// ============================================

export interface PaymentMethodInfo {
  id: string;
  name: string;
  code: string;
  icon?: string;
  enabled: boolean;
  description?: string;
}

// ============================================
// COMPANY REFERENCE (to avoid circular dependency)
// ============================================

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string | null;
  taxId?: string | null;
  currency: string;
  timezone: string;
  logo?: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// ============================================
// RE-EXPORT FOR BACKWARD COMPATIBILITY
// ============================================

// These are already exported from their respective files
// but re-exporting them here for convenience
export type { Product, ProductVariant } from './product';
export type { Customer } from './customer';
export type { BusinessUnit, User } from './user';
export type { Payment } from './payment';
export type { Order } from './order';
export type { Receipt, Invoice } from './invoice';
export type { InventoryTransaction } from './inventory';
export type { GiftCardTransaction, LoyaltyHistory } from './customer';
export type { TaxRecord } from './bookkeeping';
export type { CashRegister, CashRegisterSession } from './register';
