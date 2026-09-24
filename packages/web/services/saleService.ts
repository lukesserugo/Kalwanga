// D:\Projects\Kalwanga\packages\web\services\saleService.ts

import { api } from './api';
import type { Sale, SaleStatus } from '../types/sale';

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
 * Discount category stored on `Sale.discountType`. Mirrors the
 * backend's Prisma `DiscountType` enum exactly:
 *
 *   - 'PERCENTAGE' — applied from a percentage-based promotion
 *   - 'FIXED'      — applied from a fixed-amount promotion
 *   - 'LOYALTY'    — discount came entirely from loyalty points
 *   - 'MANUAL'     — free-form discount (mixed sources / bare discount)
 *
 * ⚠ Keep this union in sync with `enum DiscountType` in
 * `prisma/schema.prisma`. Any value added here that is not in the
 * enum will be rejected by the database at insert time.
 */
export type DiscountType =
  | 'PERCENTAGE'
  | 'FIXED'
  | 'LOYALTY'
  | 'MANUAL';

/**
 * Runtime list of the enum members. Handy for validation and for
 * rendering a `<select>` of discount types.
 */
export const DISCOUNT_TYPE_VALUES: readonly DiscountType[] = [
  'PERCENTAGE',
  'FIXED',
  'LOYALTY',
  'MANUAL',
] as const;

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
 * points, as a decimal. Mirrors the `* 0.5` cap in the backend's
 * `checkoutService.processCheckout` and
 * `saleService.createSaleFromCart`.
 */
export const MAX_LOYALTY_DISCOUNT_FRACTION = 0.5;

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
 * Round to two decimal places. Mirrors the backend's `round2` in
 * `utils/money.ts` so previews match what the server will charge.
 */
function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Compute the loyalty point cap and discount for a given total.
 * Used by the cart summary and by the POS to render the "you can use
 * up to N points" line.
 */
export function computeLoyaltyCapacity(
  total: number,
  availablePoints: number
): {
  redeemablePoints: number;
  maxDiscount: number;
  discountFraction: number;
} {
  const maxDiscount = round2(total * MAX_LOYALTY_DISCOUNT_FRACTION);
  const pointsByValue = Math.floor(maxDiscount / LOYALTY_POINT_VALUE);
  const redeemablePoints = Math.max(
    0,
    Math.min(availablePoints, pointsByValue)
  );
  const discountFraction =
    total > 0 ? round2((redeemablePoints * LOYALTY_POINT_VALUE) / total) : 0;

  return {
    redeemablePoints,
    maxDiscount: round2(redeemablePoints * LOYALTY_POINT_VALUE),
    discountFraction,
  };
}

/**
 * Type guard for the discount type union. Useful for narrowing an
 * arbitrary string coming off the wire.
 */
export function isDiscountType(value: unknown): value is DiscountType {
  if (typeof value !== 'string') return false;
  return (DISCOUNT_TYPE_VALUES as readonly string[]).includes(value);
}

/**
 * Best-effort label for an arbitrary `discountType` value. Falls
 * back to the raw string when the value isn't a known enum member —
 * this keeps old rows renderable even if they carry a legacy value.
 */
export function getDiscountTypeLabel(
  value: DiscountType | string | null | undefined
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
  currencySymbol: string;
  currencyCode: string;
  invoicePrefix: string;
  receiptPrefix: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardStats {
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
}

export interface ExportSalesParams {
  businessUnitId?: string;
  startDate: string;
  endDate: string;
  format?: 'json' | 'csv' | 'excel' | 'pdf';
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
   * Category of the discount currently applied to the cart. Uses the
   * same union as the backend `DiscountType` enum so cart payloads
   * round-trip cleanly through checkout.
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
}

export interface PosCheckoutData extends PromotionPassthrough {
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
  /**
   * Optional. When omitted, no idempotency is applied (same behavior
   * as before). When provided, retries with the same value return the
   * original sale instead of creating a duplicate. Use
   * `saleService.generateIdempotencyKey()` to obtain a value.
   */
  idempotencyKey?: string;
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
 * Preview of what a discount will look like at checkout. Returned by
 * `saleService.previewDiscount`. All numbers are in tenant currency
 * unless noted.
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
// IDEMPOTENCY HELPERS
// ============================================

/**
 * Build an `Idempotency-Key` header object for a request.
 * Returns `undefined` when no key is supplied so callers can pass the
 * result straight through to `api.post(..., { headers })` without a
 * conditional — an undefined headers object is harmless.
 */
function idempotencyHeaders(
  key?: string
): Record<string, string> | undefined {
  if (!key) return undefined;
  const trimmed = String(key).trim();
  if (!trimmed) return undefined;
  return { 'Idempotency-Key': trimmed };
}

/**
 * Copy the three promotion / loyalty passthrough fields onto a
 * request body, skipping any that are `undefined`. Returns the
 * mutated body for chaining.
 *
 * Fields are optional everywhere they appear. When omitted, the
 * backend infers `discountType` from the underlying sources.
 */
function attachPromotionFields<T extends Record<string, unknown>>(
  body: T,
  source: PromotionPassthrough
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

// ============================================
// SALE SERVICE
// ============================================

export const saleService = {
  /**
   * Generate a fresh idempotency key for a new logical operation.
   * Call once when the user initiates a sale, then reuse the same value
   * on every retry of that same sale.
   *
   * Uses `crypto.randomUUID()` when available (all modern browsers and
   * Node 16+). Falls back to a time + random hex string otherwise so
   * the key is always unique enough for the POS use case.
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
   * carries it — a `Sale` returned by any of the create endpoints, a
   * receipt, or a transaction row.
   *
   * Every field is optional; callers can render the breakdown even
   * when the sale predates the migration that added the columns.
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
   * Callers use this to decide whether to render the "how this
   * discount was computed" section on a receipt.
   */
  hasBreakdown(source: unknown): boolean {
    const b = this.extractBreakdown(source);
    return Boolean(
      b.discountType ||
        b.promotionCode ||
        (b.promotionDiscount ?? 0) > 0 ||
        (b.loyaltyPointsUsed ?? 0) > 0 ||
        (b.loyaltyDiscount ?? 0) > 0
    );
  },

  /**
   * Render a human-readable one-line summary of the breakdown. Used in
   * the receipt footer and the sale detail panel.
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
   * Compute a client-side discount preview. This never talks to the
   * backend — it's the "you'll save X" line that renders the moment a
   * point count is typed. The authoritative numbers come from the
   * backend at checkout time.
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
      capacity.redeemablePoints
    );
    const loyaltyDiscount = round2(
      effectiveLoyaltyPoints * LOYALTY_POINT_VALUE
    );

    const effectivePromotion = Math.min(
      promotionDiscount,
      Math.max(0, total - loyaltyDiscount)
    );

    const finalTotal = round2(
      Math.max(0, total - effectivePromotion - loyaltyDiscount)
    );

    const warnings: string[] = [];
    if (loyaltyPointsToUse > capacity.redeemablePoints) {
      warnings.push(
        `Only ${capacity.redeemablePoints} points can be applied to this order.`
      );
    }
    if (promotionDiscount > effectivePromotion) {
      warnings.push(
        `Promotion discount capped at ${effectivePromotion.toFixed(2)}.`
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
   * payload. Handy when the caller already knows the discount it
   * wants to send and just needs the shape.
   *
   * Example:
   *
   *   const payload = {
   *     cartId,
   *     paymentMethod: 'CASH',
   *     paidAmount: 31500,
   *     ...saleService.buildPassthrough({
   *       discountType: 'MANUAL',
   *       promotionCode: 'WELCOME10',
   *       promotionDiscount: 3500,
   *     }),
   *   };
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

      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data as SalesStats;
        }
        if ('totalSales' in response || 'totalRevenue' in response) {
          return response as SalesStats;
        }
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
  async getTodaySalesSummary(params?: { businessUnitId?: string }): Promise<{
    date: string;
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    totalCustomers: number;
    paymentBreakdown: Record<string, number>;
  }> {
    try {
      const response = await api.get<any>('/sales/today', { params });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      const response = await api.get<any>('/sales/daily-summary', { params });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
    params?: SalesAnalyticsParams
  ): Promise<SalesAnalyticsResponse> {
    try {
      const response = await api.get<any>('/sales/analytics', { params });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        if (Array.isArray(response)) {
          return response;
        }
      }
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
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Sale>> {
    try {
      const response = await api.get<any>(`/sales/status/${status}`, {
        params,
      });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
    }
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
    monthlyTrend: Array<{ month: string; revenue: number; count: number }>;
    recentPurchases: Array<{
      receiptNumber: string;
      total: number;
      date: string;
      items: number;
    }>;
  }> {
    try {
      const response = await api.get<any>(
        `/sales/customer-stats/${customerId}`
      );
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error(`Failed to fetch customer stats for ${customerId}:`, error);
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
   */
  async updateSalesSettings(
    settings: Partial<SalesSettings>,
    companyId?: string
  ): Promise<SalesSettings> {
    try {
      const params = companyId ? { companyId } : undefined;
      const response = await api.put<any>('/sales/settings', settings, {
        params,
      });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
    params?: SaleSearchParams
  ): Promise<PaginatedResponse<Sale>> {
    try {
      const response = await api.get<any>('/sales', { params });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error(`Failed to fetch sale by receipt ${receiptNumber}:`, error);
      throw error;
    }
  },

  /**
   * Get sales by customer
   * GET /sales/customer/:customerId
   */
  async getSalesByCustomer(
    customerId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Sale>> {
    try {
      const response = await api.get<any>(`/sales/customer/${customerId}`, {
        params,
      });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
      }
      return { data: [], total: 0, page: 1, totalPages: 0, limit: 20 };
    } catch (error) {
      console.error(`Failed to fetch sales for customer ${customerId}:`, error);
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        if (Array.isArray(response)) {
          return response;
        }
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch recent sales:', error);
      return [];
    }
  },

  /**
   * Get sales by date range
   * GET /sales/date-range
   */
  async getSalesByDateRange(params: {
    businessUnitId?: string;
    startDate: string;
    endDate: string;
  }): Promise<Sale[]> {
    try {
      const response = await api.get<any>('/sales/date-range', { params });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        if (Array.isArray(response)) {
          return response;
        }
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch sales by date range:', error);
      return [];
    }
  },

  /**
   * Create sale
   * POST /sales
   *
   * Idempotent when `data.idempotencyKey` is provided.
   *
   * Accepts optional promotion / loyalty passthrough fields
   * (`discountType`, `promotionCode`, `promotionDiscount`). When
   * omitted, the backend infers `discountType` from the underlying
   * sources.
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
      /** Optional. Retries with the same value return the original sale. */
      idempotencyKey?: string;
    } & PromotionPassthrough
  ): Promise<Sale> {
    try {
      const {
        idempotencyKey,
        discountType,
        promotionCode,
        promotionDiscount,
        ...rest
      } = data;

      const body = attachPromotionFields(
        { ...rest } as Record<string, unknown>,
        { discountType, promotionCode, promotionDiscount }
      );

      const response = await api.post<any>('/sales', body, {
        headers: idempotencyHeaders(idempotencyKey),
      });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to create sale:', error);
      throw error;
    }
  },

  /**
   * Create sale from cart checkout
   * POST /sales/checkout
   *
   * Idempotent when `data.idempotencyKey` is provided.
   *
   * Accepts the same promotion / loyalty passthrough fields as
   * `createSale`.
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
      /** Optional. Retries with the same value return the original sale. */
      idempotencyKey?: string;
    } & PromotionPassthrough
  ): Promise<Sale> {
    try {
      const {
        idempotencyKey,
        discountType,
        promotionCode,
        promotionDiscount,
        ...rest
      } = data;

      const body = attachPromotionFields(
        { ...rest } as Record<string, unknown>,
        { discountType, promotionCode, promotionDiscount }
      );

      const response = await api.post<any>('/sales/checkout', body, {
        headers: idempotencyHeaders(idempotencyKey),
      });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error(`Failed to delete sale ${id}:`, error);
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response || { message: 'Cart cleared successfully' };
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
    }>
  ): Promise<Cart> {
    try {
      const response = await api.post<any>('/sales/pos/items/bulk', { items });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
    data: { quantity: number; unitPrice?: number; notes?: string }
  ): Promise<Cart> {
    try {
      const response = await api.put<any>(`/sales/pos/items/${itemId}`, data);
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
   * Idempotent when `data.idempotencyKey` is provided. The header is
   * extracted and sent as `Idempotency-Key`, matching the backend
   * controller contract.
   *
   * Accepts the same promotion / loyalty passthrough fields as
   * `createSale` and `createSaleFromCart`. `PosCheckoutData` extends
   * `PromotionPassthrough`, so callers can supply them inline.
   */
  async posCheckout(data: PosCheckoutData): Promise<Sale> {
    try {
      const {
        idempotencyKey,
        discountType,
        promotionCode,
        promotionDiscount,
        ...rest
      } = data;

      const body = attachPromotionFields(
        { ...rest } as Record<string, unknown>,
        { discountType, promotionCode, promotionDiscount }
      );

      const response = await api.post<any>('/sales/pos/checkout', body, {
        headers: idempotencyHeaders(idempotencyKey),
      });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
   *
   * A discount applied here becomes the cart's `promotionDiscount` /
   * `promotionCode` at checkout, and is persisted on the resulting
   * `Sale` row.
   */
  async applyPosDiscount(discount: number): Promise<Cart> {
    try {
      const response = await api.post<any>('/sales/pos/cart/discount', {
        discount,
      });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
   *
   * Points applied here mirror to `Sale.loyaltyPointsUsed` /
   * `Sale.loyaltyDiscount` at checkout.
   */
  async applyPosLoyaltyPoints(customerId: string, points: number): Promise<Cart> {
    try {
      const response = await api.post<any>(
        '/sales/pos/cart/loyalty-points',
        { customerId, points }
      );
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        if (Array.isArray(response)) {
          return response;
        }
      }
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
    limit?: number
  ): Promise<any[]> {
    try {
      const response = await api.get<any>('/sales/pos/products/search', {
        params: { query, category, limit },
      });
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        if (Array.isArray(response)) {
          return response;
        }
      }
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
        `/sales/pos/products/barcode/${barcode}`
      );
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch product by barcode ${barcode}:`, error);
      return null;
    }
  },

  /**
   * Get POS product by SKU
   * GET /sales/pos/products/sku/:sku
   */
  async getPosProductBySku(sku: string): Promise<any> {
    try {
      const response = await api.get<any>(`/sales/pos/products/sku/${sku}`);
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        return response;
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
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          return response.data;
        }
        if (Array.isArray(response)) {
          return response;
        }
      }
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
      currencySymbol: '$',
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

// Export types for use in other files
export type { Sale };
export default saleService;
