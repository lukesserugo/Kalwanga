// D:\Projects\Kalwanga\packages\web\services\saleService.ts

import { api } from './api';
import type { Sale, SaleStatus } from '../types/sale';

// ============================================
// PAYMENT METHOD
// ============================================

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
  | 'CHECK';

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'CASH',
  'CARD',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'MOBILE_MONEY',
  'MOBILE',
  'MPESA',
  'BANK_TRANSFER',
  'BANK',
  'GIFT_CARD',
  'GIFT',
  'LOYALTY_POINTS',
  'LOYALTY',
  'WALLET',
  'SPLIT',
  'MIXED',
  'OTHER',
  'PAYPAL',
  'FLUTTERWAVE',
  'PAYSTACK',
  'SQUARE',
  'CHECK',
] as const;

/**
 * Payment methods that require a gateway handshake and therefore
 * CANNOT be used with the POS/direct sale endpoints
 * (`POST /sales`, `POST /sales/checkout`, `POST /sales/pos/checkout`).
 *
 * The backend rejects these with a 400. They must go through the
 * online checkout flow (`/checkout/online`), which creates a PENDING
 * sale, resolves the charge currency, invokes the gateway, and
 * completes the sale from the webhook.
 *
 * ⚠ Keep in sync with `REMOTE_GATEWAY_METHODS` in the backend's
 *   `checkoutService.ts` and `saleController.ts`.
 */
export const GATEWAY_PAYMENT_METHODS: ReadonlySet<PaymentMethod> =
  new Set<PaymentMethod>([
    'CARD',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'PAYPAL',
    'FLUTTERWAVE',
    'PAYSTACK',
    'SQUARE',
  ]);

/**
 * Payment methods that are ledger-native — the charge currency is
 * the ledger currency by construction. Safe for POS / direct sale.
 */
export function isLedgerNativePaymentMethod(
  method: string,
): boolean {
  return !GATEWAY_PAYMENT_METHODS.has(
    method.trim().toUpperCase() as PaymentMethod,
  );
}

// ============================================
// DISCOUNT TYPE
// ============================================

/**
 * Discount category stored on `Sale.discountType`. Mirrors the
 * backend's Prisma `DiscountType` enum exactly.
 *
 * ⚠ Keep this union in sync with `enum DiscountType` in
 *   `prisma/schema.prisma`. Values outside the enum are rejected by
 *   Postgres at insert time.
 */
export type DiscountType =
  | 'PERCENTAGE'
  | 'FIXED'
  | 'LOYALTY'
  | 'MANUAL';

export const DISCOUNT_TYPE_VALUES: readonly DiscountType[] = [
  'PERCENTAGE',
  'FIXED',
  'LOYALTY',
  'MANUAL',
] as const;

/**
 * Promotion / loyalty passthrough fields shared by every create
 * path. All optional. When omitted, the backend infers
 * `discountType` from the underlying sources.
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
 * `discountType` is typed as `DiscountType | string | null` on the
 * READ side to remain compatible with legacy rows and forward-
 * compatible with future enum members.
 */
export interface SaleBreakdown {
  discountType?: DiscountType | string | null;
  promotionCode?: string | null;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
}

// ============================================
// DISCOUNT / LOYALTY CONSTANTS & HELPERS
// ============================================

/**
 * Value of one loyalty point in the tenant's currency. Mirrors
 * `LOYALTY_POINT_VALUE` in the backend's `saleService.ts` and
 * `checkoutService.ts` so client-side previews never disagree with
 * what the server will actually charge.
 */
export const LOYALTY_POINT_VALUE = 0.1;

/**
 * Maximum share of the order total that can be covered by loyalty
 * points, as a decimal. Mirrors the `* 0.5` cap in the backend.
 */
export const MAX_LOYALTY_DISCOUNT_FRACTION = 0.5;

/**
 * Human-readable labels for each discount type.
 */
export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: 'Percentage off',
  FIXED: 'Fixed amount off',
  LOYALTY: 'Loyalty points',
  MANUAL: 'Manual discount',
};

/**
 * Round to two decimal places. Mirrors the backend's `round2`.
 */
function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Compute the loyalty point cap and discount for a given total.
 */
export function computeLoyaltyCapacity(
  total: number,
  availablePoints: number,
): {
  redeemablePoints: number;
  maxDiscount: number;
  discountFraction: number;
} {
  const maxDiscount = round2(total * MAX_LOYALTY_DISCOUNT_FRACTION);
  const pointsByValue = Math.floor(maxDiscount / LOYALTY_POINT_VALUE);
  const redeemablePoints = Math.max(
    0,
    Math.min(availablePoints, pointsByValue),
  );
  const discountFraction =
    total > 0
      ? round2((redeemablePoints * LOYALTY_POINT_VALUE) / total)
      : 0;

  return {
    redeemablePoints,
    maxDiscount: round2(redeemablePoints * LOYALTY_POINT_VALUE),
    discountFraction,
  };
}

/**
 * Type guard for the discount type union.
 */
export function isDiscountType(value: unknown): value is DiscountType {
  if (typeof value !== 'string') return false;
  return (DISCOUNT_TYPE_VALUES as readonly string[]).includes(value);
}

/**
 * Best-effort label for an arbitrary `discountType` value.
 */
export function getDiscountTypeLabel(
  value: DiscountType | string | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  if (isDiscountType(value)) return DISCOUNT_TYPE_LABELS[value];
  return String(value);
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SaleSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  businessUnitId?: string;
  customerId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  status?: SaleStatus | string;
  paymentMethod?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  minAmount?: number;
  maxAmount?: number;
  includeDeleted?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  stats?: SalesStats;
  /**
   * ISO 4217 ledger currency for the response. Present when the
   * backend endpoint is currency-aware.
   *
   * ⚠ Prefer this over a hardcoded symbol. The ledger currency is
   *   resolved server-side from the business unit; the frontend
   *   must never assume `USD`.
   */
  currency?: string;
}

export interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  totalSubtotal: number;
  totalTax: number;
  totalDiscount: number;
  averageTicket: number;
  todayRevenue?: number;
  todaySales?: number;
  pendingOrders?: number;
  processingOrders?: number;
  completedOrders?: number;
  cancelledOrders?: number;
  refundedOrders?: number;
  onHoldOrders?: number;
  topProducts: Array<{
    productId: string;
    productName?: string;
    productSku?: string;
    quantity: number;
    total: number;
  }>;
  totalItemsSold: number;
  totalCustomers: number;
  newCustomers?: number;
  returningCustomers?: number;
  repeatRate?: number;
  averageItemsPerSale: number;
  totalVisitors?: number;
  conversionRate?: number;
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
    repeatRate: number;
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
    name: string;
    quantity: number;
    revenue: number;
  }>;
  totalSales: number;
  totalRevenue: number;
}

export interface SalesSettings {
  id?: string;
  companyId?: string;
  taxRate: number;
  discountEnabled: boolean;
  maxDiscount: number;
  loyaltyPointsEnabled: boolean;
  pointsPerDollar: number;
  autoPrintReceipt: boolean;
  emailReceipts: boolean;
  receiptFooter: string;
  defaultPaymentMethod: PaymentMethod;
  /**
   * ISO 4217 code. The authoritative field.
   */
  currencyCode: string;
  /**
   * Display symbol for `currencyCode`.
   *
   * ⚠ Phase 2: DERIVED, not stored. The backend resolves this from
   *   `currencyCode` via the registry. It is optional because a
   *   fresh install or a code that has no registered symbol will
   *   not carry one — callers must fall back to `currencyCode`
   *   itself.
   *
   * ⚠ Do NOT send this field when updating settings. The backend
   *   silently drops it; only `currencyCode` is persisted.
   */
  currencySymbol?: string;
  invoicePrefix: string;
  receiptPrefix: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardStats {
  /**
   * ISO 4217 ledger currency for every amount in this response.
   */
  currency?: string;
  today: {
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
  };
  week: {
    totalSales: number;
    totalRevenue: number;
  };
  month: {
    totalSales: number;
    totalRevenue: number;
  };
  allTime: SalesStats;
  recentSales: Sale[];
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  salesByHour: Array<{
    hour: number;
    sales: number;
    revenue: number;
  }>;
  salesByDay: Array<{
    day: string;
    sales: number;
    revenue: number;
  }>;
}

export interface DailySalesSummary {
  date: string;
  totalSales: number;
  totalRevenue: number;
  totalItems: number;
  averageTicket: number;
  paymentMethods: Array<{
    method: string;
    count: number;
    total: number;
    percentage: number;
  }>;
  hourlyBreakdown: Array<{
    hour: number;
    count: number;
    revenue: number;
  }>;
  sales: Sale[];
  /**
   * ISO 4217 ledger currency for every amount in this response.
   */
  currency?: string;
}

export interface ExportSalesParams {
  businessUnitId?: string;
  startDate: string;
  endDate: string;
  format?: 'json' | 'csv' | 'excel' | 'pdf';
}

/**
 * Result of an export call. The caller is responsible for
 * downloading the blob (e.g. via an anchor click).
 */
export interface ExportSalesResult {
  blob: Blob;
  /**
   * The format the backend actually served. Normalized to the set
   * of supported formats. When the server returns an unexpected
   * content type, this is `'csv'` (the backend's default).
   */
  format: 'csv' | 'json' | 'excel' | 'pdf';
  /**
   * Suggested filename, derived from the response's
   * `Content-Disposition` header when present, otherwise generated
   * locally from `format` and the date range.
   */
  filename: string;
}

// ============================================
// POS TYPES
// ============================================

export interface CartItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    images: string[];
  };
  variantId?: string;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: any;
  };
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
  availableStock: number;
  isInStock: boolean;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  /**
   * Category of the discount currently applied to the cart.
   */
  discountType?: DiscountType;
  promotionCode?: string;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
  total: number;
  customerId?: string;
  customer?: any;
  businessUnitId: string;
  userId: string;
  notes?: string;
  status: 'ACTIVE' | 'SAVED' | 'CHECKED_OUT' | 'ABANDONED';
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  /**
   * ISO 4217 ledger currency, resolved server-side.
   *
   * ⚠ Phase 2: always present on the cart response. Use this to
   *   format every amount on the cart. Never hardcode a symbol.
   */
  currency?: string;
  /**
   * Display symbol for `currency`. Derived server-side.
   *
   * ⚠ Phase 2: optional. Prefer passing `currency` (the code) to
   *   `Intl.NumberFormat`. Use `currencySymbol` only for contexts
   *   that cannot call `Intl` (CSV exports, plain-text receipts).
   */
  currencySymbol?: string;

  // ── Phase 3a: display-currency view ─────────────────────────
  /**
   * The payer's chosen display currency, when different from the
   * ledger currency AND an FX rate is available. Absent otherwise.
   *
   * ⚠ These are VIEWS, not ledger amounts. The ledger fields
   *   (`subtotal`, `total`, `items[].unitPrice`, …) are unchanged.
   */
  displayCurrency?: string | null;
  displayRate?: number | null;
  displayRateSource?: string | null;
  displaySubtotal?: number;
  displayTax?: number;
  displayDiscount?: number;
  displayPromotionDiscount?: number;
  displayLoyaltyDiscount?: number;
  displayTotal?: number;
  displayItems?: Array<{ unitPrice: number; total: number }>;
}

export interface PosCheckoutData extends PromotionPassthrough {
  cartId: string;
  /**
   * Payment method. Must be ledger-native — gateway-backed methods
   * are rejected by the backend. See `GATEWAY_PAYMENT_METHODS`.
   */
  paymentMethod: PaymentMethod;
  paidAmount: number;
  customerId?: string;
  discount?: number;
  notes?: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  applyLoyaltyPoints?: boolean;
  tipAmount?: number;
  /**
   * Optional. When omitted, no idempotency is applied. When
   * provided, retries with the same value return the original sale
   * instead of creating a duplicate.
   */
  idempotencyKey?: string;
  /**
   * Optional. ISO 4217 code of the payer's chosen display
   * currency. Recorded on the `Payment` row as an audit fact —
   * never mutates any amount.
   */
  displayCurrency?: string | null;
}

export interface PosSummary {
  cartCount: number;
  itemCount: number;
  totalValue: number;
  averageTicket: number;
  todaySales: number;
  todayRevenue: number;
  activeCarts: number;
  abandonedCarts: number;
}

export interface RegisterStatus {
  id: string;
  name: string;
  balance: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING' | 'SUSPENDED';
  transactions: number;
  cashIn: number;
  cashOut: number;
  sessionId?: string;
  openedAt?: string;
  closedAt?: string;
}

export interface PosStats {
  today: {
    revenue: number;
    sales: number;
    averageTicket: number;
    itemsSold: number;
  };
  cartCount: number;
  activeSessions: number;
  lowStockCount: number;
  pendingOrders: number;
}

export interface PosTransaction {
  id: string;
  receiptNumber: string;
  total: number;
  status: string;
  saleDate: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    product?: { id: string; name: string; sku: string };
    variant?: { id: string; name: string; sku: string } | null;
  }>;
  payments?: Array<{
    id: string;
    paymentMethod: string;
    amount: number;
    status: string;
    currency?: string;
    displayCurrency?: string | null;
    gatewayCurrency?: string | null;
    gatewayAmount?: number | null;
    exchangeRate?: number | null;
    exchangeRateSource?: string | null;
  }>;
}

export interface PopularProduct {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  images: string[];
  category: string | null;
  inventory: { available: number } | null;
  soldCount: number;
  revenue: number;
}

/**
 * Preview of what a discount will look like at checkout.
 */
export interface DiscountPreview {
  originalTotal: number;
  promotionDiscount: number;
  loyaltyDiscount: number;
  finalTotal: number;
  loyaltyPointsUsed: number;
  loyaltyPointsEarned: number;
  warnings: string[];
}

// ============================================
// REQUEST HELPERS
// ============================================

/**
 * Build an `Idempotency-Key` header object for a request.
 */
function idempotencyHeaders(
  key?: string,
): Record<string, string> | undefined {
  if (!key) return undefined;
  const trimmed = String(key).trim();
  if (!trimmed) return undefined;
  return { 'Idempotency-Key': trimmed };
}

/**
 * Build an `X-Display-Currency` header object for a request.
 *
 * Returns `undefined` when no display currency is supplied so
 * callers can pass the result straight through without a
 * conditional. The value is upper-cased and validated to be a
 * plausible ISO code (3 letters). The backend validates against
 * the registry and drops unknown codes silently.
 */
function displayCurrencyHeaders(
  code?: string | null,
): Record<string, string> | undefined {
  if (!code) return undefined;
  const trimmed = String(code).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(trimmed)) return undefined;
  return { 'X-Display-Currency': trimmed };
}

/**
 * Merge two header objects, dropping `undefined` ones. The result
 * is `undefined` when both are empty so `api.post` receives
 * `headers: undefined` (a no-op).
 */
function mergeHeaders(
  ...sources: Array<Record<string, string> | undefined>
): Record<string, string> | undefined {
  const merged: Record<string, string> = {};
  let hasAny = false;
  for (const source of sources) {
    if (!source) continue;
    for (const [k, v] of Object.entries(source)) {
      merged[k] = v;
      hasAny = true;
    }
  }
  return hasAny ? merged : undefined;
}

/**
 * Copy the three promotion / loyalty passthrough fields onto a
 * request body, skipping any that are `undefined`. Returns the
 * mutated body for chaining.
 */
function attachPromotionFields<T extends Record<string, unknown>>(
  body: T,
  source: PromotionPassthrough,
): T {
  const target = body as Record<string, unknown>;

  if (source.discountType !== undefined) {
    target.discountType = source.discountType;
  }
  if (source.promotionCode !== undefined) {
    target.promotionCode = source.promotionCode;
  }
  if (source.promotionDiscount !== undefined) {
    target.promotionDiscount = source.promotionDiscount;
  }
  return body;
}

/**
 * Unwrap the standard `{ success, data, … }` envelope the backend
 * returns. Handles three shapes:
 *   • `{ data: T }`  → returns `T`
 *   • `T` directly   → returns `T`
 *   • null / scalar  → returns the input unchanged
 */
function unwrap<T>(response: unknown): T {
  if (response && typeof response === 'object') {
    if ('data' in (response as any)) {
      const inner = (response as any).data;
      if (inner !== undefined && inner !== null) return inner as T;
    }
  }
  return response as T;
}

/**
 * Extract `currency` from an envelope that carries it at the top
 * level (e.g. `{ success, data, currency }`). Returns `undefined`
 * when absent.
 */
function extractEnvelopeCurrency(response: unknown): string | undefined {
  if (response && typeof response === 'object' && 'currency' in response) {
    const c = (response as any).currency;
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return undefined;
}

// ============================================
// IDEMPOTENCY / DISPLAY CURRENCY BODY HELPERS
// ============================================

/**
 * Attach the display-currency hint to a request body, in addition
 * to the `X-Display-Currency` header. The backend accepts either;
 * sending both is harmless and makes the intent visible in request
 * logs.
 */
function attachDisplayCurrency<T extends Record<string, unknown>>(
  body: T,
  code?: string | null,
): T {
  if (code === undefined || code === null) return body;
  const trimmed = String(code).trim().toUpperCase();
  if (!trimmed) return body;
  (body as Record<string, unknown>).displayCurrency = trimmed;
  return body;
}

// ============================================
// SALE SERVICE
// ============================================

export const saleService = {
  // ============================================
  // IDEMPOTENCY
  // ============================================

  /**
   * Generate a fresh idempotency key for a new logical operation.
   * Call once when the user initiates a sale, then reuse the same
   * value on every retry of that same sale.
   */
  generateIdempotencyKey(): string {
    const g: any =
      typeof globalThis !== 'undefined' ? (globalThis as any) : {};
    if (g.crypto?.randomUUID) {
      return g.crypto.randomUUID();
    }
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 12);
    return `pos-${t}-${r}`;
  },

  // ============================================
  // DISCOUNT / LOYALTY HELPERS
  // ============================================

  /**
   * Extract the promotion / loyalty breakdown from any object that
   * carries it — a `Sale`, a receipt, or a transaction row.
   */
  extractBreakdown(source: unknown): SaleBreakdown {
    if (!source || typeof source !== 'object') {
      return {};
    }
    const s = source as Record<string, unknown>;
    const breakdown: SaleBreakdown = {};

    const dt = s.discountType ?? s.discount_type;
    if (dt !== undefined && dt !== null) {
      breakdown.discountType = dt as string;
    }

    const pc = s.promotionCode ?? s.promotion_code;
    if (pc !== undefined && pc !== null) {
      breakdown.promotionCode = pc as string;
    }

    const pd = s.promotionDiscount ?? s.promotion_discount;
    if (typeof pd === 'number') {
      breakdown.promotionDiscount = pd;
    } else if (typeof pd === 'string' && pd.length > 0) {
      const parsed = Number(pd);
      if (Number.isFinite(parsed)) breakdown.promotionDiscount = parsed;
    }

    const lpu = s.loyaltyPointsUsed ?? s.loyalty_points_used;
    if (typeof lpu === 'number') {
      breakdown.loyaltyPointsUsed = lpu;
    } else if (typeof lpu === 'string' && lpu.length > 0) {
      const parsed = Number(lpu);
      if (Number.isFinite(parsed)) breakdown.loyaltyPointsUsed = parsed;
    }

    const ld = s.loyaltyDiscount ?? s.loyalty_discount;
    if (typeof ld === 'number') {
      breakdown.loyaltyDiscount = ld;
    } else if (typeof ld === 'string' && ld.length > 0) {
      const parsed = Number(ld);
      if (Number.isFinite(parsed)) breakdown.loyaltyDiscount = parsed;
    }

    return breakdown;
  },

  /**
   * True when the sale carries any promotion or loyalty attribution.
   */
  hasBreakdown(source: unknown): boolean {
    const b = this.extractBreakdown(source);
    return Boolean(
      b.discountType ||
        b.promotionCode ||
        (b.promotionDiscount ?? 0) > 0 ||
        (b.loyaltyPointsUsed ?? 0) > 0 ||
        (b.loyaltyDiscount ?? 0) > 0,
    );
  },

  /**
   * Render a human-readable one-line summary of the breakdown.
   */
  describeBreakdown(source: unknown): string {
    const b = this.extractBreakdown(source);
    const parts: string[] = [];

    if (b.promotionCode) {
      parts.push(`Promotion ${b.promotionCode}`);
    } else if ((b.promotionDiscount ?? 0) > 0) {
      const label = b.discountType
        ? getDiscountTypeLabel(b.discountType) || 'Manual discount'
        : 'Manual discount';
      parts.push(label);
    }

    if ((b.loyaltyPointsUsed ?? 0) > 0) {
      parts.push(`${b.loyaltyPointsUsed} loyalty points`);
    }

    return parts.join(' + ');
  },

  /**
   * Compute a client-side discount preview. Never talks to the
   * backend — the authoritative numbers come from the backend at
   * checkout time.
   */
  previewDiscount(params: {
    total: number;
    promotionDiscount?: number;
    promotionCode?: string | null;
    discountType?: DiscountType | null;
    loyaltyPointsToUse?: number;
    availableLoyaltyPoints?: number;
  }): DiscountPreview {
    const {
      total,
      promotionDiscount = 0,
      loyaltyPointsToUse = 0,
      availableLoyaltyPoints = 0,
    } = params;

    const capacity = computeLoyaltyCapacity(total, availableLoyaltyPoints);
    const effectiveLoyaltyPoints = Math.min(
      loyaltyPointsToUse,
      capacity.redeemablePoints,
    );
    const loyaltyDiscount = round2(
      effectiveLoyaltyPoints * LOYALTY_POINT_VALUE,
    );

    const effectivePromotion = Math.min(
      promotionDiscount,
      Math.max(0, total - loyaltyDiscount),
    );

    const finalTotal = round2(
      Math.max(0, total - effectivePromotion - loyaltyDiscount),
    );

    const warnings: string[] = [];
    if (loyaltyPointsToUse > capacity.redeemablePoints) {
      warnings.push(
        `Only ${capacity.redeemablePoints} points can be applied to this order.`,
      );
    }
    if (promotionDiscount > effectivePromotion) {
      warnings.push(
        `Promotion discount capped at ${effectivePromotion.toFixed(2)}.`,
      );
    }

    return {
      originalTotal: round2(total),
      promotionDiscount: round2(effectivePromotion),
      loyaltyDiscount,
      finalTotal,
      loyaltyPointsUsed: effectiveLoyaltyPoints,
      loyaltyPointsEarned: Math.floor(finalTotal / 10),
      warnings,
    };
  },

  /**
   * Build the `PromotionPassthrough` block to attach to a checkout
   * payload.
   */
  buildPassthrough(input: PromotionPassthrough): PromotionPassthrough {
    const out: PromotionPassthrough = {};
    if (input.discountType !== undefined) {
      out.discountType = input.discountType;
    }
    if (input.promotionCode !== undefined) {
      out.promotionCode = input.promotionCode;
    }
    if (input.promotionDiscount !== undefined) {
      out.promotionDiscount = round2(input.promotionDiscount);
    }
    return out;
  },

  // ============================================
  // SALES STATISTICS
  // ============================================

  /**
   * Get sales statistics
   * GET /sales/stats
   */
  async getSalesStats(params?: {
    businessUnitId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<SalesStats> {
    try {
      const response = await api.get<any>('/sales/stats', { params });
      const data = unwrap<SalesStats>(response);
      if (data && typeof data === 'object' && 'totalSales' in data) {
        return data;
      }
      return this.getDefaultStats();
    } catch (error) {
      console.error('Failed to fetch sales stats:', error);
      return this.getDefaultStats();
    }
  },

  /**
   * Get today's sales summary
   * GET /sales/today
   */
  async getTodaySalesSummary(params?: {
    businessUnitId?: string;
  }): Promise<{
    date: string;
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    totalCustomers: number;
    paymentBreakdown: Record<string, number>;
    currency?: string;
  }> {
    try {
      const response = await api.get<any>('/sales/today', { params });
      const data = unwrap<any>(response);
      const currency = extractEnvelopeCurrency(response);
      if (data && typeof data === 'object') {
        return { ...data, ...(currency ? { currency } : {}) };
      }
      return this.getDefaultTodaySummary();
    } catch (error) {
      console.error("Failed to fetch today's sales summary:", error);
      return this.getDefaultTodaySummary();
    }
  },

  /**
   * Get daily sales summary
   * GET /sales/daily-summary
   */
  async getDailySalesSummary(params: {
    businessUnitId?: string;
    date: string;
  }): Promise<DailySalesSummary> {
    try {
      const response = await api.get<any>('/sales/daily-summary', {
        params,
      });
      const data = unwrap<any>(response);
      const currency = extractEnvelopeCurrency(response);
      if (data && typeof data === 'object') {
        return { ...data, ...(currency ? { currency } : {}) };
      }
      return this.getDefaultDailySummary();
    } catch (error) {
      console.error('Failed to fetch daily sales summary:', error);
      return this.getDefaultDailySummary();
    }
  },

  /**
   * Get dashboard sales data
   * GET /sales/dashboard
   */
  async getDashboardSalesData(params?: {
    businessUnitId?: string;
  }): Promise<DashboardStats> {
    try {
      const response = await api.get<any>('/sales/dashboard', { params });
      const data = unwrap<any>(response);
      // The backend nests `currency` inside `data`.
      const currency =
        (data && typeof data === 'object' && data.currency) ||
        extractEnvelopeCurrency(response);
      if (data && typeof data === 'object') {
        return currency ? { ...data, currency } : data;
      }
      return this.getDefaultDashboardStats();
    } catch (error) {
      console.error('Failed to fetch dashboard sales data:', error);
      return this.getDefaultDashboardStats();
    }
  },

  /**
   * Get sales analytics
   * GET /sales/analytics
   */
  async getSalesAnalytics(
    params?: SalesAnalyticsParams,
  ): Promise<SalesAnalyticsResponse> {
    try {
      const response = await api.get<any>('/sales/analytics', { params });
      const data = unwrap<SalesAnalyticsResponse>(response);
      if (data && typeof data === 'object' && 'revenueTrend' in data) {
        return data;
      }
      return this.getDefaultAnalytics();
    } catch (error) {
      console.error('Failed to fetch sales analytics:', error);
      return this.getDefaultAnalytics();
    }
  },

  /**
   * Get sales forecast
   * GET /sales/forecast
   */
  async getSalesForecast(params?: {
    businessUnitId?: string;
    days?: number;
  }): Promise<{
    forecast: Array<{
      date: string;
      predicted: number;
      confidence: number;
      lowerBound?: number;
      upperBound?: number;
    }>;
    trend: 'up' | 'down' | 'stable';
    growthRate: number;
    averageDailyRevenue?: number;
    totalHistoricalSales?: number;
    period?: string;
  }> {
    try {
      const response = await api.get<any>('/sales/forecast', { params });
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'forecast' in data) {
        return data;
      }
      return { forecast: [], trend: 'stable', growthRate: 0 };
    } catch (error) {
      console.error('Failed to fetch sales forecast:', error);
      return { forecast: [], trend: 'stable', growthRate: 0 };
    }
  },

  /**
   * Get sales comparison
   * GET /sales/compare
   */
  async getSalesComparison(params: {
    businessUnitId?: string;
    period1Start: string;
    period1End: string;
    period2Start: string;
    period2End: string;
  }): Promise<{
    period1: { revenue: number; sales: number; average: number };
    period2: { revenue: number; sales: number; average: number };
    difference: { revenue: number; sales: number; average: number };
    percentageChange: { revenue: number; sales: number; average: number };
  }> {
    try {
      const response = await api.get<any>('/sales/compare', { params });
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'period1' in data) {
        return data;
      }
      return {
        period1: { revenue: 0, sales: 0, average: 0 },
        period2: { revenue: 0, sales: 0, average: 0 },
        difference: { revenue: 0, sales: 0, average: 0 },
        percentageChange: { revenue: 0, sales: 0, average: 0 },
      };
    } catch (error) {
      console.error('Failed to fetch sales comparison:', error);
      throw error;
    }
  },

  /**
   * Get sales summary by period
   * GET /sales/summary
   */
  async getSalesSummary(params?: {
    businessUnitId?: string;
    period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    date?: string;
  }): Promise<{
    period: string;
    startDate: string;
    endDate: string;
    totalRevenue: number;
    totalSales: number;
    averageTicket: number;
    totalItems: number;
    uniqueCustomers: number;
    topCategory: string;
    topProduct: string;
  }> {
    try {
      const response = await api.get<any>('/sales/summary', { params });
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'totalRevenue' in data) {
        return data;
      }
      return {
        period: 'month',
        startDate: '',
        endDate: '',
        totalRevenue: 0,
        totalSales: 0,
        averageTicket: 0,
        totalItems: 0,
        uniqueCustomers: 0,
        topCategory: '',
        topProduct: '',
      };
    } catch (error) {
      console.error('Failed to fetch sales summary:', error);
      throw error;
    }
  },

  /**
   * Get sales by payment method
   * GET /sales/payment-methods
   */
  async getSalesByPaymentMethod(params?: {
    businessUnitId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<
    Array<{
      paymentMethod: string;
      count: number;
      total: number;
      average: number;
      percentage: number;
    }>
  > {
    try {
      const response = await api.get<any>('/sales/payment-methods', {
        params,
      });
      const data = unwrap<any>(response);
      if (Array.isArray(data)) return data;
      if (Array.isArray(response)) return response;
      return [];
    } catch (error) {
      console.error('Failed to fetch sales by payment method:', error);
      return [];
    }
  },

  /**
   * Get sales by status
   * GET /sales/status/:status
   */
  async getSalesByStatus(
    status: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<Sale>> {
    try {
      const response = await api.get<any>(`/sales/status/${status}`, {
        params,
      });
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'data' in data) {
        return data;
      }
      if (data && typeof data === 'object') {
        return data;
      }
      return { data: [], total: 0, page: 1, totalPages: 0, limit: 20 };
    } catch (error) {
      console.error(`Failed to fetch sales by status ${status}:`, error);
      return { data: [], total: 0, page: 1, totalPages: 0, limit: 20 };
    }
  },

  /**
   * Get sales by product
   * GET /sales/product/:productId
   */
  async getSalesByProduct(
    productId: string,
    params?: {
      businessUnitId?: string;
      variantId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    },
  ): Promise<{
    items: Array<{
      date: string;
      quantity: number;
      revenue: number;
      customerName: string;
      customerEmail: string;
      variantName: string;
    }>;
    totalQuantity: number;
    totalRevenue: number;
    averagePrice: number;
  }> {
    try {
      const response = await api.get<any>(`/sales/product/${productId}`, {
        params,
      });
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'items' in data) {
        return data;
      }
      return { items: [], totalQuantity: 0, totalRevenue: 0, averagePrice: 0 };
    } catch (error) {
      console.error(`Failed to fetch sales by product ${productId}:`, error);
      return { items: [], totalQuantity: 0, totalRevenue: 0, averagePrice: 0 };
    }
  },

  /**
   * Get customer sales stats
   * GET /sales/customer-stats/:customerId
   */
  async getCustomerSalesStats(customerId: string): Promise<{
    customer: {
      id: string;
      name: string;
      email: string;
      loyaltyPoints: number;
      loyaltyLevel: string;
    };
    totalSpent: number;
    totalPurchases: number;
    averageTicket: number;
    firstPurchase: string | null;
    lastPurchase: string | null;
    favoriteCategory: string;
    favoriteProduct: string;
    monthlyTrend: Array<{
      month: string;
      revenue: number;
      count: number;
    }>;
    recentPurchases: Array<{
      receiptNumber: string;
      total: number;
      date: string;
      items: number;
    }>;
  }> {
    try {
      const response = await api.get<any>(
        `/sales/customer-stats/${customerId}`,
      );
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'customer' in data) {
        return data;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error(
        `Failed to fetch customer stats for ${customerId}:`,
        error,
      );
      throw error;
    }
  },

  // ============================================
  // SALES SETTINGS
  // ============================================

  /**
   * Get sales settings
   * GET /sales/settings
   */
  async getSalesSettings(companyId?: string): Promise<SalesSettings> {
    try {
      const params = companyId ? { companyId } : undefined;
      const response = await api.get<any>('/sales/settings', { params });
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'currencyCode' in data) {
        return data;
      }
      return this.getDefaultSettings();
    } catch (error) {
      console.error('Failed to fetch sales settings:', error);
      return this.getDefaultSettings();
    }
  },

  /**
   * Update sales settings
   * PUT /sales/settings
   *
   * ⚠ `currencySymbol` is stripped from the payload before send.
   *   The backend column was removed in Phase 1 and the field is
   *   now derived from `currencyCode` at read time. Sending it is
   *   harmless — the backend drops it — but stripping it here
   *   makes the contract explicit.
   */
  async updateSalesSettings(
    settings: Partial<SalesSettings>,
    companyId?: string,
  ): Promise<SalesSettings> {
    try {
      const { currencySymbol: _drop, ...payload } = settings;
      const params = companyId ? { companyId } : undefined;
      const response = await api.put<any>('/sales/settings', payload, {
        params,
      });
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'currencyCode' in data) {
        return data;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to update sales settings:', error);
      throw error;
    }
  },

  // ============================================
  // SALE CRUD OPERATIONS
  // ============================================

  /**
   * Get all sales with pagination and filters
   * GET /sales
   */
  async getAllSales(
    params?: SaleSearchParams,
  ): Promise<PaginatedResponse<Sale>> {
    try {
      const response = await api.get<any>('/sales', { params });
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'data' in data) {
        return data;
      }
      if (data && typeof data === 'object') {
        return data;
      }
      return { data: [], total: 0, page: 1, totalPages: 0, limit: 20 };
    } catch (error) {
      console.error('Failed to fetch sales:', error);
      return { data: [], total: 0, page: 1, totalPages: 0, limit: 20 };
    }
  },

  /**
   * Get sale by ID
   * GET /sales/:id
   */
  async getSaleById(id: string): Promise<Sale> {
    try {
      const response = await api.get<any>(`/sales/${id}`);
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'id' in data) {
        return data;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error(`Failed to fetch sale ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get sale by receipt number
   * GET /sales/receipt/:receiptNumber
   */
  async getSaleByReceiptNumber(receiptNumber: string): Promise<Sale> {
    try {
      const response = await api.get<any>(`/sales/receipt/${receiptNumber}`);
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'id' in data) {
        return data;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error(
        `Failed to fetch sale by receipt ${receiptNumber}:`,
        error,
      );
      throw error;
    }
  },

  /**
   * Get sales by customer
   * GET /sales/customer/:customerId
   */
  async getSalesByCustomer(
    customerId: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<Sale>> {
    try {
      const response = await api.get<any>(`/sales/customer/${customerId}`, {
        params,
      });
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'data' in data) {
        return data;
      }
      if (data && typeof data === 'object') {
        return data;
      }
      return { data: [], total: 0, page: 1, totalPages: 0, limit: 20 };
    } catch (error) {
      console.error(
        `Failed to fetch sales for customer ${customerId}:`,
        error,
      );
      return { data: [], total: 0, page: 1, totalPages: 0, limit: 20 };
    }
  },

  /**
   * Get recent sales
   * GET /sales/recent
   */
  async getRecentSales(params?: {
    businessUnitId?: string;
    limit?: number;
  }): Promise<Sale[]> {
    try {
      const response = await api.get<any>('/sales/recent', { params });
      const data = unwrap<any>(response);
      if (Array.isArray(data)) return data;
      if (Array.isArray(response)) return response;
      return [];
    } catch (error) {
      console.error('Failed to fetch recent sales:', error);
      return [];
    }
  },

  /**
   * Get sales by date range
   * GET /sales/date-range
   *
   * ⚠ The backend returns `{ success, data, count, currency }`.
   *   Only `data` is exposed — `currency` is surfaced via the
   *   sibling helper `getSalesByDateRangeWithCurrency` for callers
   *   that need it.
   */
  async getSalesByDateRange(params: {
    businessUnitId?: string;
    startDate: string;
    endDate: string;
  }): Promise<Sale[]> {
    try {
      const response = await api.get<any>('/sales/date-range', { params });
      const data = unwrap<any>(response);
      if (Array.isArray(data)) return data;
      if (Array.isArray(response)) return response;
      return [];
    } catch (error) {
      console.error('Failed to fetch sales by date range:', error);
      return [];
    }
  },

  /**
   * Get sales by date range with the resolved ledger currency.
   * GET /sales/date-range
   *
   * Prefer this over `getSalesByDateRange` when the caller needs to
   * format amounts. The extra field is free — it arrives in the
   * same response.
   */
  async getSalesByDateRangeWithCurrency(params: {
    businessUnitId?: string;
    startDate: string;
    endDate: string;
  }): Promise<{ sales: Sale[]; currency?: string; count: number }> {
    try {
      const response = await api.get<any>('/sales/date-range', { params });
      const data = unwrap<any>(response);
      const sales: Sale[] = Array.isArray(data)
        ? data
        : Array.isArray(response)
          ? response
          : [];
      const currency = extractEnvelopeCurrency(response);
      const count =
        typeof (response as any)?.count === 'number'
          ? (response as any).count
          : sales.length;
      return { sales, currency, count };
    } catch (error) {
      console.error('Failed to fetch sales by date range:', error);
      return { sales: [], count: 0 };
    }
  },

  /**
   * Create sale (legacy direct sale).
   * POST /sales
   *
   * ⚠ Only ledger-native payment methods are accepted. Gateway
   *   methods (CARD, CREDIT_CARD, DEBIT_CARD, PAYPAL, FLUTTERWAVE,
   *   PAYSTACK, SQUARE) are rejected with a 400 by the backend.
   *   Those must go through the online checkout flow.
   *
   * Idempotent when `data.idempotencyKey` is provided.
   *
   * Accepts `data.displayCurrency` — forwarded as
   * `X-Display-Currency` header and `displayCurrency` body field.
   */
  async createSale(
    data: {
      customerId?: string;
      items: Array<{
        productId: string;
        variantId?: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
        notes?: string;
      }>;
      paymentMethod: PaymentMethod;
      paidAmount: number;
      discount?: number;
      taxRate?: number;
      notes?: string;
      businessUnitId: string;
      cashRegisterId?: string;
      cashRegisterSessionId?: string;
      tipAmount?: number;
      loyaltyPointsUsed?: number;
      idempotencyKey?: string;
      /**
       * ISO 4217 code of the payer's chosen display currency.
       * Recorded on the `Payment` row as an audit fact — never
       * mutates any amount.
       */
      displayCurrency?: string | null;
    } & PromotionPassthrough,
  ): Promise<Sale> {
    try {
      const {
        idempotencyKey,
        discountType,
        promotionCode,
        promotionDiscount,
        displayCurrency,
        ...rest
      } = data;

      const body = attachDisplayCurrency(
        attachPromotionFields(
          { ...rest } as Record<string, unknown>,
          { discountType, promotionCode, promotionDiscount },
        ),
        displayCurrency,
      );

      const headers = mergeHeaders(
        idempotencyHeaders(idempotencyKey),
        displayCurrencyHeaders(displayCurrency),
      );

      const response = await api.post<any>('/sales', body, { headers });
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to create sale:', error);
      throw error;
    }
  },

  /**
   * Create sale from cart checkout.
   * POST /sales/checkout
   *
   * ⚠ Only ledger-native payment methods are accepted. See
   *   `createSale`.
   *
   * Idempotent when `data.idempotencyKey` is provided.
   */
  async createSaleFromCart(
    data: {
      cartId: string;
      paymentMethod: PaymentMethod;
      paidAmount: number;
      customerId?: string;
      discount?: number;
      notes?: string;
      cashRegisterId?: string;
      cashRegisterSessionId?: string;
      applyLoyaltyPoints?: boolean;
      tipAmount?: number;
      idempotencyKey?: string;
      displayCurrency?: string | null;
    } & PromotionPassthrough,
  ): Promise<Sale> {
    try {
      const {
        idempotencyKey,
        discountType,
        promotionCode,
        promotionDiscount,
        displayCurrency,
        ...rest
      } = data;

      const body = attachDisplayCurrency(
        attachPromotionFields(
          { ...rest } as Record<string, unknown>,
          { discountType, promotionCode, promotionDiscount },
        ),
        displayCurrency,
      );

      const headers = mergeHeaders(
        idempotencyHeaders(idempotencyKey),
        displayCurrencyHeaders(displayCurrency),
      );

      const response = await api.post<any>('/sales/checkout', body, {
        headers,
      });
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to create sale from cart:', error);
      throw error;
    }
  },

  /**
   * Update sale
   * PUT /sales/:id
   */
  async updateSale(id: string, data: Partial<Sale>): Promise<Sale> {
    try {
      const response = await api.put<any>(`/sales/${id}`, data);
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error(`Failed to update sale ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete sale (soft delete)
   * DELETE /sales/:id
   */
  async deleteSale(id: string): Promise<Sale> {
    try {
      const response = await api.delete<any>(`/sales/${id}`);
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error(`Failed to delete sale ${id}:`, error);
      throw error;
    }
  },

  // ============================================
  // EXPORT
  // ============================================

  /**
   * Export sales as a downloadable file.
   *
   * ⚠ The backend has TWO distinct export endpoints:
   *
   *     GET /sales/export        → JSON envelope, role-gated
   *     GET /sales/export/csv    → streamed CSV, role-gated
   *     GET /sales/export/excel  → JSON placeholder, role-gated
   *     GET /sales/export/pdf    → JSON placeholder, role-gated
   *
   *   The `format` query param on `/sales/export` does NOT change
   *   the response shape — it only affects the message. Do not
   *   pass `format=csv` to `/sales/export` expecting a CSV file.
   *
   * This method routes to the correct endpoint for the requested
   * format. Only `csv` and `json` return a real file today;
   * `excel` and `pdf` return a JSON payload as a placeholder (the
   * backend logs `"Excel export would be generated here"`).
   */
  async exportSales(params: ExportSalesParams): Promise<ExportSalesResult> {
    const format = params.format ?? 'csv';

    const query: Record<string, string> = {
      startDate: params.startDate,
      endDate: params.endDate,
    };
    if (params.businessUnitId) {
      query.businessUnitId = params.businessUnitId;
    }

    // `/sales/export/csv` is the only endpoint that streams a real
    // file. The others return JSON.
    const path =
      format === 'csv' ? '/sales/export/csv' : '/sales/export';

    try {
      const response = await api.get<any>(path, {
        params: query,
        responseType: 'blob',
      });

      // Normalize: the client may return a Blob, `{ data: Blob }`,
      // a raw axios response, or (for the JSON endpoints) a plain
      // object that the caller still wants as a Blob.
      let blob: Blob;
      let contentType: string | undefined;
      let contentDisposition: string | undefined;

      if (response instanceof Blob) {
        blob = response;
        contentType = response.type;
      } else if (response?.data instanceof Blob) {
        blob = response.data;
        contentType = response.data.type;
        contentDisposition =
          response.headers?.['content-disposition'] ||
          response.headers?.['Content-Disposition'];
      } else {
        const payload =
          typeof response === 'string'
            ? response
            : JSON.stringify(response);
        blob = new Blob([payload], { type: 'application/json' });
        contentType = 'application/json';
      }

      // Fallback filename: `<format>-<startDate>-<endDate>.<ext>`.
      const ext =
        format === 'excel' ? 'xlsx' : format === 'pdf' ? 'pdf' : format;
      const fallbackFilename = `sales-${params.startDate}-${params.endDate}.${ext}`;

      const filename = extractFilenameFromDisposition(
        contentDisposition,
      ) ?? fallbackFilename;

      // If the server sent `Content-Type: text/csv`, trust that
      // over the requested `format`.
      const resolvedFormat: ExportSalesResult['format'] =
        contentType?.includes('text/csv')
          ? 'csv'
          : contentType?.includes('application/json')
            ? 'json'
            : format;

      return { blob, format: resolvedFormat, filename };
    } catch (error) {
      console.error('Failed to export sales:', error);
      throw error;
    }
  },

  // ============================================
  // RECEIPT / REFUND
  // ============================================

  /**
   * Send a receipt email for a sale.
   * POST /sales/:id/email-receipt
   */
  async sendReceiptEmail(
    saleId: string,
    email: string,
  ): Promise<{ success: true; message: string }> {
    if (!saleId) throw new Error('Sale ID is required');
    if (!email) throw new Error('Email address is required');

    try {
      const response = await api.post<any>(
        `/sales/${saleId}/email-receipt`,
        { email },
      );
      const data = unwrap<any>(response);
      if (data && typeof data === 'object') {
        return data;
      }
      return { success: true, message: 'Receipt sent' };
    } catch (error) {
      console.error(`Failed to send receipt for sale ${saleId}:`, error);
      throw error;
    }
  },

  /**
   * Refund a sale.
   * POST /sales/:id/refund
   *
   * `amount` is optional. When omitted, the backend refunds the
   * full remaining balance.
   *
   * ⚠ This endpoint is NOT idempotent — retrying creates a second
   *   refund record. The caller is responsible for not retrying
   *   blindly.
   */
  async refundSale(
    saleId: string,
    reason: string,
    amount?: number,
  ): Promise<{
    refund: {
      id: string;
      refundNumber: string;
      total: number;
      status: string;
      createdAt: string;
    };
    sale: Sale;
  }> {
    if (!saleId) throw new Error('Sale ID is required');

    const body: Record<string, unknown> = {
      reason: reason?.trim() || 'No reason provided',
    };
    if (
      typeof amount === 'number' &&
      Number.isFinite(amount) &&
      amount > 0
    ) {
      body.amount = amount;
    }

    try {
      const response = await api.post<any>(
        `/sales/${saleId}/refund`,
        body,
      );
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'refund' in data) {
        return data;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error(`Failed to refund sale ${saleId}:`, error);
      throw error;
    }
  },

  // ============================================
  // POS ROUTES (via /sales/pos/*)
  // ============================================

  /**
   * Get POS cart
   * GET /sales/pos/cart
   */
  async getPosCart(): Promise<Cart> {
    try {
      const response = await api.get<any>('/sales/pos/cart');
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'id' in data) {
        return data;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to fetch POS cart:', error);
      throw error;
    }
  },

  /**
   * Get POS cart details
   * GET /sales/pos/cart/details
   */
  async getPosCartDetails(): Promise<Cart> {
    try {
      const response = await api.get<any>('/sales/pos/cart/details');
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'id' in data) {
        return data;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to fetch POS cart details:', error);
      throw error;
    }
  },

  /**
   * Clear POS cart
   * DELETE /sales/pos/cart
   */
  async clearPosCart(): Promise<{ message: string }> {
    try {
      const response = await api.delete<any>('/sales/pos/cart');
      const data = unwrap<any>(response);
      if (data && typeof data === 'object') {
        return data;
      }
      return { message: 'Cart cleared successfully' };
    } catch (error) {
      console.error('Failed to clear POS cart:', error);
      throw error;
    }
  },

  /**
   * Add item to POS cart
   * POST /sales/pos/items
   */
  async addPosItem(data: {
    productId: string;
    quantity: number;
    variantId?: string;
    notes?: string;
  }): Promise<Cart> {
    try {
      const response = await api.post<any>('/sales/pos/items', data);
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to add item to POS cart:', error);
      throw error;
    }
  },

  /**
   * Add multiple items to POS cart
   * POST /sales/pos/items/bulk
   */
  async addPosItems(
    items: Array<{
      productId: string;
      quantity: number;
      variantId?: string;
      notes?: string;
    }>,
  ): Promise<Cart> {
    try {
      const response = await api.post<any>('/sales/pos/items/bulk', {
        items,
      });
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to add items to POS cart:', error);
      throw error;
    }
  },

  /**
   * Update POS cart item
   * PUT /sales/pos/items/:itemId
   */
  async updatePosItem(
    itemId: string,
    data: { quantity: number; unitPrice?: number; notes?: string },
  ): Promise<Cart> {
    try {
      const response = await api.put<any>(
        `/sales/pos/items/${itemId}`,
        data,
      );
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error(`Failed to update POS item ${itemId}:`, error);
      throw error;
    }
  },

  /**
   * Remove POS cart item
   * DELETE /sales/pos/items/:itemId
   */
  async removePosItem(itemId: string): Promise<Cart> {
    try {
      const response = await api.delete<any>(`/sales/pos/items/${itemId}`);
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error(`Failed to remove POS item ${itemId}:`, error);
      throw error;
    }
  },

  /**
   * POS Checkout
   * POST /sales/pos/checkout
   *
   * ⚠ Only ledger-native payment methods are accepted. Gateway
   *   methods are rejected with a 400.
   *
   * Idempotent when `data.idempotencyKey` is provided.
   *
   * Accepts `data.displayCurrency` — forwarded as both an
   * `X-Display-Currency` header and a `displayCurrency` body field.
   */
  async posCheckout(data: PosCheckoutData): Promise<Sale> {
    try {
      const {
        idempotencyKey,
        discountType,
        promotionCode,
        promotionDiscount,
        displayCurrency,
        ...rest
      } = data;

      const body = attachDisplayCurrency(
        attachPromotionFields(
          { ...rest } as Record<string, unknown>,
          { discountType, promotionCode, promotionDiscount },
        ),
        displayCurrency,
      );

      const headers = mergeHeaders(
        idempotencyHeaders(idempotencyKey),
        displayCurrencyHeaders(displayCurrency),
      );

      const response = await api.post<any>('/sales/pos/checkout', body, {
        headers,
      });
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to process POS checkout:', error);
      throw error;
    }
  },

  /**
   * Apply discount to POS cart
   * POST /sales/pos/cart/discount
   */
  async applyPosDiscount(discount: number): Promise<Cart> {
    try {
      const response = await api.post<any>('/sales/pos/cart/discount', {
        discount,
      });
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to apply POS discount:', error);
      throw error;
    }
  },

  /**
   * Apply loyalty points to POS cart
   * POST /sales/pos/cart/loyalty-points
   */
  async applyPosLoyaltyPoints(
    customerId: string,
    points: number,
  ): Promise<Cart> {
    try {
      const response = await api.post<any>(
        '/sales/pos/cart/loyalty-points',
        { customerId, points },
      );
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to apply POS loyalty points:', error);
      throw error;
    }
  },

  /**
   * Associate customer with POS cart
   * POST /sales/pos/cart/customer
   */
  async associatePosCustomer(customerId: string): Promise<Cart> {
    try {
      const response = await api.post<any>('/sales/pos/cart/customer', {
        customerId,
      });
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to associate POS customer:', error);
      throw error;
    }
  },

  /**
   * Get POS summary
   * GET /sales/pos/summary
   */
  async getPosSummary(): Promise<PosSummary> {
    try {
      const response = await api.get<any>('/sales/pos/summary');
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'cartCount' in data) {
        return data;
      }
      return this.getDefaultPosSummary();
    } catch (error) {
      console.error('Failed to fetch POS summary:', error);
      return this.getDefaultPosSummary();
    }
  },

  /**
   * Get POS statistics
   * GET /sales/pos/stats
   */
  async getPosStats(): Promise<PosStats> {
    try {
      const response = await api.get<any>('/sales/pos/stats');
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'today' in data) {
        return data;
      }
      return {
        today: { revenue: 0, sales: 0, averageTicket: 0, itemsSold: 0 },
        cartCount: 0,
        activeSessions: 0,
        lowStockCount: 0,
        pendingOrders: 0,
      };
    } catch (error) {
      console.error('Failed to fetch POS stats:', error);
      return {
        today: { revenue: 0, sales: 0, averageTicket: 0, itemsSold: 0 },
        cartCount: 0,
        activeSessions: 0,
        lowStockCount: 0,
        pendingOrders: 0,
      };
    }
  },

  /**
   * Get POS transaction history
   * GET /sales/pos/transactions
   */
  async getPosTransactions(params?: {
    page?: number;
    limit?: number;
  }): Promise<{
    data: PosTransaction[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    try {
      const response = await api.get<any>('/sales/pos/transactions', {
        params,
      });
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'data' in data) {
        return data;
      }
      if (data && typeof data === 'object') {
        return data;
      }
      return { data: [], total: 0, page: 1, totalPages: 0, limit: 20 };
    } catch (error) {
      console.error('Failed to fetch POS transactions:', error);
      return { data: [], total: 0, page: 1, totalPages: 0, limit: 20 };
    }
  },

  /**
   * Get POS register status
   * GET /sales/pos/register/status
   */
  async getPosRegisterStatus(): Promise<RegisterStatus> {
    try {
      const response = await api.get<any>('/sales/pos/register/status');
      const data = unwrap<any>(response);
      if (data && typeof data === 'object' && 'status' in data) {
        return data;
      }
      return this.getDefaultRegisterStatus();
    } catch (error) {
      console.error('Failed to fetch register status:', error);
      return this.getDefaultRegisterStatus();
    }
  },

  // ============================================
  // POS CUSTOMER OPERATIONS
  // ============================================

  /**
   * Search POS customers
   * GET /sales/pos/customers/search
   */
  async searchPosCustomers(query: string, limit?: number): Promise<any[]> {
    try {
      const response = await api.get<any>('/sales/pos/customers/search', {
        params: { query, limit },
      });
      const data = unwrap<any>(response);
      if (Array.isArray(data)) return data;
      if (Array.isArray(response)) return response;
      return [];
    } catch (error) {
      console.error('Failed to search customers:', error);
      return [];
    }
  },

  /**
   * Get POS customer
   * GET /sales/pos/customers/:id
   */
  async getPosCustomer(id: string): Promise<any> {
    try {
      const response = await api.get<any>(`/sales/pos/customers/${id}`);
      const data = unwrap<any>(response);
      if (data && typeof data === 'object') {
        return data;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch customer ${id}:`, error);
      return null;
    }
  },

  /**
   * Create POS customer
   * POST /sales/pos/customers
   */
  async createPosCustomer(data: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  }): Promise<any> {
    try {
      const response = await api.post<any>('/sales/pos/customers', data);
      const unwrapped = unwrap<any>(response);
      if (unwrapped && typeof unwrapped === 'object') {
        return unwrapped;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to create customer:', error);
      throw error;
    }
  },

  // ============================================
  // POS PRODUCT OPERATIONS
  // ============================================

  /**
   * Search POS products
   * GET /sales/pos/products/search
   */
  async searchPosProducts(
    query: string,
    category?: string,
    limit?: number,
  ): Promise<any[]> {
    try {
      const response = await api.get<any>('/sales/pos/products/search', {
        params: { query, category, limit },
      });
      const data = unwrap<any>(response);
      if (Array.isArray(data)) return data;
      if (Array.isArray(response)) return response;
      return [];
    } catch (error) {
      console.error('Failed to search products:', error);
      return [];
    }
  },

  /**
   * Get POS product by barcode
   * GET /sales/pos/products/barcode/:barcode
   */
  async getPosProductByBarcode(barcode: string): Promise<any> {
    try {
      const response = await api.get<any>(
        `/sales/pos/products/barcode/${barcode}`,
      );
      const data = unwrap<any>(response);
      if (data && typeof data === 'object') {
        return data;
      }
      return null;
    } catch (error) {
      console.error(
        `Failed to fetch product by barcode ${barcode}:`,
        error,
      );
      return null;
    }
  },

  /**
   * Get POS product by SKU
   * GET /sales/pos/products/sku/:sku
   */
  async getPosProductBySku(sku: string): Promise<any> {
    try {
      const response = await api.get<any>(
        `/sales/pos/products/sku/${sku}`,
      );
      const data = unwrap<any>(response);
      if (data && typeof data === 'object') {
        return data;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch product by SKU ${sku}:`, error);
      return null;
    }
  },

  /**
   * Get popular products (top sellers over the last 30 days)
   * GET /sales/pos/products/popular
   */
  async getPopularProducts(params?: {
    limit?: number;
  }): Promise<PopularProduct[]> {
    try {
      const response = await api.get<any>('/sales/pos/products/popular', {
        params,
      });
      const data = unwrap<any>(response);
      if (Array.isArray(data)) return data;
      if (Array.isArray(response)) return response;
      return [];
    } catch (error) {
      console.error('Failed to fetch popular products:', error);
      return [];
    }
  },

  // ============================================
  // DEFAULT FALLBACK VALUES
  // ============================================

  getDefaultStats(): SalesStats {
    return {
      totalSales: 0,
      totalRevenue: 0,
      totalSubtotal: 0,
      totalTax: 0,
      totalDiscount: 0,
      averageTicket: 0,
      todayRevenue: 0,
      todaySales: 0,
      pendingOrders: 0,
      processingOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      refundedOrders: 0,
      onHoldOrders: 0,
      topProducts: [],
      totalItemsSold: 0,
      totalCustomers: 0,
      newCustomers: 0,
      returningCustomers: 0,
      repeatRate: 0,
      averageItemsPerSale: 0,
      totalVisitors: 0,
      conversionRate: 0,
    };
  },

  getDefaultTodaySummary(): {
    date: string;
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    totalCustomers: number;
    paymentBreakdown: Record<string, number>;
  } {
    return {
      date: new Date().toISOString().split('T')[0],
      totalSales: 0,
      totalRevenue: 0,
      averageTicket: 0,
      totalCustomers: 0,
      paymentBreakdown: {},
    };
  },

  getDefaultDailySummary(): DailySalesSummary {
    return {
      date: new Date().toISOString().split('T')[0],
      totalSales: 0,
      totalRevenue: 0,
      totalItems: 0,
      averageTicket: 0,
      paymentMethods: [],
      hourlyBreakdown: [],
      sales: [],
    };
  },

  getDefaultDashboardStats(): DashboardStats {
    return {
      today: { totalSales: 0, totalRevenue: 0, averageTicket: 0 },
      week: { totalSales: 0, totalRevenue: 0 },
      month: { totalSales: 0, totalRevenue: 0 },
      allTime: this.getDefaultStats(),
      recentSales: [],
      topProducts: [],
      salesByHour: [],
      salesByDay: [],
    };
  },

  getDefaultAnalytics(): SalesAnalyticsResponse {
    return {
      revenueTrend: [],
      distribution: [],
      peakHours: [],
      customerInsights: {
        totalCustomers: 0,
        newCustomers: 0,
        returningCustomers: 0,
        repeatRate: 0,
      },
      bestCategory: '',
      bestCategorySales: 0,
      averageOrderValue: 0,
      averageItems: 0,
      retentionRate: 0,
      conversionRate: 0,
      totalVisitors: 0,
      topProducts: [],
      totalSales: 0,
      totalRevenue: 0,
    };
  },

  /**
   * Default sales settings, used only when the backend call fails
   * or returns an unrecognised shape.
   *
   * ⚠ `currencySymbol` is left off. Callers must fall back to
   *   `currencyCode` itself when rendering. Hardcoding `$` here
   *   would mislabel a UGX deployment.
   */
  getDefaultSettings(): SalesSettings {
    return {
      taxRate: 8,
      discountEnabled: true,
      maxDiscount: 20,
      loyaltyPointsEnabled: true,
      pointsPerDollar: 10,
      autoPrintReceipt: true,
      emailReceipts: true,
      receiptFooter: 'Thank you for your business!',
      defaultPaymentMethod: 'CASH',
      currencyCode: 'USD',
      invoicePrefix: 'INV-',
      receiptPrefix: 'RCP-',
    };
  },

  getDefaultPosSummary(): PosSummary {
    return {
      cartCount: 0,
      itemCount: 0,
      totalValue: 0,
      averageTicket: 0,
      todaySales: 0,
      todayRevenue: 0,
      activeCarts: 0,
      abandonedCarts: 0,
    };
  },

  getDefaultRegisterStatus(): RegisterStatus {
    return {
      id: '',
      name: '',
      balance: 0,
      status: 'CLOSED',
      transactions: 0,
      cashIn: 0,
      cashOut: 0,
    };
  },
};

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Parse a `Content-Disposition` header for the suggested filename.
 * Returns `undefined` when the header is missing or malformed.
 */
function extractFilenameFromDisposition(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;

  // `filename*=UTF-8''sales%20report.csv` (RFC 5987).
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      /* fall through to the plain form */
    }
  }

  // `filename="sales report.csv"` or `filename=sales.csv`.
  const plainMatch = /filename="?([^";]+)"?/i.exec(value);
  if (plainMatch) return plainMatch[1];

  return undefined;
}

export type { Sale };
export default saleService;
