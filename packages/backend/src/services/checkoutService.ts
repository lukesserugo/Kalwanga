// packages/backend/src/services/checkoutService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { SaleService } from './saleService.js';
import { PaymentService } from './paymentService.js';
import { CartService } from './cartService.js';
import { logger } from '../lib/logger.js';
import {
  computeCartTotals,
  computeChange,
  round2,
} from '../utils/money.js';
import { applyInventoryDelta } from '../utils/inventory.js';
import { currencyService } from './currencyService.js';
import { chargeCurrencyService } from './chargeCurrencyService.js';
import type { SupportedProvider } from './currencyService.js';

// ── Provider-side configuration probes ──────────────────────────
import {
  isMtnConfigured,
  isAirtelConfigured,
  missingMtnKeys,
  missingAirtelKeys,
} from './mobileMoneyService.js';

// ============================================
// CANONICAL PAYMENT METHODS
// ============================================

const CANONICAL_PAYMENT_METHODS = [
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

const CANONICAL_PAYMENT_METHODS_SET = new Set<string>(
  CANONICAL_PAYMENT_METHODS,
);

const ONLINE_PAYMENT_METHODS = new Set<string>([
  'CREDIT_CARD',
  'DEBIT_CARD',
  'PAYPAL',
  'FLUTTERWAVE',
  'PAYSTACK',
  'SQUARE',
]);

const MOBILE_PAYMENT_METHODS = new Set<string>([
  'MOBILE_MONEY',
  'MPESA',
]);

type MobileMoneyProvider = 'MPESA' | 'MTN' | 'AIRTEL';

function normalizePaymentMethod(method: string): string {
  const upper = method.trim().toUpperCase();

  const aliasMap: Record<string, string> = {
    CARD: 'CREDIT_CARD',
    MOBILE: 'MOBILE_MONEY',
    MPESA: 'MOBILE_MONEY',
    BANK: 'BANK_TRANSFER',
    GIFT: 'GIFT_CARD',
    LOYALTY: 'LOYALTY_POINTS',
    WALLET: 'MOBILE_MONEY',
    SPLIT: 'CASH',
    MIXED: 'CASH',
    OTHER: 'CASH',
  };

  return aliasMap[upper] || upper;
}

function safeTaxRate(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw) || raw < 0) return 0;
  return raw;
}

type DiscountType =
  | 'PERCENTAGE'
  | 'FIXED'
  | 'LOYALTY'
  | 'MANUAL'
  | 'BUY_X_GET_Y'
  | 'FREE_SHIPPING'
  | 'BOGO'
  | 'BUNDLE'
  | 'TIERED';

function inferDiscountType(input: {
  explicit?: DiscountType | null;
  hasLoyalty: boolean;
  hasPromotion: boolean;
  hasBareDiscount: boolean;
}): DiscountType | null {
  if (input.explicit) return input.explicit;
  if (input.hasLoyalty && !input.hasPromotion) return 'LOYALTY';
  if (input.hasLoyalty && input.hasPromotion) return 'MANUAL';
  if (input.hasPromotion) return 'MANUAL';
  if (input.hasBareDiscount) return 'MANUAL';
  return null;
}

const SYNCHRONOUS_SUCCESS_STATUSES = new Set<string>([
  'succeeded',
  'SUCCEEDED',
  'success',
  'SUCCESS',
  'completed',
  'COMPLETED',
  'captured',
  'CAPTURED',
  'paid',
  'PAID',
]);

// ============================================
// CURRENCY RESOLUTION
// ============================================

function resolveBusinessUnitCurrency(
  businessUnitCurrency: string | null | undefined,
): string {
  return currencyService.resolveForBusiness(businessUnitCurrency);
}

/**
 * Map a normalized payment method to the provider name that
 * `chargeCurrencyService` and the gateway adapters use.
 *
 * ⚠ Mobile money is split — the resolver needs the concrete
 *   provider (MTN, AIRTEL, MPESA), not the umbrella
 *   `MOBILE_MONEY`. The caller supplies it via
 *   `data.mobileMoneyProvider`.
 *
 * ⚠ Offline methods (CASH, BANK_TRANSFER, CHECK) and ledger-native
 *   methods (GIFT_CARD, LOYALTY_POINTS) return a sentinel and are
 *   never passed to the remote gateway dispatch. The resolver is
 *   not called for them because their charge currency is the
 *   ledger currency by construction.
 */
function providerForPaymentMethod(
  method: string,
  mobileMoneyProvider?: MobileMoneyProvider | null,
): string | null {
  const upper = method.trim().toUpperCase();

  if (upper === 'CREDIT_CARD' || upper === 'DEBIT_CARD' || upper === 'CARD') {
    return 'STRIPE';
  }
  if (upper === 'PAYPAL') return 'PAYPAL';
  if (upper === 'FLUTTERWAVE') return 'FLUTTERWAVE';
  if (upper === 'PAYSTACK') return 'PAYSTACK';
  if (upper === 'SQUARE') return 'SQUARE';

  if (MOBILE_PAYMENT_METHODS.has(upper)) {
    if (upper === 'MPESA') return 'MPESA';
    return (mobileMoneyProvider ?? 'MTN');
  }

  // Offline and ledger-native methods — no remote charge currency.
  return null;
}

// ============================================
// INTERFACES
// ============================================

interface CheckoutItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface CheckoutData {
  cartId: string;
  customerId?: string;
  paymentMethod: string;
  paidAmount: number;
  discount?: number;
  notes?: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  applyLoyaltyPoints?: boolean;
  /**
   * Business unit the sale belongs to. When omitted, the cart's
   * own `businessUnitId` is used. Either way, the resolved BU is
   * the source of truth for the currency.
   */
  businessUnitId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  customerAddress?: string;
  idempotencyKey?: string;

  discountType?: DiscountType | null;
  promotionCode?: string | null;
  promotionDiscount?: number;

  /**
   * The payer's chosen display currency, read from the
   * `X-Display-Currency` header by `checkoutController` and passed
   * down.
   *
   * Recorded on the `Payment` row as an audit fact. NEVER used to
   * mutate any amount — every amount on the Sale is denominated in
   * the business unit's own currency.
   *
   * `null` and `undefined` are treated identically: "no display
   * override".
   */
  displayCurrency?: string | null;

  /**
   * Phase D1: the payer's affirmative acceptance of the converted
   * charge amount, shown on the pre-payment screen.
   *
   * ⚠ REQUIRED whenever the resolved charge currency differs from
   *   the ledger currency. `processOnlineCheckout` rejects the
   *   checkout when this is false and a conversion is required.
   *   Never default this to `true` — the whole point is that the
   *   payer saw the converted amount and agreed.
   */
  chargeContextAcknowledged?: boolean;
}

interface OnlineCheckoutData extends CheckoutData {
  returnUrl?: string;
  cancelUrl?: string;
  cardNonce?: string;
  paymentMethodId?: string;
  /**
   * Gift-card code, natural name. The controller forwards whichever
   * of `giftCardCode` / `gatewayId` the client sent; this service
   * resolves `giftCardCode ?? gatewayId` before dispatching.
   */
  giftCardCode?: string;
  /**
   * Gift-card code, backend-compatible key. Preserved on the
   * request type so a caller that only sets `gatewayId` still
   * reaches the gift-card branch.
   */
  gatewayId?: string;
  mobileMoneyProvider?: MobileMoneyProvider;
}

interface CheckoutResponse {
  sale: any;
  payment: any;
  receipt: any;
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  changeAmount: number;
}

type NextAction =
  | { type: 'CONFIRM_STRIPE'; clientSecret: string }
  | { type: 'REDIRECT'; url: string }
  | { type: 'AWAIT_STK_PUSH'; message: string; checkoutRequestId: string }
  | { type: 'OFFLINE'; message: string }
  | { type: 'NONE' };

interface GatewayResult {
  gateway: string;
  status: string;
  transactionId?: string;
  clientSecret?: string;
  redirectUrl?: string;
  mpesa?: { checkoutRequestId: string; customerMessage: string };
  nextAction: NextAction;
  raw: any;
}

interface OnlineCheckoutResponse extends CheckoutResponse {
  clientSecret?: string;
  redirectUrl?: string;
  mpesa?: { checkoutRequestId: string; customerMessage: string };
  nextAction: NextAction;
}

interface CheckoutStats {
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
  salesByDate: Array<{ date: string; count: number; revenue: number }>;
  recentSales: any[];
}

interface ExportOptions {
  userId: string;
  format: string;
  dateFrom?: Date;
  dateTo?: Date;
  businessUnitId?: string;
}

interface CheckoutSummaryResponse {
  items: any[];
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

interface CheckoutHistoryFilters {
  businessUnitId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  paymentStatus?: string;
  customerId?: string;
  search?: string;
}

interface CheckoutHistoryResult {
  checkouts: any[];
  total: number;
  limit: number;
  offset: number;
}

interface CheckoutSettings {
  allowPartialPayment: boolean;
  requireCustomer: boolean;
  requireSignature: boolean;
  maxDiscount: number;
  taxInclusive: boolean;
  defaultPaymentMethod: string;
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

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
  description?: string;
}

/**
 * Pre-payment charge preview DTO. Returned by
 * `previewCheckoutCharge` and rendered on the confirm screen.
 *
 * ⚠ `available: false` is a first-class outcome. The frontend
 *   renders the `reason` rather than a 500 — a missing FX rate
 *   must not abort the payer's flow with a server error.
 */
interface CheckoutChargePreview {
  available: boolean;
  reason?: string;
  ledger?: {
    currency: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
  };
  charge?: {
    currency: string;
    amount: number;
    fee: number;
    total: number;
  };
  rate?: { value: number; source: string };
  disclosure?: string;
  requiresPayerConfirmation?: boolean;
}

// ============================================
// SHARED PRISMA SELECTS
// ============================================

const SALE_ITEM_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      images: true,
      unitPrice: true,
      taxRate: true,
    },
  },
  variant: {
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      attributes: true,
    },
  },
} as const;

const SALE_FULL_INCLUDE = {
  customer: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  items: { include: SALE_ITEM_INCLUDE },
  payments: true,
  businessUnit: {
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      email: true,
      currency: true,
      companyId: true,
    },
  },
} as const;

// ============================================
// GATEWAY ERROR NORMALIZATION
// ============================================

function resolveGatewayError(error: any): AppError {
  if (error instanceof AppError) return error;

  const seen = new Set<any>();
  let node = error;
  while (node?.cause && !seen.has(node.cause)) {
    seen.add(node.cause);
    node = node.cause;
  }

  const nodeCodeMap: Record<string, number> = {
    ECONNREFUSED: 503,
    ENOTFOUND: 503,
    EAI_AGAIN: 503,
    ETIMEDOUT: 504,
    ECONNABORTED: 504,
  };

  const explicitStatus: unknown =
    node?.response?.status ??
    node?.status ??
    node?.statusCode ??
    node?.httpStatus;

  const codeMapped: number | undefined =
    typeof node?.code === 'string' ? nodeCodeMap[node.code] : undefined;

  const candidate =
    typeof explicitStatus === 'number' && explicitStatus > 0
      ? explicitStatus
      : codeMapped;

  const status: number =
    typeof candidate === 'number' && candidate > 0 ? candidate : 502;

  const message: string =
    node?.response?.data?.message ??
    node?.response?.data?.error_description ??
    node?.response?.data?.error ??
    node?.message ??
    (typeof node === 'string' ? node : 'Payment gateway error');

  logger.error('[checkout] Gateway error chain:', {
    top: error?.message,
    cause: error?.cause?.message,
    deepest: node?.message,
    code: node?.code,
    status,
  });

  return new AppError(message, status);
}

// ============================================
// CHECKOUT SERVICE CLASS
// ============================================

export class CheckoutService extends BaseService {
  private saleService: SaleService;
  private paymentService: PaymentService;
  private cartService: CartService;

  constructor() {
    super();
    this.saleService = new SaleService();
    this.paymentService = new PaymentService();
    this.cartService = new CartService();
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private safeEmitNewSale(sale: any, businessUnitId: string): void {
    try {
      logger.info(
        `💰 New sale created: ${sale?.receiptNumber || sale?.id} in ${businessUnitId}`,
      );
    } catch (error) {
      logger.warn('Failed to emit sale event:', error);
    }
  }

  private generateReceiptNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RCP-${timestamp}-${random}`;
  }

  private buildReceiptShape(sale: any, extra: any = {}) {
    return {
      receiptNumber: sale.receiptNumber,
      items: extra.items ?? [],
      subtotal: sale.subtotal,
      tax: sale.tax,
      discount: sale.discount,
      total: sale.total,
      paidAmount: extra.paidAmount ?? sale.paidAmount,
      changeAmount: extra.changeAmount ?? sale.changeAmount,
      customerId: extra.customerId ?? sale.customerId,
      businessUnitId: extra.businessUnitId ?? sale.businessUnitId,
      createdAt: sale.saleDate ?? sale.createdAt,
      paymentMethod: extra.paymentMethod ?? 'CASH',
      discountType: extra.discountType ?? sale.discountType ?? null,
      promotionCode: extra.promotionCode ?? sale.promotionCode ?? null,
      promotionDiscount:
        extra.promotionDiscount ?? sale.promotionDiscount ?? 0,
      loyaltyPointsUsed:
        extra.loyaltyPointsUsed ?? sale.loyaltyPointsUsed ?? 0,
      loyaltyDiscount:
        extra.loyaltyDiscount ?? sale.loyaltyDiscount ?? 0,
      currency: extra.currency ?? sale.currency ?? null,
      // ── Charge-currency audit (only present when converted) ──
      chargeCurrency: extra.chargeCurrency ?? null,
      chargeAmount: extra.chargeAmount ?? null,
      chargeRate: extra.chargeRate ?? null,
      chargeRateSource: extra.chargeRateSource ?? null,
    };
  }

  private buildWhereClause(filters?: CheckoutHistoryFilters): any {
    const where: any = {};

    if (filters?.businessUnitId) {
      where.businessUnitId = filters.businessUnitId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.saleDate = {};
      if (filters.startDate) where.saleDate.gte = filters.startDate;
      if (filters.endDate) where.saleDate.lte = filters.endDate;
    }

    if (filters?.status) where.status = filters.status;
    if (filters?.paymentStatus) where.paymentStatus = filters.paymentStatus;
    if (filters?.customerId) where.customerId = filters.customerId;

    if (filters?.search) {
      where.OR = [
        { receiptNumber: { contains: filters.search, mode: 'insensitive' } },
        {
          customer: {
            firstName: { contains: filters.search, mode: 'insensitive' },
          },
        },
        {
          customer: {
            lastName: { contains: filters.search, mode: 'insensitive' },
          },
        },
        {
          user: {
            email: { contains: filters.search, mode: 'insensitive' },
          },
        },
      ];
    }

    return where;
  }

  // ============================================
  // CANONICAL CHECKOUT (POS / OFFLINE)
  // ============================================

  async processCheckout(
    data: CheckoutData & { idempotencyKey?: string },
    userId: string,
  ): Promise<CheckoutResponse> {
    try {
      const upper = data.paymentMethod.trim().toUpperCase();
      if (
        ONLINE_PAYMENT_METHODS.has(upper) ||
        MOBILE_PAYMENT_METHODS.has(upper)
      ) {
        throw new AppError(
          `Payment method ${upper} requires gateway authorization. ` +
            `Call processOnlineCheckout instead of processCheckout.`,
          400,
        );
      }

      return await this.prisma.$transaction(async (tx: any) => {
        if (data.idempotencyKey) {
          const existing = await tx.sale.findUnique({
            where: { idempotencyKey: data.idempotencyKey },
            include: { items: true, payments: true },
          });
          if (existing) {
            return {
              sale: existing,
              payment: existing.payments[0] ?? null,
              receipt: this.buildReceiptShape(existing),
              loyaltyPointsEarned: 0,
              loyaltyPointsUsed: existing.loyaltyPointsUsed ?? 0,
              changeAmount: existing.changeAmount ?? 0,
            };
          }
        }

        const cart = await tx.cart.findUnique({
          where: { id: data.cartId },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    unitPrice: true,
                    taxRate: true,
                    isActive: true,
                  },
                },
                variant: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    price: true,
                    isActive: true,
                  },
                },
              },
            },
            customer: true,
          },
        });

        if (!cart) throw new AppError('Cart not found', 404);
        if (cart.items.length === 0) throw new AppError('Cart is empty', 400);
        if (cart.userId !== userId) {
          throw new AppError('Cart does not belong to this user', 403);
        }
        if (cart.status !== 'ACTIVE') {
          throw new AppError(
            `Cart is not active (status: ${cart.status})`,
            400,
          );
        }

        const businessUnitId = data.businessUnitId || cart.businessUnitId;

        const buRecord = await tx.businessUnit.findUnique({
          where: { id: businessUnitId },
          select: { currency: true, companyId: true },
        });
        const resolvedCurrency = resolveBusinessUnitCurrency(
          buRecord?.currency,
        );
        const companyId = buRecord?.companyId ?? null;

        const lines = cart.items.map((item: any) => {
          if (item.product.isActive === false) {
            throw new AppError(
              `Product "${item.product.name}" is no longer active`,
              400,
            );
          }
          if (item.variant && item.variant.isActive === false) {
            throw new AppError(
              `Variant "${item.variant.name}" is no longer active`,
              400,
            );
          }
          const unitPrice =
            item.variant?.price ?? item.product.unitPrice ?? 0;
          return {
            unitPrice,
            quantity: item.quantity,
            taxRate: safeTaxRate(item.product.taxRate),
          };
        });

        const totals = computeCartTotals(
          lines,
          data.discount ?? cart.discount ?? 0,
        );

        let loyaltyPointsUsed = 0;
        let loyaltyDiscount = 0;
        if (data.applyLoyaltyPoints && (data.customerId || cart.customerId)) {
          const customerId = data.customerId || cart.customerId!;
          const customer = await tx.customer.findUnique({
            where: { id: customerId },
            select: { loyaltyPoints: true },
          });
          if (customer && customer.loyaltyPoints > 0) {
            const maxDiscount = round2(totals.total * 0.5);
            const maxPointsForDiscount = Math.floor(maxDiscount / 0.1);
            loyaltyPointsUsed = Math.min(
              customer.loyaltyPoints,
              maxPointsForDiscount,
            );
            loyaltyDiscount = round2(loyaltyPointsUsed * 0.1);
          }
        }

        const finalTotal = round2(
          Math.max(0, totals.total - loyaltyDiscount),
        );

        const change = computeChange(data.paidAmount, finalTotal);
        if (change < 0) {
          throw new AppError(
            `Insufficient payment. Required: ${finalTotal.toFixed(2)}, received: ${data.paidAmount.toFixed(2)}`,
            400,
          );
        }

        for (const item of cart.items) {
          const inventory = await tx.inventory.findFirst({
            where: {
              ...(item.variantId
                ? { variant: { id: item.variantId } }
                : { product: { id: item.productId } }),
              businessUnitId,
            },
            select: { quantity: true, reserved: true },
          });
          if (!inventory) {
            throw new AppError(
              `No inventory record for ${item.product.name}`,
              400,
            );
          }
          const available =
            inventory.quantity - (inventory.reserved ?? 0);
          if (available < item.quantity) {
            throw new AppError(
              `Insufficient stock for ${item.product.name}. Available: ${available}`,
              400,
            );
          }
        }

        if (data.cashRegisterId) {
          const register = await tx.cashRegister.findUnique({
            where: { id: data.cashRegisterId },
            select: { isActive: true },
          });
          if (!register) throw new AppError('Cash register not found', 404);
          if (!register.isActive) {
            throw new AppError('Cash register is not active', 400);
          }
        }

        const promotionDiscount = round2(
          data.promotionDiscount ?? totals.discount,
        );
        const resolvedDiscountType = inferDiscountType({
          explicit: data.discountType ?? null,
          hasLoyalty: loyaltyDiscount > 0,
          hasPromotion: promotionDiscount > 0,
          hasBareDiscount: (data.discount ?? 0) > 0,
        });

        const receiptNumber = this.generateReceiptNumber();
        const sale = await tx.sale.create({
          data: {
            receiptNumber,
            idempotencyKey: data.idempotencyKey ?? null,
            subtotal: totals.subtotal,
            tax: totals.tax,
            discount: round2(totals.discount + loyaltyDiscount),
            discountType: resolvedDiscountType,
            promotionCode: data.promotionCode ?? null,
            promotionDiscount,
            loyaltyPointsUsed,
            loyaltyDiscount: round2(loyaltyDiscount),
            total: finalTotal,
            paidAmount: data.paidAmount,
            changeAmount: change > 0 ? change : 0,
            notes: data.notes ?? null,
            businessUnitId,
            userId,
            customerId: data.customerId || cart.customerId || null,
            cashRegisterId: data.cashRegisterId ?? null,
            cashRegisterSessionId: data.cashRegisterSessionId ?? null,
            status: 'COMPLETED',
            saleDate: new Date(),
          },
        });

        for (let i = 0; i < cart.items.length; i++) {
          const item = cart.items[i];
          const line = totals.lines[i];
          const perUnit = round2(line.net / Math.max(1, item.quantity));
          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              variantId: item.variantId ?? null,
              quantity: item.quantity,
              unitPrice: perUnit,
              total: line.gross,
              notes: item.notes ?? null,
            },
          });
        }

        for (const item of cart.items) {
          await applyInventoryDelta(tx, {
            productId: item.productId,
            variantId: item.variantId,
            businessUnitId,
            delta: -item.quantity,
            reason: 'SALE',
            referenceId: sale.id,
            notes: `Sale ${receiptNumber}`,
            userId,
            forbidNegative: true,
          });
        }

        const enumValue = normalizePaymentMethod(data.paymentMethod);

        // ── Ledger + display on the Payment row ──────────────
        // Offline methods are ledger-native: charge currency is
        // the ledger currency. `amount` is always the ledger
        // amount. `displayCurrency` is recorded for audit.
        const payment = await tx.payment.create({
          data: {
            amount: finalTotal,
            currency: resolvedCurrency,
            displayCurrency: data.displayCurrency ?? null,
            paymentMethod: enumValue as any,
            status: 'PAID',
            saleId: sale.id,
            userId,
            cashRegisterId: data.cashRegisterId ?? null,
            cashRegisterSessionId: data.cashRegisterSessionId ?? null,
            businessUnitId,
            processedAt: new Date(),
            reference: `PAY-${receiptNumber}`,
            metadata: {
              currency: resolvedCurrency,
              displayCurrency: data.displayCurrency ?? null,
              paymentMethod: enumValue,
              source: 'pos',
            },
          },
        });

        if (data.cashRegisterId && enumValue === 'CASH') {
          await tx.cashRegister.update({
            where: { id: data.cashRegisterId },
            data: { cashBalance: { increment: finalTotal } },
          });
        }

        const pointsEarned = Math.floor(sale.total / 10);
        const customerId = data.customerId || cart.customerId;
        if (customerId) {
          await tx.customer.update({
            where: { id: customerId },
            data: {
              totalSpent: { increment: finalTotal },
              lastPurchaseAt: new Date(),
              loyaltyPoints: {
                increment: pointsEarned - loyaltyPointsUsed,
              },
            },
          });

          if (pointsEarned > 0) {
            await tx.loyaltyHistory.create({
              data: {
                customerId,
                points: pointsEarned,
                type: 'EARN',
                notes: `Purchase ${receiptNumber}`,
                saleId: sale.id,
                userId,
                businessUnitId,
              },
            });
          }
          if (loyaltyPointsUsed > 0) {
            await tx.loyaltyHistory.create({
              data: {
                customerId,
                points: -loyaltyPointsUsed,
                type: 'REDEEM',
                notes: `Redeemed on ${receiptNumber}`,
                saleId: sale.id,
                userId,
                businessUnitId,
              },
            });
          }
        }

        await tx.cartItem.deleteMany({ where: { cartId: data.cartId } });
        await tx.cart.update({
          where: { id: data.cartId },
          data: {
            subtotal: 0,
            tax: 0,
            discount: 0,
            total: 0,
            status: 'CHECKED_OUT',
            customer: { disconnect: true },
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'SALE',
            entityId: sale.id,
            userId,
            companyId,
            businessUnitId,
            entityName: receiptNumber,
            changes: {
              total: finalTotal,
              subtotal: totals.subtotal,
              tax: totals.tax,
              discount: round2(totals.discount + loyaltyDiscount),
              discountType: resolvedDiscountType,
              promotionCode: data.promotionCode ?? null,
              promotionDiscount,
              loyaltyPointsUsed,
              loyaltyDiscount: round2(loyaltyDiscount),
              paymentMethod: enumValue,
              currency: resolvedCurrency,
              displayCurrency: data.displayCurrency ?? null,
              itemCount: cart.items.length,
              loyaltyPointsEarned: pointsEarned,
              idempotencyKey: data.idempotencyKey ?? null,
            },
            severity: 'INFO',
          },
        });

        this.safeEmitNewSale(sale, businessUnitId);

        const receipt = this.buildReceiptShape(sale, {
          items: cart.items.map((item: any, i: number) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: round2(
              totals.lines[i].net / Math.max(1, item.quantity),
            ),
            total: totals.lines[i].gross,
          })),
          paidAmount: data.paidAmount,
          changeAmount: change > 0 ? change : 0,
          paymentMethod: enumValue,
          customerId: cart.customerId,
          businessUnitId,
          discountType: resolvedDiscountType,
          promotionCode: data.promotionCode ?? null,
          promotionDiscount,
          loyaltyPointsUsed,
          loyaltyDiscount: round2(loyaltyDiscount),
          currency: resolvedCurrency,
        });

        return {
          sale,
          payment,
          receipt,
          loyaltyPointsEarned: pointsEarned,
          loyaltyPointsUsed,
          changeAmount: change > 0 ? change : 0,
        };
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.processCheckout');
      throw error;
    }
  }

  // ============================================
  // ONLINE CHECKOUT (GATEWAY-BACKED)
  // ============================================

  async processOnlineCheckout(
    data: OnlineCheckoutData,
    userId: string,
  ): Promise<OnlineCheckoutResponse> {
    try {
      const upper = data.paymentMethod.trim().toUpperCase();

      // ----------------------------------------------------
      // 0. Idempotency
      // ----------------------------------------------------
      if (data.idempotencyKey) {
        const existing = await this.prisma.sale.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
          include: { items: true, payments: true },
        });

        if (existing) {
          const isTerminal =
            existing.status === 'CANCELLED' ||
            existing.status === 'VOID' ||
            existing.status === 'REFUNDED';

          if (isTerminal) {
            logger.info(
              `[checkout] Idempotency key ${data.idempotencyKey} matched terminal sale ${existing.id} (status=${existing.status}) — freeing key and starting a fresh attempt`,
            );
            await this.prisma.sale.update({
              where: { id: existing.id },
              data: { idempotencyKey: null },
            });
          } else {
            const existingPayment = existing.payments[0] ?? null;
            return {
              sale: existing,
              payment: existingPayment,
              receipt: this.buildReceiptShape(existing),
              loyaltyPointsEarned: 0,
              loyaltyPointsUsed: existing.loyaltyPointsUsed ?? 0,
              changeAmount: existing.changeAmount ?? 0,
              nextAction:
                existing.status === 'COMPLETED'
                  ? { type: 'NONE' }
                  : {
                      type: 'OFFLINE',
                      message:
                        'Sale is awaiting payment confirmation from the gateway.',
                    },
            };
          }
        }
      }

      // ----------------------------------------------------
      // 1. Phase 1 — create PENDING Sale + Payment
      //
      // ⚠ The cart is NOT consumed here. It stays ACTIVE with
      //   its items until `markSalePaidFromWebhook` confirms the
      //   payment. That way a failed gateway call leaves the cart
      //   intact for a retry on the same cart id.
      // ----------------------------------------------------
      const phase1 = await this.prisma.$transaction(
        async (tx: any) => {
          const cart = await tx.cart.findUnique({
            where: { id: data.cartId },
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                      unitPrice: true,
                      taxRate: true,
                      isActive: true,
                    },
                  },
                  variant: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                      price: true,
                      isActive: true,
                    },
                  },
                },
              },
              customer: true,
            },
          });

          if (!cart) throw new AppError('Cart not found', 404);
          if (cart.items.length === 0) {
            throw new AppError('Cart is empty', 400);
          }
          if (cart.userId !== userId) {
            throw new AppError('Cart does not belong to this user', 403);
          }
          if (cart.status !== 'ACTIVE') {
            throw new AppError(
              `Cart is not active (status: ${cart.status})`,
              400,
            );
          }

          const businessUnitId = data.businessUnitId || cart.businessUnitId;

          const businessUnitRecord = await tx.businessUnit.findUnique({
            where: { id: businessUnitId },
            select: { currency: true },
          });
          const businessUnitCurrency = resolveBusinessUnitCurrency(
            businessUnitRecord?.currency,
          );

          const lines = cart.items.map((item: any) => {
            if (item.product.isActive === false) {
              throw new AppError(
                `Product "${item.product.name}" is no longer active`,
                400,
              );
            }
            if (item.variant && item.variant.isActive === false) {
              throw new AppError(
                `Variant "${item.variant.name}" is no longer active`,
                400,
              );
            }
            const unitPrice =
              item.variant?.price ?? item.product.unitPrice ?? 0;
            return {
              unitPrice,
              quantity: item.quantity,
              taxRate: safeTaxRate(item.product.taxRate),
            };
          });

          const totals = computeCartTotals(
            lines,
            data.discount ?? cart.discount ?? 0,
          );

          let loyaltyPointsUsed = 0;
          let loyaltyDiscount = 0;
          if (
            data.applyLoyaltyPoints &&
            (data.customerId || cart.customerId)
          ) {
            const customerId = data.customerId || cart.customerId!;
            const customer = await tx.customer.findUnique({
              where: { id: customerId },
              select: { loyaltyPoints: true },
            });
            if (customer && customer.loyaltyPoints > 0) {
              const maxDiscount = round2(totals.total * 0.5);
              const maxPoints = Math.floor(maxDiscount / 0.1);
              loyaltyPointsUsed = Math.min(
                customer.loyaltyPoints,
                maxPoints,
              );
              loyaltyDiscount = round2(loyaltyPointsUsed * 0.1);
            }
          }
          const finalTotal = round2(
            Math.max(0, totals.total - loyaltyDiscount),
          );

          for (const item of cart.items) {
            const inventory = await tx.inventory.findFirst({
              where: {
                ...(item.variantId
                  ? { variant: { id: item.variantId } }
                  : { product: { id: item.productId } }),
                businessUnitId,
              },
              select: { quantity: true, reserved: true },
            });
            if (!inventory) {
              throw new AppError(
                `No inventory record for ${item.product.name}`,
                400,
              );
            }
            const available =
              inventory.quantity - (inventory.reserved ?? 0);
            if (available < item.quantity) {
              throw new AppError(
                `Insufficient stock for ${item.product.name}. Available: ${available}`,
                400,
              );
            }
          }

          const promotionDiscount = round2(
            data.promotionDiscount ?? totals.discount,
          );
          const resolvedDiscountType = inferDiscountType({
            explicit: data.discountType ?? null,
            hasLoyalty: loyaltyDiscount > 0,
            hasPromotion: promotionDiscount > 0,
            hasBareDiscount: (data.discount ?? 0) > 0,
          });

          const receiptNumber = this.generateReceiptNumber();

          const sale = await tx.sale.create({
            data: {
              receiptNumber,
              idempotencyKey: data.idempotencyKey ?? null,
              // ── Cart linkage ──────────────────────────────
              // The webhook completion path reads this to know
              // which cart to consume once the payment is
              // confirmed.
              cartId: data.cartId,
              subtotal: totals.subtotal,
              tax: totals.tax,
              discount: round2(totals.discount + loyaltyDiscount),
              discountType: resolvedDiscountType,
              promotionCode: data.promotionCode ?? null,
              promotionDiscount,
              loyaltyPointsUsed,
              loyaltyDiscount: round2(loyaltyDiscount),
              total: finalTotal,
              paidAmount: 0,
              changeAmount: 0,
              notes: data.notes ?? null,
              businessUnitId,
              userId,
              customerId: data.customerId || cart.customerId || null,
              status: 'PENDING',
              saleDate: new Date(),
            },
          });

          for (let i = 0; i < cart.items.length; i++) {
            const item = cart.items[i];
            const line = totals.lines[i];
            const perUnit = round2(
              line.net / Math.max(1, item.quantity),
            );
            await tx.saleItem.create({
              data: {
                saleId: sale.id,
                productId: item.productId,
                variantId: item.variantId ?? null,
                quantity: item.quantity,
                unitPrice: perUnit,
                total: line.gross,
                notes: item.notes ?? null,
              },
            });
          }

          for (const item of cart.items) {
            await applyInventoryDelta(tx, {
              productId: item.productId,
              variantId: item.variantId,
              businessUnitId,
              delta: -item.quantity,
              reason: 'SALE',
              referenceId: sale.id,
              notes: `Sale ${receiptNumber} (pending gateway)`,
              userId,
              forbidNegative: true,
            });
          }

          const enumValue = normalizePaymentMethod(data.paymentMethod);

          const payment = await tx.payment.create({
            data: {
              amount: finalTotal,
              currency: businessUnitCurrency,
              displayCurrency: data.displayCurrency ?? null,
              paymentMethod: enumValue as any,
              status: 'PENDING',
              saleId: sale.id,
              userId,
              businessUnitId,
              processedAt: new Date(),
              reference: `PAY-${receiptNumber}`,
              metadata: {
                idempotencyKey: data.idempotencyKey ?? null,
                returnUrl: data.returnUrl ?? null,
                cancelUrl: data.cancelUrl ?? null,
                giftCardCode:
                  data.giftCardCode ?? data.gatewayId ?? null,
                mobileMoneyProvider:
                  data.mobileMoneyProvider ?? null,
                currency: businessUnitCurrency,
                displayCurrency: data.displayCurrency ?? null,
              },
            },
          });

          // ⚠ NO CART CONSUMPTION HERE. See the comment at the
          //   top of this transaction.

          await tx.auditLog.create({
            data: {
              action: 'CREATE',
              entityType: 'SALE',
              entityId: sale.id,
              userId,
              businessUnitId,
              entityName: receiptNumber,
              changes: {
                action: 'ONLINE_CHECKOUT_INITIATED',
                total: finalTotal,
                paymentMethod: enumValue,
                mobileMoneyProvider:
                  data.mobileMoneyProvider ?? null,
                currency: businessUnitCurrency,
                displayCurrency: data.displayCurrency ?? null,
                status: 'PENDING',
              },
              severity: 'INFO',
            },
          });

          return {
            sale,
            payment,
            cart: {
              id: cart.id,
              customerId: cart.customerId,
              businessUnitId,
              currency: businessUnitCurrency,
            },
            totals,
            finalTotal,
            loyaltyPointsUsed,
            loyaltyDiscount,
            resolvedDiscountType,
            promotionDiscount,
            enumValue,
            itemLines: cart.items.map((item: any, i: number) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: round2(
                totals.lines[i].net / Math.max(1, item.quantity),
              ),
              total: totals.lines[i].gross,
            })),
          };
        },
        { timeout: 15000 },
      );

      // ----------------------------------------------------
      // 1b. Resolve the CHARGE context before the gateway.
      // ----------------------------------------------------
      const provider = providerForPaymentMethod(
        phase1.enumValue,
        data.mobileMoneyProvider ?? null,
      );

      let chargeContext: Awaited<
        ReturnType<typeof chargeCurrencyService.resolve>
      > | null = null;

      if (provider) {
        try {
          chargeContext = await chargeCurrencyService.resolve({
            ledgerAmount: phase1.finalTotal,
            ledgerCurrency: phase1.cart.currency,
            provider,
            displayCurrency: data.displayCurrency ?? null,
          });
        } catch (chargeErr: any) {
          logger.error(
            `[checkout] Charge-currency resolution failed for sale ${phase1.sale.id} (${provider}):`,
            chargeErr,
          );

          await this.markSaleFailedFromWebhook(
            phase1.sale.id,
            phase1.payment.id,
            { reason: 'CHARGE_CURRENCY_UNAVAILABLE' },
            'PREPAYMENT',
            chargeErr instanceof Error
              ? chargeErr.message
              : 'No charge currency available.',
          );

          throw chargeErr instanceof AppError
            ? chargeErr
            : new AppError(
                'No charge currency available for the selected payment method.',
                503,
              );
        }

        if (chargeContext.converted && !data.chargeContextAcknowledged) {
          logger.warn(
            `[checkout] Sale ${phase1.sale.id} requires converted-charge acknowledgement ` +
              `(${chargeContext.ledgerCurrency} → ${chargeContext.chargeCurrency}) but none was given.`,
          );

          await this.markSaleFailedFromWebhook(
            phase1.sale.id,
            phase1.payment.id,
            { reason: 'CHARGE_CONTEXT_NOT_ACKNOWLEDGED' },
            'PREPAYMENT',
            'Payer did not acknowledge the converted charge amount.',
          );

          throw new AppError(
            'This checkout requires payment in a different currency than the ' +
              'business unit\u2019s ledger currency. Please review the converted ' +
              'amount and confirm.',
            409,
          );
        }

        await this.prisma.payment.update({
          where: { id: phase1.payment.id },
          data: {
            gatewayCurrency: chargeContext.converted
              ? chargeContext.chargeCurrency
              : null,
            gatewayAmount: chargeContext.converted
              ? chargeContext.chargeAmount
              : null,
            exchangeRate: chargeContext.converted
              ? chargeContext.rate
              : null,
            exchangeRateSource: chargeContext.converted
              ? chargeContext.rateSource
              : null,
            metadata: {
              ...((phase1.payment.metadata as any) ?? {}),
              chargeContext: {
                ledgerCurrency: chargeContext.ledgerCurrency,
                ledgerAmount: chargeContext.ledgerAmount,
                chargeCurrency: chargeContext.chargeCurrency,
                chargeAmount: chargeContext.chargeAmount,
                payerTotal: chargeContext.payerTotal,
                rate: chargeContext.rate,
                rateSource: chargeContext.rateSource,
                feeAmount: chargeContext.feeAmount,
                disclosure: chargeContext.disclosure,
                acknowledged: chargeContext.converted,
              },
            },
          },
        });
      }

      // ----------------------------------------------------
      // 2. Phase 2 — call the gateway
      // ----------------------------------------------------
      let gatewayResult: GatewayResult;
      try {
        gatewayResult = await this.invokeGateway({
          paymentMethod: phase1.enumValue,
          ledgerAmount: phase1.finalTotal,
          ledgerCurrency: phase1.cart.currency,
          chargeAmount:
            chargeContext?.payerTotal ?? phase1.finalTotal,
          chargeCurrency:
            chargeContext?.chargeCurrency ?? phase1.cart.currency,
          sale: phase1.sale,
          payment: phase1.payment,
          customer: null,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          customerName: data.customerName,
          returnUrl: data.returnUrl,
          cancelUrl: data.cancelUrl,
          idempotencyKey: data.idempotencyKey,
          cardNonce: data.cardNonce,
          paymentMethodId: data.paymentMethodId,
          giftCardCode: data.giftCardCode ?? data.gatewayId,
          mobileMoneyProvider: data.mobileMoneyProvider,
          displayCurrency: data.displayCurrency ?? null,
        });
      } catch (gatewayError: any) {
        logger.error(
          `Gateway call failed for sale ${phase1.sale.id}:`,
          gatewayError,
        );

        await this.prisma.$transaction(async (tx: any) => {
          await tx.payment.update({
            where: { id: phase1.payment.id },
            data: {
              status: 'FAILED',
              notes: `Gateway error: ${gatewayError?.message || 'unknown'}`,
              metadata: {
                ...((phase1.payment.metadata as any) ?? {}),
                gatewayError: {
                  message: gatewayError?.message,
                  code: gatewayError?.code,
                  type: gatewayError?.type,
                },
              },
            },
          });
          await tx.sale.update({
            where: { id: phase1.sale.id },
            data: { status: 'CANCELLED' },
          });
          for (const line of phase1.itemLines) {
            await applyInventoryDelta(tx, {
              productId: line.productId,
              variantId: line.variantId,
              businessUnitId: phase1.cart.businessUnitId,
              delta: line.quantity,
              reason: 'RESTOCK',
              referenceId: phase1.sale.id,
              notes: `Gateway failure ${phase1.sale.receiptNumber}`,
              userId,
              forbidNegative: false,
            });
          }
          // ⚠ The cart is intentionally left untouched here. It
          //   was never consumed, so nothing needs restoring.
        });

        throw resolveGatewayError(gatewayError);
      }

      // ----------------------------------------------------
      // 3. Phase 3 — persist the gateway reference
      // ----------------------------------------------------
      await this.prisma.payment.update({
        where: { id: phase1.payment.id },
        data: {
          transactionId: gatewayResult.transactionId ?? null,
          metadata: {
            ...((phase1.payment.metadata as any) ?? {}),
            gateway: gatewayResult.gateway,
            gatewayStatus: gatewayResult.status,
            gatewayResponse: gatewayResult.raw,
          },
        },
      });

      // ----------------------------------------------------
      // 3b. Inline synchronous completion
      // ----------------------------------------------------
      if (
        gatewayResult.transactionId &&
        SYNCHRONOUS_SUCCESS_STATUSES.has(gatewayResult.status)
      ) {
        try {
          await this.markSalePaidFromWebhook(
            phase1.sale.id,
            phase1.payment.id,
            gatewayResult.raw,
            gatewayResult.gateway,
          );
          logger.info(
            `Sale ${phase1.sale.receiptNumber} marked PAID inline (${gatewayResult.gateway}, status=${gatewayResult.status})`,
          );
        } catch (inlineError) {
          logger.warn(
            `Inline markSalePaidFromWebhook failed for sale ${phase1.sale.id} (webhook will retry):`,
            inlineError,
          );
        }
      }

      // ----------------------------------------------------
      // 4. Build the response
      // ----------------------------------------------------
      const receipt = this.buildReceiptShape(phase1.sale, {
        items: phase1.itemLines,
        paidAmount: 0,
        changeAmount: 0,
        paymentMethod: phase1.enumValue,
        customerId: phase1.cart.customerId,
        businessUnitId: phase1.cart.businessUnitId,
        discountType: phase1.resolvedDiscountType,
        promotionCode: data.promotionCode ?? null,
        promotionDiscount: phase1.promotionDiscount,
        loyaltyPointsUsed: phase1.loyaltyPointsUsed,
        loyaltyDiscount: round2(phase1.loyaltyDiscount),
        currency: phase1.cart.currency,
        chargeCurrency: chargeContext?.converted
          ? chargeContext.chargeCurrency
          : null,
        chargeAmount: chargeContext?.converted
          ? chargeContext.chargeAmount
          : null,
        chargeRate: chargeContext?.converted
          ? chargeContext.rate
          : null,
        chargeRateSource: chargeContext?.converted
          ? chargeContext.rateSource
          : null,
      });

      return {
        sale: phase1.sale,
        payment: {
          ...phase1.payment,
          transactionId: gatewayResult.transactionId ?? null,
        },
        receipt,
        loyaltyPointsEarned: 0,
        loyaltyPointsUsed: phase1.loyaltyPointsUsed,
        changeAmount: 0,
        clientSecret: gatewayResult.clientSecret,
        redirectUrl: gatewayResult.redirectUrl,
        mpesa: gatewayResult.mpesa,
        nextAction: gatewayResult.nextAction,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.processOnlineCheckout');
      throw error;
    }
  }

  // ============================================
  // PRE-PAYMENT CHARGE PREVIEW
  // ============================================

  /**
   * Pre-payment charge preview. Called by the controller when the
   * payer selects a payment method. Returns the exact amount that
   * will be charged, in the gateway's currency, plus the rate, its
   * source, and the disclosure text.
   *
   * ⚠ Never throws on a missing FX rate. Returns `available: false`
   *   with a reason so the frontend renders an explanation rather
   *   than a 500. The actual checkout WILL throw if the rate is
   *   still unavailable — but the payer sees why on the preview
   *   screen, not after committing.
   */
  async previewCheckoutCharge(params: {
    cartId: string;
    paymentMethod: string;
    mobileMoneyProvider?: MobileMoneyProvider | null;
    displayCurrency?: string | null;
  }): Promise<CheckoutChargePreview> {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { id: params.cartId },
        include: {
          businessUnit: { select: { currency: true } },
        },
      });

      if (!cart) throw new AppError('Cart not found', 404);

      const ledgerCurrency = resolveBusinessUnitCurrency(
        (cart as any).businessUnit?.currency ?? null,
      );

      const provider = providerForPaymentMethod(
        params.paymentMethod,
        params.mobileMoneyProvider ?? null,
      );

      // Offline and ledger-native methods never convert. Return the
      // ledger-only preview so the UI can render the same shape.
      if (!provider) {
        return {
          available: true,
          ledger: {
            currency: ledgerCurrency,
            subtotal: cart.subtotal,
            tax: cart.tax || 0,
            discount: cart.discount || 0,
            total: cart.total,
          },
          charge: {
            currency: ledgerCurrency,
            amount: cart.total,
            fee: 0,
            total: cart.total,
          },
          rate: { value: 1, source: 'identity' },
          requiresPayerConfirmation: false,
        };
      }

      let chargeContext;
      try {
        chargeContext = await chargeCurrencyService.resolve({
          ledgerAmount: cart.total,
          ledgerCurrency,
          provider,
          displayCurrency: params.displayCurrency ?? null,
        });
      } catch (err) {
        return {
          available: false,
          reason:
            err instanceof Error
              ? err.message
              : 'No charge currency available for the selected payment method.',
          ledger: {
            currency: ledgerCurrency,
            subtotal: cart.subtotal,
            tax: cart.tax || 0,
            discount: cart.discount || 0,
            total: cart.total,
          },
        };
      }

      return {
        available: true,
        ledger: {
          currency: chargeContext.ledgerCurrency,
          subtotal: cart.subtotal,
          tax: cart.tax || 0,
          discount: cart.discount || 0,
          total: chargeContext.ledgerAmount,
        },
        charge: {
          currency: chargeContext.chargeCurrency,
          amount: chargeContext.chargeAmount,
          fee: chargeContext.feeAmount,
          total: chargeContext.payerTotal,
        },
        rate: {
          value: chargeContext.rate,
          source: chargeContext.rateSource,
        },
        disclosure: chargeContext.disclosure,
        requiresPayerConfirmation: chargeContext.converted,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.previewCheckoutCharge');
      throw error;
    }
  }

  // ============================================
  // GATEWAY DISPATCH
  // ============================================

  private async invokeGateway(input: {
    paymentMethod: string;
    /** Ledger amount — what the books record. */
    ledgerAmount: number;
    /** Ledger currency — the BU's currency. */
    ledgerCurrency: string;
    /** Charge amount — what the gateway will actually bill. */
    chargeAmount: number;
    /** Charge currency — must be accepted by the gateway. */
    chargeCurrency: string;
    sale: any;
    payment: any;
    customer: any;
    customerEmail?: string;
    customerPhone?: string;
    customerName?: string;
    returnUrl?: string;
    cancelUrl?: string;
    idempotencyKey?: string;
    cardNonce?: string;
    paymentMethodId?: string;
    giftCardCode?: string;
    mobileMoneyProvider?: MobileMoneyProvider;
    displayCurrency?: string | null;
  }): Promise<GatewayResult> {
    const {
      paymentMethod,
      ledgerAmount,
      ledgerCurrency,
      chargeAmount,
      chargeCurrency,
      sale,
      payment,
      customer,
      customerEmail,
      customerPhone,
      customerName,
      returnUrl,
      cancelUrl,
      idempotencyKey,
      cardNonce,
      paymentMethodId,
      giftCardCode,
      mobileMoneyProvider,
      displayCurrency,
    } = input;

    const frontendUrl =
      process.env.FRONTEND_URL || 'http://localhost:3000';
    const successUrl =
      returnUrl ||
      `${frontendUrl}/checkout/success?saleId=${sale.id}`;
    const failureUrl =
      cancelUrl ||
      `${frontendUrl}/checkout/cancel?saleId=${sale.id}`;

    const upper = paymentMethod.trim().toUpperCase();

    // ── Defensive: charge currency MUST be accepted by the ──
    //    remote gateway. The resolver guarantees this; reaching
    //    here with a rejection means the resolver and the adapter
    //    disagree — a bug, not a payer error.
    const remoteProviders = new Set([
      'CREDIT_CARD',
      'DEBIT_CARD',
      'CARD',
      'PAYPAL',
      'FLUTTERWAVE',
      'PAYSTACK',
      'SQUARE',
    ]);
    if (remoteProviders.has(upper)) {
      const providerName =
        upper === 'CREDIT_CARD' ||
        upper === 'DEBIT_CARD' ||
        upper === 'CARD'
          ? 'STRIPE'
          : upper;
      currencyService.assertProviderAccepts(
        providerName as SupportedProvider,
        chargeCurrency,
      );
    }

    // ── Offline methods ─────────────────────────────────────
    if (['CASH', 'BANK_TRANSFER', 'CHECK'].includes(upper)) {
      return {
        gateway: upper,
        status: 'PENDING_OFFLINE',
        nextAction: {
          type: 'OFFLINE',
          message:
            upper === 'CASH'
              ? 'Pay at the counter — your order is reserved.'
              : 'Awaiting bank transfer confirmation.',
        },
        raw: { note: 'Offline payment — awaiting staff confirmation' },
      };
    }

    // ── Card (Stripe) ───────────────────────────────────────
    if (['CREDIT_CARD', 'DEBIT_CARD', 'CARD'].includes(upper)) {
      const stripeIdempotencyKey = `stripe_intent_${payment.id}`;

      const intent = await this.paymentService.createPaymentIntent({
        amount: chargeAmount,
        currency: chargeCurrency,
        description: `Sale ${sale.receiptNumber}`,
        metadata: {
          saleId: sale.id,
          paymentId: payment.id,
          userId: sale.userId,
          ledgerCurrency,
          ledgerAmount: String(ledgerAmount),
          ...(displayCurrency ? { displayCurrency } : {}),
        },
        customerId: customer?.id,
        idempotencyKey: stripeIdempotencyKey,
      });

      if (paymentMethodId) {
        logger.info(
          `Stripe: paymentMethodId supplied for sale ${sale.id} — client will confirm.`,
        );
      }

      return {
        gateway: 'STRIPE',
        status: intent.status,
        transactionId: intent.id,
        clientSecret: intent.clientSecret,
        nextAction: {
          type: 'CONFIRM_STRIPE',
          clientSecret: intent.clientSecret,
        },
        raw: intent,
      };
    }

    // ── Mobile money ────────────────────────────────────────
    if (MOBILE_PAYMENT_METHODS.has(upper)) {
      if (!customerPhone) {
        throw new AppError(
          'Phone number is required for mobile money payments',
          400,
        );
      }

      const provider: MobileMoneyProvider =
        upper === 'MPESA' ? 'MPESA' : (mobileMoneyProvider ?? 'MTN');

      // ── M-Pesa ───────────────────────────────────────────
      if (provider === 'MPESA') {
        // M-Pesa's currency is enforced by `mpesaService` itself
        // via the deployment's `MPESA_COUNTRY` env var — it only
        // ever transacts in KES on the Kenya deployment.
        const { mpesaService } = await import('./mpesaService.js');
        if (!mpesaService.isConfigured()) {
          throw new AppError(
            'M-Pesa is not configured. Please contact support.',
            503,
          );
        }
        const stk = await mpesaService.initiateSTKPush({
          phoneNumber: customerPhone,
          amount: chargeAmount,
          accountReference: sale.receiptNumber,
          transactionDesc: `Payment for ${sale.receiptNumber}`,
        });

        return {
          gateway: 'MPESA',
          status: 'PENDING',
          transactionId: stk.CheckoutRequestID,
          mpesa: {
            checkoutRequestId: stk.CheckoutRequestID,
            customerMessage: stk.CustomerMessage,
          },
          nextAction: {
            type: 'AWAIT_STK_PUSH',
            message: stk.CustomerMessage,
            checkoutRequestId: stk.CheckoutRequestID,
          },
          raw: stk,
        };
      }

      // ── MTN MoMo / Airtel Money ──────────────────────────
      if (provider === 'MTN' || provider === 'AIRTEL') {
        const { mobileMoneyService } = await import(
          './mobileMoneyService.js'
        );

        if (provider === 'MTN') {
          if (!isMtnConfigured()) {
            const missing = missingMtnKeys();
            throw new AppError(
              missing.length > 0
                ? `MTN is not configured. Missing: ${missing.join(', ')}.`
                : 'MTN is not configured. Please contact support.',
              503,
            );
          }
        } else {
          if (!isAirtelConfigured()) {
            const missing = missingAirtelKeys();
            throw new AppError(
              missing.length > 0
                ? `Airtel is not configured. Missing: ${missing.join(', ')}.`
                : 'Airtel is not configured. Please contact support.',
              503,
            );
          }
        }

        // ⚠ `chargeCurrency` was set by the resolver to the
        //   provider's country currency. Passing it here means
        //   mobileMoneyService will match it against
        //   MTN_COUNTRY / AIRTEL_COUNTRY and NOT reject. A
        //   mismatch at this point is a resolver bug, which the
        //   mobile-money service surfaces loudly.
        const result = await mobileMoneyService.initiatePayment(
          provider,
          {
            phoneNumber: customerPhone,
            amount: chargeAmount,
            currency: chargeCurrency,
            reference: sale.receiptNumber,
            description: `Payment for ${sale.receiptNumber}`,
            metadata: {
              saleId: sale.id,
              paymentId: payment.id,
              userId: sale.userId,
            },
          },
        );

        return {
          gateway: provider,
          status: result.status || 'PENDING',
          transactionId: result.transactionId || result.reference,
          nextAction: {
            type: 'AWAIT_STK_PUSH',
            message:
              result.message ||
              `Approve the payment request on your ${provider} phone.`,
            checkoutRequestId:
              result.transactionId || result.reference || sale.receiptNumber,
          },
          raw: result,
        };
      }

      throw new AppError(
        `Unsupported mobile money provider: ${provider}`,
        400,
      );
    }

    // ── PayPal ──────────────────────────────────────────────
    if (upper === 'PAYPAL') {
      const { PayPalService } = await import('./paypalService.js');
      const paypal = new PayPalService();
      if (!paypal.validateConfig()) {
        throw new AppError('PayPal is not configured', 503);
      }
      const order: any = await paypal.processPayment({
        amount: chargeAmount,
        currency: chargeCurrency,
        description: `Sale ${sale.receiptNumber}`,
        saleId: sale.id,
        orderId: undefined,
        userId: sale.userId,
        customerEmail,
        customerName,
        returnUrl: successUrl,
        cancelUrl: failureUrl,
        metadata: {
          paymentId: payment.id,
          saleId: sale.id,
          ledgerCurrency,
          ledgerAmount: String(ledgerAmount),
          ...(displayCurrency ? { displayCurrency } : {}),
        },
      });

      const approvalUrl =
        order.approvalUrl ||
        order.links?.find((l: any) => l.rel === 'approve')?.href;
      if (!approvalUrl) {
        throw new AppError(
          'PayPal did not return an approval URL',
          502,
        );
      }

      return {
        gateway: 'PAYPAL',
        status: 'PENDING',
        transactionId: order.id,
        redirectUrl: approvalUrl,
        nextAction: { type: 'REDIRECT', url: approvalUrl },
        raw: order,
      };
    }

    // ── Flutterwave ─────────────────────────────────────────
    if (upper === 'FLUTTERWAVE') {
      const { FlutterwaveService } = await import(
        './flutterwaveService.js'
      );
      const fw = new FlutterwaveService();
      if (!fw.validateConfig()) {
        throw new AppError('Flutterwave is not configured', 503);
      }
      const result: any = await fw.processPayment({
        amount: chargeAmount,
        currency: chargeCurrency,
        paymentMethod: 'card',
        description: `Sale ${sale.receiptNumber}`,
        saleId: sale.id,
        orderId: undefined,
        userId: sale.userId,
        customerEmail,
        customerName,
        phoneNumber: customerPhone,
        redirectUrl: successUrl,
        metadata: {
          paymentId: payment.id,
          saleId: sale.id,
          ledgerCurrency,
          ledgerAmount: String(ledgerAmount),
          ...(displayCurrency ? { displayCurrency } : {}),
        },
      });

      const redirectUrl =
        result.redirectUrl || result.link || result.data?.link;
      if (!redirectUrl) {
        throw new AppError(
          'Flutterwave did not return a redirect URL',
          502,
        );
      }

      return {
        gateway: 'FLUTTERWAVE',
        status: 'PENDING',
        transactionId: result.txRef || result.id,
        redirectUrl,
        nextAction: { type: 'REDIRECT', url: redirectUrl },
        raw: result,
      };
    }

    // ── Paystack ────────────────────────────────────────────
    if (upper === 'PAYSTACK') {
      throw new AppError(
        'Paystack provider is not installed. Enable it or use a different gateway.',
        503,
      );
    }

    // ── Square ──────────────────────────────────────────────
    if (upper === 'SQUARE') {
      if (!cardNonce) {
        throw new AppError(
          'Square requires a card nonce generated by the Square Web SDK.',
          400,
        );
      }

      const { SquareService } = await import('./squareService.js');
      const square = new SquareService();
      if (!square.validateConfig()) {
        throw new AppError('Square is not configured', 503);
      }
      const result: any = await square.processCardPayment({
        amount: chargeAmount,
        cardNonce,
        currency: chargeCurrency,
        customerId: customer?.id,
        description: `Sale ${sale.receiptNumber}`,
        metadata: {
          saleId: sale.id,
          paymentId: payment.id,
          userId: sale.userId,
          ledgerCurrency,
          ledgerAmount: String(ledgerAmount),
          ...(displayCurrency ? { displayCurrency } : {}),
        },
      });

      return {
        gateway: 'SQUARE',
        status: result.status || 'PENDING',
        transactionId: result.id,
        nextAction: { type: 'NONE' },
        raw: result,
      };
    }

    // ── Gift Card ───────────────────────────────────────────
    //
    // ⚠ Gift cards are LEDGER-NATIVE. They redeem in the ledger
    //   currency, not the charge currency. A gift card issued for
    //   UGX 50,000 can only be redeemed against a UGX 50,000 line
    //   — converting it to USD would misstate its stored balance.
    //   So this branch uses `ledgerAmount`/`ledgerCurrency`, NOT
    //   `chargeAmount`/`chargeCurrency`.
    if (upper === 'GIFT_CARD' || upper === 'GIFT') {
      if (!giftCardCode) {
        throw new AppError(
          'Gift card code is required for GIFT_CARD payments.',
          400,
        );
      }

      const giftCardIdempotencyKey =
        idempotencyKey && idempotencyKey.trim() !== ''
          ? `giftcard_sale_${idempotencyKey}`
          : `giftcard_${payment.id}`;

      const result: any = await this.paymentService.processPayment({
        amount: ledgerAmount,
        paymentMethod: 'GIFT_CARD',
        saleId: sale.id,
        userId: sale.userId,
        currency: ledgerCurrency,
        gatewayId: giftCardCode,
        metadata: {
          saleId: sale.id,
          paymentId: payment.id,
          giftCardCode,
        },
        description: `Sale ${sale.receiptNumber}`,
        idempotencyKey: giftCardIdempotencyKey,
        displayCurrency: displayCurrency ?? null,
      });

      return {
        gateway: 'GIFT_CARD',
        status: result.status || 'succeeded',
        transactionId: result.transactionId || result.id,
        nextAction: { type: 'NONE' },
        raw: result,
      };
    }

    throw new AppError(
      `Unsupported payment method: ${paymentMethod}`,
      400,
    );
  }

  // ============================================
  // WEBHOOK-DRIVEN SALE COMPLETION
  // ============================================

  async markSalePaidFromWebhook(
    saleId: string,
    paymentId: string,
    gatewayPayload: any,
    gatewayName: string = 'UNKNOWN',
  ): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx: any) => {
          const sale = await tx.sale.findUnique({
            where: { id: saleId },
            include: {
              items: true,
              payments: true,
              businessUnit: {
                select: { companyId: true },
              },
            },
          });
          if (!sale) {
            logger.warn(
              `[webhook:${gatewayName}] Sale ${saleId} not found — ignoring`,
            );
            return;
          }
          if (sale.status === 'COMPLETED') {
            logger.info(
              `[webhook:${gatewayName}] Sale ${saleId} already COMPLETED — idempotent skip`,
            );
            return;
          }
          if (
            sale.status === 'CANCELLED' ||
            sale.status === 'VOID' ||
            sale.status === 'REFUNDED'
          ) {
            logger.warn(
              `[webhook:${gatewayName}] Sale ${saleId} is ${sale.status} — cannot mark PAID`,
            );
            return;
          }

          const targetPayment = paymentId
            ? sale.payments.find((p: any) => p.id === paymentId)
            : sale.payments[0];

          if (!targetPayment) {
            logger.warn(
              `[webhook:${gatewayName}] No payment found for sale ${saleId}`,
            );
            return;
          }

          if (targetPayment.status === 'PAID') {
            logger.info(
              `[webhook:${gatewayName}] Payment ${targetPayment.id} already PAID — idempotent skip`,
            );
            return;
          }

          await tx.payment.update({
            where: { id: targetPayment.id },
            data: {
              status: 'PAID',
              processedAt: new Date(),
              metadata: {
                ...((targetPayment.metadata as any) ?? {}),
                gateway: gatewayName,
                webhookPayload: gatewayPayload,
                confirmedAt: new Date().toISOString(),
              },
            },
          });

          const totalPaid = sale.payments
            .map((p: any) =>
              p.id === targetPayment.id
                ? p.amount
                : p.status === 'PAID'
                  ? p.amount
                  : 0,
            )
            .reduce((sum: number, n: number) => sum + n, 0);

          const isFullyPaid = totalPaid >= sale.total;

          await tx.sale.update({
            where: { id: saleId },
            data: {
              status: isFullyPaid ? 'COMPLETED' : 'PROCESSING',
              paidAmount: totalPaid,
              changeAmount: Math.max(0, totalPaid - sale.total),
            },
          });

          if (isFullyPaid) {
            const pointsEarned = Math.floor(sale.total / 10);
            if (sale.customerId && pointsEarned > 0) {
              await tx.customer.update({
                where: { id: sale.customerId },
                data: {
                  totalSpent: { increment: sale.total },
                  lastPurchaseAt: new Date(),
                  loyaltyPoints: {
                    increment:
                      pointsEarned - (sale.loyaltyPointsUsed ?? 0),
                  },
                },
              });

              await tx.loyaltyHistory.create({
                data: {
                  customerId: sale.customerId,
                  points: pointsEarned,
                  type: 'EARN',
                  notes: `Purchase ${sale.receiptNumber}`,
                  saleId: sale.id,
                  userId: sale.userId,
                  businessUnitId: sale.businessUnitId,
                },
              });

              if ((sale.loyaltyPointsUsed ?? 0) > 0) {
                await tx.loyaltyHistory.create({
                  data: {
                    customerId: sale.customerId,
                    points: -(sale.loyaltyPointsUsed ?? 0),
                    type: 'REDEEM',
                    notes: `Redeemed on ${sale.receiptNumber}`,
                    saleId: sale.id,
                    userId: sale.userId,
                    businessUnitId: sale.businessUnitId,
                  },
                });
              }
            }

            if (
              sale.cashRegisterId &&
              targetPayment.paymentMethod === 'CASH'
            ) {
              await tx.cashRegister.update({
                where: { id: sale.cashRegisterId },
                data: { cashBalance: { increment: sale.total } },
              });
            }

            const companyId =
              (sale as any).companyId ||
              (sale.businessUnit as any)?.companyId ||
              '';
            try {
              await tx.receipt.upsert({
                where: { saleId: sale.id },
                create: {
                  receiptNumber: `RCP-${sale.receiptNumber}`,
                  content: JSON.stringify({
                    saleId: sale.id,
                    receiptNumber: sale.receiptNumber,
                  }),
                  format: 'PDF',
                  type: 'SALE',
                  status: 'ISSUED',
                  saleId: sale.id,
                  companyId,
                },
                update: { status: 'ISSUED' },
              });
            } catch (receiptErr) {
              logger.warn(
                `[webhook:${gatewayName}] Receipt upsert skipped:`,
                receiptErr,
              );
            }
          }

          // ── Consume the cart only after payment is confirmed ──
          //
          // Phase-1 used to clear the cart before the gateway was
          // called. When the gateway failed, the cart was left
          // CHECKED_OUT and empty, so every retry on the same cart
          // id hit "Cart is empty". Moving the consumption here
          // means a failed gateway attempt leaves the cart intact
          // for a retry.
          //
          // ⚠ Only consume when the sale is fully paid. Partial
          //   payments (split tender) leave the cart open so the
          //   remaining tender can be recorded against the same
          //   cart.
          //
          // ⚠ `sale.cartId` is nullable. Sales created before the
          //   `add_sale_cart_id` migration, and sales created
          //   without a cart linkage (POS flows), skip this block
          //   safely.
          if (isFullyPaid && (sale as any).cartId) {
            const linkedCartId = (sale as any).cartId as string;
            try {
              await tx.cartItem.deleteMany({
                where: { cartId: linkedCartId },
              });
              await tx.cart.update({
                where: { id: linkedCartId },
                data: {
                  subtotal: 0,
                  tax: 0,
                  discount: 0,
                  total: 0,
                  status: 'CHECKED_OUT',
                  customer: { disconnect: true },
                },
              });
              logger.info(
                `[webhook:${gatewayName}] Consumed cart ${linkedCartId} for sale ${sale.receiptNumber}`,
              );
            } catch (cartErr) {
              // A cart that was already consumed by a previous
              // webhook delivery, or a cart row that was hard-
              // deleted, must not fail the whole webhook. Log and
              // continue — the sale is already marked PAID.
              logger.warn(
                `[webhook:${gatewayName}] Cart consumption failed for sale ${sale.receiptNumber} (cartId=${linkedCartId}):`,
                cartErr,
              );
            }
          }

          await tx.auditLog.create({
            data: {
              action: 'UPDATE',
              entityType: 'SALE',
              entityId: sale.id,
              userId: sale.userId,
              businessUnitId: sale.businessUnitId,
              entityName: sale.receiptNumber,
              changes: {
                action: 'WEBHOOK_PAYMENT_CONFIRMED',
                gateway: gatewayName,
                paymentId: targetPayment.id,
                totalPaid,
                fullyPaid: isFullyPaid,
                cartConsumed:
                  isFullyPaid && !!(sale as any).cartId
                    ? (sale as any).cartId
                    : null,
                gatewayPayload,
              },
              severity: 'INFO',
            },
          });

          logger.info(
            `[webhook:${gatewayName}] Sale ${sale.receiptNumber} marked ${isFullyPaid ? 'COMPLETED' : 'PROCESSING'}`,
          );
        },
        { timeout: 20000 },
      );
    } catch (error) {
      this.handleError(
        error,
        'CheckoutService.markSalePaidFromWebhook',
      );
      throw error;
    }
  }

  async markSaleFailedFromWebhook(
    saleId: string,
    paymentId: string,
    gatewayPayload: any,
    gatewayName: string = 'UNKNOWN',
    reason?: string,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx: any) => {
          const sale = await tx.sale.findUnique({
            where: { id: saleId },
            include: { items: true, payments: true },
          });
          if (!sale) {
            logger.warn(
              `[webhook:${gatewayName}] Sale ${saleId} not found`,
            );
            return;
          }
          if (sale.status === 'COMPLETED') {
            logger.warn(
              `[webhook:${gatewayName}] Sale ${saleId} already COMPLETED — refusing to mark FAILED`,
            );
            return;
          }
          if (
            sale.status === 'CANCELLED' ||
            sale.status === 'VOID' ||
            sale.status === 'REFUNDED'
          ) {
            logger.info(
              `[webhook:${gatewayName}] Sale ${saleId} already ${sale.status} — idempotent skip`,
            );
            return;
          }

          const targetPayment = paymentId
            ? sale.payments.find((p: any) => p.id === paymentId)
            : sale.payments[0];
          if (!targetPayment) return;
          if (targetPayment.status === 'FAILED') {
            logger.info(
              `[webhook:${gatewayName}] Payment ${targetPayment.id} already FAILED — skip`,
            );
            return;
          }

          await tx.payment.update({
            where: { id: targetPayment.id },
            data: {
              status: 'FAILED',
              notes: reason
                ? `Gateway failure: ${reason}`
                : 'Gateway failure',
              metadata: {
                ...((targetPayment.metadata as any) ?? {}),
                gateway: gatewayName,
                webhookPayload: gatewayPayload,
                failedAt: new Date().toISOString(),
              },
            },
          });

          await tx.sale.update({
            where: { id: saleId },
            data: { status: 'CANCELLED' },
          });

          for (const item of sale.items) {
            await applyInventoryDelta(tx, {
              productId: item.productId,
              variantId: item.variantId,
              businessUnitId: sale.businessUnitId,
              delta: item.quantity,
              reason: 'RESTOCK',
              referenceId: sale.id,
              notes: `Gateway failure ${sale.receiptNumber}`,
              userId: sale.userId,
              forbidNegative: false,
            });
          }

          await tx.auditLog.create({
            data: {
              action: 'UPDATE',
              entityType: 'SALE',
              entityId: sale.id,
              userId: sale.userId,
              businessUnitId: sale.businessUnitId,
              entityName: sale.receiptNumber,
              changes: {
                action: 'WEBHOOK_PAYMENT_FAILED',
                gateway: gatewayName,
                paymentId: targetPayment.id,
                reason,
                gatewayPayload,
              },
              severity: 'MEDIUM',
            },
          });

          logger.warn(
            `[webhook:${gatewayName}] Sale ${sale.receiptNumber} marked CANCELLED after gateway failure`,
          );
        },
        { timeout: 20000 },
      );
    } catch (error) {
      this.handleError(
        error,
        'CheckoutService.markSaleFailedFromWebhook',
      );
      throw error;
    }
  }

  // ============================================
  // SUMMARY / READ
  // ============================================

  async getCheckoutSummary(
    cartId: string,
  ): Promise<CheckoutSummaryResponse> {
    try {
      if (!cartId) throw new AppError('Cart ID is required', 400);

      const cart = await this.prisma.cart.findUnique({
        where: { id: cartId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unitPrice: true,
                  images: true,
                  isActive: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                  attributes: true,
                  isActive: true,
                },
              },
            },
          },
          customer: true,
          businessUnit: {
            select: { currency: true },
          },
        },
      });

      if (!cart) throw new AppError('Cart not found', 404);

      const loyaltyPointsAvailable =
        (cart.customer as any)?.loyaltyPoints || 0;
      const maxLoyaltyDiscount = Math.min(
        round2(loyaltyPointsAvailable * 0.1),
        round2(cart.subtotal * 0.5),
      );
      const loyaltyPointsRedeemable = Math.floor(
        Math.min(loyaltyPointsAvailable, cart.subtotal / 0.1),
      );

      const resolvedCurrency = resolveBusinessUnitCurrency(
        (cart as any).businessUnit?.currency ?? null,
      );
      const currencyMeta =
        currencyService.tryGetCurrency(resolvedCurrency);

      return {
        items: cart.items.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          product: item.product,
          variant: item.variant,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        subtotal: cart.subtotal,
        tax: cart.tax || 0,
        discount: cart.discount || 0,
        total: cart.total,
        loyaltyPointsAvailable,
        loyaltyPointsRedeemable,
        maxLoyaltyDiscount,
        customerId: cart.customerId || undefined,
        currency: resolvedCurrency,
        currencySymbol: currencyMeta?.symbol ?? resolvedCurrency,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutSummary');
      throw error;
    }
  }

  async getSaleWithReceipt(saleId: string) {
    try {
      if (!saleId) throw new AppError('Sale ID is required', 400);

      const sale = await this.prisma.sale.findUnique({
        where: { id: saleId },
        include: SALE_FULL_INCLUDE,
      });

      if (!sale) throw new AppError('Sale not found', 404);
      return sale;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getSaleWithReceipt');
      throw error;
    }
  }

  async getReceiptByNumber(receiptNumber: string) {
    try {
      if (!receiptNumber) {
        throw new AppError('Receipt number is required', 400);
      }

      const sale = await this.prisma.sale.findUnique({
        where: { receiptNumber },
        include: SALE_FULL_INCLUDE,
      });

      if (!sale) throw new AppError('Receipt not found', 404);
      return sale;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getReceiptByNumber');
      throw error;
    }
  }

  async getAllCheckouts(
    limit = 50,
    offset = 0,
    filters?: CheckoutHistoryFilters,
    orderBy?: any,
  ): Promise<CheckoutHistoryResult> {
    try {
      const where = this.buildWhereClause(filters);

      const [checkouts, total] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: orderBy || { saleDate: 'desc' },
          include: SALE_FULL_INCLUDE,
        }),
        this.prisma.sale.count({ where }),
      ]);

      return { checkouts, total, limit, offset };
    } catch (error) {
      this.handleError(error, 'CheckoutService.getAllCheckouts');
      throw error;
    }
  }

  async getCheckoutById(checkoutId: string) {
    try {
      if (!checkoutId) throw new AppError('Checkout ID is required', 400);

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
        include: SALE_FULL_INCLUDE,
      });

      if (!checkout) throw new AppError('Checkout not found', 404);
      return checkout;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutById');
      throw error;
    }
  }

  async getCheckoutByReceiptNumber(receiptNumber: string) {
    try {
      if (!receiptNumber) {
        throw new AppError('Receipt number is required', 400);
      }

      const checkout = await this.prisma.sale.findUnique({
        where: { receiptNumber },
        include: SALE_FULL_INCLUDE,
      });

      if (!checkout) throw new AppError('Checkout not found', 404);
      return checkout;
    } catch (error) {
      this.handleError(
        error,
        'CheckoutService.getCheckoutByReceiptNumber',
      );
      throw error;
    }
  }

  async getCheckoutReceipt(checkoutId: string) {
    try {
      if (!checkoutId) throw new AppError('Checkout ID is required', 400);

      const receipt = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
        include: SALE_FULL_INCLUDE,
      });

      if (!receipt) throw new AppError('Receipt not found', 404);
      return receipt;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutReceipt');
      throw error;
    }
  }

  async getCheckoutItems(checkoutId: string) {
    try {
      if (!checkoutId) throw new AppError('Checkout ID is required', 400);

      const items = await this.prisma.saleItem.findMany({
        where: { saleId: checkoutId },
        include: SALE_ITEM_INCLUDE,
      });

      if (!items || items.length === 0) {
        throw new AppError('No items found for this checkout', 404);
      }
      return items;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutItems');
      throw error;
    }
  }

  // ============================================
  // ITEM MUTATIONS
  // ============================================

  async addCheckoutItem(
    checkoutId: string,
    itemData: {
      productId: string;
      variantId?: string;
      quantity: number;
      unitPrice?: number;
    },
    userId: string,
  ) {
    try {
      if (!checkoutId) throw new AppError('Checkout ID is required', 400);

      return await this.prisma.$transaction(async (tx: any) => {
        const checkout = await tx.sale.findUnique({
          where: { id: checkoutId },
        });
        if (!checkout) throw new AppError('Checkout not found', 404);
        if (checkout.status === 'COMPLETED') {
          throw new AppError('Cannot add item to completed checkout', 400);
        }
        if (checkout.status === 'CANCELLED') {
          throw new AppError('Cannot add item to cancelled checkout', 400);
        }

        const product = await tx.product.findUnique({
          where: { id: itemData.productId },
          select: { unitPrice: true, taxRate: true, isActive: true },
        });
        if (!product) throw new AppError('Product not found', 404);
        if (!product.isActive) {
          throw new AppError('Product is not active', 400);
        }

        let unitPrice = product.unitPrice;
        if (itemData.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: itemData.variantId },
            select: { price: true, isActive: true },
          });
          if (!variant) throw new AppError('Variant not found', 404);
          if (!variant.isActive) {
            throw new AppError('Variant is not active', 400);
          }
          unitPrice = variant.price;
        }

        const total = round2(unitPrice * itemData.quantity);

        const item = await tx.saleItem.create({
          data: {
            saleId: checkoutId,
            productId: itemData.productId,
            variantId: itemData.variantId ?? null,
            quantity: itemData.quantity,
            unitPrice,
            total,
          },
          include: SALE_ITEM_INCLUDE,
        });

        const allItems = await tx.saleItem.findMany({
          where: { saleId: checkoutId },
          include: {
            product: { select: { taxRate: true } },
          },
        });
        const totals = computeCartTotals(
          allItems.map((i: any) => ({
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            taxRate: safeTaxRate(i.product.taxRate),
          })),
          0,
        );
        await tx.sale.update({
          where: { id: checkoutId },
          data: {
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SALE',
            entityId: checkoutId,
            userId,
            entityName: checkout.receiptNumber,
            changes: {
              action: 'ADD_ITEM',
              itemId: item.id,
              productId: itemData.productId,
              quantity: itemData.quantity,
              unitPrice,
            },
            severity: 'INFO',
          },
        });

        return item;
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.addCheckoutItem');
      throw error;
    }
  }

  async removeCheckoutItem(
    checkoutId: string,
    itemId: string,
    userId: string,
  ) {
    try {
      if (!checkoutId || !itemId) {
        throw new AppError('Checkout ID and Item ID are required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const checkout = await tx.sale.findUnique({
          where: { id: checkoutId },
        });
        if (!checkout) throw new AppError('Checkout not found', 404);
        if (checkout.status === 'COMPLETED') {
          throw new AppError(
            'Cannot remove item from completed checkout',
            400,
          );
        }
        if (checkout.status === 'CANCELLED') {
          throw new AppError(
            'Cannot remove item from cancelled checkout',
            400,
          );
        }

        const item = await tx.saleItem.findUnique({ where: { id: itemId } });
        if (!item) throw new AppError('Item not found', 404);
        if (item.saleId !== checkoutId) {
          throw new AppError('Item does not belong to this checkout', 400);
        }

        await tx.saleItem.delete({ where: { id: itemId } });

        const remaining = await tx.saleItem.findMany({
          where: { saleId: checkoutId },
          include: {
            product: { select: { taxRate: true } },
          },
        });
        const totals = computeCartTotals(
          remaining.map((i: any) => ({
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            taxRate: safeTaxRate(i.product.taxRate),
          })),
          0,
        );
        await tx.sale.update({
          where: { id: checkoutId },
          data: {
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SALE',
            entityId: checkoutId,
            userId,
            entityName: checkout.receiptNumber,
            changes: {
              action: 'REMOVE_ITEM',
              itemId,
              removedTotal: item.total,
            },
            severity: 'INFO',
          },
        });

        return { success: true, message: 'Item removed successfully' };
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.removeCheckoutItem');
      throw error;
    }
  }

  async updateCheckoutItem(
    checkoutId: string,
    itemId: string,
    quantity: number,
    userId: string,
  ) {
    try {
      if (!checkoutId || !itemId) {
        throw new AppError('Checkout ID and Item ID are required', 400);
      }
      if (quantity <= 0) {
        throw new AppError('Quantity must be positive', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const checkout = await tx.sale.findUnique({
          where: { id: checkoutId },
        });
        if (!checkout) throw new AppError('Checkout not found', 404);
        if (checkout.status === 'COMPLETED') {
          throw new AppError(
            'Cannot update item in completed checkout',
            400,
          );
        }
        if (checkout.status === 'CANCELLED') {
          throw new AppError(
            'Cannot update item in cancelled checkout',
            400,
          );
        }

        const item = await tx.saleItem.findUnique({ where: { id: itemId } });
        if (!item) throw new AppError('Item not found', 404);
        if (item.saleId !== checkoutId) {
          throw new AppError('Item does not belong to this checkout', 400);
        }

        const newTotal = round2(quantity * item.unitPrice);
        const updated = await tx.saleItem.update({
          where: { id: itemId },
          data: { quantity, total: newTotal },
          include: SALE_ITEM_INCLUDE,
        });

        const allItems = await tx.saleItem.findMany({
          where: { saleId: checkoutId },
          include: {
            product: { select: { taxRate: true } },
          },
        });
        const totals = computeCartTotals(
          allItems.map((i: any) => ({
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            taxRate: safeTaxRate(i.product.taxRate),
          })),
          0,
        );
        await tx.sale.update({
          where: { id: checkoutId },
          data: {
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SALE',
            entityId: checkoutId,
            userId,
            entityName: checkout.receiptNumber,
            changes: {
              action: 'UPDATE_ITEM',
              itemId,
              oldQuantity: item.quantity,
              newQuantity: quantity,
            },
            severity: 'INFO',
          },
        });

        return updated;
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.updateCheckoutItem');
      throw error;
    }
  }

  // ============================================
  // DISCOUNT OPERATIONS
  // ============================================

  async applyDiscount(
    checkoutId: string,
    discountCode: string,
    userId: string,
  ) {
    try {
      if (!checkoutId) throw new AppError('Checkout ID is required', 400);

      return await this.prisma.$transaction(async (tx: any) => {
        const checkout = await tx.sale.findUnique({
          where: { id: checkoutId },
        });
        if (!checkout) throw new AppError('Checkout not found', 404);

        const promotion = await tx.promotion.findFirst({
          where: {
            OR: [{ name: discountCode }, { code: discountCode }],
            isActive: true,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
        });

        if (!promotion) {
          throw new AppError('Invalid or expired discount code', 400);
        }

        let discountAmount = 0;
        if (promotion.type === 'PERCENTAGE') {
          discountAmount = round2(
            checkout.subtotal * (promotion.value / 100),
          );
          if (promotion.maxDiscount) {
            discountAmount = Math.min(
              discountAmount,
              promotion.maxDiscount,
            );
          }
        } else if (promotion.type === 'FIXED') {
          discountAmount = Math.min(
            promotion.value,
            checkout.subtotal,
          );
        } else {
          throw new AppError('Unsupported discount type', 400);
        }

        const total = round2(
          checkout.subtotal + checkout.tax - discountAmount,
        );

        const updated = await tx.sale.update({
          where: { id: checkoutId },
          data: {
            discount: discountAmount,
            discountType: String(promotion.type),
            promotionCode: discountCode,
            promotionDiscount: discountAmount,
            total: Math.max(0, total),
          },
          include: SALE_FULL_INCLUDE,
        });

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SALE',
            entityId: checkoutId,
            userId,
            entityName: checkout.receiptNumber,
            changes: {
              action: 'APPLY_DISCOUNT',
              discountCode,
              discountAmount,
              discountType: String(promotion.type),
            },
            severity: 'INFO',
          },
        });

        return updated;
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.applyDiscount');
      throw error;
    }
  }

  async removeDiscountFromCheckout(checkoutId: string, userId: string) {
    try {
      if (!checkoutId) throw new AppError('Checkout ID is required', 400);

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
      });
      if (!checkout) throw new AppError('Checkout not found', 404);

      const updated = await this.prisma.sale.update({
        where: { id: checkoutId },
        data: {
          discount: 0,
          discountType: null,
          promotionCode: null,
          promotionDiscount: 0,
          total: round2(checkout.subtotal + checkout.tax),
        },
        include: SALE_FULL_INCLUDE,
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SALE',
          entityId: checkoutId,
          userId,
          entityName: checkout.receiptNumber,
          changes: { action: 'REMOVE_DISCOUNT', removed: true },
          severity: 'INFO',
        },
      });

      return updated;
    } catch (error) {
      this.handleError(
        error,
        'CheckoutService.removeDiscountFromCheckout',
      );
      throw error;
    }
  }

  // ============================================
  // UPDATE / COMPLETE / CANCEL
  // ============================================

  async updateCheckout(checkoutId: string, data: any, userId: string) {
    try {
      if (!checkoutId) throw new AppError('Checkout ID is required', 400);

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
      });
      if (!checkout) throw new AppError('Checkout not found', 404);

      const updated = await this.prisma.sale.update({
        where: { id: checkoutId },
        data: { ...data, updatedAt: new Date() },
        include: SALE_FULL_INCLUDE,
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SALE',
          entityId: checkoutId,
          userId,
          entityName: checkout.receiptNumber,
          changes: data,
          severity: 'INFO',
        },
      });

      return updated;
    } catch (error) {
      this.handleError(error, 'CheckoutService.updateCheckout');
      throw error;
    }
  }

  async processPaymentForCheckout(
    checkoutId: string,
    paymentData: {
      paymentMethod: string;
      amount: number;
      paymentDetails?: any;
      userId: string;
    },
  ) {
    try {
      if (!checkoutId) throw new AppError('Checkout ID is required', 400);

      return await this.prisma.$transaction(async (tx: any) => {
        const checkout = await tx.sale.findUnique({
          where: { id: checkoutId },
          include: { payments: true },
        });
        if (!checkout) throw new AppError('Checkout not found', 404);
        if (checkout.status === 'COMPLETED') {
          throw new AppError('Checkout is already completed', 400);
        }
        if (checkout.status === 'CANCELLED') {
          throw new AppError('Checkout is cancelled', 400);
        }

        const buRecord = await tx.businessUnit.findUnique({
          where: { id: checkout.businessUnitId },
          select: { currency: true },
        });
        const resolvedCurrency = resolveBusinessUnitCurrency(
          buRecord?.currency,
        );

        const payment = await tx.payment.create({
          data: {
            amount: paymentData.amount,
            currency: resolvedCurrency,
            paymentMethod: normalizePaymentMethod(
              paymentData.paymentMethod,
            ) as any,
            status: 'PAID',
            saleId: checkoutId,
            userId: paymentData.userId,
            processedAt: new Date(),
            reference: `PAY-${checkout.receiptNumber}`,
            metadata: {
              currency: resolvedCurrency,
              paymentMethod: normalizePaymentMethod(
                paymentData.paymentMethod,
              ),
            },
          },
        });

        const totalPaid =
          checkout.payments.reduce(
            (acc: number, p: any) => acc + p.amount,
            0,
          ) + paymentData.amount;

        const paymentStatus =
          totalPaid >= checkout.total ? 'PAID' : 'PARTIAL';

        await tx.sale.update({
          where: { id: checkoutId },
          data: {
            paidAmount: totalPaid,
            paymentStatus,
            status:
              totalPaid >= checkout.total ? 'COMPLETED' : 'PROCESSING',
          },
        });

        return payment;
      });
    } catch (error) {
      this.handleError(
        error,
        'CheckoutService.processPaymentForCheckout',
      );
      throw error;
    }
  }

  async completeCheckout(checkoutId: string, userId: string) {
    try {
      if (!checkoutId) throw new AppError('Checkout ID is required', 400);

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
        include: { payments: true },
      });
      if (!checkout) throw new AppError('Checkout not found', 404);
      if (checkout.status === 'COMPLETED') {
        throw new AppError('Checkout is already completed', 400);
      }
      if (checkout.status === 'CANCELLED') {
        throw new AppError('Checkout is cancelled', 400);
      }

      const totalPaid = checkout.payments.reduce(
        (acc: number, p: any) => acc + p.amount,
        0,
      );
      if (totalPaid < checkout.total) {
        throw new AppError(
          `Insufficient payment. Required: ${checkout.total}, Paid: ${totalPaid}`,
          400,
        );
      }

      const completed = await this.prisma.sale.update({
        where: { id: checkoutId },
        data: {
          status: 'COMPLETED',
          paymentStatus: 'PAID',
        },
        include: SALE_FULL_INCLUDE,
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SALE',
          entityId: checkoutId,
          userId,
          entityName: checkout.receiptNumber,
          changes: { status: 'COMPLETED' },
          severity: 'INFO',
        },
      });

      return completed;
    } catch (error) {
      this.handleError(error, 'CheckoutService.completeCheckout');
      throw error;
    }
  }

  async cancelCheckout(
    checkoutId: string,
    userId: string,
    reason?: string,
  ) {
    try {
      if (!checkoutId) throw new AppError('Checkout ID is required', 400);

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
      });
      if (!checkout) throw new AppError('Checkout not found', 404);
      if (checkout.status === 'COMPLETED') {
        throw new AppError('Cannot cancel completed checkout', 400);
      }
      if (checkout.status === 'CANCELLED') {
        throw new AppError('Checkout is already cancelled', 400);
      }

      const cancelled = await this.prisma.sale.update({
        where: { id: checkoutId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
        include: SALE_FULL_INCLUDE,
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SALE',
          entityId: checkoutId,
          userId,
          entityName: checkout.receiptNumber,
          changes: { status: 'CANCELLED', reason },
          severity: 'LOW',
        },
      });

      return cancelled;
    } catch (error) {
      this.handleError(error, 'CheckoutService.cancelCheckout');
      throw error;
    }
  }

  async deleteCheckout(checkoutId: string, userId: string) {
    try {
      if (!checkoutId) throw new AppError('Checkout ID is required', 400);

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
        include: { items: true, payments: true },
      });
      if (!checkout) throw new AppError('Checkout not found', 404);
      if (checkout.status === 'COMPLETED') {
        throw new AppError(
          'Cannot delete completed checkout. Please void it first.',
          400,
        );
      }

      await this.prisma.$transaction(async (tx: any) => {
        if (checkout.payments.length > 0) {
          await tx.payment.deleteMany({ where: { saleId: checkoutId } });
        }
        if (checkout.items.length > 0) {
          await tx.saleItem.deleteMany({ where: { saleId: checkoutId } });
        }
        await tx.sale.delete({ where: { id: checkoutId } });

        await tx.auditLog.create({
          data: {
            action: 'DELETE',
            entityType: 'SALE',
            entityId: checkoutId,
            userId,
            entityName: checkout.receiptNumber,
            changes: { deleted: true },
            severity: 'LOW',
          },
        });
      });

      return { success: true, message: 'Checkout deleted successfully' };
    } catch (error) {
      this.handleError(error, 'CheckoutService.deleteCheckout');
      throw error;
    }
  }

  // ============================================
  // VOID
  // ============================================

  async voidCheckout(
    saleId: string,
    userId: string,
    reason?: string,
  ): Promise<any> {
    try {
      return await this.prisma.$transaction(async (tx: any) => {
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: { items: true, payments: true },
        });
        if (!sale) throw new AppError('Sale not found', 404);
        if (sale.status === 'VOID') {
          throw new AppError('Sale is already voided', 400);
        }

        const voidedSale = await tx.sale.update({
          where: { id: saleId },
          data: {
            status: 'VOID',
            voidedAt: new Date(),
            voidedBy: userId,
            voidReason: reason || 'Voided by user',
          },
        });

        for (const item of sale.items) {
          await applyInventoryDelta(tx, {
            productId: item.productId,
            variantId: item.variantId,
            businessUnitId: sale.businessUnitId,
            delta: item.quantity,
            reason: 'RESTOCK',
            referenceId: sale.id,
            notes: `Void sale ${sale.receiptNumber}`,
            userId,
            forbidNegative: false,
          });
        }

        await tx.payment.updateMany({
          where: { saleId },
          data: {
            status: 'REFUNDED',
            refundedAt: new Date(),
            refundReason: `Voided: ${reason || 'no reason given'}`,
            refundedBy: userId,
          },
        });

        if (sale.customerId) {
          const history = await tx.loyaltyHistory.findMany({
            where: { saleId },
          });

          let delta = 0;
          for (const h of history) {
            delta -= h.points;
          }

          if (delta !== 0) {
            await tx.customer.update({
              where: { id: sale.customerId },
              data: {
                loyaltyPoints: { increment: delta },
                totalSpent: { decrement: sale.total },
              },
            });

            await tx.loyaltyHistory.create({
              data: {
                customerId: sale.customerId,
                points: delta,
                type: 'ADJUSTMENT',
                notes: `Reversal of sale ${sale.receiptNumber} (void)`,
                saleId: sale.id,
                userId,
                businessUnitId: sale.businessUnitId,
              },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SALE',
            entityId: saleId,
            userId,
            entityName: sale.receiptNumber,
            changes: {
              action: 'VOID_SALE',
              reason,
              reversedPromotionCode: sale.promotionCode ?? null,
              reversedPromotionDiscount: sale.promotionDiscount ?? 0,
              reversedLoyaltyPointsUsed: sale.loyaltyPointsUsed ?? 0,
              reversedLoyaltyDiscount: sale.loyaltyDiscount ?? 0,
            },
            severity: 'HIGH',
          },
        });

        return voidedSale;
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.voidCheckout');
      throw error;
    }
  }

  // ============================================
  // RECEIPT EMAIL
  // ============================================

  async sendReceiptEmail(
    checkoutId: string,
    email: string | null,
    userId: string,
  ) {
    try {
      if (!checkoutId) throw new AppError('Checkout ID is required', 400);

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
        include: SALE_FULL_INCLUDE,
      });
      if (!checkout) throw new AppError('Checkout not found', 404);

      const recipientEmail =
        email || checkout.customer?.email || checkout.user?.email;
      if (!recipientEmail) {
        throw new AppError(
          'No email address available for receipt',
          400,
        );
      }

      logger.info(
        `📧 Sending receipt for ${checkout.receiptNumber} to ${recipientEmail}`,
      );

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SALE',
          entityId: checkoutId,
          userId,
          entityName: checkout.receiptNumber,
          changes: { email: recipientEmail, action: 'EMAIL_RECEIPT' },
          severity: 'INFO',
        },
      });

      return {
        success: true,
        message: `Receipt sent to ${recipientEmail}`,
        email: recipientEmail,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.sendReceiptEmail');
      throw error;
    }
  }

  // ============================================
  // HISTORY / STATS
  // ============================================

  async getCheckoutHistory(
    userId: string,
    filters?: {
      status?: string;
      customerId?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<CheckoutHistoryResult> {
    try {
      const page = filters?.page || 1;
      const limit = filters?.limit || 20;
      const offset = (page - 1) * limit;

      const where = this.buildWhereClause({
        ...filters,
        businessUnitId: undefined,
      });

      const [checkouts, total] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { saleDate: 'desc' },
          include: SALE_FULL_INCLUDE,
        }),
        this.prisma.sale.count({ where }),
      ]);

      return { checkouts, total, limit, offset };
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutHistory');
      throw error;
    }
  }

  async getCustomerCheckoutHistory(
    customerId: string,
    page = 1,
    limit = 20,
  ) {
    try {
      if (!customerId) throw new AppError('Customer ID is required', 400);

      const skip = (page - 1) * limit;

      const [history, total] = await Promise.all([
        this.prisma.sale.findMany({
          where: { customerId },
          take: limit,
          skip,
          orderBy: { saleDate: 'desc' },
          include: SALE_FULL_INCLUDE,
        }),
        this.prisma.sale.count({ where: { customerId } }),
      ]);

      return { history, total, page, limit };
    } catch (error) {
      this.handleError(
        error,
        'CheckoutService.getCustomerCheckoutHistory',
      );
      throw error;
    }
  }

  async getCheckoutStats(options: {
    userId: string;
    dateFrom?: Date;
    dateTo?: Date;
    businessUnitId?: string;
  }): Promise<CheckoutStats> {
    try {
      const { dateFrom, dateTo, businessUnitId } = options;

      const where: any = {};
      if (dateFrom || dateTo) {
        where.saleDate = {};
        if (dateFrom) where.saleDate.gte = dateFrom;
        if (dateTo) where.saleDate.lte = dateTo;
      }
      if (businessUnitId) where.businessUnitId = businessUnitId;
      where.status = 'COMPLETED';

      const sales = await this.prisma.sale.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
          payments: true,
        },
      });

      const totalSales = sales.length;
      const totalRevenue = round2(
        sales.reduce((acc: number, s: any) => acc + s.total, 0),
      );
      const totalTax = round2(
        sales.reduce((acc: number, s: any) => acc + (s.tax || 0), 0),
      );
      const totalDiscount = round2(
        sales.reduce(
          (acc: number, s: any) => acc + (s.discount || 0),
          0,
        ),
      );
      const averageOrderValue =
        totalSales > 0 ? round2(totalRevenue / totalSales) : 0;

      const productMap: Record<
        string,
        {
          productId: string;
          productName: string;
          quantity: number;
          revenue: number;
        }
      > = {};

      for (const sale of sales) {
        for (const item of sale.items) {
          const key = item.productId;
          if (!productMap[key]) {
            productMap[key] = {
              productId: item.productId,
              productName: item.product?.name || 'Unknown',
              quantity: 0,
              revenue: 0,
            };
          }
          productMap[key].quantity += item.quantity;
          productMap[key].revenue += item.total;
        }
      }

      const topProducts = Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const salesByPaymentMethod: Record<string, number> = {};
      for (const sale of sales) {
        for (const payment of sale.payments) {
          const method = payment.paymentMethod;
          salesByPaymentMethod[method] =
            (salesByPaymentMethod[method] || 0) + payment.amount;
        }
      }

      const dateMap: Record<string, { count: number; revenue: number }> =
        {};
      for (const sale of sales) {
        const date =
          sale.saleDate?.toISOString().split('T')[0] || '';
        if (!dateMap[date]) dateMap[date] = { count: 0, revenue: 0 };
        dateMap[date].count++;
        dateMap[date].revenue += sale.total;
      }

      const salesByDate = Object.entries(dateMap)
        .map(([date, data]) => ({
          date,
          count: data.count,
          revenue: round2(data.revenue),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const recentSales = sales.slice(0, 10);

      return {
        totalSales,
        totalRevenue,
        totalTax,
        totalDiscount,
        averageOrderValue,
        topProducts,
        salesByPaymentMethod,
        salesByDate,
        recentSales,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutStats');
      throw error;
    }
  }

  // ============================================
  // METADATA
  // ============================================

  async getPaymentMethods(
    businessUnitId?: string,
  ): Promise<PaymentMethod[]> {
    try {
      // Resolve the BU currency so we can filter methods by what the
      // registry says each gateway accepts. Without a BU, every
      // method is returned as-is (backwards compatible).
      let currency: string | null = null;
      if (businessUnitId) {
        const bu = await this.prisma.businessUnit.findUnique({
          where: { id: businessUnitId },
          select: { currency: true },
        });
        currency = resolveBusinessUnitCurrency(bu?.currency ?? null);
      }

      const accepts = (provider: string): boolean => {
        if (!currency) return true;
        // Offline and ledger-native methods are always enabled —
        // they transact in the ledger currency by definition.
        if (
          provider === 'CASH' ||
          provider === 'BANK_TRANSFER' ||
          provider === 'CHECK' ||
          provider === 'GIFT_CARD' ||
          provider === 'LOYALTY_POINTS'
        ) {
          return true;
        }
        return currencyService.providerAccepts(
          provider as SupportedProvider,
          currency,
        );
      };

      const mobileMoneyFor = (): string[] => {
        if (!currency) return [];
        return (
          currencyService.tryGetCurrency(currency)?.mobileMoneyProviders?.slice() ?? []
        );
      };

      const mmProviders = mobileMoneyFor();

      const all: PaymentMethod[] = [
        { id: 'CASH', name: 'Cash', code: 'CASH', enabled: true, description: 'Pay with cash' },
        { id: 'CARD', name: 'Card', code: 'CARD', enabled: accepts('STRIPE'), description: 'Pay with credit or debit card' },
        { id: 'CREDIT_CARD', name: 'Credit Card', code: 'CREDIT_CARD', enabled: accepts('STRIPE'), description: 'Pay with credit card' },
        { id: 'DEBIT_CARD', name: 'Debit Card', code: 'DEBIT_CARD', enabled: accepts('STRIPE'), description: 'Pay with debit card' },
        { id: 'MOBILE_MONEY', name: 'Mobile Money', code: 'MOBILE_MONEY', enabled: mmProviders.length > 0, description: 'Pay with mobile money' },
        { id: 'MPESA', name: 'M-Pesa', code: 'MPESA', enabled: mmProviders.includes('MPESA'), description: 'Pay with M-Pesa' },
        { id: 'MTN', name: 'MTN MoMo', code: 'MTN', enabled: mmProviders.includes('MTN'), description: 'Pay with MTN Mobile Money' },
        { id: 'AIRTEL', name: 'Airtel Money', code: 'AIRTEL', enabled: mmProviders.includes('AIRTEL'), description: 'Pay with Airtel Money' },
        { id: 'BANK_TRANSFER', name: 'Bank Transfer', code: 'BANK_TRANSFER', enabled: true, description: 'Pay via bank transfer' },
        { id: 'GIFT_CARD', name: 'Gift Card', code: 'GIFT_CARD', enabled: true, description: 'Pay with gift card' },
        { id: 'LOYALTY_POINTS', name: 'Loyalty Points', code: 'LOYALTY_POINTS', enabled: true, description: 'Pay with loyalty points' },
        { id: 'WALLET', name: 'Wallet', code: 'WALLET', enabled: mmProviders.length > 0, description: 'Pay with wallet balance' },
        { id: 'PAYPAL', name: 'PayPal', code: 'PAYPAL', enabled: accepts('PAYPAL'), description: 'Pay via PayPal' },
        { id: 'FLUTTERWAVE', name: 'Flutterwave', code: 'FLUTTERWAVE', enabled: accepts('FLUTTERWAVE'), description: 'Pay via Flutterwave' },
        { id: 'PAYSTACK', name: 'Paystack', code: 'PAYSTACK', enabled: accepts('PAYSTACK'), description: 'Pay via Paystack' },
        { id: 'SQUARE', name: 'Square', code: 'SQUARE', enabled: accepts('SQUARE'), description: 'Pay via Square' },
        { id: 'CHECK', name: 'Check', code: 'CHECK', enabled: true, description: 'Pay by check' },
      ];

      return all;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getPaymentMethods');
      throw error;
    }
  }

  async getCheckoutSettings(userId: string): Promise<CheckoutSettings> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          businessUnits: {
            where: { isActive: true },
            take: 1,
            include: {
              businessUnit: {
                select: {
                  id: true,
                  currency: true,
                  settings: true,
                },
              },
            },
          },
        },
      });

      const businessUnit = (user?.businessUnits?.[0] as any)
        ?.businessUnit as
        | { id: string; currency: string | null; settings: unknown }
        | undefined;

      const resolvedCurrency = resolveBusinessUnitCurrency(
        businessUnit?.currency ?? null,
      );

      const defaultSettings: CheckoutSettings = {
        allowPartialPayment: true,
        requireCustomer: false,
        requireSignature: false,
        maxDiscount: 50,
        taxInclusive: false,
        defaultPaymentMethod: 'CASH',
        receiptFooter: 'Thank you for your business!',
        loyaltyPointsEnabled: true,
        pointsPerDollar: 10,
        allowGuestCheckout: true,
        maxCartItems: 100,
        cartExpiryHours: 24,
        discountEnabled: true,
        maxDiscountPercentage: 20,
        autoApplyPromotions: false,
        reserveStockOnAdd: true,
        reserveStockMinutes: 15,
        lowStockThreshold: 5,
        freeShippingThreshold: 100,
        shippingCost: 0,
        taxRate: 8,
        notifyOnAbandonedCart: true,
        abandonedCartHours: 2,
        currencyCode: resolvedCurrency,
        showStockBadge: true,
        showVariantImages: true,
      };

      if (businessUnit?.settings && typeof businessUnit.settings === 'object') {
        const stored = {
          ...(businessUnit.settings as Record<string, unknown>),
        };
        delete (stored as any).currencySymbol;

        return {
          ...defaultSettings,
          ...stored,
        } as CheckoutSettings;
      }

      return defaultSettings;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutSettings');
      throw error;
    }
  }

  async updateCheckoutSettings(
    userId: string,
    settings: Partial<CheckoutSettings>,
  ): Promise<CheckoutSettings> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          businessUnits: {
            where: { isActive: true },
            take: 1,
            include: {
              businessUnit: {
                select: {
                  id: true,
                  settings: true,
                  currency: true,
                },
              },
            },
          },
        },
      });

      const businessUnit = (user?.businessUnits?.[0] as any)
        ?.businessUnit as
        | { id: string; settings: unknown; currency: string | null }
        | undefined;

      if (!businessUnit) {
        throw new AppError('User does not have a business unit', 400);
      }

      const existing =
        businessUnit.settings && typeof businessUnit.settings === 'object'
          ? (businessUnit.settings as Record<string, unknown>)
          : {};

      const existingClean = { ...existing };
      delete (existingClean as any).currencySymbol;

      const incomingClean = { ...(settings as Record<string, unknown>) };
      delete (incomingClean as any).currencySymbol;

      const merged = { ...existingClean, ...incomingClean };

      await this.prisma.businessUnit.update({
        where: { id: businessUnit.id },
        data: {
          settings: merged as any,
        },
      });

      const currentSettings = await this.getCheckoutSettings(userId);
      return {
        ...currentSettings,
        ...(incomingClean as Partial<CheckoutSettings>),
      };
    } catch (error) {
      this.handleError(
        error,
        'CheckoutService.updateCheckoutSettings',
      );
      throw error;
    }
  }

  // ============================================
  // EXPORT
  // ============================================

  async exportCheckouts(options: ExportOptions) {
    try {
      const { format, dateFrom, dateTo, businessUnitId } = options;

      const where: any = {};
      if (dateFrom || dateTo) {
        where.saleDate = {};
        if (dateFrom) where.saleDate.gte = dateFrom;
        if (dateTo) where.saleDate.lte = dateTo;
      }
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const checkouts = await this.prisma.sale.findMany({
        where,
        include: SALE_FULL_INCLUDE,
        orderBy: { saleDate: 'desc' },
      });

      if (format === 'csv') {
        const headers = [
          'Receipt Number',
          'Date',
          'Customer',
          'Currency',
          'Total',
          'Tax',
          'Discount',
          'Discount Type',
          'Promotion Code',
          'Promotion Discount',
          'Loyalty Points Used',
          'Loyalty Discount',
          'Charge Currency',
          'Charge Amount',
          'Charge Rate',
          'Payment Method',
          'Status',
          'Items Count',
          'Business Unit',
        ];

        const rows = checkouts.map((checkout: any) => {
          const firstPayment = checkout.payments?.[0];
          return [
            checkout.receiptNumber,
            checkout.saleDate?.toISOString() || '',
            checkout.customer?.firstName
              ? `${checkout.customer.firstName} ${checkout.customer.lastName}`
              : '',
            checkout.businessUnit?.currency ?? '',
            checkout.total.toFixed(2),
            (checkout.tax || 0).toFixed(2),
            (checkout.discount || 0).toFixed(2),
            checkout.discountType || '',
            checkout.promotionCode || '',
            (checkout.promotionDiscount || 0).toFixed(2),
            String(checkout.loyaltyPointsUsed ?? 0),
            (checkout.loyaltyDiscount || 0).toFixed(2),
            firstPayment?.gatewayCurrency ?? '',
            firstPayment?.gatewayAmount != null
              ? firstPayment.gatewayAmount.toFixed(2)
              : '',
            firstPayment?.exchangeRate != null
              ? String(firstPayment.exchangeRate)
              : '',
            firstPayment?.paymentMethod || '',
            checkout.status,
            checkout.items.length,
            checkout.businessUnit?.name || '',
          ];
        });

        let csv = headers.join(',') + '\n';
        rows.forEach((row: string[]) => {
          csv += row.join(',') + '\n';
        });
        return csv;
      }

      return {
        format: 'json',
        total: checkouts.length,
        data: checkouts,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.exportCheckouts');
      throw error;
    }
  }

  async exportCheckoutData(
    userId: string,
    options: {
      format?: 'csv' | 'json' | 'excel';
      startDate?: Date;
      endDate?: Date;
      status?: string;
    },
  ): Promise<string | Buffer | any> {
    try {
      const { format = 'csv', startDate, endDate, status } = options;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          businessUnits: {
            where: { isActive: true },
            take: 1,
            include: {
              businessUnit: { select: { id: true } },
            },
          },
        },
      });

      const businessUnit = (user?.businessUnits?.[0] as any)
        ?.businessUnit as { id: string } | undefined;

      const where: any = {};
      if (businessUnit?.id) {
        where.businessUnitId = businessUnit.id;
      }
      if (startDate || endDate) {
        where.saleDate = {};
        if (startDate) where.saleDate.gte = startDate;
        if (endDate) where.saleDate.lte = endDate;
      }
      if (status) where.status = status;

      const checkouts = await this.prisma.sale.findMany({
        where,
        include: SALE_FULL_INCLUDE,
        orderBy: { saleDate: 'desc' },
      });

      if (format === 'csv') {
        let csv =
          'Receipt Number,Date,Customer,Currency,Total,Charge Currency,Charge Amount,Status,Payment Method\n';
        for (const checkout of checkouts) {
          const customerName = checkout.customer
            ? `${checkout.customer.firstName} ${checkout.customer.lastName}`
            : 'Guest';
          const firstPayment = checkout.payments?.[0];
          const paymentMethod = firstPayment?.paymentMethod || 'N/A';
          const chargeCurrency = firstPayment?.gatewayCurrency || '';
          const chargeAmount =
            firstPayment?.gatewayAmount != null
              ? String(firstPayment.gatewayAmount)
              : '';
          csv += `${checkout.receiptNumber},${
            checkout.saleDate?.toISOString() || ''
          },${customerName},${checkout.businessUnit?.currency ?? ''},${
            checkout.total
          },${chargeCurrency},${chargeAmount},${checkout.status},${paymentMethod}\n`;
        }
        return csv;
      }

      return {
        format,
        total: checkouts.length,
        data: checkouts,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.exportCheckoutData');
      throw error;
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const checkoutService = new CheckoutService();

export default CheckoutService;
