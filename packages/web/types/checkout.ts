// packages/web/types/checkout.ts

import type { Sale } from './sale';
import type { Payment } from './payment';
import type { PaymentMethod } from '../services/saleService';

// ============================================
// PRIMITIVE UNIONS
// ============================================

/**
 * Discount category stored on `Sale.discountType`.
 *
 * Matches the 9-value enum the backend validates against
 * (`DISCOUNT_TYPE_VALUES` in `shared/src/schemas/checkout.ts`).
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
 * Payment method identifier accepted by `POST /checkout` and
 * `POST /checkout/online`.
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
 * Any payment method this app accepts: either a canonical Prisma
 * enum value or an alias the backend normalizes.
 *
 * ⚠ Use this type at any boundary that stores or forwards a
 *   payment-method string — a form-state field, a context value, a
 *   React setter, etc. It is wider than `CanonicalPaymentMethod`
 *   (what ends up in the DB) and wider than `PaymentMethod` (the
 *   narrow union the POS UI renders).
 *
 *   Storing a bare `string` anywhere a payment method lives is
 *   what causes the "Type 'string' is not assignable to
 *   `CanonicalPaymentMethod | PaymentMethod`" error at every call
 *   site that forwards the value into a `CheckoutData`-shaped
 *   payload. Using `AnyPaymentMethod` on the stored field fixes
 *   the error at the source.
 */
export type AnyPaymentMethod = CanonicalPaymentMethod | PaymentMethod;

/**
 * Sale status returned on list responses and checkout receipts.
 *
 * Mirrors Prisma's `SaleStatus` enum. If a status is added to the
 * schema, add it here too — the backend's `PUT /checkout/:id`
 * accepts any value in the enum, and the web type must match or
 * the admin UI can't reach the new state.
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
 *
 * Mirrors Prisma's `PaymentStatus` enum.
 */
export type CheckoutPaymentStatus =
  | 'UNPAID'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIAL'
  | 'PROCESSING'
  | 'AUTHORIZED'
  | 'DECLINED';

/**
 * Mobile-money sub-provider the frontend selects when
 * `paymentMethod === 'MOBILE_MONEY'`. Sent to the backend as
 * `mobileMoneyProvider` so it routes to the right gateway.
 *
 * When omitted, the backend defaults to `'MPESA'`.
 */
export type MobileMoneyProvider = 'MPESA' | 'MTN' | 'AIRTEL';

// ============================================
// REQUEST SHAPES
// ============================================

/**
 * Body accepted by `POST /checkout`.
 *
 * ⚠ `POST /checkout` is the OFFLINE path (cash / bank transfer /
 *   check). Card / PayPal / Flutterwave / Paystack / Square /
 *   Mobile Money must go through `POST /checkout/online` — the
 *   backend rejects them here with a 400. The gateway-specific
 *   fields on this type are declared for forward compatibility and
 *   because the service's payload builder forwards them uniformly;
 *   they are ignored on the offline path.
 */
export interface CheckoutData {
  // ── Required ─────────────────────────────────────────────
  cartId: string;
  /**
   * Canonical payment method. The service normalizes aliases to
   * Prisma enum values before writing.
   */
  paymentMethod: AnyPaymentMethod;
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
  /**
   * Business-unit override.
   *
   * The backend resolves the currency and companyId from the
   * cart's own BU. The controller accepts this field for forward
   * compatibility but (as of the latest rewrite) drops it and
   * uses `cart.businessUnitId`. Declared here so callers don't
   * have to `as any` when they set it.
   */
  businessUnitId?: string;

  // ── Idempotency ──────────────────────────────────────────
  idempotencyKey?: string;

  // ── Promotion / loyalty attribution passthrough ──────────
  discountType?: DiscountType | null;
  promotionCode?: string | null;
  promotionDiscount?: number;

  // ── Gateway-specific (forward-compat / online path) ──────
  /**
   * Square card nonce from the Square Web SDK. Required when
   * `paymentMethod === 'SQUARE'`. Ignored for every other method.
   */
  cardNonce?: string;
  /**
   * Stripe PaymentMethod id (pm_xxx) for server-side confirmation.
   * Ignored on the offline path.
   */
  paymentMethodId?: string;
  /**
   * Gift card code for `paymentMethod === 'GIFT_CARD'`. The
   * backend's `GiftCardProviderHandler` reads it as `gatewayId`.
   * The service also mirrors this value onto `gatewayId` for
   * backends that expect it there.
   */
  giftCardCode?: string;
  /**
   * Legacy gift-card code key. Prefer `giftCardCode` — the service
   * mirrors it automatically. Declared here so a caller that has
   * to send the raw backend-compatible key doesn't need a cast.
   */
  gatewayId?: string;
  /**
   * Mobile-money provider selector. Only meaningful when
   * `paymentMethod === 'MOBILE_MONEY'`.
   */
  mobileMoneyProvider?: MobileMoneyProvider;

  // ── Gateway redirect URLs ────────────────────────────────
  /** Redirect target after a successful gateway flow. */
  returnUrl?: string;
  /** Redirect target after a cancelled gateway flow. */
  cancelUrl?: string;

  // ── Client-only hint ─────────────────────────────────────
  savePaymentMethod?: boolean;
}

/**
 * Subset accepted by `POST /checkout/:id/items`.
 *
 * ⚠ `unitPrice` is deliberately NOT accepted — the backend looks
 *   it up from `Product.unitPrice` / `ProductVariant.price`.
 *   Accepting it from the client was a fraud vector.
 */
export interface AddCheckoutItemRequest {
  productId: string;
  variantId?: string;
  quantity: number;
}

/**
 * Subset accepted by `PUT /checkout/:id/items/:itemId`.
 *
 * The backend also accepts a bare integer body for backwards
 * compatibility; this wrapper shape is the canonical form.
 */
export interface UpdateCheckoutItemRequest {
  quantity: number;
}

/**
 * Body accepted by `POST /checkout/:id/pay`.
 *
 * ⚠ This is NOT the gateway-call entry point. It records an
 *   ADDITIONAL payment against an existing checkout (split /
 *   partial tender). The initial charge happens on
 *   `POST /checkout/online`.
 */
export interface ProcessCheckoutPaymentRequest {
  paymentMethod: AnyPaymentMethod;
  /** Must be strictly positive — zero-amount splits are rejected. */
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
 * Body accepted by `POST /checkout/:id/void`.
 *
 * Distinct from cancel — void reverses inventory, loyalty, and
 * payments; cancel only marks the Sale `CANCELLED`.
 */
export interface VoidCheckoutRequest {
  reason?: string;
}

/**
 * Body accepted by `PUT /checkout/:id`.
 *
 * ⚠ The status enums mirror Prisma exactly. The previous shape
 *   allowed `'VOIDED'` (which doesn't exist) and rejected
 *   legitimate values like `'VOID'`, `'REFUNDED'`, `'ON_HOLD'`.
 *   An admin couldn't reach those states via this endpoint.
 */
export interface UpdateCheckoutRequest {
  status?: CheckoutSaleStatus;
  paymentStatus?: CheckoutPaymentStatus;
  notes?: string;
}

/**
 * Query accepted by `GET /checkout` (admin list).
 */
export interface GetCheckoutsQuery {
  page?: number;
  limit?: number;
  status?: CheckoutSaleStatus | string;
  paymentStatus?: CheckoutPaymentStatus | string;
  customerId?: string;
  /**
   * Business-unit scope. The backend forwards this to the service's
   * where-clause; omitting it returns every BU the caller can see.
   */
  businessUnitId?: string;
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
  status?: CheckoutSaleStatus | string;
  customerId?: string;
  /**
   * Business-unit scope. The backend forwards this to the service's
   * where-clause; omitting it returns every BU the caller can see.
   */
  businessUnitId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

/**
 * Query accepted by `GET /checkout/customer/:customerId/history`.
 *
 * The route is role-gated (Manager+ on the backend router) and the
 * controller additionally scopes by the caller's company when
 * `req.user.companyId` is populated.
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
 *
 * ⚠ The backend controller reads either `dateFrom`/`dateTo` OR
 *   `startDate`/`endDate` from the query. Both pairs are declared
 *   here so callers can use whichever naming matches the rest of
 *   their code without a cast.
 *
 * ⚠ `format` is CSV or JSON only. The backend does not implement
 *   an Excel generator — sending `format: 'excel'` would fall
 *   through to the CSV branch and produce a `.csv` payload with
 *   an `.xlsx` filename, which Excel then refuses to open. Excel
 *   will be re-added to this union when the backend implements
 *   the generator.
 */
export interface ExportCheckoutsQuery {
  format?: 'csv' | 'json';
  dateFrom?: string;
  dateTo?: string;
  startDate?: string;
  endDate?: string;
  businessUnitId?: string;
  /**
   * Optional status filter. Applied server-side by the export
   * handler.
   *
   * **Omit the field** (do not send `'all'`) to export every
   * status — the backend schema rejects `'all'` as an unknown
   * enum value and returns a 400. Callers should send
   * `status: undefined` for the "no filter" case, which is what
   * the checkout history page does.
   */
  status?: CheckoutSaleStatus | string;
}

/**
 * Query accepted by `GET /checkout/export`.
 *
 * ⚠ Accepts both date-param naming pairs — see
 *   `ExportCheckoutsQuery`.
 *
 * ⚠ `format` is CSV or JSON only, same as the admin-scoped export.
 */
export interface ExportCheckoutDataQuery {
  format?: 'csv' | 'json';
  startDate?: string;
  endDate?: string;
  dateFrom?: string;
  dateTo?: string;
  /**
   * Optional status filter. Applied server-side. Omit for "no
   * filter" — see `ExportCheckoutsQuery.status`.
   */
  status?: CheckoutSaleStatus | string;
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

/**
 * List response envelope.
 *
 * ⚠ `withLegacyListAccessors` (in `services/checkoutService.ts`)
 *   installs non-enumerable getters for `total`, `page`,
 *   `totalPages`, and `limit` on the runtime object. They're
 *   declared here as optional so consumers can read either
 *   `response.pagination.total` or `response.total` without a
 *   type error, and so the deprecation is documented at the type
 *   level.
 */
export interface CheckoutListResponse<T> {
  success: true;
  data: T[];
  pagination: CheckoutPagination;
  /** @deprecated Read `pagination.total`. */
  total?: number;
  /** @deprecated Read `pagination.page`. */
  page?: number;
  /** @deprecated Read `pagination.totalPages`. */
  totalPages?: number;
  /** @deprecated Read `pagination.limit`. */
  limit?: number;
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

  /**
   * Resolved currency for the sale (ISO 4217). Populated by the
   * backend's currency resolver — from the business unit's
   * `currency` column, falling back to `DEFAULT_CURRENCY` and
   * then the registry default.
   */
  currency?: string | null;
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

/**
 * Checkout summary as returned by `GET /checkout/summary/:cartId`.
 *
 * ⚠ `currencySymbol` was removed. Phase 1 dropped every persisted
 *   symbol column from `CartSettings`, `CheckoutSettings`, and
 *   `SalesSettings`; the backend's `getCheckoutSummary` now
 *   computes the symbol at read time from `currencyCode` via the
 *   registry. The `currencySymbol` field may still be emitted by
 *   the backend for one more deploy cycle for backward
 *   compatibility, but the web client should treat it as
 *   best-effort and prefer deriving its own display symbol from
 *   `currency`.
 */
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

  /**
   * Resolved currency for the cart's business unit (ISO 4217).
   * Populated by `checkoutService.getCheckoutSummary` from the
   * same resolution chain as `CheckoutReceipt.currency`.
   */
  currency?: string;
}

export interface CheckoutSummaryItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

/**
 * Dashboard statistics shape.
 *
 * ⚠ This type describes a shape the backend has never actually
 *   returned. The backend's `checkoutService.getCheckoutStats`
 *   returns `{ totalSales, totalRevenue, totalTax, totalDiscount,
 *   averageOrderValue, topProducts, salesByPaymentMethod,
 *   salesByDate, recentSales }`. Whoever consumes this type is
 *   reading fields that will be `undefined` at runtime.
 *
 *   Do NOT trust this interface without confirming against
 *   `checkoutService.getCheckoutStats` in the backend. Fixing the
 *   divergence requires a coordinated change to every consumer and
 *   is out of scope for this file's rewrite.
 *
 * @deprecated Shape does not match the backend response. Verify
 *   before using.
 */
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

/**
 * Checkout settings stored on `BusinessUnit.settings` as a JSON
 * blob.
 *
 * ⚠ `currencyCode` is the only currency field that this interface
 *   accepts. Phase 1 removed the persisted `currencySymbol`
 *   column from the sibling tables and from
 *   `BusinessUnit.settings`; the display symbol is now derived
 *   from `currencyCode` via `lib/currencies.ts` on the read path.
 *
 * ⚠ `updateCheckoutSettings` on the backend validates the patch
 *   against a strict schema. Every field on `CheckoutSettings` is
 *   accepted except `currencySymbol` — passing it will 400 with
 *   "Unknown settings field: currencySymbol". This is intentional:
 *   the schema mismatch surfaces the Phase 4/5 cleanup as a real
 *   error rather than silently accepting a field the backend will
 *   discard.
 */
export interface CheckoutSettings {
  allowPartialPayment: boolean;
  requireCustomer: boolean;
  requireSignature: boolean;
  maxDiscount: number;
  taxInclusive: boolean;
  defaultPaymentMethod: AnyPaymentMethod;
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
  /** Total number of rows the export produced. */
  total: number;
}

// ============================================
// VALIDATION-ONLY SHAPES (NOT BACKED BY A ROUTE)
// ============================================

/**
 * @deprecated The backend does not expose `POST /checkout/validate`.
 *   Preserved for backwards compatibility with callers that still
 *   reference the type.
 */
export interface ValidateCheckoutRequest {
  cartId: string;
  paymentMethod: AnyPaymentMethod;
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
 *   Use `checkoutService.getCheckoutSummary(cartId)` instead — it
 *   computes the same totals server-side without a dedicated route.
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
