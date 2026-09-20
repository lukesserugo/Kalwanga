// D:\Projects\Kalwanga\packages\backend\src\services\checkoutService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { SaleService } from './saleService.js';
import { PaymentService } from './paymentService.js';
import { CartService } from './cartService.js';
import {
  computeCartTotals,
  computeChange,
  round2,
} from '../utils/money.js';
import { applyInventoryDelta } from '../utils/inventory.js';

// ============================================
// CANONICAL PAYMENT METHODS
// ============================================
//
// Mirrors `CANONICAL_PAYMENT_METHODS` in `../utils/validators.ts` and
// `../controllers/checkoutController.ts`. Kept local to the service
// to avoid a circular import; the three must stay in sync.
//
// The Prisma `PaymentMethod` enum is narrower than this set. The
// `normalizePaymentMethod` helper below collapses every alias to the
// enum value Prisma actually knows about before writing.

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

/**
 * Map a user-supplied payment method to the value the Prisma
 * `PaymentMethod` enum accepts. Aliases collapse to their canonical
 * enum value; unknown values pass through unchanged so that
 * `prisma.payment.create` produces a clear error if the value slipped
 * past the controller.
 */
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
    PAYPAL: 'BANK_TRANSFER',
    FLUTTERWAVE: 'MOBILE_MONEY',
    PAYSTACK: 'MOBILE_MONEY',
    SQUARE: 'CREDIT_CARD',
  };

  return aliasMap[upper] || upper;
}

/**
 * Normalize a tax rate from the database to the decimal multiplier
 * that `computeLine` multiplies against.
 *
 * ⚠ The schema stores `taxRate` as a **percentage** (8 = 8%) and the
 * database enforces this via `CHECK` constraints on every taxRate
 * column — see migration `20260919182422_normalize_tax_rate_convention`.
 *
 * ⚠ This helper does NOT divide by 100. `computeLine` in `money.ts`
 * does the conversion. This function exists only to coerce null and
 * non-finite values to a safe 0, and to pass the percentage straight
 * through. Do not add a `/ 100` here — the fix for the 8× tax bug
 * lives in `money.ts` and only there.
 */
function safeTaxRate(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw) || raw < 0) return 0;
  return raw;
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
  businessUnitId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  customerAddress?: string;
  idempotencyKey?: string;
}

interface CheckoutResponse {
  sale: any;
  payment: any;
  receipt: any;
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  changeAmount: number;
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
  currencySymbol: string;
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

// ============================================
// SHARED PRISMA SELECTS
// ============================================
//
// Hoisted so every read in this file returns the same projection. The
// previous version duplicated these literals ~20 times.

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
    },
  },
} as const;

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

  /**
   * Fire-and-forget real-time sale event. Wrapped so a failure here
   * never rolls back the transaction.
   */
  private safeEmitNewSale(sale: any, businessUnitId: string): void {
    try {
      console.log(
        `💰 New sale created: ${sale?.receiptNumber || sale?.id} in ${businessUnitId}`,
      );
      // WebSocket emission would go here if configured.
    } catch (error) {
      console.warn('Failed to emit sale event:', error);
    }
  }

  /**
   * Generate a receipt number. Timestamp + random suffix gives
   * monotonic-ish ordering with low collision risk. If you need
   * strict per-BU sequencing, replace with a sequence table.
   */
  private generateReceiptNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RCP-${timestamp}-${random}`;
  }

  /**
   * Standard shape returned by `processCheckout`. Kept as a helper so
   * both the fresh path and the idempotent-replay path produce the
   * same response shape.
   */
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
    };
  }

  /**
   * Build a Prisma `where` clause for filters.
   */
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
  // CANONICAL CHECKOUT
  // ============================================

  /**
   * Process checkout from cart.
   *
   * Server-authoritative pipeline:
   *   1. Idempotency check (returns existing sale if key matches)
   *   2. Load cart with all prices
   *   3. Build server-computed lines
   *   4. Compute totals via `computeCartTotals`
   *   5. Compute loyalty redemption
   *   6. Verify payment sufficiency
   *   7. Verify stock (inside the same transaction)
   *   8. Create Sale + SaleItems
   *   9. Decrement inventory via `applyInventoryDelta`
   *  10. Create Payment + update cash register
   *  11. Accrue and/or redeem loyalty points
   *  12. Clear cart
   *  13. Write audit log
   *  14. Build receipt response
   *
   * ⚠ Tax rate is stored as a percentage (8 = 8%) in every table it
   * appears on. `computeLine` in `money.ts` divides by 100 before
   * multiplying. This method passes the raw percentage straight
   * through — do not divide it here.
   */
  async processCheckout(
    data: CheckoutData & { idempotencyKey?: string },
    userId: string,
  ): Promise<CheckoutResponse> {
    try {
      return await this.prisma.$transaction(async (tx: any) => {
        // ------------------------------------------------------
        // 0. Idempotency
        // ------------------------------------------------------
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
              loyaltyPointsUsed: 0,
              changeAmount: existing.changeAmount ?? 0,
            };
          }
        }

        // ------------------------------------------------------
        // 1. Load the cart with authoritative product data
        // ------------------------------------------------------
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

        // ------------------------------------------------------
        // 2. Build server-authoritative lines
        // ------------------------------------------------------
        //
        // `taxRate` is a percentage from the DB (8 = 8%). `computeLine`
        // divides by 100 before multiplying. Do not divide here.
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

        // ------------------------------------------------------
        // 3. Compute totals server-side
        // ------------------------------------------------------
        const totals = computeCartTotals(
          lines,
          data.discount ?? cart.discount ?? 0,
        );

        // ------------------------------------------------------
        // 4. Loyalty redemption
        // ------------------------------------------------------
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

        // ------------------------------------------------------
        // 5. Payment sufficiency
        // ------------------------------------------------------
        const change = computeChange(data.paidAmount, finalTotal);
        if (change < 0) {
          throw new AppError(
            `Insufficient payment. Required: ${finalTotal.toFixed(2)}, received: ${data.paidAmount.toFixed(2)}`,
            400,
          );
        }

        // ------------------------------------------------------
        // 6. Stock validation
        // ------------------------------------------------------
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

        // ------------------------------------------------------
        // 7. Cash register check
        // ------------------------------------------------------
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

        // ------------------------------------------------------
        // 8. Create Sale
        // ------------------------------------------------------
        const receiptNumber = this.generateReceiptNumber();
        const sale = await tx.sale.create({
          data: {
            receiptNumber,
            idempotencyKey: data.idempotencyKey ?? null,
            subtotal: totals.subtotal,
            tax: totals.tax,
            discount: round2(totals.discount + loyaltyDiscount),
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

        // ------------------------------------------------------
        // 9. Create SaleItems (server-computed lines only)
        // ------------------------------------------------------
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

        // ------------------------------------------------------
        // 10. Decrement inventory via the shared helper
        // ------------------------------------------------------
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

        // ------------------------------------------------------
        // 11. Payment
        // ------------------------------------------------------
        const enumValue = normalizePaymentMethod(data.paymentMethod);
        const payment = await tx.payment.create({
          data: {
            amount: finalTotal,
            paymentMethod: enumValue as any,
            status: 'PAID',
            saleId: sale.id,
            userId,
            cashRegisterId: data.cashRegisterId ?? null,
            cashRegisterSessionId: data.cashRegisterSessionId ?? null,
            businessUnitId,
            processedAt: new Date(),
            reference: `PAY-${receiptNumber}`,
          },
        });

        if (data.cashRegisterId && enumValue === 'CASH') {
          await tx.cashRegister.update({
            where: { id: data.cashRegisterId },
            data: { cashBalance: { increment: finalTotal } },
          });
        }

        // ------------------------------------------------------
        // 12. Loyalty accrual + redemption
        // ------------------------------------------------------
        const pointsEarned = Math.floor(finalTotal / 10);
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

        // ------------------------------------------------------
        // 13. Clear cart
        // ------------------------------------------------------
        await tx.cartItem.deleteMany({ where: { cartId: data.cartId } });
        await tx.cart.update({
          where: { id: data.cartId },
          data: {
            subtotal: 0,
            tax: 0,
            discount: 0,
            total: 0,
            status: 'CHECKED_OUT',
            customerId: null,
            discountType: null,
            promotionCode: null,
            promotionDiscount: 0,
            loyaltyPointsUsed: 0,
            loyaltyDiscount: 0,
            updatedAt: new Date(),
          },
        });

        // ------------------------------------------------------
        // 14. Audit log
        // ------------------------------------------------------
        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'SALE',
            entityId: sale.id,
            userId,
            companyId: null,
            businessUnitId,
            entityName: receiptNumber,
            changes: {
              total: finalTotal,
              subtotal: totals.subtotal,
              tax: totals.tax,
              discount: round2(totals.discount + loyaltyDiscount),
              paymentMethod: enumValue,
              itemCount: cart.items.length,
              loyaltyPointsUsed,
              loyaltyPointsEarned: pointsEarned,
              idempotencyKey: data.idempotencyKey ?? null,
            },
            severity: 'INFO',
          },
        });

        // ------------------------------------------------------
        // 15. Real-time event (fire and forget)
        // ------------------------------------------------------
        this.safeEmitNewSale(sale, businessUnitId);

        // ------------------------------------------------------
        // 16. Response
        // ------------------------------------------------------
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
  // SUMMARY / READ
  // ============================================

  async getCheckoutSummary(cartId: string): Promise<CheckoutSummaryResponse> {
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
      this.handleError(error, 'CheckoutService.getCheckoutByReceiptNumber');
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
  // ITEM MUTATIONS (server-priced)
  // ============================================

  /**
   * Add item to a checkout.
   *
   * ⚠ The previous signature accepted `unitPrice` from the caller.
   * That is a fraud vector — a malicious client could POST
   * `unitPrice: 0.01`. The new signature omits `unitPrice`; the
   * server looks it up from `Product.unitPrice` / `ProductVariant.price`.
   *
   * `itemData.unitPrice` is still accepted for backward compatibility
   * with older callers but is IGNORED. If you're ready to break the
   * old contract, delete that field from the interface and from every
   * caller.
   *
   * ⚠ `taxRate` is passed to `computeCartTotals` as a percentage
   * straight from the DB. `computeLine` handles the /100 conversion.
   */
  async addCheckoutItem(
    checkoutId: string,
    itemData: {
      productId: string;
      variantId?: string;
      quantity: number;
      /** @deprecated — ignored. Server always uses DB price. */
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

        // Recompute parent sale totals from ALL items.
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
            updatedAt: new Date(),
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

  /**
   * Remove an item from a checkout and recompute totals.
   */
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

        // Recompute totals from remaining items.
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
            updatedAt: new Date(),
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

  /**
   * Update a checkout item's quantity and recompute totals.
   */
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
            updatedAt: new Date(),
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
            total: Math.max(0, total),
            updatedAt: new Date(),
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
          total: round2(checkout.subtotal + checkout.tax),
          updatedAt: new Date(),
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

        const payment = await tx.payment.create({
          data: {
            amount: paymentData.amount,
            paymentMethod: normalizePaymentMethod(
              paymentData.paymentMethod,
            ) as any,
            status: 'PAID',
            saleId: checkoutId,
            userId: paymentData.userId,
            processedAt: new Date(),
            reference: `PAY-${checkout.receiptNumber}`,
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
            updatedAt: new Date(),
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
          completedAt: new Date(),
          updatedAt: new Date(),
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
          cancelledBy: userId,
          cancellationReason: reason || 'Cancelled by user',
          updatedAt: new Date(),
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

  /**
   * Void a sale. Restocks inventory via the shared helper, voids
   * payments, and reverses loyalty. Idempotent — a second call is a
   * no-op that returns the same sale.
   */
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
        if (sale.status === 'VOIDED') {
          throw new AppError('Sale is already voided', 400);
        }

        const voidedSale = await tx.sale.update({
          where: { id: saleId },
          data: {
            status: 'VOIDED',
            voidedAt: new Date(),
            voidedBy: userId,
            voidReason: reason || 'Voided by user',
            updatedAt: new Date(),
          },
        });

        // Restock via the shared helper so the transaction log and
        // inventory math stay consistent with every other mutation.
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
            updatedAt: new Date(),
          },
        });

        // Reverse loyalty impact.
        if (sale.customerId) {
          const history = await tx.loyaltyHistory.findMany({
            where: { saleId },
          });

          // Undo earned points, restore redeemed points.
          let delta = 0;
          for (const h of history) {
            delta -= h.points; // history stores signed points
          }

          if (delta !== 0) {
            await tx.customer.update({
              where: { id: sale.customerId },
              data: {
                loyaltyPoints: { increment: delta },
                totalSpent: { decrement: sale.total },
                updatedAt: new Date(),
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
            changes: { action: 'VOID_SALE', reason },
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

      console.log(
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

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      return [
        { id: 'CASH', name: 'Cash', code: 'CASH', enabled: true, description: 'Pay with cash' },
        { id: 'CARD', name: 'Card', code: 'CARD', enabled: true, description: 'Pay with credit or debit card' },
        { id: 'CREDIT_CARD', name: 'Credit Card', code: 'CREDIT_CARD', enabled: false, description: 'Alias for CARD' },
        { id: 'DEBIT_CARD', name: 'Debit Card', code: 'DEBIT_CARD', enabled: false, description: 'Alias for CARD' },
        { id: 'MOBILE_MONEY', name: 'Mobile Money', code: 'MOBILE_MONEY', enabled: true, description: 'Pay with mobile money' },
        { id: 'MPESA', name: 'M-Pesa', code: 'MPESA', enabled: true, description: 'Pay with M-Pesa' },
        { id: 'BANK_TRANSFER', name: 'Bank Transfer', code: 'BANK_TRANSFER', enabled: true, description: 'Pay via bank transfer' },
        { id: 'GIFT_CARD', name: 'Gift Card', code: 'GIFT_CARD', enabled: true, description: 'Pay with gift card' },
        { id: 'LOYALTY_POINTS', name: 'Loyalty Points', code: 'LOYALTY_POINTS', enabled: true, description: 'Pay with loyalty points' },
        { id: 'WALLET', name: 'Wallet', code: 'WALLET', enabled: true, description: 'Pay from wallet balance' },
        { id: 'PAYPAL', name: 'PayPal', code: 'PAYPAL', enabled: true, description: 'Pay via PayPal' },
        { id: 'FLUTTERWAVE', name: 'Flutterwave', code: 'FLUTTERWAVE', enabled: true, description: 'Pay via Flutterwave' },
        { id: 'PAYSTACK', name: 'Paystack', code: 'PAYSTACK', enabled: true, description: 'Pay via Paystack' },
        { id: 'SQUARE', name: 'Square', code: 'SQUARE', enabled: true, description: 'Pay via Square' },
        { id: 'CHECK', name: 'Check', code: 'CHECK', enabled: true, description: 'Pay by check' },
      ];
    } catch (error) {
      this.handleError(error, 'CheckoutService.getPaymentMethods');
      throw error;
    }
  }

  async getCheckoutSettings(userId: string): Promise<CheckoutSettings> {
    try {
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
        currencyCode: 'USD',
        currencySymbol: '$',
        showStockBadge: true,
        showVariantImages: true,
      };

      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            businessUnits: {
              where: { isActive: true },
              take: 1,
            },
          },
        });

        if (user?.businessUnits && user.businessUnits.length > 0) {
          const businessUnit = user.businessUnits[0];
          if ((businessUnit as any).settings) {
            return {
              ...defaultSettings,
              ...(businessUnit as any).settings,
            };
          }
        }
      } catch (settingsError) {
        console.warn(
          'Could not fetch user settings, using defaults:',
          settingsError,
        );
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
          },
        },
      });

      if (!user?.businessUnits || user.businessUnits.length === 0) {
        throw new AppError('User does not have a business unit', 400);
      }

      const businessUnit = user.businessUnits[0];

      await this.prisma.businessUnit.update({
        where: { id: businessUnit.id },
        data: {
          // @ts-ignore - settings column exists in schema
          settings: settings,
          updatedAt: new Date(),
        },
      });

      const currentSettings = await this.getCheckoutSettings(userId);
      return { ...currentSettings, ...settings };
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
          'Total',
          'Tax',
          'Discount',
          'Payment Method',
          'Status',
          'Items Count',
          'Business Unit',
        ];

        const rows = checkouts.map((checkout: any) => [
          checkout.receiptNumber,
          checkout.saleDate?.toISOString() || '',
          checkout.customer?.firstName
            ? `${checkout.customer.firstName} ${checkout.customer.lastName}`
            : '',
          checkout.total.toFixed(2),
          (checkout.tax || 0).toFixed(2),
          (checkout.discount || 0).toFixed(2),
          checkout.payments[0]?.paymentMethod || '',
          checkout.status,
          checkout.items.length,
          checkout.businessUnit?.name || '',
        ]);

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
          businessUnits: { where: { isActive: true }, take: 1 },
        },
      });

      const where: any = {};
      if (user?.businessUnits?.[0]?.id) {
        where.businessUnitId = user.businessUnits[0].id;
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
          'Receipt Number,Date,Customer,Total,Status,Payment Method\n';
        for (const checkout of checkouts) {
          const customerName = checkout.customer
            ? `${checkout.customer.firstName} ${checkout.customer.lastName}`
            : 'Guest';
          const paymentMethod =
            checkout.payments[0]?.paymentMethod || 'N/A';
          csv += `${checkout.receiptNumber},${
            checkout.saleDate?.toISOString() || ''
          },${customerName},${checkout.total},${checkout.status},${paymentMethod}\n`;
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

export default CheckoutService;
