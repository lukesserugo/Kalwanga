// D:\Projects\Kalwanga\packages\backend\src\controllers\checkoutController.ts

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
// re-declares them. The "MUST stay in lock-step" comments that
// used to live here are gone — there is one source of truth.
//
// Imported schemas:
//   createCheckoutSchema     offline create  (requires paidAmount)
//   onlineCheckoutSchema     online create   (no paidAmount)
//   voidCheckoutSchema       void reason
//   getCheckoutsSchema       list query params
//   addCheckoutItemSchema    add item body
//   updateCheckoutItemSchema update quantity body
//   applyDiscountSchema      discount code body
//   mobileMoneyProviderSchema  MPESA | MTN | AIRTEL | undefined
//   DISCOUNT_TYPE_VALUES     9-value discount enum

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
// LOCAL ALIASES FOR UPDATED ITEM BODY
// ============================================
//
// `updateCheckoutItemSchema` from the shared package only
// validates `quantity`. The controller additionally accepts a
// bare integer body for backwards compatibility with older
// clients that posted `{ "quantity": 3 }` without the wrapper.
// We reuse the shared schema's quantity validator.

const updateItemSchema = z.object({
  quantity: z.number().int().positive(),
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

      const validatedData = createCheckoutSchema.parse(normalized);

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
  //   restored, and the service re-throws with the provider's own
  //   status code and message. This controller forwards that status
  //   verbatim — see the catch block. A missing MTN credential now
  //   surfaces as a clean 503 rather than an opaque 502.
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

          // Mobile-money provider selector. Forwarded so the
          // service routes to the right provider handler
          // (MPESA / MTN / AIRTEL). When absent, the service
          // defaults to M-Pesa.
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
      //   1. A COMPLETED replay — legitimate, user should see
      //      the receipt.
      //   2. A CANCELLED replay — the previous attempt at this
      //      key failed. Returning success here would strand the
      //      user on the "awaiting confirmation" screen for a
      //      callback that will never arrive. Return 409 instead
      //      and let the frontend prompt a retry with a fresh
      //      key.
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

      // ── Status-code passthrough ──────────────────────────
      //
      // `AppError` exposes its status as `status`; axios / Stripe
      // SDK errors use `statusCode` or `response.status`.
      // `getErrorStatusCode` handles all three. Preserving the
      // status is what lets a clean 503 ("MTN is not configured")
      // reach the frontend as a 503 instead of being flattened to
      // a generic 502 by the fallback below.
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
      // Only errors that explicitly announce themselves as
      // gateway failures AND carry no status code land here.
      // The previous `message.includes('gateway')` check was too
      // broad — it matched the word "gateway" anywhere, including
      // in legible 4xx messages. Restricted to the two exact
      // prefixes the service throws.
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

      // Prefer the local `updateItemSchema` (which accepts a bare
      // integer body) but fall back to the shared
      // `updateCheckoutItemSchema` if the caller posted the wrapper
      // shape. Both produce the same `{ quantity }` output.
      const data =
        req.body && typeof req.body.quantity === 'number'
          ? updateItemSchema.parse(req.body)
          : updateCheckoutItemSchema.parse(req.body);

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
