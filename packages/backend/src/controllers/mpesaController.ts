// D:\Projects\Kalwanga\packages\backend\src\controllers\mpesaController.ts

import { Request, Response, NextFunction } from 'express';
import { mpesaService } from '../services/mpesaService.js';
import { paymentService } from '../services/paymentService.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { logger } from '../lib/logger.js';

// ============================================
// DEFAULT CURRENCY
// ============================================
//
// Mirrors the precedence in `paymentService`, `checkoutService`,
// and `paymentController`: caller-supplied value wins, then
// `DEFAULT_CURRENCY`, then a hardcoded UGX fallback (the deployment
// is Ugandan — USD was the wrong default for every endpoint that
// omitted a currency).
//
// ⚠ Phase 2: `Payment.currency` is now a REQUIRED column with no
//   schema default. Every `paymentService.createPendingPayment`
//   call site in this file must pass a resolved currency or a
//   businessUnitId that lets the service resolve one. The
//   fallback here matches the one in `paymentController`.

const DEFAULT_CURRENCY_FALLBACK = 'UGX';

function resolveDefaultCurrency(): string {
  return process.env.DEFAULT_CURRENCY || DEFAULT_CURRENCY_FALLBACK;
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

/**
 * Phone number regex.
 *
 * Accepts digits, spaces, `+`, `(`, `)`, `-`. Enforces an absolute
 * minimum of 10 digits. The service layer applies the
 * provider-specific format check.
 */
const PHONE_REGEX = /^[+\d][\d\s()-]{9,19}$/;

/**
 * STK Push body.
 *
 * ⚠ Phase 2: `currency` and `businessUnitId` are accepted here for
 *   parity with `paymentController.mpesaSTKPushSchema`. The two
 *   controllers serve the same logical operation (initiate an
 *   M-Pesa STK push and create a PENDING Payment) and MUST accept
 *   the same wire contract, or a client that works against one
 *   fails mysteriously against the other.
 *
 *   Both are optional. `businessUnitId` is read by the service's
 *   `resolveCurrency` when `currency` is absent. When neither is
 *   supplied, the controller falls back to the platform default
 *   via `resolveDefaultCurrency()`.
 */
const stkPushSchema = z.object({
  phoneNumber: z
    .string()
    .regex(PHONE_REGEX, 'Phone number format is invalid'),
  amount: z.number().positive('Amount must be positive'),
  accountReference: z.string().optional(),
  transactionDesc: z.string().optional(),
  callbackUrl: z.string().url().optional(),
  /**
   * Optional. When omitted, the controller supplies the platform
   * default via `resolveDefaultCurrency()`. The service re-resolves
   * through `currencyService` if the value is unknown.
   */
  currency: z.string().optional(),
  /**
   * Optional. Read by the service's `resolveCurrency` when
   * `currency` is absent, and written to `Payment.businessUnitId`
   * for audit attribution.
   */
  businessUnitId: z.string().optional(),
  /**
   * Optional linkage to a Sale or Order. Forwarded so the
   * callback handler can complete the correct row.
   */
  saleId: z.string().optional(),
  orderId: z.string().optional(),
  /**
   * Optional idempotency key for the Payment row. When omitted,
   * the service derives a deterministic one from the payment's
   * salient fields.
   */
  idempotencyKey: z.string().optional(),
  /**
   * Optional customer linkage written into `Payment.metadata.customerId`.
   */
  customerId: z.string().optional(),
});

const transactionStatusSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
});

const b2cPaymentSchema = z.object({
  phoneNumber: z
    .string()
    .regex(PHONE_REGEX, 'Phone number format is invalid'),
  amount: z.number().positive('Amount must be positive'),
  commandId: z.enum(['BusinessPayment', 'SalaryPayment', 'PromotionPayment']),
  remarks: z.string().optional(),
  occasion: z.string().optional(),
  /**
   * ⚠ Accepted for forward compatibility but NOT consumed by the
   *   B2C handler. Safaricom's B2C v1 API reads the currency from
   *   the shortcode's country configuration on Safaricom's side;
   *   `mpesaService.processB2CPayment` does not accept a currency
   *   argument. Kept here so an existing client that sends it
   *   doesn't trip a validation error.
   */
  currency: z.string().optional(),
});

// ============================================
// HELPERS
// ============================================

/**
 * Extract the authenticated user's ID from the request.
 *
 * Supports both `req.user.id` and `req.user.userId` because
 * different auth middlewares populate one or the other. The Clerk
 * middleware populates `.userId`.
 */
function requireUserId(req: Request): string {
  const userId = (req as any).user?.id ?? (req as any).user?.userId;
  if (!userId) {
    throw new AppError('User ID is required', 401);
  }
  return userId;
}

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
 * Resolve the effective business unit for a request.
 *
 * Mirrors the precedence used elsewhere in the codebase (see
 * `cartController.getBusinessUnitId`): explicit header / body /
 * query value wins, then the user's own unit, then the most recent
 * active unit. Returns `undefined` if nothing resolves — the
 * service's `resolveCurrency` will then fall through to
 * `DEFAULT_CURRENCY`.
 *
 * ⚠ Phase 2: The resolved value is passed to
 *   `createPendingPayment`, which uses it (a) as the row's
 *   `businessUnitId` for audit attribution and (b) as the
 *   `currency` lookup key when no explicit currency is supplied.
 *   Without this, a Ugandan business unit with its own currency
 *   column would have its M-Pesa PENDING Payment written as the
 *   platform default instead.
 */
async function resolveBusinessUnitId(
  req: Request,
): Promise<string | undefined> {
  const user = (req as any).user;

  // 1. Explicit override (header > body > query).
  const explicit =
    (req.headers['x-business-unit-id'] as string | undefined) ||
    (req.body?.businessUnitId as string | undefined) ||
    (req.query?.businessUnitId as string | undefined);

  if (
    explicit &&
    explicit !== 'default' &&
    explicit !== 'default-business-unit'
  ) {
    const exists = await prisma.businessUnit.findUnique({
      where: { id: explicit },
      select: { id: true, isActive: true },
    });
    if (exists && exists.isActive) {
      return exists.id;
    }
    logger.warn(
      `[mpesa] Explicit businessUnitId "${explicit}" not found or inactive — falling back`,
    );
  }

  // 2. User's own unit.
  const userBu =
    user?.businessUnitId ||
    user?.businessUnits?.[0]?.businessUnitId ||
    user?.businessUnits?.[0]?.id;

  if (userBu && userBu !== 'default') {
    const exists = await prisma.businessUnit.findUnique({
      where: { id: userBu },
      select: { id: true, isActive: true },
    });
    if (exists && exists.isActive) {
      return exists.id;
    }
  }

  // 3. Not resolved. Caller passes `undefined` to the service,
  //    which then falls back to the platform default currency.
  //    This is intentionally NOT the "most recent active unit"
  //    walk — that path belongs to `cartController.getBusinessUnitId`
  //    and would silently attribute the payment to an arbitrary
  //    BU. M-Pesa callers who don't supply a BU get the platform
  //    default and a null BU on the row.
  return undefined;
}

// ============================================
// CONTROLLER
// ============================================

export const mpesaController = {
  /**
   * Initiate STK Push payment.
   * POST /mpesa/stk-push
   *
   * ⚠ Phase 2: The PENDING Payment row created here requires a
   *   resolved currency. This handler forwards the caller's
   *   `currency` and `businessUnitId`; when neither is supplied,
   *   it falls back to `resolveDefaultCurrency()`. The service's
   *   `resolveCurrency` re-validates the value through
   *   `currencyService` before writing the row.
   */
  async initiateSTKPush(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = stkPushSchema.parse(req.body);
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

      // ── Phase 2: currency resolution ─────────────────────
      // Prefer the caller's `businessUnitId` when it resolves (the
      // service will then read the BU's own currency). Fall back
      // to the caller's explicit `currency` if no BU resolves.
      // Final fallback is the platform default.
      //
      // The service's `resolveCurrency` handles the ordering
      // authoritatively — this is just what we hand it.
      const resolvedBusinessUnitId = await resolveBusinessUnitId(req);

      const payment = await paymentService.createPendingPayment({
        amount: validatedData.amount,
        paymentMethod: 'MOBILE_MONEY',
        userId,
        saleId: validatedData.saleId,
        orderId: validatedData.orderId,
        currency:
          validatedData.currency || resolveDefaultCurrency(),
        businessUnitId:
          validatedData.businessUnitId ?? resolvedBusinessUnitId,
        transactionId: result.CheckoutRequestID,
        reference: result.MerchantRequestID,
        idempotencyKey: validatedData.idempotencyKey,
        metadata: {
          checkoutRequestId: result.CheckoutRequestID,
          merchantRequestId: result.MerchantRequestID,
          phoneNumber: validatedData.phoneNumber,
          provider: 'MPESA',
          source: 'mpesa-controller',
          idempotencyKey: validatedData.idempotencyKey ?? null,
          customerId: validatedData.customerId ?? null,
          businessUnitId:
            validatedData.businessUnitId ??
            resolvedBusinessUnitId ??
            null,
        },
      });

      res.json({
        success: true,
        data: {
          ...result,
          paymentId: payment.id,
        },
        message: 'STK Push initiated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
      next(error);
    }
  },

  /**
   * Query transaction status.
   * GET /mpesa/status/:transactionId
   */
  async queryTransactionStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { transactionId } = transactionStatusSchema.parse(req.params);

      const result = await mpesaService.queryTransactionStatus({
        transactionId,
        shortcode: process.env.MPESA_SHORTCODE || '174379',
      });

      res.json({
        success: true,
        data: result,
        message: 'Transaction status retrieved successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
      next(error);
    }
  },

  /**
   * Handle STK Push callback (Safaricom webhook).
   * POST /mpesa/callback
   *
   * ⚠ This is the endpoint Safaricom posts to after the customer
   *   enters their PIN. It must:
   *
   *     1. Update the Payment row to PAID / FAILED.
   *     2. Call `CheckoutService.markSalePaidFromWebhook`, which
   *        posts loyalty points, creates the Receipt row, writes
   *        the audit log, and dispatches the completion event.
   *
   *   Step 2 is what the previous version of this controller was
   *   missing — see the `markSalePaidFromWebhook` call below.
   *
   *   The sibling handler at `paymentController.handleMpesaCallback`
   *   already does this. Both callbacks MUST behave identically
   *   regardless of which URL Safaricom was configured to hit.
   *
   * ⚠ Phase 2 note: This handler only UPDATEs the existing
   *   `Payment` row (created by `initiateSTKPush`). It never
   *   creates one, so no currency resolution is required here —
   *   the row's `currency` column was already populated at
   *   creation time. `markSalePaidFromWebhook` reads the currency
   *   from the row when it needs to render a receipt.
   */
  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      logger.info('M-Pesa callback received:', JSON.stringify(req.body));

      const result = await mpesaService.handleSTKPushCallback(req.body);

      const payment = await paymentService.getPaymentByTransactionId(
        result.checkoutRequestId,
      );

      if (!payment) {
        logger.warn(
          `[webhook:MPESA] No payment found for CheckoutRequestID ${result.checkoutRequestId} — callback dropped`,
        );
        return res
          .status(200)
          .json({ ResultCode: 0, ResultDesc: 'Success' });
      }

      // Short-circuit if we've already handled this callback.
      // Safaricom retries aggressively and `markSalePaidFromWebhook`
      // would no-op anyway, but doing this early avoids the extra
      // write and makes the idempotency explicit.
      if (payment.status === 'PAID' || payment.status === 'FAILED') {
        logger.info(
          `[webhook:MPESA] Payment ${payment.id} already ${payment.status} — idempotent skip`,
        );
        return res
          .status(200)
          .json({ ResultCode: 0, ResultDesc: 'Success' });
      }

      if (result.isSuccess) {
        // ⚠ Merge into existing metadata — do NOT overwrite. The
        //   original metadata carries `phoneNumber` and
        //   `merchantRequestId`, which downstream tools use.
        await paymentService.updatePaymentStatus(payment.id, 'PAID', {
          metadata: {
            ...((payment.metadata as any) ?? {}),
            callbackData: result.callbackMetadata,
            resultCode: result.resultCode,
            resultDesc: result.resultDesc,
            confirmedAt: new Date().toISOString(),
          },
          notes: `M-Pesa payment successful: ${result.resultDesc}`,
        });

        // ⚠ Complete the linked Sale via CheckoutService. This
        //   is what posts loyalty points, writes the receipt, and
        //   dispatches the event. Without it, the Sale shows
        //   COMPLETED but the customer earns nothing.
        const saleId = payment.saleId;
        if (saleId) {
          const { checkoutService } = await import(
            '../services/checkoutService.js'
          );
          await checkoutService.markSalePaidFromWebhook(
            saleId,
            payment.id,
            result.callbackMetadata ?? result,
            'MPESA',
          );
        } else if (payment.orderId) {
          // Legacy POS path — Order-only linkage, no Sale row.
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
          metadata: {
            ...((payment.metadata as any) ?? {}),
            callbackData: result.callbackMetadata,
            resultCode: result.resultCode,
            resultDesc: result.resultDesc,
            failedAt: new Date().toISOString(),
          },
          notes: `M-Pesa payment failed: ${result.resultDesc}`,
        });

        // Fail the linked Sale so its inventory reservation is
        // released and any pending state is cleared.
        const saleId = payment.saleId;
        if (saleId) {
          const { checkoutService } = await import(
            '../services/checkoutService.js'
          );
          await checkoutService.markSaleFailedFromWebhook(
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

      // ⚠ Always return 200 to Safaricom. It retries on any
      //   non-2xx response, and its retry policy is undocumented.
      //   Reconciliation of dropped callbacks is handled out of
      //   band by a job that queries `queryTransactionStatus` for
      //   any PENDING payment older than N minutes. The structured
      //   warn log above gives that job a list to work from.
      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success',
      });
    } catch (error) {
      logger.error('Callback processing error:', {
        error,
        body: req.body,
      });
      // Still 200 — see the comment above.
      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success',
      });
    }
  },

  /**
   * Process B2C payment (Business to Customer).
   * POST /mpesa/b2c
   *
   * ⚠ Currency is NOT forwarded. Safaricom's B2C v1 API reads the
   *   currency from the shortcode's country configuration on
   *   Safaricom's side — the request body has no `Currency` field
   *   and `mpesaService.processB2CPayment` does not accept one.
   *   `b2cPaymentSchema.currency` remains accepted at the wire
   *   boundary for forward compatibility but is not consumed.
   */
  async processB2CPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = b2cPaymentSchema.parse(req.body);
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
        // ⚠ No `currency` — see the JSDoc above.
      });

      res.json({
        success: true,
        data: result,
        message: 'B2C payment initiated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
      next(error);
    }
  },

  /**
   * Register C2B URLs with Safaricom.
   * POST /mpesa/register-c2b
   */
  async registerC2BURL(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await mpesaService.registerC2BURL();

      res.json({
        success: true,
        data: result,
        message: 'C2B URLs registered successfully',
      });
    } catch (error) {
      next(error);
    }
  },
};

export default mpesaController;
