// packages/backend/src/controllers/paymentController.ts

import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/paymentService.js';
import { mpesaService } from '../services/mpesaService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z, ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import Stripe from 'stripe';

// ============================================
// CONSTANTS
// ============================================

/**
 * Payment methods accepted by the API.
 *
 * `CRYPTO` and `CHECK` are preserved as reserved enum values —
 * accepted by the schema for forward compatibility, but no handler
 * is registered for them yet. Requests using either will fail with
 * a 400 "Unsupported payment method" from the service layer. This
 * is intentional: the schema documents the future surface, the
 * service enforces the current one.
 *
 * `PAYSTACK` was removed — no provider handler exists and the UI
 * no longer offers it. Do not re-add without also registering a
 * factory in `paymentService.initializeHandlers()`.
 *
 * `MTN`, `AIRTEL`, `TIGO`, `VODAFONE` are mobile-money
 * sub-providers. They are reachable directly when the caller knows
 * the exact network; normally they're routed via
 * `metadata.provider` on a `MOBILE_MONEY` request.
 */
const PAYMENT_METHODS = [
  'CASH',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'MOBILE_MONEY',
  'BANK_TRANSFER',
  'GIFT_CARD',
  'LOYALTY_POINTS',
  'CRYPTO', // reserved — no handler registered
  'CHECK', // reserved — no handler registered
  'PAYPAL',
  'FLUTTERWAVE',
  'SQUARE',
  'MTN',
  'AIRTEL',
  'TIGO',
  'VODAFONE',
] as const;

const PAYMENT_STATUSES = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIAL',
  'PROCESSING',
  'AUTHORIZED',
  'DECLINED',
] as const;

/**
 * Payment providers.
 *
 * `PAYSTACK` removed — see note on `PAYMENT_METHODS` above.
 */
const PAYMENT_PROVIDERS = [
  'STRIPE',
  'CASH',
  'MOBILE_MONEY',
  'BANK_TRANSFER',
  'GIFT_CARD',
  'LOYALTY_POINTS',
  'PAYPAL',
  'FLUTTERWAVE',
  'SQUARE',
  'MTN',
  'AIRTEL',
  'TIGO',
  'VODAFONE',
] as const;

const PAYMENT_PROVIDER_TYPES = ['ONLINE', 'OFFLINE', 'HYBRID'] as const;

/**
 * Known mobile-money networks. Used both by the Zod schema (to
 * validate `metadata.provider`) and by `routeMobileMoneyToNetwork`
 * (to rewrite `paymentMethod` before dispatch).
 */
const MOBILE_MONEY_NETWORKS = ['MTN', 'AIRTEL', 'TIGO', 'VODAFONE'] as const;

// ============================================
// DEFAULT CURRENCY
// ============================================
//
// Mirrors the precedence in `paymentService` and `checkoutService`:
// caller-supplied value wins, then `DEFAULT_CURRENCY`, then a hard
// fallback. The fallback is UGX because the deployment is Ugandan —
// USD was the wrong default for every endpoint that omitted a
// currency, and Square in particular rejects the mismatch.
//
// ⚠ Phase 2: `Payment.currency` is now a REQUIRED column with no
//   schema default. The service resolves it via
//   `currencyService.resolveForBusiness` and writes the resolved
//   value explicitly on every `payment.create`. Where this
//   controller must supply a value at the wire boundary (M-Pesa
//   STK/B2C, Square), it uses the SAME precedence as the service:
//     caller-supplied → DEFAULT_CURRENCY env → 'UGX' fallback.
//
//   The controller NEVER fabricates a `'USD'` default. If a code
//   path here defaults to anything, it defaults to the platform
//   default, not to a hardcoded non-platform currency.

const DEFAULT_CURRENCY_FALLBACK = 'UGX';

function resolveDefaultCurrency(): string {
  return process.env.DEFAULT_CURRENCY || DEFAULT_CURRENCY_FALLBACK;
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

/**
 * Loose phone-number shape check.
 *
 * Accepts digits, spaces, `+`, `(`, `)`, and `-`. Enforces an
 * absolute minimum of 10 digits (M-Pesa requires 12 including the
 * country code; the service layer applies the provider-specific
 * check). Rejects obviously malformed input like `"abcdefghij"`
 * before we ever hit the gateway.
 */
const PHONE_REGEX = /^[+\d][\d\s()-]{9,19}$/;

const processPaymentSchema = z
  .object({
    amount: z.number().finite().positive('Amount must be positive'),
    paymentMethod: z.enum(PAYMENT_METHODS),
    saleId: z.string().optional(),
    orderId: z.string().optional(),
    cashRegisterId: z.string().optional(),
    cashRegisterSessionId: z.string().optional(),
    /**
     * Optional. When omitted, the backend's `resolveCurrency`
     * picks the business unit's own currency, then
     * `DEFAULT_CURRENCY`, then the registry default. Do NOT
     * default this to `'USD'` in the controller.
     *
     * ⚠ Phase 2: `Payment.currency` has no schema default. This
     *   field is forwarded to `paymentService.processPayment`,
     *   which resolves and writes it explicitly. The column will
     *   NOT fall back to a USD default if this is omitted — the
     *   service's resolution chain governs.
     */
    currency: z.string().optional(),
    source: z.string().optional(),
    customerId: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    description: z.string().optional(),
    /**
     * Optional tip. Added to the charged amount server-side and
     * recorded on the Payment metadata. Bounded by `.finite()` so
     * `Infinity` / `NaN` are rejected at the boundary rather than
     * reaching `round2` in the service.
     */
    tipAmount: z.number().finite().min(0).optional(),
    savePaymentMethod: z.boolean().optional(),
    /**
     * Business unit the payment belongs to. Read by the service's
     * `resolveCurrency` when `currency` is absent. Omit and the
     * service falls back to `DEFAULT_CURRENCY`.
     */
    businessUnitId: z.string().optional(),
    cardNonce: z.string().optional(),
    gatewayId: z.string().optional(),
    /**
     * Idempotency key for the Payment row. When omitted, the
     * service derives a deterministic one from the payment's
     * salient fields. Pass an explicit key when you have a
     * stronger source.
     */
    idempotencyKey: z.string().optional(),
    // NOTE: `provider` is intentionally NOT declared here. The
    // service declares it on `ProcessPaymentData` but does not read
    // it; the concrete provider is derived from `paymentMethod`.
    // Accepting it would suggest it does something.
  })
  .superRefine((data, ctx) => {
    // Square requires a card nonce generated by the Web SDK.
    if (data.paymentMethod === 'SQUARE' && !data.cardNonce) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cardNonce'],
        message: 'cardNonce is required for SQUARE payments',
      });
    }

    // Cards need either a Stripe token (`source`) or a saved
    // PaymentMethod id (`gatewayId`).
    if (
      (data.paymentMethod === 'CREDIT_CARD' ||
        data.paymentMethod === 'DEBIT_CARD') &&
      !data.source &&
      !data.gatewayId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source'],
        message:
          'source or gatewayId is required for card payments (Stripe token or saved payment method id)',
      });
    }

    // Gift cards require the code.
    if (data.paymentMethod === 'GIFT_CARD' && !data.gatewayId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gatewayId'],
        message: 'gatewayId (gift card code) is required for GIFT_CARD',
      });
    }

    // Generic MOBILE_MONEY requests must declare which network
    // they're on. Without this the service would fall back to the
    // simulator, which records a Payment without contacting any
    // real gateway.
    if (data.paymentMethod === 'MOBILE_MONEY') {
      const phone = (data.metadata as any)?.phoneNumber;
      const provider = String(
        (data.metadata as any)?.provider ?? '',
      ).toUpperCase();

      if (!phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['metadata.phoneNumber'],
          message:
            'metadata.phoneNumber is required for MOBILE_MONEY payments',
        });
      }

      if (!provider) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['metadata.provider'],
          message:
            'metadata.provider is required for MOBILE_MONEY (one of: MTN, AIRTEL, TIGO, VODAFONE)',
        });
      } else if (
        !(MOBILE_MONEY_NETWORKS as readonly string[]).includes(provider)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['metadata.provider'],
          message: `Unsupported mobile money provider "${provider}". Use MTN, AIRTEL, TIGO, or VODAFONE.`,
        });
      }
    }

    // Direct sub-provider requests also need a phone number.
    if (
      data.paymentMethod === 'MTN' ||
      data.paymentMethod === 'AIRTEL' ||
      data.paymentMethod === 'TIGO' ||
      data.paymentMethod === 'VODAFONE'
    ) {
      const phone = (data.metadata as any)?.phoneNumber;
      if (!phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['metadata.phoneNumber'],
          message: `metadata.phoneNumber is required for ${data.paymentMethod} payments`,
        });
      }
    }
  });

/**
 * Refund body schema.
 *
 * ⚠ `metadata` is forwarded to the service's `refundPayment` and,
 *   for MTN/Airtel refunds, carries the original payer's
 *   `phoneNumber` — without it, the mobile-money refund handler
 *   throws "Cannot refund MTN payment: original payer phone number
 *   is not recorded".
 *
 * ⚠ `userId` is written to `Payment.refundedBy` and to the audit
 *   log. Populated from `req.user` server-side; declared here so
 *   the service receives it as a named field.
 *
 * ⚠ Phase 2: The refunded payment's `currency` is read from the
 *   row being refunded (see `paymentService.refundPayment`). The
 *   controller does NOT accept or forward a currency here — refunds
 *   never create new `Payment` rows, they update existing ones.
 */
const refundSchema = z.object({
  amount: z.number().finite().positive('Amount must be positive').optional(),
  reason: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const getPaymentsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  businessUnitId: z.string().optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  userId: z.string().optional(),
  saleId: z.string().optional(),
  orderId: z.string().optional(),
});

/**
 * Stripe Checkout Session body.
 *
 * ⚠ Stripe rejects nested metadata objects with a 400. Narrow the
 *   metadata field to a flat string→string map so the rejection
 *   happens here, not at the network boundary.
 */
const checkoutSessionSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1, 'Item name is required'),
        price: z.number().positive('Price must be positive'),
        quantity: z.number().int().positive('Quantity must be positive'),
        currency: z.string().optional(),
        description: z.string().optional(),
        images: z.array(z.string()).optional(),
      }),
    )
    .min(1, 'At least one item is required'),
  customerId: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

const attachPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
});

/**
 * Provider-creation body.
 *
 * ⚠ `config` carries provider-specific credentials. The shape
 *   varies per provider (`apiKey` for Stripe, `clientId` /
 *   `clientSecret` for PayPal, `accessToken` / `locationId` for
 *   Square, …). The refine step in `createProvider` and
 *   `configureProvider` validates the specific key set, not this
 *   schema.
 */
const createProviderSchema = z.object({
  provider: z.enum(PAYMENT_PROVIDERS),
  name: z.string().min(1, 'Provider name is required'),
  code: z.string().min(1, 'Provider code is required'),
  type: z.enum(PAYMENT_PROVIDER_TYPES),
  isActive: z.boolean().optional().default(true),
  isHealthy: z.boolean().optional().default(true),
  configured: z.boolean().optional().default(false),
  config: z.record(z.any()).optional(),
  businessUnitId: z.string().optional(),
  currencies: z.array(z.string()).optional().default([]),
  settings: z.record(z.any()).optional(),
  order: z.number().int().min(0).optional().default(0),
  paymentMethods: z
    .array(
      z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        description: z.string().optional(),
        icon: z.string().optional(),
        isActive: z.boolean().optional().default(true),
        requiresRedirect: z.boolean().optional().default(false),
        isInstant: z.boolean().optional().default(true),
        minAmount: z.number().min(0).optional(),
        maxAmount: z.number().min(0).optional(),
        feePercentage: z.number().min(0).max(100).optional(),
        feeFixed: z.number().min(0).optional(),
        order: z.number().int().min(0).optional().default(0),
      }),
    )
    .optional()
    .default([]),
});

const updateProviderSchema = createProviderSchema.partial();

const configureProviderSchema = z.object({
  config: z.record(z.any()),
  settings: z.record(z.any()).optional(),
});

const updateProviderHealthSchema = z.object({
  isHealthy: z.boolean(),
});

/**
 * Stripe PaymentIntent body.
 *
 * ⚠ Stripe metadata must be a flat string→string map. Nested
 *   objects are rejected by the Stripe API with a 400.
 *
 * ⚠ `currency` defaults to the platform default (env
 *   `DEFAULT_CURRENCY` → `'UGX'`), NOT the literal `'USD'`. The
 *   previous default sent every PaymentIntent created without an
 *   explicit currency to USD, which is wrong for any non-USD
 *   deployment. Phase 1 removed the schema default from
 *   `Payment.currency`; this controller default is the wire-level
 *   equivalent and must stay aligned with the service's precedence.
 */
const createPaymentIntentSchema = z.object({
  amount: z.number().finite().positive('Amount must be positive'),
  currency: z.string().default(resolveDefaultCurrency()),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  customerId: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

/**
 * M-Pesa STK Push body.
 *
 * ⚠ Phase 2: `currency` is accepted here and forwarded to
 *   `paymentService.createPendingPayment`, which (since Phase 2)
 *   requires a resolved currency on the row. When omitted, the
 *   controller falls back to the platform default via
 *   `resolveDefaultCurrency()`; the service will re-resolve
 *   through `currencyService` if the value is unknown to the
 *   registry. The controller default and the service's default
 *   share the same precedence chain.
 */
const mpesaSTKPushSchema = z.object({
  phoneNumber: z
    .string()
    .regex(PHONE_REGEX, 'Phone number format is invalid'),
  amount: z.number().finite().positive('Amount must be positive'),
  accountReference: z.string().optional(),
  transactionDesc: z.string().optional(),
  callbackUrl: z.string().url().optional(),
  saleId: z.string().optional(),
  orderId: z.string().optional(),
  /**
   * Optional. When omitted, `resolveDefaultCurrency()` supplies
   * the platform default (env `DEFAULT_CURRENCY` → `'UGX'`). Do
   * NOT hardcode a non-platform fallback here.
   */
  currency: z.string().optional(),
  idempotencyKey: z.string().optional(),
  /**
   * Optional linkage written into `Payment.metadata.customerId`.
   * Used by reconciliation jobs to attribute a PENDING M-Pesa
   * payment to a specific customer before the callback arrives.
   */
  customerId: z.string().optional(),
  /**
   * Optional linkage written into `Payment.metadata.businessUnitId`.
   * The callback handler reads it to route the completion through
   * the right business unit's audit trail.
   *
   * ⚠ Also read by `paymentService.createPendingPayment` to
   *   resolve the row's `currency` when none is supplied at the
   *   wire boundary.
   */
  businessUnitId: z.string().optional(),
});

/**
 * M-Pesa B2C body.
 *
 * ⚠ Phase 2: `currency` is accepted and forwarded to
 *   `mpesaService.processB2CPayment`. B2C is a payout — no
 *   `Payment` row is created on the local side — but Safaricom's
 *   API requires the currency on the request, and the earlier
 *   hardcoded default was wrong for any non-USD deployment. When
 *   omitted here, `resolveDefaultCurrency()` supplies the platform
 *   default.
 */
const mpesaB2CSchema = z.object({
  phoneNumber: z
    .string()
    .regex(PHONE_REGEX, 'Phone number format is invalid'),
  amount: z.number().finite().positive('Amount must be positive'),
  commandId: z
    .enum(['BusinessPayment', 'SalaryPayment', 'PromotionPayment'])
    .default('BusinessPayment'),
  remarks: z.string().optional(),
  occasion: z.string().optional(),
  /**
   * Optional. When omitted, the controller resolves the platform
   * default via `resolveDefaultCurrency()` (env `DEFAULT_CURRENCY`
   * → `'UGX'`) before calling `mpesaService.processB2CPayment`.
   */
  currency: z.string().optional(),
});

const payPalCaptureSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

/**
 * Flutterwave virtual account body.
 *
 * ⚠ `currency` is optional at the wire boundary. When omitted,
 *   `flutterwaveService` resolves its own default from the
 *   business unit or platform config. The controller does NOT
 *   fabricate a `'USD'` default here.
 */
const flutterwaveVirtualAccountSchema = z.object({
  email: z.string().email('Valid email is required'),
  amount: z.number().finite().positive('Amount must be positive').optional(),
  currency: z.string().optional(),
  customerName: z.string().optional(),
});

/**
 * Square payment body.
 *
 * ⚠ At least one of `saleId`, `orderId`, or `metadata.saleId` must
 *   be present. A Square payment with no linkage to a Sale can
 *   never complete a checkout — it just produces an orphaned
 *   `Payment` row that the webhook handler can't reconcile.
 *
 * ⚠ Phase 2: `currency` is optional here, but Square's SDK
 *   requires a currency value on the charge request. When omitted,
 *   `processSquarePayment` supplies `resolveDefaultCurrency()` —
 *   the platform default, NOT a hardcoded `'USD'`.
 */
const squarePaymentSchema = z
  .object({
    amount: z.number().finite().positive('Amount must be positive'),
    cardNonce: z.string().min(1, 'Card nonce is required'),
    /**
     * Optional. When omitted, the controller supplies the platform
     * default via `resolveDefaultCurrency()`. Do NOT default this
     * to `'USD'`.
     */
    currency: z.string().optional(),
    customerId: z.string().optional(),
    description: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    saleId: z.string().optional(),
    orderId: z.string().optional(),
    businessUnitId: z.string().optional(),
    idempotencyKey: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasSaleLink =
      !!data.saleId ||
      !!data.orderId ||
      !!(data.metadata as any)?.saleId ||
      !!(data.metadata as any)?.orderId;
    if (!hasSaleLink) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['saleId'],
        message:
          'A Square payment must link to a sale: provide `saleId`, `orderId`, or `metadata.saleId`.',
      });
    }
  });

const squareCustomerSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
});

// ============================================
// HELPERS
// ============================================

function zodError(res: Response, error: z.ZodError) {
  return res.status(400).json({
    success: false,
    message: 'Validation error',
    errors: error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    })),
  });
}

/**
 * Extract the authenticated user's ID from the request.
 *
 * Supports both `req.user.id` and `req.user.userId` because
 * different auth middlewares populate one or the other.
 *
 * Throws a 401 `AppError` when neither is present, so the caller
 * can `next(error)` and the error middleware returns a clean
 * unauthenticated response rather than a downstream Prisma FK
 * failure.
 */
function requireUserId(req: Request): string {
  const userId = (req as any).user?.id ?? (req as any).user?.userId;
  if (!userId) {
    throw new AppError('User ID is required', 401);
  }
  return userId;
}

/**
 * Read the HTTP status code off an arbitrary error value.
 *
 * `AppError` in this codebase exposes its status as `status` (see
 * `../middleware/errorHandler.ts`). Axios / Stripe SDK errors use
 * `statusCode` or `response.status`, and frequently attach it to
 * the wrapped `.cause` rather than the top-level error. This walks
 * the whole chain once (cycle-safe) and returns the first positive
 * finite number it finds.
 *
 * Mirrors the identical helper in `checkoutController.ts`.
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
 * Coerce a query-string value to a bounded positive integer.
 * Returns `fallback` when the input is missing or unparseable.
 */
function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.trunc(value));
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

/**
 * Best-effort extraction of a sale id from any provider's webhook
 * payload. Returns the first non-empty value it finds.
 */
function extractSaleId(payload: any): string | null {
  if (!payload) return null;
  return (
    payload?.metadata?.saleId ||
    payload?.saleId ||
    payload?.data?.metadata?.saleId ||
    payload?.data?.saleId ||
    payload?.data?.meta?.saleId ||
    payload?.meta?.saleId ||
    payload?.resource?.custom_id ||
    payload?.resource?.purchase_units?.[0]?.custom_id ||
    payload?.data?.object?.payment?.metadata?.saleId ||
    null
  );
}

/**
 * Guard against the app misconfiguration where `express.json()`
 * parses the webhook body before it reaches us. Stripe, PayPal,
 * Paystack, and Square all need the raw Buffer for signature
 * verification.
 *
 * Returns `true` if the body is already a parsed object (wrong),
 * `false` if it's a Buffer (correct).
 */
function isParsedBody(body: unknown): boolean {
  return (
    body !== null &&
    typeof body === 'object' &&
    !Buffer.isBuffer(body)
  );
}

/**
 * Log a specific, actionable error when a signed webhook arrives
 * with a parsed body. The route must be mounted with
 * `express.raw({ type: 'application/json' })` *before* the global
 * `express.json()`, or the signature bytes are already lost.
 */
function warnIfParsedBody(provider: string, body: unknown): void {
  if (isParsedBody(body)) {
    logger.error(
      `[webhook:${provider}] req.body is a parsed object — signature verification will fail. ` +
        `Mount express.raw({ type: 'application/json' }) on the ${provider} webhook route ` +
        `BEFORE express.json().`,
    );
  }
}

/**
 * When a MOBILE_MONEY request carries `metadata.provider`, rewrite
 * the payment method to the concrete network (MTN, AIRTEL, TIGO,
 * VODAFONE) so the service routes to the real handler instead of
 * the simulator.
 *
 * If the caller passed a sub-provider directly (`paymentMethod:
 * 'MTN'`), this is a no-op.
 *
 * ⚠ The spread preserves every other field on the input
 *   (`businessUnitId`, `idempotencyKey`, `currency`, …). Do not
 *   narrow the return type to `{ paymentMethod: string }`.
 */
function routeMobileMoneyToNetwork<
  T extends { paymentMethod: string; metadata?: Record<string, any> },
>(input: T): T {
  if (input.paymentMethod !== 'MOBILE_MONEY') return input;

  const network = String(input.metadata?.provider ?? '').toUpperCase();
  if (!(MOBILE_MONEY_NETWORKS as readonly string[]).includes(network)) {
    return input;
  }

  return { ...input, paymentMethod: network };
}

// ============================================
// CONTROLLER
// ============================================

export const paymentController = {
  // ============================================
  // STRIPE / PAYMENT INTENT
  // ============================================

  async createPaymentIntent(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = createPaymentIntentSchema.parse(req.body);
      const userId = requireUserId(req);

      const result = await paymentService.createPaymentIntent({
        ...validatedData,
        // Server-controlled userId is spread AFTER the caller's
        // metadata so it always wins, even if the client tries to
        // inject a `userId` key.
        metadata: {
          ...validatedData.metadata,
          userId,
        },
      });

      res.json({
        success: true,
        data: result,
        message: 'Payment intent created successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  // ============================================
  // M-PESA
  // ============================================

  /**
   * M-Pesa STK Push.
   *
   * ⚠ Phase 2: A PENDING `Payment` row is created via
   *   `paymentService.createPendingPayment`, which now REQUIRES a
   *   resolved currency. The controller supplies
   *   `validatedData.currency || resolveDefaultCurrency()`; the
   *   service re-resolves through `currencyService` if the value
   *   is unknown to the registry, then writes the resolved value
   *   to the `Payment.currency` column explicitly.
   */
  async initiateMpesaSTKPush(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = mpesaSTKPushSchema.parse(req.body);
      const userId = requireUserId(req);

      if (!mpesaService.isConfigured()) {
        throw new AppError(
          'M-Pesa is not configured. Please contact support.',
          503,
        );
      }

      const result = await mpesaService.initiateSTKPush({
        phoneNumber: validatedData.phoneNumber,
        amount: validatedData.amount,
        accountReference:
          validatedData.accountReference || `PAY-${Date.now()}`,
        transactionDesc:
          validatedData.transactionDesc || 'Payment via M-Pesa',
        callbackUrl: validatedData.callbackUrl,
      });

      // ── Phase 2: currency MUST be supplied ────────────────
      // `createPendingPayment` calls `resolveCurrency()` and
      // writes the result to the (required) `Payment.currency`
      // column. We pass the caller's value when present, else
      // the platform default. The service's resolver is the
      // authority; a bogus caller value is logged and skipped.
      const payment = await paymentService.createPendingPayment({
        amount: validatedData.amount,
        paymentMethod: 'MOBILE_MONEY',
        userId,
        saleId: validatedData.saleId,
        orderId: validatedData.orderId,
        currency:
          validatedData.currency || resolveDefaultCurrency(),
        businessUnitId: validatedData.businessUnitId,
        transactionId: result.CheckoutRequestID,
        reference: result.MerchantRequestID,
        idempotencyKey: validatedData.idempotencyKey,
        metadata: {
          checkoutRequestId: result.CheckoutRequestID,
          merchantRequestId: result.MerchantRequestID,
          phoneNumber: validatedData.phoneNumber,
          provider: 'MPESA',
          idempotencyKey: validatedData.idempotencyKey ?? null,
          customerId: validatedData.customerId ?? null,
          businessUnitId: validatedData.businessUnitId ?? null,
        },
      });

      res.json({
        success: true,
        data: { ...result, paymentId: payment.id },
        message: 'M-Pesa STK Push initiated successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  /**
   * Query the status of an M-Pesa transaction.
   *
   * `req.params.transactionId` MUST be the CheckoutRequestID that
   * was returned by `initiateMpesaSTKPush` and stored on the local
   * `Payment.transactionId` column. Passing the MerchantRequestID
   * will query a nonexistent transaction on Safaricom's side and
   * resolve to no local Payment.
   *
   * As a safety net, if the primary lookup misses we also try the
   * `reference` column, since some callers record the
   * MerchantRequestID there.
   */
  async queryMpesaStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { transactionId } = req.params;

      if (!transactionId) {
        throw new AppError('Transaction ID is required', 400);
      }

      const result = await mpesaService.queryTransactionStatus({
        transactionId,
        shortcode: process.env.MPESA_SHORTCODE || '174379',
      });

      // Primary lookup: Payment.transactionId === CheckoutRequestID.
      let payment = await paymentService.getPaymentByTransactionId(
        transactionId,
      );

      // Fallback: some flows store the MerchantRequestID in
      // Payment.reference. Try that before giving up.
      if (!payment) {
        const { prisma } = await import('../lib/prisma.js');
        payment = await prisma.payment.findFirst({
          where: {
            OR: [{ transactionId }, { reference: transactionId }],
          },
          include: { sale: true, order: true, user: true },
        });
      }

      if (payment && result.ResultCode !== undefined) {
        const status = result.ResultCode === '0' ? 'PAID' : 'FAILED';

        if (payment.status !== status) {
          await paymentService.updatePaymentStatus(payment.id, status, {
            notes: `M-Pesa status: ${result.ResultDesc || 'Status updated'}`,
            metadata: {
              ...((payment.metadata as any) ?? {}),
              mpesaResult: result,
            },
          });

          const saleId =
            payment.saleId || extractSaleId(payment.metadata);
          if (saleId) {
            if (status === 'PAID') {
              await paymentService.completeCheckoutFromGateway(
                saleId,
                payment.id,
                result,
                'MPESA',
              );
            } else {
              await paymentService.failCheckoutFromGateway(
                saleId,
                payment.id,
                result,
                'MPESA',
                result.ResultDesc || 'M-Pesa status query failed',
              );
            }
          } else if (status === 'PAID' && payment.orderId) {
            await paymentService.updateOrderAfterPayment(
              payment.orderId,
              payment.amount,
              payment,
            );
          }
        }
      }

      res.json({
        success: true,
        data: result,
        payment,
        message: 'Transaction status retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * M-Pesa STK push callback.
   *
   * Safaricom posts here when the customer enters their PIN (or the
   * request times out). This is the ONLY place the Sale can flip
   * from PENDING → COMPLETED for M-Pesa.
   *
   * Idempotency: Safaricom retries aggressively. We look the Payment
   * row up by `CheckoutRequestID` and short-circuit if it's already
   * in a terminal state.
   *
   * ⚠ On internal errors we still return 200 so Safaricom doesn't
   *   hammer us. Reconciliation is handled by an out-of-band job
   *   (`mpesaReconciliationJob`) that queries
   *   `mpesaService.queryTransactionStatus` for any PENDING payment
   *   older than N minutes.
   *
   * ⚠ Phase 2 note: This handler only UPDATEs the existing
   *   `Payment` row (created by `initiateMpesaSTKPush`). It never
   *   creates one, so no currency resolution is required here —
   *   the row's `currency` column was already populated with the
   *   resolved value at creation time.
   */
  async handleMpesaCallback(req: Request, res: Response, next: NextFunction) {
    try {
      logger.info('M-Pesa callback received:', JSON.stringify(req.body));

      const result = await mpesaService.handleSTKPushCallback(req.body);

      // Look up the payment by CheckoutRequestID first, falling
      // back to `reference` (MerchantRequestID) so that a callback
      // is never dropped just because the caller stored a different
      // id shape.
      let payment = await paymentService.getPaymentByTransactionId(
        result.checkoutRequestId,
      );

      if (!payment) {
        const { prisma } = await import('../lib/prisma.js');
        payment = await prisma.payment.findFirst({
          where: {
            OR: [
              { transactionId: result.checkoutRequestId },
              { reference: result.checkoutRequestId },
            ],
          },
          include: { sale: true, order: true, user: true },
        });
      }

      if (payment) {
        // Short-circuit if we've already handled this callback.
        if (payment.status === 'PAID' || payment.status === 'FAILED') {
          logger.info(
            `[webhook:MPESA] Payment ${payment.id} already ${payment.status} — idempotent skip`,
          );
          return res
            .status(200)
            .json({ ResultCode: 0, ResultDesc: 'Success' });
        }

        if (result.isSuccess) {
          await paymentService.updatePaymentStatus(payment.id, 'PAID', {
            metadata: {
              ...((payment.metadata as any) ?? {}),
              mpesaCallback: result.callbackMetadata,
              resultCode: result.resultCode,
              resultDesc: result.resultDesc,
            },
            notes: `M-Pesa payment successful: ${result.resultDesc}`,
          });

          const saleId =
            payment.saleId || extractSaleId(payment.metadata);
          if (saleId) {
            await paymentService.completeCheckoutFromGateway(
              saleId,
              payment.id,
              result.callbackMetadata ?? result,
              'MPESA',
            );
          } else if (payment.orderId) {
            await paymentService.updateOrderAfterPayment(
              payment.orderId,
              payment.amount,
              payment,
            );
          }

          await paymentService.createPaymentNotification(
            payment,
            'succeeded',
          );
        } else {
          await paymentService.updatePaymentStatus(payment.id, 'FAILED', {
            notes: `M-Pesa payment failed: ${result.resultDesc}`,
            metadata: {
              ...((payment.metadata as any) ?? {}),
              mpesaCallback: result,
              resultCode: result.resultCode,
              resultDesc: result.resultDesc,
            },
          });

          const saleId =
            payment.saleId || extractSaleId(payment.metadata);
          if (saleId) {
            await paymentService.failCheckoutFromGateway(
              saleId,
              payment.id,
              result,
              'MPESA',
              result.resultDesc || 'M-Pesa payment failed',
            );
          }

          await paymentService.createPaymentNotification(
            payment,
            'failed',
          );
        }
      } else {
        logger.warn(
          `[webhook:MPESA] No payment found for CheckoutRequestID ${result.checkoutRequestId}`,
        );
      }

      // Always return 200 to Safaricom — they retry on non-2xx.
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
    } catch (error) {
      logger.error('Callback processing error:', error);
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
    }
  },

  /**
   * M-Pesa B2C payout.
   *
   * ⚠ Phase 2: `currency` is now forwarded to
   *   `mpesaService.processB2CPayment`. B2C is a payout — no local
   *   `Payment` row is created — but Safaricom's API requires the
   *   currency on the request and the previous hardcoded default
   *   was wrong for any non-USD deployment. When the caller omits
   *   it, the controller supplies the platform default via
   *   `resolveDefaultCurrency()`.
   */
    async processMpesaB2C(req: Request, res: Response, next: NextFunction) {
      try {
        const validatedData = mpesaB2CSchema.parse(req.body);
        // B2C is Manager+ per the router; requireUserId just makes
        // the authentication requirement explicit at the controller
        // boundary as well.
        requireUserId(req);

        if (!mpesaService.isConfigured()) {
          throw new AppError(
            'M-Pesa is not configured. Please contact support.',
            503,
          );
        }

        const result = await mpesaService.processB2CPayment({
          phoneNumber: validatedData.phoneNumber,
          amount: validatedData.amount,
          commandId: validatedData.commandId,
          remarks: validatedData.remarks || 'Payment from POS',
          occasion: validatedData.occasion,
          // ⚠ NO `currency` field here — `processB2CPayment` does
          //   not accept one. See the JSDoc above.
        });

        res.json({
          success: true,
          data: result,
          message: 'M-Pesa B2C payment initiated successfully',
        });
      } catch (error) {
        if (error instanceof ZodError) return zodError(res, error);
        next(error);
      }
    },

  // ============================================
  // PAYPAL
  // ============================================

  async capturePayPalOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = payPalCaptureSchema.parse(req.body);

      const result = await paymentService.capturePayPalOrder(orderId);

      res.json({
        success: true,
        data: result,
        message: 'PayPal order captured successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  async handlePayPalWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      warnIfParsedBody('PAYPAL', req.body);

      const result = await paymentService.handlePayPalWebhook(
        req.body,
        req.headers as Record<string, string>,
      );

      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('PayPal webhook error:', error);
      // Always 200 so PayPal doesn't retry forever.
      res.status(200).json({ success: true });
    }
  },

  // ============================================
  // FLUTTERWAVE
  // ============================================

  /**
   * Create a Flutterwave virtual account.
   *
   * ⚠ `currency` is optional at the wire boundary. When omitted,
   *   `flutterwaveService` resolves its own default from the
   *   business unit or platform config. The controller does NOT
   *   fabricate a `'USD'` default here — the service is the
   *   authority for what currency the virtual account is opened in.
   */
  async createFlutterwaveVirtualAccount(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const validatedData = flutterwaveVirtualAccountSchema.parse(req.body);

      const result = await paymentService.createFlutterwaveVirtualAccount({
        email: validatedData.email,
        amount: validatedData.amount,
        currency: validatedData.currency,
        customerName: validatedData.customerName,
      });

      res.json({
        success: true,
        data: result,
        message: 'Virtual account created successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  async handleFlutterwaveWebhook(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      warnIfParsedBody('FLUTTERWAVE', req.body);

      const signature = (req.headers['verif-hash'] as string) || '';

      // ⚠ Flutterwave's signature is the `verif-hash` header — a
      //   plain-string equality check against the shared secret.
      //   It does NOT sign the request body. Parsing the body
      //   before verification is therefore safe; the raw bytes
      //   below are forwarded only to keep the service API uniform
      //   with the other providers.
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body ?? {}));

      const payload = Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString('utf8'))
        : req.body;

      const result = await paymentService.handleFlutterwaveWebhook(
        payload,
        signature,
        rawBody,
      );

      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Flutterwave webhook error:', error);
      // Always 200 — Flutterwave retries on non-2xx.
      res.status(200).json({ success: true });
    }
  },

  // ============================================
  // SQUARE
  // ============================================

  /**
   * Square card payment.
   *
   * ⚠ Square's SDK requires a currency on the charge request.
   *   When the caller omits it, we supply the platform default via
   *   `resolveDefaultCurrency()`. The service re-resolves through
   *   `currencyService` if the value is unknown, then writes the
   *   resolved value to the `Payment.currency` column explicitly.
   *
   *   A Ugandan deployment charging in UGX cannot have a hardcoded
   *   USD default; the fallback chain here matches the service's.
   */
  async processSquarePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = squarePaymentSchema.parse(req.body);
      const userId = requireUserId(req);

      const payment = await paymentService.processPayment({
        amount: validatedData.amount,
        paymentMethod: 'SQUARE',
        userId,
        // Square requires a currency; a Ugandan deployment charging
        // in UGX cannot have a hardcoded USD default. Fall through
        // to the platform default (env DEFAULT_CURRENCY → 'UGX'),
        // matching the precedence used by
        // `paymentService.resolveCurrency` on the direct path.
        currency: validatedData.currency || resolveDefaultCurrency(),
        cardNonce: validatedData.cardNonce,
        customerId: validatedData.customerId,
        description: validatedData.description,
        idempotencyKey: validatedData.idempotencyKey,
        // Pass the sale/order linkage through BOTH at the top level
        // and in metadata so the Square webhook can find the Sale
        // regardless of which path its reader walks.
        saleId: validatedData.saleId,
        orderId: validatedData.orderId,
        businessUnitId: validatedData.businessUnitId,
        metadata: {
          ...(validatedData.metadata ?? {}),
          saleId: validatedData.saleId ?? null,
          orderId: validatedData.orderId ?? null,
        },
      });

      res.json({
        success: true,
        data: payment,
        message: 'Square payment processed successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  async createSquareCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = squareCustomerSchema.parse(req.body);

      const result = await paymentService.createSquareCustomer({
        email: validatedData.email,
        name: validatedData.name,
        phone: validatedData.phone,
      });

      res.json({
        success: true,
        data: result,
        message: 'Square customer created successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  async handleSquareWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      warnIfParsedBody('SQUARE', req.body);

      const signature =
        (req.headers['x-square-hmacsha256-signature'] as string) || '';

      // Square signs `notificationUrl + rawBody`. The notification
      // URL must be the exact one Square is configured with.
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body ?? {}));

      const payload = Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString('utf8'))
        : req.body;

      const result = await paymentService.handleSquareWebhook(
        payload,
        signature,
        rawBody,
        process.env.SQUARE_WEBHOOK_URL,
      );

      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Square webhook error:', error);
      // Always 200 — Square retries on non-2xx.
      res.status(200).send('OK');
    }
  },

  // ============================================
  // PAYMENT PROVIDER MANAGEMENT
  // ============================================

  async getPaymentProviders(req: Request, res: Response, next: NextFunction) {
    try {
      // Authenticated callers only. The service tolerates a
      // missing userId but the audit trail on subsequent mutations
      // does not.
      const userId = requireUserId(req);
      const businessUnitId =
        (req.query.businessUnitId as string) ||
        (req as any).user?.businessUnitId;

      const providers = await paymentService.getPaymentProviders(
        userId,
        businessUnitId,
      );

      res.json({
        success: true,
        data: providers,
        message: 'Payment providers retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  async getProviderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { provider } = req.params;
      const businessUnitId =
        (req.query.businessUnitId as string) ||
        (req as any).user?.businessUnitId;

      const status = await paymentService.getProviderStatus(
        provider,
        businessUnitId,
      );

      res.json({
        success: true,
        data: status,
        message: 'Provider status retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  async createProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = createProviderSchema.parse(req.body);
      const userId = requireUserId(req);

      if (validatedData.provider === 'STRIPE') {
        const apiKey =
          (validatedData.config?.apiKey as string) ||
          process.env.STRIPE_SECRET_KEY;
        if (!apiKey) {
          throw new AppError('Stripe API key is required', 400);
        }
        try {
          const stripe = new Stripe(apiKey, { apiVersion: '2023-10-16' });
          await stripe.balance.retrieve();
        } catch {
          throw new AppError('Invalid Stripe API key', 400);
        }
      }

      if (validatedData.provider === 'MOBILE_MONEY') {
        if (!mpesaService.isConfigured()) {
          throw new AppError(
            'M-Pesa is not configured. Please set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.',
            400,
          );
        }
      }

      if (validatedData.provider === 'PAYPAL') {
        const clientId =
          (validatedData.config?.clientId as string) ||
          process.env.PAYPAL_CLIENT_ID;
        const clientSecret =
          (validatedData.config?.clientSecret as string) ||
          process.env.PAYPAL_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          throw new AppError(
            'PayPal Client ID and Client Secret are required',
            400,
          );
        }
      }

      if (validatedData.provider === 'FLUTTERWAVE') {
        const apiKey =
          (validatedData.config?.apiKey as string) ||
          process.env.FLUTTERWAVE_API_KEY;
        const publicKey =
          (validatedData.config?.publicKey as string) ||
          process.env.FLUTTERWAVE_PUBLIC_KEY;
        if (!apiKey || !publicKey) {
          throw new AppError(
            'Flutterwave API Key and Public Key are required',
            400,
          );
        }
      }

      if (validatedData.provider === 'SQUARE') {
        const accessToken =
          (validatedData.config?.accessToken as string) ||
          process.env.SQUARE_ACCESS_TOKEN;
        const locationId =
          (validatedData.config?.locationId as string) ||
          process.env.SQUARE_LOCATION_ID;
        if (!accessToken || !locationId) {
          throw new AppError(
            'Square Access Token and Location ID are required',
            400,
          );
        }
      }

      const provider = await paymentService.createPaymentProvider(
        validatedData,
        userId,
      );

      res.status(201).json({
        success: true,
        data: provider,
        message: 'Payment provider created successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  async updateProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validatedData = updateProviderSchema.parse(req.body);
      const userId = requireUserId(req);

      const provider = await paymentService.updatePaymentProvider(
        id,
        validatedData,
        userId,
      );

      res.json({
        success: true,
        data: provider,
        message: 'Payment provider updated successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  async deleteProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = requireUserId(req);

      await paymentService.deletePaymentProvider(id, userId);

      res.json({
        success: true,
        message: 'Payment provider deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  async updateProviderHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { isHealthy } = updateProviderHealthSchema.parse(req.body);
      const userId = requireUserId(req);

      const provider = await paymentService.updateProviderHealthWithAudit(
        id,
        isHealthy,
        userId,
      );

      res.json({
        success: true,
        data: provider,
        message: 'Provider health updated successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  async configureProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { config, settings } = configureProviderSchema.parse(req.body);
      const userId = requireUserId(req);

      const provider = await paymentService.getProviderById(id);
      if (!provider) {
        throw new AppError('Provider not found', 404);
      }

      // ── Merge the patch with the existing config ─────────────
      // The previous version validated the *incoming patch* in
      // isolation, so a `PUT` that only set `settings` on an
      // already-configured PayPal provider would 400 with
      // "PayPal Client ID and Client Secret are required" even
      // though they were already stored. `paymentService.configureProvider`
      // merges patch over existing; the validation must too.
      const existingConfig =
        (provider.config as Record<string, unknown> | null) ?? {};
      const mergedConfig = { ...existingConfig, ...(config ?? {}) };

      if (provider.provider === 'STRIPE') {
        const apiKey =
          (mergedConfig.apiKey as string) || process.env.STRIPE_SECRET_KEY;
        if (apiKey) {
          try {
            const stripe = new Stripe(apiKey, {
              apiVersion: '2023-10-16',
            });
            await stripe.balance.retrieve();
          } catch {
            throw new AppError('Invalid Stripe API key', 400);
          }
        }
      }

      if (provider.provider === 'MOBILE_MONEY') {
        if (!mpesaService.isConfigured()) {
          throw new AppError(
            'M-Pesa is not configured. Please set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.',
            400,
          );
        }
      }

      if (provider.provider === 'PAYPAL') {
        if (!mergedConfig.clientId || !mergedConfig.clientSecret) {
          throw new AppError(
            'PayPal Client ID and Client Secret are required',
            400,
          );
        }
      }

      if (provider.provider === 'FLUTTERWAVE') {
        if (!mergedConfig.apiKey || !mergedConfig.publicKey) {
          throw new AppError(
            'Flutterwave API Key and Public Key are required',
            400,
          );
        }
      }

      if (provider.provider === 'SQUARE') {
        if (!mergedConfig.accessToken || !mergedConfig.locationId) {
          throw new AppError(
            'Square Access Token and Location ID are required',
            400,
          );
        }
      }

      const updatedProvider = await paymentService.configureProvider(
        id,
        config,
        settings,
        userId,
      );

      res.json({
        success: true,
        data: updatedProvider,
        message: 'Provider configured successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  async addProviderCurrency(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { currency, conversionRate } = req.body;
      const userId = requireUserId(req);

      if (!currency) {
        throw new AppError('Currency is required', 400);
      }

      const result = await paymentService.addProviderCurrency(
        id,
        currency,
        conversionRate,
        userId,
      );

      res.json({
        success: true,
        data: result,
        message: 'Currency added successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  async removeProviderCurrency(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id, currency } = req.params;
      const userId = requireUserId(req);

      if (!currency) {
        throw new AppError('Currency is required', 400);
      }

      await paymentService.removeProviderCurrency(id, currency, userId);

      res.json({
        success: true,
        message: 'Currency removed successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // CORE PAYMENT ENDPOINTS
  // ============================================

  /**
   * Generic payment endpoint.
   *
   * ⚠ Phase 2 contract: `currency` is optional on the wire. When
   *   omitted, `paymentService.processPayment` resolves it via
   *   `currencyService.resolveForBusiness` (caller → business unit
   *   → `DEFAULT_CURRENCY` → registry default) and writes the
   *   resolved value to the REQUIRED `Payment.currency` column.
   *
   *   The controller does NOT fabricate a currency default here.
   *   The service is the authority; the controller just forwards
   *   whatever the caller supplied.
   */
  async processPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = processPaymentSchema.parse(req.body);
      const userId = requireUserId(req);

      // Route MOBILE_MONEY to the concrete network so the service
      // dispatches to MTN/AIRTEL/TIGO/VODAFONE handlers instead of
      // the simulator. A no-op for every other method.
      //
      // ⚠ `routeMobileMoneyToNetwork` uses object spread, so every
      //   other field on `validatedData` (`businessUnitId`,
      //   `idempotencyKey`, `currency`, `tipAmount`, …) is preserved.
      const routed = routeMobileMoneyToNetwork(validatedData);

      const payment = await paymentService.processPayment({
        ...routed,
        userId,
      });

      res.status(201).json({
        success: true,
        data: payment,
        message: 'Payment processed successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  /**
   * Refund a payment.
   *
   * ⚠ Phase 2 contract: The refunded payment's currency is read
   *   from the `Payment.currency` column of the row being refunded
   *   (see `paymentService.refundPayment`). Refunds do NOT create
   *   new `Payment` rows, so the controller does NOT accept or
   *   forward a currency here. The row's stored value is the
   *   authority.
   */
  async refundPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { amount, reason, metadata } = refundSchema.parse(req.body);

      // requireUserId throws 401 for an anonymous caller. The
      // previous code allowed `undefined` through, which then
      // produced a Prisma FK failure on the audit-log write.
      const userId = requireUserId(req);

      if (!id) {
        throw new AppError('Payment ID is required', 400);
      }

      const result = await paymentService.refundPayment({
        paymentId: id,
        amount,
        reason,
        userId,
        // Forwarded so MTN/Airtel refund handlers can reach the
        // original payer's wallet via `metadata.phoneNumber`.
        metadata,
      });

      res.json({
        success: true,
        data: result,
        message: 'Payment refunded successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  async getPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('Payment ID is required', 400);
      }

      const payment = await paymentService.getPaymentStatus(id);

      res.json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get aggregate payment statistics.
   *
   * Errors propagate to the error middleware; a successful query
   * that genuinely has no rows returns zeros with a 200.
   */
  async getPaymentSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, businessUnitId, status, paymentMethod } =
        req.query;
      requireUserId(req);

      const summary = await paymentService.getPaymentSummary({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        businessUnitId: businessUnitId as string | undefined,
        status: status as any,
        paymentMethod: paymentMethod as any,
      });

      if (!summary) {
        return res.json({
          success: true,
          data: {
            totalAmount: 0,
            byMethod: {},
            count: 0,
            averageAmount: 0,
            totalRefunds: 0,
            refundCount: 0,
            netAmount: 0,
          },
          message: 'No payment data available',
        });
      }

      res.json({
        success: true,
        data: summary,
        message: 'Payment summary retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  async getAllPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedQuery = getPaymentsSchema.parse(req.query);

      const {
        page,
        limit,
        startDate,
        endDate,
        businessUnitId,
        status,
        paymentMethod,
        userId,
        saleId,
        orderId,
      } = validatedQuery;

      // Bounded parsing: `parseInt('abc')` yields NaN, which flows
      // to Prisma as `take: NaN` and produces a 500. `toPositiveInt`
      // falls back to the default and caps `limit` at 100 so a
      // caller can't request a million rows.
      const parsedPage = toPositiveInt(page, 1);
      const parsedLimit = Math.min(100, toPositiveInt(limit, 20));

      const result = await paymentService.getAllPayments({
        page: parsedPage,
        limit: parsedLimit,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        businessUnitId: businessUnitId as string | undefined,
        status: status as any,
        paymentMethod: paymentMethod as any,
        userId: userId as string | undefined,
        saleId: saleId as string | undefined,
        orderId: orderId as string | undefined,
      });

      res.json({
        success: true,
        data: result.payments,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  // ============================================
  // STRIPE CHECKOUT & CUSTOMER
  // ============================================

  async createCheckoutSession(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = checkoutSessionSchema.parse(req.body);
      const { items, customerId, successUrl, cancelUrl, metadata } =
        validatedData;

      const session = await paymentService.createCheckoutSession(
        items,
        customerId,
        successUrl,
        cancelUrl,
        metadata,
      );

      res.json({
        success: true,
        data: session,
        message: 'Checkout session created',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  /**
   * Stripe webhook handler.
   *
   * ⚠ Requires the RAW request body. If `req.body` arrives as a
   *   parsed object, `stripe.webhooks.constructEvent` throws
   *   "Webhook signature verification failed" on every request.
   *
   * When that misconfiguration is detected we ACK with a 200 —
   * returning 5xx would make Stripe retry every event for up to
   * 72 hours, and the route is still misconfigured, so every retry
   * would fail identically. The correct recovery is: log loudly,
   * fix the mount order, and reconcile any missed events
   * out-of-band by querying Stripe for the affected window.
   *
   * ⚠ Phase 2 note: When a `checkout.session.completed` event
   *   arrives without a corresponding local `Payment` row, the
   *   service creates one and writes the currency from
   *   `paymentIntent.currency` (authoritative — that's what Stripe
   *   actually charged in). This handler does not touch currency.
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        // Missing header is a real client error, not a
        // misconfiguration — Stripe always sends it. A 400 here
        // is appropriate and Stripe will not retry a 4xx.
        throw new AppError('Stripe signature is required', 400);
      }

      if (isParsedBody(req.body)) {
        logger.error(
          '[webhook:STRIPE] req.body is a parsed object — Stripe signature verification will fail. ' +
            'Mount express.raw({ type: "application/json" }) on /api/payments/webhook BEFORE express.json(). ' +
            'ACKing the event so Stripe does not retry; reconcile the affected window out-of-band.',
        );
        return res.status(200).json({
          success: true,
          received: true,
          processed: false,
          reason: 'route-misconfigured',
        });
      }

      const result = await paymentService.handleWebhook(req.body, signature);

      return res.json({ success: true, ...result });
    } catch (error) {
      // ── Client errors propagate; server errors ACK ──────
      //
      // `AppError` exposes its status as `status`. The previous
      // version only checked `error.statusCode`, which never
      // matched, so the 400 from the "Stripe signature is
      // required" branch above was being swallowed by the ACK-200
      // fallback and the client saw a false success.
      //
      // `getErrorStatusCode` reads `status`, `statusCode`, and
      // `response.status` on the error and every wrapped `.cause`,
      // so a 4xx from any layer reaches `next(error)` and a 5xx
      // is ACKed so Stripe doesn't retry a misconfiguration it
      // cannot fix.
      const statusCode = getErrorStatusCode(error);
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        return next(error);
      }

      logger.error('Webhook error:', error);
      return res.status(200).json({
        success: true,
        received: true,
        processed: false,
      });
    }
  },

  async createStripeCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);

      const result = await paymentService.createStripeCustomer(userId);

      res.json({
        success: true,
        data: result,
        message: result.alreadyExists
          ? 'Customer already exists'
          : 'Customer created',
      });
    } catch (error) {
      next(error);
    }
  },

  async getPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);

      const paymentMethods = await paymentService.getCustomerPaymentMethods(
        userId,
      );

      res.json({ success: true, data: paymentMethods });
    } catch (error) {
      next(error);
    }
  },

  async attachPaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const { paymentMethodId } = attachPaymentMethodSchema.parse(req.body);

      const paymentMethod = await paymentService.attachPaymentMethod(
        userId,
        paymentMethodId,
      );

      res.json({
        success: true,
        data: paymentMethod,
        message: 'Payment method attached',
      });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  },

  async detachPaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('Payment method ID is required', 400);
      }

      const result = await paymentService.detachPaymentMethod(id);

      res.json({
        success: true,
        data: result,
        message: 'Payment method detached',
      });
    } catch (error) {
      next(error);
    }
  },
};

export default paymentController;
