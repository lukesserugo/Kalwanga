// D:\Projects\Kalwanga\packages\backend\src\controllers\checkoutController.ts

import { Request, Response, NextFunction } from 'express';
import { CheckoutService } from '../services/checkoutService.js';
import { CartService } from '../services/cartService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { z } from 'zod';

const checkoutService = new CheckoutService();
const cartService = new CartService();

// ============================================
// CANONICAL PAYMENT METHODS
// ============================================
//
// Mirrors `CANONICAL_PAYMENT_METHODS` in
// `../services/checkoutService.ts` and `../routes/checkout.ts`. The
// three must stay in sync.

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
// DISCOUNT TYPE
// ============================================
//
// ⚠ This array MUST stay in lock-step with the `DiscountType` union
// in `../services/checkoutService.ts`. Both now carry all 9 values.
// If either side is ever narrowed, TS2322 will reappear at the two
// `discountType: validatedData.discountType` callsites below.

const DISCOUNT_TYPE_VALUES = [
  'PERCENTAGE',
  'FIXED',
  'LOYALTY',
  'MANUAL',
  'BUY_X_GET_Y',
  'FREE_SHIPPING',
  'BOGO',
  'BUNDLE',
  'TIERED',
] as const;

// ============================================
// VALIDATION SCHEMAS
// ============================================
//
// ⚠ Each of these schemas MUST stay in lock-step with its counterpart
// in `../routes/checkout.ts` and `../services/checkoutService.ts`.
// Any drift between the three produces "Required (undefined)" 400s on
// payloads that are actually valid.

const checkoutSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  customerId: z.string().optional(),
  paymentMethod: paymentMethodSchema,
  paidAmount: z
    .number()
    .nonnegative('Paid amount must be zero or greater'),
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  notes: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  applyLoyaltyPoints: z.boolean().default(false),
  businessUnitId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),

  // Gateway-specific (harmless on the offline path; the service
  // ignores what it doesn't need).
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  cardNonce: z.string().optional(),
  paymentMethodId: z.string().optional(),

  // Gift-card specific. The frontend sends the code under both
  // `giftCardCode` (natural name) and `gatewayId` (backend-compatible
  // name); the service reads either.
  giftCardCode: z.string().optional(),
  gatewayId: z.string().optional(),

  discountType: z.enum(DISCOUNT_TYPE_VALUES).nullable().optional(),
  promotionCode: z.string().nullable().optional(),
  promotionDiscount: z.number().min(0).optional(),
});

/**
 * Online checkout schema.
 *
 * Everything `checkoutSchema` accepts, PLUS the gateway fields:
 *   - returnUrl / cancelUrl   for redirect-based providers
 *   - cardNonce               for Square (from the Web SDK)
 *   - paymentMethodId         for server-side Stripe confirmation
 *   - giftCardCode / gatewayId for Gift Card redemption
 *
 * `paidAmount` is NOT accepted here — the amount is entirely
 * server-computed from the cart. A client that tries to send it will
 * have it silently dropped by the schema's `.strip()` behaviour.
 */
const onlineCheckoutSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  customerId: z.string().optional(),
  paymentMethod: paymentMethodSchema,
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  notes: z.string().optional(),
  applyLoyaltyPoints: z.boolean().default(false),
  businessUnitId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),

  // Gateway-specific
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  cardNonce: z.string().optional(),
  paymentMethodId: z.string().optional(),

  // Gift-card specific. The frontend sends the code under both
  // `giftCardCode` (natural name) and `gatewayId` (backend-compatible
  // name); the service reads either.
  giftCardCode: z.string().optional(),
  gatewayId: z.string().optional(),

  discountType: z.enum(DISCOUNT_TYPE_VALUES).nullable().optional(),
  promotionCode: z.string().nullable().optional(),
  promotionDiscount: z.number().min(0).optional(),
});

const voidCheckoutSchema = z.object({
  reason: z.string().optional(),
});

const getCheckoutsSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('saleDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const addItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
});

const updateItemSchema = z.object({
  quantity: z.number().int().positive(),
});

const discountSchema = z.object({
  code: z.string().min(1, 'Discount code is required'),
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
 * `AppError` in this codebase exposes the status code as `status`
 * (see `../middleware/errorHandler.ts`). Some errors thrown by
 * third-party libraries (axios, Stripe SDK) use `statusCode` or
 * `response.status`. We check all three and return `undefined` when
 * none matches, so the caller can fall through to the generic
 * handler.
 */
function getErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const anyErr = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };

  const candidates = [
    anyErr.status,
    anyErr.statusCode,
    anyErr.response?.status,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return undefined;
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

      logger.info('🧾 POST /checkout payload:', {
        body: req.body,
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

      const validatedData = checkoutSchema.parse(normalized);

      const cart = await cartService.getCartById(validatedData.cartId);
      if (!cart) throw new AppError('Cart not found', 404);
      if (cart.userId !== userId) {
        throw new AppError('Cart does not belong to this user', 403);
      }

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
          businessUnitId: validatedData.businessUnitId,
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
  //   restored, and the response is a 502 with the gateway's error
  //   message.
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
  //
  // 409 means "your previous attempt at this key failed; generate
  // a new key and retry". The frontend must NOT show the
  // awaiting-confirmation screen for a CANCELLED sale — the user
  // would be stuck waiting for a callback that will never come.
  //
  // Before this fix the branch returned 201 with `nextAction:
  // OFFLINE` for CANCELLED sales too, which produced exactly that
  // stuck UX. See the `CANCELLED` handling below.

  async createOnlineCheckout(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      if (!userId) throw new AppError('User ID is required', 400);

      logger.info('🧾 POST /checkout/online payload:', {
        body: req.body,
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

      // Ownership check before the service even opens a transaction.
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
          businessUnitId: validatedData.businessUnitId,
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
      //   1. A COMPLETED replay — legitimate, user should see
      //      the receipt.
      //   2. A CANCELLED replay — the previous attempt at this
      //      key failed. Returning success here would strand the
      //      user on the "awaiting confirmation" screen for a
      //      callback that will never arrive. Return 409 instead
      //      and let the frontend prompt a retry with a fresh
      //      key.
      //
      // We can't easily tell "did the service short-circuit?"
      // from the response shape alone, so we rely on the Sale's
      // status: if the incoming request supplied an idempotency
      // key AND the resulting sale is CANCELLED, this was a
      // replay of a failed attempt.
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

      // ── If the sale is already complete (idempotent replay or an
      //    offline method that resolves synchronously), return 200
      //    instead of 201 so clients can distinguish.
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

      // Gateway failures surface as 5xx so the frontend can retry
      // without treating it as a client error.
      //
      // ⚠ `AppError` in this codebase exposes its status code as
      //   `status` (see `../middleware/errorHandler.ts`), NOT
      //   `statusCode`. Axios / Stripe SDK errors may use
      //   `statusCode` or `response.status`. `getErrorStatusCode`
      //   handles all three shapes.
      const statusCode = getErrorStatusCode(error);
      if (typeof statusCode === 'number' && statusCode >= 500) {
        return res.status(statusCode).json({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Payment gateway error',
        });
      }

      // Map specific gateway error hints to 502
      const message: string = error?.message ?? '';
      if (
        message.startsWith('Payment gateway error') ||
        message.includes('did not return') ||
        message.includes('gateway')
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
      const page = parseInt(params.page, 10);
      const limit = parseInt(params.limit, 10);
      const skip = (page - 1) * limit;

      const filters: any = {};

      if (params.status) filters.status = params.status;
      if (params.paymentStatus) filters.paymentStatus = params.paymentStatus;
      if (params.customerId) filters.customerId = params.customerId;
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
        params.sortBy === 'createdAt' ? 'saleDate' : params.sortBy
      ] = params.sortOrder;

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
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      const filters: any = {};
      if (status) filters.status = status;
      if (customerId) filters.customerId = customerId;
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

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

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
      const data = addItemSchema.parse(req.body);

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
      const data = updateItemSchema.parse(req.body);

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
      const data = discountSchema.parse(req.body);

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
  //    `createOnlineCheckout`. If you need to charge a card for a
  //    split payment, call the payment service directly.

  async processPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const { paymentMethod, amount, paymentDetails } = req.body;

      if (!id) throw new AppError('Checkout ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

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
      const settings = req.body;

      if (!userId) throw new AppError('User ID is required', 400);

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
      const { format = 'csv', dateFrom, dateTo, businessUnitId } =
        req.query;

      if (!userId) throw new AppError('User ID is required', 400);

      const result = await checkoutService.exportCheckouts({
        userId,
        format: format as string,
        dateFrom: dateFrom
          ? new Date(dateFrom as string)
          : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
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
      const { format = 'csv', startDate, endDate, status } = req.query;

      if (!userId) throw new AppError('User ID is required', 400);

      const filters: any = {};
      if (status) filters.status = status;
      if (startDate || endDate) {
        filters.saleDate = {};
        if (startDate) {
          filters.saleDate.gte = new Date(startDate as string);
        }
        if (endDate) filters.saleDate.lte = new Date(endDate as string);
      }

      const result = await checkoutService.getAllCheckouts(
        1000,
        0,
        filters,
      );

      if (format === 'csv') {
        let csv =
          'Receipt Number,Date,Customer,Total,Tax,Discount,' +
          'Discount Type,Promotion Code,Promotion Discount,' +
          'Loyalty Points Used,Loyalty Discount,' +
          'Status,Payment Method\n';
        for (const checkout of result.checkouts) {
          const customerName = checkout.customer
            ? `${checkout.customer.firstName} ${checkout.customer.lastName}`
            : 'Guest';
          const paymentMethod =
            checkout.payments[0]?.paymentMethod || 'N/A';
          csv +=
            `${checkout.receiptNumber},` +
            `${checkout.saleDate?.toISOString() || ''},` +
            `${customerName},` +
            `${checkout.total},` +
            `${(checkout.tax || 0).toFixed(2)},` +
            `${(checkout.discount || 0).toFixed(2)},` +
            `${checkout.discountType || ''},` +
            `${checkout.promotionCode || ''},` +
            `${(checkout.promotionDiscount || 0).toFixed(2)},` +
            `${checkout.loyaltyPointsUsed ?? 0},` +
            `${(checkout.loyaltyDiscount || 0).toFixed(2)},` +
            `${checkout.status},` +
            `${paymentMethod}\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=checkout_export_${Date.now()}.csv`,
        );
        return res.send(csv);
      }

      res.status(200).json({
        success: true,
        data: result.checkouts,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default checkoutController;
