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
  | 'RETURNED'
  | 'DELETED';

export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'MOBILE_MONEY'
  | 'MOBILE'
  | 'MPESA'
  | 'BANK_TRANSFER'
  | 'BANK'
  | 'GIFT_CARD'
  | 'GIFT'
  | 'LOYALTY_POINTS'
  | 'LOYALTY'
  | 'WALLET'
  | 'SPLIT'
  | 'MIXED'
  | 'OTHER'
  | 'PAYPAL'
  | 'FLUTTERWAVE'
  | 'PAYSTACK'
  | 'SQUARE'
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
 */
export interface SaleBreakdown {
  discountType?: DiscountType | string | null;
  promotionCode?: string | null;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
}

// ============================================
// PAYMENT CURRENCY (PHASE 2 / D1)
// ============================================

/**
 * Per-payment currency audit fields written by the backend.
 *
 * ── Ledger currency ─────────────────────────────────────────────
 *   `currency` is the business unit's ledger currency. It is
 *   REQUIRED and written on every payment row. All amounts on the
 *   `Sale` (subtotal, tax, total, items[].unitPrice, items[].total)
 *   are denominated in this currency.
 *
 * ── Display currency ────────────────────────────────────────────
 *   `displayCurrency` is the payer's chosen view currency, read
 *   from the `X-Display-Currency` header. It is recorded as an
 *   AUDIT FACT — never used to mutate any ledger amount.
 *
 * ── Charge currency (Phase D1) ──────────────────────────────────
 *   When the payment gateway bills in a different currency than
 *   the ledger (a converted card/PayPal/Flutterwave/Paystack/Square
 *   sale), the backend writes:
 *
 *     gatewayCurrency      the currency the gateway actually billed
 *     gatewayAmount        the amount in `gatewayCurrency`
 *     exchangeRate         ledger → charge rate applied
 *     exchangeRateSource   provenance of the rate
 *
 *   For ledger-native methods (CASH, BANK_TRANSFER, CHECK,
 *   GIFT_CARD, LOYALTY_POINTS) and for mobile money, all four are
 *   `null` — the charge currency IS the ledger currency.
 */
export interface PaymentCurrencyAudit {
  currency?: string;
  displayCurrency?: string | null;
  gatewayCurrency?: string | null;
  gatewayAmount?: number | null;
  exchangeRate?: number | null;
  exchangeRateSource?: string | null;
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

  /**
   * ISO 4217 ledger currency, resolved server-side from the
   * business unit.
   *
   * ⚠ Phase 2: every amount on this sale is denominated in this
   *   currency. Use it to format `subtotal`, `tax`, `total`,
   *   `items[].unitPrice`, `items[].total`, `paidAmount`,
   *   `changeAmount`, and every line on `payments[]`.
   *
   *   Optional because pre-Phase-2 backend responses don't carry
   *   it. When absent, fall back to `payments[0].currency`.
   */
  currency?: string;

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
   * on sales that were created with a key.
   */
  idempotencyKey?: string | null;

  // ── Phase 3a: display-currency view ───────────────────────────
  //
  // Populated ONLY when the payer chose a display currency via
  // `X-Display-Currency` AND an FX rate was available. Every field
  // is optional.
  //
  // ⚠ These are VIEWS, not ledger amounts. The ledger fields
  //   (`subtotal`, `total`, `items[].unitPrice`, …) are unchanged.
  //   An operator must always be able to see the ledger.
  //
  // There is no `displayItems` on `Sale` — the sale detail page
  // renders items individually and applies the display conversion
  // at render time using `displayRate`.
  displayCurrency?: string | null;
  displayRate?: number | null;
  displayRateSource?: string | null;
  displaySubtotal?: number;
  displayTax?: number;
  displayDiscount?: number;
  displayTotal?: number;
  displayPaidAmount?: number;
  displayChangeAmount?: number;
}

// ============================================
// SALE ITEM INTERFACE
// ============================================

export interface SaleItem {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  /**
   * Per-line discount on the ledger currency.
   */
  discount?: number;
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
  paymentMethod?: string;
  minAmount?: number;
  maxAmount?: number;
  includeDeleted?: boolean;
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
  view?: 'daily' | 'weekly' | 'monthly' | 'hourly';
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
    repeatRate?: number;
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
  totalSales?: number;
  totalRevenue?: number;
}

// ============================================
// SETTINGS INTERFACES
// ============================================

/**
 * Sales settings as returned by `GET /sales/settings`.
 *
 * ⚠ `currencySymbol` is derived, not stored. The backend resolves
 *   it from `currencyCode` via the currency registry on every read
 *   and includes it on the response. It is optional because a
 *   registry entry may not carry a symbol (in which case the
 *   backend falls back to the code itself).
 *
 *   When updating settings, do NOT send `currencySymbol`. The
 *   backend drops it silently — only `currencyCode` is persisted.
 */
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
  currencyCode: string;
  /** Derived server-side. Never persisted. */
  currencySymbol?: string;
  invoicePrefix: string;
  receiptPrefix: string;
}

// ============================================
// DASHBOARD STATS INTERFACE
// ============================================

export interface DashboardStats {
  /** ISO 4217 ledger currency for every amount in this response. */
  currency?: string;
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

/**
 * Result of an export call.
 */
export interface ExportSalesResult {
  blob: Blob;
  format: 'csv' | 'json' | 'excel' | 'pdf';
  filename: string;
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
   * Idempotency key. When supplied, the same value sent twice
   * results in the same sale being returned — no duplicate.
   */
  idempotencyKey?: string;
  /**
   * ISO 4217 code of the payer's chosen display currency. Recorded
   * on the `Payment` row as an audit fact.
   */
  displayCurrency?: string | null;
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

    discountType?: DiscountType | string | null;
    promotionCode?: string | null;
    promotionDiscount?: number;
    loyaltyPointsUsed?: number;
    loyaltyDiscount?: number;

    /**
     * Ledger currency.
     */
    currency?: string;

    // ── Charge-currency audit (Phase D1) ─────────────────────
    chargeCurrency?: string | null;
    chargeAmount?: number | null;
    chargeRate?: number | null;
    chargeRateSource?: string | null;
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
  currency?: string;
  currencySymbol?: string;
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
