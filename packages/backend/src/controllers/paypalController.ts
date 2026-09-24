// src/controllers/paypalController.ts

import { Request, Response, NextFunction } from 'express';
import { BaseService } from '../services/BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { paymentService } from '../services/paymentService.js';
import { prisma } from '../lib/prisma.js';
import { PaymentMethod } from '../generated/prisma/index.js';

// ============================================
// REQUEST BODY TYPES
// ============================================

interface CreateOrderBody {
  amount: number;
  currency?: string;
  description?: string;
  saleId?: string;
  orderId?: string;
  customerEmail?: string;
  customerName?: string;
  returnUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

interface CaptureOrderBody {
  orderId?: string;
  saleId?: string;
  metadata?: Record<string, any>;
}

interface RefundBody {
  transactionId: string;
  amount?: number;
  currency?: string;
  reason?: string;
  noteToPayer?: string;
}

// ============================================
// CONTROLLER
// ============================================

class PayPalController extends BaseService {
  // ============================================
  // CONFIG / STATUS
  // ============================================

  getStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const configured = !!(
        process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
      );

      res.status(200).json({
        success: true,
        data: {
          provider: 'PAYPAL',
          configured,
          environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
          webhookConfigured: !!process.env.PAYPAL_WEBHOOK_ID,
        },
      });
    } catch (error) {
      this.handleError(error, 'PayPalController.getStatus');
      next(error);
    }
  };

  // ============================================
  // ORDER CREATION
  // ============================================

  createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const body = req.body as CreateOrderBody;

      if (!body.amount || body.amount <= 0) {
        throw new AppError('Amount must be positive', 400);
      }

      const result = await paymentService.processPayment({
        amount: body.amount,
        currency: body.currency || 'USD',
        paymentMethod: 'PAYPAL',
        description: body.description,
        saleId: body.saleId,
        orderId: body.orderId,
        userId,
        idempotencyKey: body.idempotencyKey,
        metadata: {
          ...(body.metadata || {}),
          customerEmail: body.customerEmail,
          customerName: body.customerName,
          returnUrl: body.returnUrl,
          cancelUrl: body.cancelUrl,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'PAYPAL_ORDER',
          entityId: result.id,
          entityName: `PayPal order ${result.id}`,
          userId,
          changes: {
            amount: body.amount,
            currency: body.currency || 'USD',
            saleId: body.saleId,
            orderId: body.orderId,
          },
          severity: 'INFO',
        },
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.handleError(error, 'PayPalController.createOrder');
      next(error);
    }
  };

  // ============================================
  // ORDER CAPTURE
  // ============================================

  captureOrder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const body = req.body as CaptureOrderBody;
      const paramOrderId =
        typeof req.params.orderId === 'string'
          ? req.params.orderId
          : undefined;
      const orderId = paramOrderId || body.orderId;

      if (!orderId) {
        throw new AppError('PayPal order ID is required', 400);
      }

      const result = await paymentService.capturePayPalOrder(orderId);

      // Resolve the local Payment row first so we pass a real
      // paymentId to the checkout service — an empty string would
      // leave the capture unlinked from its Payment row.
      const payment = await paymentService.getPaymentByTransactionId(
        orderId,
      );

      const saleId = body.saleId || payment?.saleId || '';
      const paymentId = payment?.id || '';

      if (saleId) {
        try {
          const { checkoutService } = await import(
            '../services/checkoutService.js'
          );
          await checkoutService.markSalePaidFromWebhook(
            saleId,
            paymentId,
            result.captureData,
            'PAYPAL',
          );
        } catch (err) {
          logger.error(
            `[paypal:capture] Failed to complete checkout for sale ${saleId}:`,
            err,
          );
        }
      }

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'PAYPAL_ORDER',
          entityId: orderId,
          entityName: `PayPal capture ${result.id}`,
          userId,
          changes: {
            status: result.status,
            amount: result.amount,
            currency: result.currency,
            saleId,
            paymentId,
          },
          severity: 'INFO',
        },
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.handleError(error, 'PayPalController.captureOrder');
      next(error);
    }
  };

  // ============================================
  // REFUND
  // ============================================

  refund = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const body = req.body as RefundBody;

      if (!body.transactionId) {
        throw new AppError('transactionId is required', 400);
      }

      if (
        body.amount !== undefined &&
        (typeof body.amount !== 'number' || body.amount <= 0)
      ) {
        throw new AppError(
          'Refund amount must be a positive number',
          400,
        );
      }

      // Look up the local payment by PayPal order/capture id.
      const payment = await paymentService.getPaymentByTransactionId(
        body.transactionId,
      );

      if (!payment) {
        throw new AppError(
          `No payment found for transaction ${body.transactionId}`,
          404,
        );
      }

      const result = await paymentService.refundPayment(
        payment.id,
        body.amount,
        body.reason,
        userId,
      );

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'PAYPAL_REFUND',
          entityId: payment.id,
          entityName: `PayPal refund ${payment.id}`,
          userId,
          changes: {
            transactionId: body.transactionId,
            amount: body.amount,
            currency: body.currency,
            reason: body.reason,
          },
          severity: 'INFO',
        },
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.handleError(error, 'PayPalController.refund');
      next(error);
    }
  };

  // ============================================
  // TRANSACTION STATUS
  // ============================================

  getTransactionStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const { transactionId } = req.params;

      if (!transactionId) {
        throw new AppError('transactionId is required', 400);
      }

      const payment = await paymentService.getPaymentByTransactionId(
        transactionId,
      );

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      res.status(200).json({
        success: true,
        data: {
          status: payment.status,
          transactionId: payment.transactionId,
          paymentId: payment.id,
          provider: 'PAYPAL',
          amount: payment.amount,
          currency: payment.currency,
          createdAt: payment.processedAt,
        },
      });
    } catch (error) {
      this.handleError(error, 'PayPalController.getTransactionStatus');
      next(error);
    }
  };

  // ============================================
  // WEBHOOK
  // ============================================

  /**
   * PayPal webhook receiver.
   *
   * Signature verification is not implemented on the service side
   * (see `PayPalService.verifyWebhookSignature`). Until it is, this
   * endpoint trusts all inbound payloads. Acceptable in sandbox;
   * must be implemented before handling real money.
   *
   * Always responds 200 to PayPal for non-fatal errors, because
   * PayPal retries on non-2xx responses and a retry storm is worse
   * than a dropped event. The only case where a non-200 is returned
   * is a 400 AppError (malformed payload that will never succeed on
   * retry).
   */
  handleWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body);

      const payload = Buffer.isBuffer(req.body)
        ? JSON.parse(rawBody)
        : req.body;

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers[key] = value;
        else if (Array.isArray(value)) headers[key] = value.join(', ');
      }

      const eventType = payload?.event_type || 'unknown';
      const eventId = payload?.id || '';

      logger.info(
        `[paypal:webhook] Received ${eventType} (${eventId})`,
      );

      const result = await paymentService.handlePayPalWebhook(
        payload,
        headers,
      );

      res.status(200).json({ received: true, ...result });
    } catch (error) {
      this.handleError(error, 'PayPalController.handleWebhook');

      // Narrow `unknown` into stable booleans first — TypeScript
      // will not carry `instanceof` narrowing across the ternary
      // below if the checks and their usage live on separate
      // statements.
      const isAppError = error instanceof AppError;
      const isError = error instanceof Error;

      const status =
        isAppError && (error as AppError).status === 400 ? 400 : 200;

      const message = isError
        ? (error as Error).message
        : 'Unknown error';

      res.status(status).json({
        received: false,
        error: message,
      });
    }
  };

  // ============================================
  // ADMIN: LIST PAYPAL PAYMENTS
  // ============================================

  listPayments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit as string) || 20),
      );
      const skip = (page - 1) * limit;

      const where = {
        paymentMethod: PaymentMethod.PAYPAL,
        ...(req.query.status && { status: req.query.status as any }),
        ...(req.query.saleId && { saleId: req.query.saleId as string }),
        ...(req.query.orderId && {
          orderId: req.query.orderId as string,
        }),
      };

      const [payments, total] = await Promise.all([
        this.prisma.payment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { processedAt: 'desc' },
          include: {
            sale: {
              select: {
                id: true,
                receiptNumber: true,
                total: true,
              },
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
                total: true,
              },
            },
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        }),
        this.prisma.payment.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          payments,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      this.handleError(error, 'PayPalController.listPayments');
      next(error);
    }
  };
}

export const paypalController = new PayPalController();
export default paypalController;
