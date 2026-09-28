// packages/backend/src/controllers/checkoutController.ts

import { Request, Response, NextFunction } from 'express';
import { CheckoutService } from '../services/checkoutService.js';
import { CartService } from '../services/cartService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { z } from 'zod';

// ============================================
// SHARED SCHEMAS
// ============================================
//
// The canonical checkout schemas live in the shared package so
// every consumer (this controller, the mobile app, the web app)
// validates against the exact same shape. This file no longer
// re-declares them.

import {
  createCheckoutSchema,
  onlineCheckoutSchema,
  voidCheckoutSchema,
  getCheckoutsSchema,
  addCheckoutItemSchema,
  updateCheckoutItemSchema,
  applyDiscountSchema,
  mobileMoneyProviderSchema,
  DISCOUNT_TYPE_VALUES,
} from '../../../shared/src/schemas/checkout.js';

const checkoutService = new CheckoutService();
const cartService = new CartService();

// ============================================
// CANONICAL PAYMENT METHODS
// ============================================
//
// The alias map is controller-local on purpose — the routes in
// `../routes/checkout.ts` were written against this exact list,
// and the shared package's `paymentMethodSchema` uses a stricter
// canonical set. Keeping this local preserves the existing
// alias-tolerance (CARD → CREDIT_CARD, MOBILE → MOBILE_MONEY, …)
// without widening the shared schema.

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

const paymentMethodSchema = z
  .string()
  .min(1, 'Payment method is required')
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => CANONICAL_PAYMENT_METHODS_SET.has(v), {
    message: `Unsupported payment method. Accepted: ${CANONICAL_PAYMENT_METHODS.join(
      ', ',
    )}`,
  });

// ============================================
// LOCAL SCHEMAS
// ============================================
//
// Settings validation. The service does read-modify-write on the
// business unit's `settings` JSON, but the shape itself is not
// validated there. This schema bounds the allowed keys and value
// types so a caller can't persist arbitrary JSON.

const updateCheckoutSettingsSchema = z
  .object({
    allowPartialPayment: z.boolean().optional(),
    requireCustomer: z.boolean().optional(),
    requireSignature: z.boolean().optional(),
    maxDiscount: z.number().min(0).max(100).optional(),
    taxInclusive: z.boolean().optional(),
    defaultPaymentMethod: paymentMethodSchema.optional(),
    receiptFooter: z.string().max(500).optional(),
    loyaltyPointsEnabled: z.boolean().optional(),
    pointsPerDollar: z.number().int().nonnegative().optional(),
    allowGuestCheckout: z.boolean().optional(),
    maxCartItems: z.number().int().positive().optional(),
    cartExpiryHours: z.number().int().positive().optional(),
    discountEnabled: z.boolean().optional(),
    maxDiscountPercentage: z.number().min(0).max(100).optional(),
    autoApplyPromotions: z.boolean().optional(),
    reserveStockOnAdd: z.boolean().optional(),
    reserveStockMinutes: z.number().int().positive().optional(),
    lowStockThreshold: z.number().int().nonnegative().optional(),
    freeShippingThreshold: z.number().nonnegative().optional(),
    shippingCost: z.number().nonnegative().optional(),
    taxRate: z.number().min(0).max(100).optional(),
    notifyOnAbandonedCart: z.boolean().optional(),
    abandonedCartHours: z.number().int().positive().optional(),
    currencyCode: z.string().length(3).optional(),
    currencySymbol: z.string().max(8).optional(),
    showStockBadge: z.boolean().optional(),
    showVariantImages: z.boolean().optional(),
  })
  .strict();

// Split-payment body (added after the initial checkout). This is
// NOT the gateway entry point — that is `createOnlineCheckout`.

const processCheckoutPaymentSchema = z.object({
  paymentMethod: paymentMethodSchema,
  amount: z.number().finite().positive(),
  paymentDetails: z.unknown().optional(),
});

// ============================================
// HELPERS
// ============================================

function zodErrorResponse(error: z.ZodError) {
  return {
    success: false,
    message: 'Validation error',
    errors: error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    })),
  };
}

function getUserId(req: Request): string | undefined {
  return (req as any).user?.id ?? (req as any).user?.userId;
}

function getCompanyId(req: Request): string | undefined {
  return (
    (req as any).user?.companyId ??
    (req as any).user?.company?.id ??
    undefined
  );
}

function resolveCartId(req: Request): string | undefined {
  const { cartId, id } = req.params as {
    cartId?: string;
    id?: string;
  };
  return cartId ?? id ?? undefined;
}

/**
 * Read a numeric HTTP status code off an unknown error value.
 *
 * Walks the `.cause` chain (cycle-safe) because axios, undici, the
 * Stripe SDK, and Node network errors attach the status to the
 * wrapped error rather than the top-level one. Returns `undefined`
 * when nothing on the chain carries a positive finite number.
 */
function getErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const seen = new Set<unknown>();
  let node: any = error;

  while (node && typeof node === 'object' && !seen.has(node)) {
    seen.add(node);

    const candidates = [
      node.status,
      node.statusCode,
      node.response?.status,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === 'number' &&
        Number.isFinite(candidate) &&
        candidate > 0
      ) {
        return candidate;
      }
    }

    node = node.cause;
  }

  return undefined;
}

/**
 * Coerce a query-string or numeric value to a bounded integer.
 * Returns `fallback` when the input can't be parsed.
 */
function toInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Normalize an incoming checkout body: accept snake_case aliases,
 * coerce stringified numbers, and return a canonical object the
 * Zod schema can validate.
 *
 * The list of accepted aliases is intentionally broad so the
 * endpoint is forgiving of client-side drift. The controller still
 * reports exactly which canonical field is missing if one is absent.
 */
function normalizeCheckoutBody(body: any) {
  const b = body ?? {};

  const normalized: any = {
    cartId: b.cartId ?? b.cart_id ?? b.cart?.id,
    customerId: b.customerId ?? b.customer_id ?? undefined,
    paymentMethod: b.paymentMethod ?? b.payment_method ?? undefined,
    paidAmount: b.paidAmount ?? b.paid_amount ?? b.amount ?? undefined,
    discount: b.discount,
    notes: b.notes,
    cashRegisterId: b.cashRegisterId ?? b.cash_register_id ?? undefined,
    cashRegisterSessionId:
      b.cashRegisterSessionId ?? b.cash_register_session_id ?? undefined,
    applyLoyaltyPoints:
      b.applyLoyaltyPoints ?? b.apply_loyalty_points ?? false,
    businessUnitId: b.businessUnitId ?? b.business_unit_id ?? undefined,
    customerEmail: b.customerEmail ?? b.customer_email ?? undefined,
    customerPhone: b.customerPhone ?? b.customer_phone ?? undefined,
    customerName: b.customerName ?? b.customer_name ?? undefined,
    customerAddress: b.customerAddress ?? b.customer_address ?? undefined,
    idempotencyKey: b.idempotencyKey ?? b.idempotency_key ?? undefined,

    // Gateway-specific
    returnUrl: b.returnUrl ?? b.return_url ?? undefined,
    cancelUrl: b.cancelUrl ?? b.cancel_url ?? undefined,
    cardNonce: b.cardNonce ?? b.card_nonce ?? undefined,
    paymentMethodId:
      b.paymentMethodId ?? b.payment_method_id ?? undefined,

    // Gift-card specific. The frontend sends the same code under
    // both keys; the service reads either, so we preserve both here.
    giftCardCode: b.giftCardCode ?? b.gift_card_code ?? undefined,
    gatewayId: b.gatewayId ?? b.gateway_id ?? undefined,

    // Mobile-money provider selector. Normalize the value to
    // uppercase so a lowercase `'mtn'` still validates.
    mobileMoneyProvider: (() => {
      const raw =
        b.mobileMoneyProvider ??
        b.mobile_money_provider ??
        undefined;
      if (raw === undefined || raw === null) return undefined;
      if (typeof raw !== 'string') return raw;
      return raw.trim().toUpperCase();
    })(),

    // Promotion / loyalty passthrough
    discountType: b.discountType ?? b.discount_type ?? undefined,
    promotionCode: b.promotionCode ?? b.promotion_code ?? undefined,
    promotionDiscount:
      b.promotionDiscount ?? b.promotion_discount ?? undefined,
  };

  // Coerce numeric strings
  if (typeof normalized.paidAmount === 'string') {
    const parsed = Number(normalized.paidAmount);
    if (Number.isFinite(parsed)) normalized.paidAmount = parsed;
  }
  if (typeof normalized.promotionDiscount === 'string') {
    const parsed = Number(normalized.promotionDiscount);
    if (Number.isFinite(parsed)) normalized.promotionDiscount = parsed;
  }

  return normalized;
}

/**
 * Report the fields that must be present on a create-checkout body.
 * Extracted so both create handlers use the same list and produce
 * the same "Required" shape.
 */
function findMissingCreateFields(
  normalized: any,
  opts: { requirePaidAmount: boolean },
): string[] {
  const missing: string[] = [];
  if (!normalized.cartId) missing.push('cartId');
  if (!normalized.paymentMethod) missing.push('paymentMethod');
  if (
    opts.requirePaidAmount &&
    (normalized.paidAmount === undefined ||
      normalized.paidAmount === null)
  ) {
    missing.push('paidAmount');
  }
  return missing;
}

/**
 * Read the first present value from a set of query-param aliases.
 * Used by the two export endpoints so clients can use either the
 * `dateFrom`/`dateTo` naming (from `getCheckouts`) or the
 * `startDate`/`endDate` naming (from `getCheckoutHistory`).
 */
function pickQueryString(
  query: Record<string, unknown>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = query[name];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return undefined;
}

// ============================================
// CHECKOUT CONTROLLER
// ============================================

export const checkoutController = {
  // ============================================
  // CREATE — OFFLINE (POS / CASH)
  // ============================================
  //
  // Records a completed sale for an already-tendered payment. Only
  // supports cash / bank transfer / check. Card, PayPal, Flutterwave,
  // Paystack, Square, and Mobile Money are rejected here with a
  // clear message pointing at POST /checkout/online.

  async createCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      if (!userId) throw new AppError('User ID is required', 400);

      logger.info('🧾 POST /checkout payload received', {
        keys: Object.keys(req.body ?? {}),
        cartId: req.body?.cartId ?? req.body?.cart_id,
      });

      const normalized = normalizeCheckoutBody(req.body);

      const missing = findMissingCreateFields(normalized, {
        requirePaidAmount: true,
      });
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: missing.map((field) => ({
            field,
            message: 'Required',
          })),
          received: Object.keys(req.body ?? {}),
        });
      }

      const validatedData = createCheckoutSchema.parse(normalized);

      // Advisory early-out. The authoritative ownership check runs
      // inside the service's transaction; this just produces a
      // clean 403/404 before we open one.
      const cart = await cartService.getCartById(validatedData.cartId);
      if (!cart) throw new AppError('Cart not found', 404);
      if (cart.userId !== userId) {
        throw new AppError('Cart does not belong to this user', 403);
      }

      // Ignore any caller-supplied `businessUnitId`. The cart's own
      // BU is authoritative; letting a client pick a different one
      // opens a cross-BU write surface (stock checks, currency,
      // audit row, Sale.businessUnitId).
      const result = await checkoutService.processCheckout(
        {
          cartId: validatedData.cartId,
          customerId: validatedData.customerId,
          paymentMethod: validatedData.paymentMethod,
          paidAmount: validatedData.paidAmount,
          discount: validatedData.discount,
          notes: validatedData.notes,
          cashRegisterId: validatedData.cashRegisterId,
          cashRegisterSessionId: validatedData.cashRegisterSessionId,
          applyLoyaltyPoints: validatedData.applyLoyaltyPoints,
          businessUnitId: undefined,
          customerEmail: validatedData.customerEmail,
          customerPhone: validatedData.customerPhone,
          customerName: validatedData.customerName,
          customerAddress: validatedData.customerAddress,
          idempotencyKey: validatedData.idempotencyKey,
          discountType: validatedData.discountType ?? null,
          promotionCode: validatedData.promotionCode ?? null,
          promotionDiscount: validatedData.promotionDiscount,
        },
        userId,
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Checkout completed successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          ...zodErrorResponse(error),
          received: Object.keys(req.body ?? {}),
        });
      }
      next(error);
    }
  },

  // ============================================
  // CREATE — ONLINE (GATEWAY-BACKED)
  // ============================================
  //
  // The public web checkout entry point. Creates a PENDING Sale +
  // PENDING Payment, calls the gateway, and returns a `nextAction`
  // the frontend switches on:
  //
  //   CONFIRM_STRIPE  → frontend confirms with Stripe.js
  //   REDIRECT        → window.location.href = url
  //   AWAIT_STK_PUSH  → poll /checkout/:saleId until COMPLETED
  //   OFFLINE         → show "awaiting confirmation" screen
  //   NONE            → sale already complete (idempotent replay)
  //
  // ⚠ `paidAmount` is NOT read from the body. The total is entirely
  //   server-computed from the cart + product prices + loyalty.
  //
  // ⚠ On gateway failure the sale is marked CANCELLED, inventory is
  //   restored, and the service re-throws with the provider's own
  //   status code and message. This controller forwards that status
  //   verbatim.
  //
  // ── Idempotency semantics ──────────────────────────────────
  //
  // The service short-circuits when the incoming `idempotencyKey`
  // matches an existing Sale. The reply shape depends on the
  // matched Sale's status:
  //
  //   PENDING / PROCESSING  → 201 with `nextAction: OFFLINE`
  //   COMPLETED             → 200 with `nextAction: NONE`
  //   CANCELLED             → **409 Conflict**

  async createOnlineCheckout(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      if (!userId) throw new AppError('User ID is required', 400);

      logger.info('🧾 POST /checkout/online payload received', {
        keys: Object.keys(req.body ?? {}),
        cartId: req.body?.cartId ?? req.body?.cart_id,
      });

      const normalized = normalizeCheckoutBody(req.body);

      // `paidAmount` is deliberately NOT required — server computes it.
      const missing = findMissingCreateFields(normalized, {
        requirePaidAmount: false,
      });
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: missing.map((field) => ({
            field,
            message: 'Required',
          })),
          received: Object.keys(req.body ?? {}),
        });
      }

      const validatedData = onlineCheckoutSchema.parse(normalized);

      // Advisory early-out — the service re-checks inside the
      // transaction.
      const cart = await cartService.getCartById(validatedData.cartId);
      if (!cart) throw new AppError('Cart not found', 404);
      if (cart.userId !== userId) {
        throw new AppError('Cart does not belong to this user', 403);
      }

      const result = await checkoutService.processOnlineCheckout(
        {
          cartId: validatedData.cartId,
          customerId: validatedData.customerId,
          paymentMethod: validatedData.paymentMethod,
          // Server ignores this but the type requires it.
          paidAmount: 0,
          discount: validatedData.discount,
          notes: validatedData.notes,
          applyLoyaltyPoints: validatedData.applyLoyaltyPoints,
          // Same as the offline path: the cart's BU is
          // authoritative. Drop the caller-supplied value.
          businessUnitId: undefined,
          customerEmail: validatedData.customerEmail,
          customerPhone: validatedData.customerPhone,
          customerName: validatedData.customerName,
          customerAddress: validatedData.customerAddress,
          idempotencyKey: validatedData.idempotencyKey,

          // Gateway-specific passthrough
          returnUrl: validatedData.returnUrl,
          cancelUrl: validatedData.cancelUrl,
          cardNonce: validatedData.cardNonce,
          paymentMethodId: validatedData.paymentMethodId,

          // Gift-card specific. Forwarded under both names so the
          // service's `data.giftCardCode ?? data.gatewayId` lookup
          // resolves regardless of which key the client sent.
          giftCardCode: validatedData.giftCardCode,
          gatewayId: validatedData.gatewayId,

          // Mobile-money provider selector.
          mobileMoneyProvider: validatedData.mobileMoneyProvider,

          // Promotion / loyalty passthrough
          discountType: validatedData.discountType ?? null,
          promotionCode: validatedData.promotionCode ?? null,
          promotionDiscount: validatedData.promotionDiscount,
        },
        userId,
      );

      // ── Idempotency short-circuit detection ──────────────
      //
      // `processOnlineCheckout` has two "short-circuit" paths
      // that return an existing Sale without doing any gateway
      // work:
      //
      //   1. A COMPLETED replay — legitimate.
      //   2. A CANCELLED replay — the previous attempt at this
      //      key failed. Return 409 so the frontend prompts a
      //      retry with a fresh key.
      if (
        validatedData.idempotencyKey &&
        result.sale?.status === 'CANCELLED'
      ) {
        logger.warn(
          `[checkout] idempotency key ${validatedData.idempotencyKey} matched CANCELLED sale ${result.sale.id} — returning 409`,
        );
        return res.status(409).json({
          success: false,
          message:
            'This checkout attempt was previously cancelled. ' +
            'Retry with a fresh idempotency key.',
          code: 'IDEMPOTENCY_CANCELLED',
          saleId: result.sale.id,
        });
      }

      const isComplete = result.sale?.status === 'COMPLETED';
      const status = isComplete ? 200 : 201;

      res.status(status).json({
        success: true,
        data: result,
        message: isComplete
          ? 'Checkout completed'
          : 'Checkout created — awaiting payment confirmation',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          ...zodErrorResponse(error),
          received: Object.keys(req.body ?? {}),
        });
      }

      // ── Status-code passthrough ──────────────────────────
      //
      // `AppError` exposes its status as `status`; axios / Stripe
      // SDK errors use `statusCode` or `response.status`; and
      // sometimes the status lives on the wrapped `cause`.
      // `getErrorStatusCode` walks the whole chain.
      const statusCode = getErrorStatusCode(error);
      if (typeof statusCode === 'number') {
        return res.status(statusCode).json({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Payment gateway error',
        });
      }

      // ── Narrow 502 fallback ──────────────────────────────
      //
      // Only reached when the error carries no status anywhere on
      // its chain AND announces itself as a gateway failure. In
      // practice `resolveGatewayError` produces an `AppError` with
      // `.status`, so this is a belt-and-braces branch for a
      // provider SDK that throws a bare Error with a
      // gateway-shaped message.
      const message: string = error?.message ?? '';
      if (
        message.startsWith('Payment gateway error') ||
        message.includes('did not return')
      ) {
        return res.status(502).json({
          success: false,
          message,
        });
      }

      next(error);
    }
  },

  // ============================================
  // LIST / READ
  // ============================================

  async getCheckouts(req: Request, res: Response, next: NextFunction) {
    try {
      const params = getCheckoutsSchema.parse(req.query);
      const page = Math.max(1, toInt((params as any).page, 1));
      const limit = Math.min(
        100,
        Math.max(1, toInt((params as any).limit, 20)),
      );
      const skip = (page - 1) * limit;

      const filters: any = {};

      if (params.status) filters.status = params.status;
      if (params.paymentStatus) filters.paymentStatus = params.paymentStatus;
      if (params.customerId) filters.customerId = params.customerId;
      if ((params as any).businessUnitId) {
        filters.businessUnitId = (params as any).businessUnitId;
      }
      if (params.search) {
        filters.OR = [
          {
            receiptNumber: {
              contains: params.search,
              mode: 'insensitive',
            },
          },
          {
            customer: {
              firstName: {
                contains: params.search,
                mode: 'insensitive',
              },
            },
          },
          {
            customer: {
              lastName: {
                contains: params.search,
                mode: 'insensitive',
              },
            },
          },
          {
            user: {
              email: {
                contains: params.search,
                mode: 'insensitive',
              },
            },
          },
        ];
      }
      if (params.dateFrom || params.dateTo) {
        filters.saleDate = {};
        if (params.dateFrom) {
          filters.saleDate.gte = new Date(params.dateFrom);
        }
        if (params.dateTo) {
          filters.saleDate.lte = new Date(params.dateTo);
        }
      }

      const orderBy: any = {};
      orderBy[
        (params as any).sortBy === 'createdAt'
          ? 'saleDate'
          : (params as any).sortBy
      ] = (params as any).sortOrder;

      const result = await checkoutService.getAllCheckouts(
        limit,
        skip,
        filters,
        orderBy,
      );

      res.status(200).json({
        success: true,
        data: result.checkouts,
        pagination: {
          total: result.total,
          page,
          totalPages: Math.ceil(result.total / limit),
          limit,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  async getCheckoutById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Checkout ID is required', 400);

      const checkout = await checkoutService.getCheckoutById(id);

      res.status(200).json({ success: true, data: checkout });
    } catch (error) {
      next(error);
    }
  },

  async getCheckoutByReceiptNumber(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { receiptNumber } = req.params;
      if (!receiptNumber) {
        throw new AppError('Receipt number is required', 400);
      }

      const checkout =
        await checkoutService.getCheckoutByReceiptNumber(receiptNumber);

      res.status(200).json({ success: true, data: checkout });
    } catch (error) {
      next(error);
    }
  },

  async getCheckoutSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const cartId = resolveCartId(req);
      if (!cartId) throw new AppError('Cart ID is required', 400);

      const summary = await checkoutService.getCheckoutSummary(cartId);

      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },

  async getCheckoutItems(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Checkout ID is required', 400);

      const items = await checkoutService.getCheckoutItems(id);

      res.status(200).json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  },

  async getCheckoutHistory(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      if (!userId) throw new AppError('User ID is required', 400);

      const {
        page = '1',
        limit = '20',
        startDate,
        endDate,
        status,
        customerId,
        search,
        businessUnitId,
      } = req.query;

      const pageNum = Math.max(1, toInt(page, 1));
      const limitNum = Math.min(100, Math.max(1, toInt(limit, 20)));

      const filters: any = {};
      if (status) filters.status = status;
      if (customerId) filters.customerId = customerId;
      // Forward the business-unit scope. The service's
      // `buildWhereClause` already supports it; the previous
      // version never supplied it, so `/checkout/history`
      // returned sales across every BU.
      if (typeof businessUnitId === 'string' && businessUnitId.trim() !== '') {
        filters.businessUnitId = businessUnitId;
      }
      if (startDate || endDate) {
        filters.saleDate = {};
        if (startDate) filters.saleDate.gte = new Date(startDate as string);
        if (endDate) filters.saleDate.lte = new Date(endDate as string);
      }
      if (search) {
        filters.OR = [
          {
            receiptNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            customer: {
              firstName: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
          {
            customer: {
              lastName: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
          {
            user: {
              email: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        ];
      }

      const result = await checkoutService.getAllCheckouts(
        limitNum,
        (pageNum - 1) * limitNum,
        filters,
      );

      res.status(200).json({
        success: true,
        data: result.checkouts,
        pagination: {
          total: result.total,
          page: pageNum,
          totalPages: Math.ceil(result.total / limitNum),
          limit: limitNum,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getCustomerCheckoutHistory(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { customerId } = req.params;
      const { page = '1', limit = '20' } = req.query;

      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      // Scope check: a customer's history is only visible to users
      // in the same company. Without this, any authenticated caller
      // could enumerate `customerId`s and read purchase history.
      const companyId = getCompanyId(req);
      if (companyId) {
        const customer = await (checkoutService as any).prisma.customer
          .findUnique({
            where: { id: customerId },
            select: { companyId: true },
          })
          .catch(() => null);

        if (!customer) {
          throw new AppError('Customer not found', 404);
        }
        if (customer.companyId !== companyId) {
          throw new AppError(
            'Customer does not belong to your company',
            403,
          );
        }
      }

      const pageNum = Math.max(1, toInt(page, 1));
      const limitNum = Math.min(100, Math.max(1, toInt(limit, 20)));

      const result = await checkoutService.getCustomerCheckoutHistory(
        customerId,
        pageNum,
        limitNum,
      );

      res.status(200).json({
        success: true,
        data: result.history,
        pagination: {
          total: result.total,
          page: pageNum,
          totalPages: Math.ceil(result.total / limitNum),
          limit: limitNum,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // UPDATE / STATUS
  // ============================================

  async updateCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const data = req.body;

      if (!id) throw new AppError('Checkout ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

      const updated = await checkoutService.updateCheckout(
        id,
        data,
        userId,
      );

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Checkout updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  async completeCheckout(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      if (!id) throw new AppError('Checkout ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

      const result = await checkoutService.completeCheckout(id, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Checkout completed successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  async cancelCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const { reason } = req.body;

      if (!id) throw new AppError('Checkout ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

      const result = await checkoutService.cancelCheckout(
        id,
        userId,
        reason,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Checkout cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  async voidCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const { saleId } = req.params;
      const { reason } = voidCheckoutSchema.parse(req.body || {});

      if (!userId) throw new AppError('User ID is required', 400);
      if (!saleId) throw new AppError('Sale ID is required', 400);

      const result = await checkoutService.voidCheckout(
        saleId,
        userId,
        reason,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Checkout voided successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  async deleteCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      if (!id) throw new AppError('Checkout ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

      const result = await checkoutService.deleteCheckout(id, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Checkout deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // ITEMS
  // ============================================

  async addCheckoutItem(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const data = addCheckoutItemSchema.parse(req.body);

      if (!id) throw new AppError('Checkout ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

      const result = await checkoutService.addCheckoutItem(
        id,
        data,
        userId,
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Item added successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  async updateCheckoutItem(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id, itemId } = req.params;
      const userId = getUserId(req);

      // Schema-driven: unwrap a bare number or `{ quantity }` into
      // `{ quantity }`, then validate once.
      const raw =
        req.body && typeof req.body.quantity === 'number'
          ? req.body
          : typeof req.body === 'number'
            ? { quantity: req.body }
            : req.body;

      const data = updateCheckoutItemSchema.parse(raw);

      if (!id || !itemId) {
        throw new AppError('Checkout ID and Item ID are required', 400);
      }
      if (!userId) throw new AppError('User ID is required', 400);

      const result = await checkoutService.updateCheckoutItem(
        id,
        itemId,
        data.quantity,
        userId,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Item updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  async removeCheckoutItem(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id, itemId } = req.params;
      const userId = getUserId(req);

      if (!id || !itemId) {
        throw new AppError('Checkout ID and Item ID are required', 400);
      }
      if (!userId) throw new AppError('User ID is required', 400);

      const result = await checkoutService.removeCheckoutItem(
        id,
        itemId,
        userId,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Item removed successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // DISCOUNTS
  // ============================================

  async applyDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const data = applyDiscountSchema.parse(req.body);

      if (!id) throw new AppError('Checkout ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

      const result = await checkoutService.applyDiscount(
        id,
        data.code,
        userId,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Discount applied successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  async removeDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      if (!id) throw new AppError('Checkout ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

      const result = await checkoutService.removeDiscountFromCheckout(
        id,
        userId,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Discount removed successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // PAYMENTS (POST-CHECKOUT)
  // ============================================
  //
  // ⚠ This handles SPLIT / PARTIAL payments added AFTER the initial
  //    checkout. It is NOT the gateway-call entry point — that is
  //    `createOnlineCheckout`.

  async processPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      if (!id) throw new AppError('Checkout ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

      const { paymentMethod, amount, paymentDetails } =
        processCheckoutPaymentSchema.parse(req.body);

      const result = await checkoutService.processPaymentForCheckout(
        id,
        {
          paymentMethod,
          amount,
          paymentDetails,
          userId,
        },
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Payment processed successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  async getPaymentMethods(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      if (!userId) throw new AppError('User ID is required', 400);

      const paymentMethods = await checkoutService.getPaymentMethods();

      res.status(200).json({
        success: true,
        data: paymentMethods,
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // RECEIPTS
  // ============================================

  async getCheckoutReceipt(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Checkout ID is required', 400);

      const receipt = await checkoutService.getCheckoutReceipt(id);

      res.status(200).json({ success: true, data: receipt });
    } catch (error) {
      next(error);
    }
  },

  async sendReceiptEmail(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const { email } = req.body;

      if (!id) throw new AppError('Checkout ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

      const result = await checkoutService.sendReceiptEmail(
        id,
        email || null,
        userId,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Receipt sent successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // STATS / SETTINGS
  // ============================================

  async getCheckoutStats(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const { dateFrom, dateTo, businessUnitId } = req.query;

      if (!userId) throw new AppError('User ID is required', 400);

      const stats = await checkoutService.getCheckoutStats({
        userId,
        dateFrom: dateFrom
          ? new Date(dateFrom as string)
          : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        businessUnitId: businessUnitId as string,
      });

      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  async getCheckoutSettings(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      if (!userId) throw new AppError('User ID is required', 400);

      const settings = await checkoutService.getCheckoutSettings(userId);

      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  },

  async updateCheckoutSettings(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      // Validate the body against a bounded schema. The service
      // does read-modify-write on the BU's settings JSON, but the
      // shape itself must be validated here — otherwise a caller
      // can persist arbitrary JSON.
      const settings = updateCheckoutSettingsSchema.parse(req.body);

      const updated = await checkoutService.updateCheckoutSettings(
        userId,
        settings,
      );

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Settings updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  // ============================================
  // EXPORTS
  // ============================================

  async exportCheckouts(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      // Accept both date-param naming conventions.
      const format =
        pickQueryString(req.query as any, 'format') ?? 'csv';
      const dateFrom = pickQueryString(
        req.query as any,
        'dateFrom',
        'startDate',
      );
      const dateTo = pickQueryString(
        req.query as any,
        'dateTo',
        'endDate',
      );
      const businessUnitId = pickQueryString(
        req.query as any,
        'businessUnitId',
      );

      const result = await checkoutService.exportCheckouts({
        userId,
        format: format as string,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        businessUnitId: businessUnitId as string,
      });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=checkouts_${Date.now()}.csv`,
        );
        return res.send(result);
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async exportCheckoutData(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      // Accept both date-param naming conventions. `exportCheckouts`
      // uses `dateFrom`/`dateTo`; `getCheckoutHistory` uses
      // `startDate`/`endDate`. Recognize both here.
      const format =
        pickQueryString(req.query as any, 'format') ?? 'csv';
      const startDate = pickQueryString(
        req.query as any,
        'startDate',
        'dateFrom',
      );
      const endDate = pickQueryString(
        req.query as any,
        'endDate',
        'dateTo',
      );
      const status = pickQueryString(req.query as any, 'status');

      // Delegate to the service's own export method. The previous
      // controller re-implemented CSV generation inline with a
      // different column set and a hard-coded 1 000-row cap.
      const result = await checkoutService.exportCheckoutData(userId, {
        format: format as 'csv' | 'json' | 'excel',
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status: status as string | undefined,
      });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=checkout_export_${Date.now()}.csv`,
        );
        return res.send(result);
      }

      // Non-CSV: the service returns `{ format, total, data }`.
      const anyResult = result as any;
      res.status(200).json({
        success: true,
        data: anyResult?.data ?? anyResult,
        total: anyResult?.total ?? undefined,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default checkoutController;
