// D:\Projects\Kalwanga\packages\web\types\checkout.ts

import type { Sale } from './sale';
import type { Payment } from './payment';
import type { PaymentMethod } from '../services/saleService';

// ============================================
// PRIMITIVE UNIONS
// ============================================

/**
 * Discount category stored on `Sale.discountType`.
 */
export type DiscountType =
  | 'PERCENTAGE'
  | 'FIXED'
  | 'LOYALTY'
  | 'MANUAL'
  | 'BUY_X_GET_Y'
  | 'FREE_SHIPPING'
  | 'BOGO'
  | 'BUNDLE'
  | 'TIERED';

/**
 * Payment method identifier accepted by `POST /checkout`.
 *
 * Mirrors `CANONICAL_PAYMENT_METHODS` from
 * `checkoutController.ts`. The service normalizes alias forms
 * (`CARD`, `MPESA`, `BANK`, …) to canonical Prisma enum values
 * before writing to the database.
 */
export type CanonicalPaymentMethod =
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
  | 'CHECK';

/**
 * Sale status returned on list responses and checkout receipts.
 */
export type CheckoutSaleStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'ON_HOLD'
  | 'VOID'
  | 'DELETED';

/**
 * Payment status on a `Payment` row.
 */
export type CheckoutPaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIAL'
  | 'PROCESSING'
  | 'AUTHORIZED'
  | 'DECLINED';

// ============================================
// REQUEST SHAPES
// ============================================

/**
 * Body accepted by `POST /checkout`.
 */
export interface CheckoutData {
  // ── Required ─────────────────────────────────────────────
  cartId: string;
  paymentMethod: PaymentMethod;
  paidAmount: number;

  // ── Customer ─────────────────────────────────────────────
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  customerAddress?: string;

  // ── Cart-level modifiers ─────────────────────────────────
  discount?: number;
  notes?: string;

  // ── Cash register ────────────────────────────────────────
  cashRegisterId?: string;
  cashRegisterSessionId?: string;

  // ── Loyalty ──────────────────────────────────────────────
  applyLoyaltyPoints?: boolean;

  // ── Business unit ────────────────────────────────────────
  businessUnitId?: string;

  // ── Idempotency ──────────────────────────────────────────
  idempotencyKey?: string;

  // ── Promotion / loyalty attribution passthrough ──────────
  discountType?: DiscountType | null;
  promotionCode?: string | null;
  promotionDiscount?: number;

  // ── Gateway-specific (online checkout) ───────────────────
  /**
   * Square card nonce from the Square Web SDK. Required when
   * `paymentMethod === 'SQUARE'`. Ignored for every other method.
   */
  cardNonce?: string;
  /**
   * Gift card code for `paymentMethod === 'GIFT_CARD'`. The
   * backend's `GiftCardProviderHandler` reads it as `gatewayId`.
   * The service also mirrors this value onto `gatewayId` for
   * backends that expect it there.
   */
  giftCardCode?: string;

  // ── Client-only hint ─────────────────────────────────────
  savePaymentMethod?: boolean;
}

/**
 * Subset accepted by `POST /checkout/:id/items`.
 */
export interface AddCheckoutItemRequest {
  productId: string;
  variantId?: string;
  quantity: number;
}

/**
 * Subset accepted by `PUT /checkout/:id/items/:itemId`.
 */
export interface UpdateCheckoutItemRequest {
  quantity: number;
}

/**
 * Body accepted by `POST /checkout/:id/pay`.
 */
export interface ProcessCheckoutPaymentRequest {
  paymentMethod: PaymentMethod;
  amount: number;
  paymentDetails?: Record<string, unknown>;
}

/**
 * Body accepted by `POST /checkout/:id/discount`.
 */
export interface ApplyCheckoutDiscountRequest {
  code: string;
}

/**
 * Body accepted by `POST /checkout/:id/email-receipt`.
 */
export interface EmailCheckoutReceiptRequest {
  email?: string;
}

/**
 * Body accepted by `POST /checkout/:id/cancel`.
 */
export interface CancelCheckoutRequest {
  reason?: string;
}

/**
 * Body accepted by `POST /checkout/:saleId/void`.
 */
export interface VoidCheckoutRequest {
  reason?: string;
}

/**
 * Body accepted by `PUT /checkout/:id`.
 */
export interface UpdateCheckoutRequest {
  status?:
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'VOIDED';
  paymentStatus?:
    | 'PENDING'
    | 'PAID'
    | 'FAILED'
    | 'REFUNDED'
    | 'PARTIAL';
  notes?: string;
}

/**
 * Query accepted by `GET /checkout` (admin list).
 */
export interface GetCheckoutsQuery {
  page?: number;
  limit?: number;
  status?: string;
  paymentStatus?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Query accepted by `GET /checkout/history`.
 */
export interface GetCheckoutHistoryQuery {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

/**
 * Query accepted by `GET /checkout/customer/:customerId/history`.
 */
export interface GetCustomerCheckoutHistoryQuery {
  page?: number;
  limit?: number;
}

/**
 * Query accepted by `GET /checkout/stats/summary`.
 */
export interface GetCheckoutStatsQuery {
  dateFrom?: string;
  dateTo?: string;
  businessUnitId?: string;
}

/**
 * Query accepted by `GET /checkout/export/all`.
 */
export interface ExportCheckoutsQuery {
  format?: 'csv' | 'json';
  dateFrom?: string;
  dateTo?: string;
  businessUnitId?: string;
}

/**
 * Query accepted by `GET /checkout/export`.
 */
export interface ExportCheckoutDataQuery {
  format?: 'csv' | 'json';
  startDate?: string;
  endDate?: string;
  status?: string;
}

// ============================================
// RESPONSE SHAPES
// ============================================

export interface CheckoutPagination {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface CheckoutListResponse<T> {
  success: true;
  data: T[];
  pagination: CheckoutPagination;
}

export interface CheckoutSingleResponse<T> {
  success: true;
  data: T;
}

export interface CheckoutReceipt {
  receiptNumber: string;
  items: CheckoutReceiptItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  customerId?: string;
  businessUnitId: string;
  createdAt: string;
  paymentMethod: string;

  discountType?: DiscountType | string | null;
  promotionCode?: string | null;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
}

export interface CheckoutReceiptItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CheckoutResponse {
  sale: Sale;
  payment?: Payment;
  receipt: CheckoutReceipt;
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  changeAmount: number;
}

export interface CheckoutWithPaymentResponse {
  checkout: CheckoutResponse;
  payment: Payment;
}

export interface CheckoutSummary {
  items: CheckoutSummaryItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  loyaltyPointsAvailable: number;
  loyaltyPointsRedeemable: number;
  maxLoyaltyDiscount: number;
  customerId?: string;
}

export interface CheckoutSummaryItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CheckoutStats {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    totalCustomers: number;
    conversionRate: number;
    abandonedCarts: number;
    recoveredCarts: number;
  };
  trends: {
    daily: Array<{ date: string; revenue: number; orders: number }>;
    weekly: Array<{ week: string; revenue: number; orders: number }>;
    monthly: Array<{ month: string; revenue: number; orders: number }>;
  };
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  topCustomers: Array<{
    id: string;
    name: string;
    email: string;
    totalSpent: number;
    orderCount: number;
  }>;
  paymentMethods: Array<{ method: string; count: number; total: number }>;
  checkoutSteps: Array<{
    step: string;
    completed: number;
    dropped: number;
  }>;
  performance: {
    averageCheckoutTime: number;
    pageLoadTime: number;
    successRate: number;
    errorRate: number;
  };
}

export interface PaymentMethodOption {
  id: string;
  name: string;
  code: string;
  icon?: string;
  enabled: boolean;
  description?: string;
}

export interface CheckoutSettings {
  allowPartialPayment: boolean;
  requireCustomer: boolean;
  requireSignature: boolean;
  maxDiscount: number;
  taxInclusive: boolean;
  defaultPaymentMethod: PaymentMethod;
  receiptFooter: string;
  loyaltyPointsEnabled: boolean;
  pointsPerDollar: number;
  allowGuestCheckout: boolean;
  maxCartItems: number;
  cartExpiryHours: number;
  discountEnabled: boolean;
  maxDiscountPercentage: number;
  autoApplyPromotions: boolean;
  reserveStockOnAdd: boolean;
  reserveStockMinutes: number;
  lowStockThreshold: number;
  freeShippingThreshold: number;
  shippingCost: number;
  taxRate: number;
  notifyOnAbandonedCart: boolean;
  abandonedCartHours: number;
  currencyCode: string;
  currencySymbol: string;
  showStockBadge: boolean;
  showVariantImages: boolean;
}

export type CheckoutSettingsUpdate = Partial<CheckoutSettings>;

export interface CheckoutSettingsResponse {
  success: true;
  data: CheckoutSettings;
  message?: string;
}

export interface CheckoutExportJsonResponse {
  success: true;
  data: Sale[];
  total: number;
}

// ============================================
// VALIDATION-ONLY SHAPES (NOT BACKED BY A ROUTE)
// ============================================

/**
 * @deprecated The backend does not expose `POST /checkout/validate`.
 */
export interface ValidateCheckoutRequest {
  cartId: string;
  paymentMethod: PaymentMethod;
  paidAmount: number;
}

/**
 * @deprecated See `ValidateCheckoutRequest`.
 */
export interface ValidateCheckoutResponse {
  valid: boolean;
  errors?: Array<{ field: string; message: string }>;
  warnings?: Array<{ field: string; message: string }>;
}

/**
 * @deprecated The backend does not expose `POST /checkout/calculate`.
 */
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

/**
 * @deprecated See `CalculateTotalsRequest`.
 */
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
