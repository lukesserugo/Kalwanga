// D:\Projects\Kalwanga\packages\backend\src\controllers\mpesaController.ts

import { Request, Response, NextFunction } from 'express';
import { mpesaService } from '../services/mpesaService.js';
import { paymentService } from '../services/paymentService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { logger } from '../lib/logger.js';

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

const stkPushSchema = z.object({
  phoneNumber: z
    .string()
    .regex(PHONE_REGEX, 'Phone number format is invalid'),
  amount: z.number().positive('Amount must be positive'),
  accountReference: z.string().optional(),
  transactionDesc: z.string().optional(),
  callbackUrl: z.string().url().optional(),
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

// ============================================
// CONTROLLER
// ============================================

export const mpesaController = {
  /**
   * Initiate STK Push payment.
   * POST /mpesa/stk-push
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

      const payment = await paymentService.createPendingPayment({
        amount: validatedData.amount,
        paymentMethod: 'MOBILE_MONEY',
        userId,
        transactionId: result.CheckoutRequestID,
        reference: result.MerchantRequestID,
        metadata: {
          checkoutRequestId: result.CheckoutRequestID,
          merchantRequestId: result.MerchantRequestID,
          phoneNumber: validatedData.phoneNumber,
          provider: 'MPESA',
          source: 'mpesa-controller',
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
