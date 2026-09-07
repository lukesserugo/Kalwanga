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

const stkPushSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number is required'),
  amount: z.number().positive('Amount must be positive'),
  accountReference: z.string().optional(),
  transactionDesc: z.string().optional(),
  callbackUrl: z.string().url().optional(),
});

const transactionStatusSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
});

const b2cPaymentSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number is required'),
  amount: z.number().positive('Amount must be positive'),
  commandId: z.enum(['BusinessPayment', 'SalaryPayment', 'PromotionPayment']),
  remarks: z.string().optional(),
  occasion: z.string().optional(),
});

// ============================================
// CONTROLLER
// ============================================

export const mpesaController = {
  /**
   * Initiate STK Push payment
   * POST /api/mpesa/stk-push
   */
  async initiateSTKPush(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = stkPushSchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      // Ensure M-Pesa is configured
      if (!mpesaService.isConfigured()) {
        throw new AppError('M-Pesa is not configured. Please contact support.', 503);
      }

      const result = await mpesaService.initiateSTKPush({
        phoneNumber: validatedData.phoneNumber,
        amount: validatedData.amount,
        accountReference: validatedData.accountReference || `PAY-${Date.now()}`,
        transactionDesc: validatedData.transactionDesc || 'Payment via M-Pesa',
        callbackUrl: validatedData.callbackUrl,
      });

      // Create pending payment record
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Query transaction status
   * GET /api/mpesa/status/:transactionId
   */
  async queryTransactionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { transactionId } = req.params;

      if (!transactionId) {
        throw new AppError('Transaction ID is required', 400);
      }

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
      next(error);
    }
  },

  /**
   * Handle STK Push callback (webhook)
   * POST /api/mpesa/callback
   */
  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      logger.info('M-Pesa callback received:', JSON.stringify(req.body));

      const result = await mpesaService.handleSTKPushCallback(req.body);

      // Update payment status based on callback
      if (result.isSuccess) {
        // Find payment by transaction ID
        const payment = await paymentService.getPaymentByTransactionId(result.checkoutRequestId);
        
        if (payment) {
          // Update payment to PAID
          await paymentService.updatePaymentStatus(payment.id, 'PAID', {
            metadata: {
              callbackData: result.callbackMetadata,
              resultCode: result.resultCode,
              resultDesc: result.resultDesc,
            },
          });

          // Update sale/order if exists
          if (payment.saleId) {
            await paymentService.updateSaleAfterPayment(payment.saleId, payment.amount, payment);
          }

          if (payment.orderId) {
            await paymentService.updateOrderAfterPayment(payment.orderId, payment.amount, payment);
          }
        }
      } else {
        // Update payment to FAILED
        const payment = await paymentService.getPaymentByTransactionId(result.checkoutRequestId);
        if (payment) {
          await paymentService.updatePaymentStatus(payment.id, 'FAILED', {
            notes: `M-Pesa payment failed: ${result.resultDesc}`,
          });
        }
      }

      // Respond to M-Pesa
      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success',
      });
    } catch (error) {
      logger.error('Callback processing error:', error);
      // Always respond with success to M-Pesa
      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success',
      });
    }
  },

  /**
   * Process B2C payment (Business to Customer)
   * POST /api/mpesa/b2c
   */
  async processB2CPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = b2cPaymentSchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('User ID is required', 400);
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Register C2B URLs
   * POST /api/mpesa/register-c2b
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
