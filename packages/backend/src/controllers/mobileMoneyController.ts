// D:\Projects\Kalwanga\packages\backend\src\controllers\mobileMoneyController.ts

import { Request, Response, NextFunction } from 'express';
import { mobileMoneyService } from '../services/mobileMoneyService.js';
import { paymentService } from '../services/paymentService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const initiatePaymentSchema = z.object({
  provider: z.enum(['MTN', 'AIRTEL']),
  phoneNumber: z.string().min(10, 'Phone number is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().optional().default('UGX'),
  reference: z.string().optional(),
  description: z.string().optional(),
  callbackUrl: z.string().url().optional(),
  saleId: z.string().optional(),
  orderId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const checkStatusSchema = z.object({
  provider: z.enum(['MTN', 'AIRTEL']),
  reference: z.string().min(1, 'Reference is required'),
});

const transferSchema = z.object({
  provider: z.enum(['MTN', 'AIRTEL']),
  phoneNumber: z.string().min(10, 'Phone number is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().optional().default('UGX'),
  reference: z.string().optional(),
  reason: z.string().optional(),
});

const validateAccountSchema = z.object({
  provider: z.enum(['MTN', 'AIRTEL']),
  phoneNumber: z.string().min(10, 'Phone number is required'),
});

const getBalanceSchema = z.object({
  provider: z.enum(['MTN', 'AIRTEL']),
});

// ============================================
// CONTROLLER
// ============================================

export const mobileMoneyController = {
  /**
   * Initiate Mobile Money payment
   * POST /api/mobile-money/pay
   */
  async initiatePayment(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    try {
      const validatedData = initiatePaymentSchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      logger.info(`📱 Initiating ${validatedData.provider} payment for amount ${validatedData.amount}`);

      // Initiate payment through mobile money service
      const result = await mobileMoneyService.initiatePayment(
        validatedData.provider,
        {
          phoneNumber: validatedData.phoneNumber,
          amount: validatedData.amount,
          currency: validatedData.currency || 'UGX',
          reference: validatedData.reference || `${validatedData.provider}-${Date.now()}`,
          description: validatedData.description || `Payment via ${validatedData.provider}`,
          callbackUrl: validatedData.callbackUrl,
          metadata: validatedData.metadata,
        }
      );

      // Create pending payment record
      const paymentData: {
        amount: number;
        paymentMethod: string;
        userId: string;
        transactionId: string;
        reference: string;
        metadata?: Record<string, any>;
      } = {
        amount: validatedData.amount,
        paymentMethod: 'MOBILE_MONEY',
        userId,
        transactionId: result.transactionId,
        reference: result.reference,
        metadata: {
          provider: validatedData.provider,
          phoneNumber: validatedData.phoneNumber,
          mobileMoneyResult: result,
          saleId: validatedData.saleId,
          orderId: validatedData.orderId,
          ...validatedData.metadata,
        },
      };

      const payment = await paymentService.createPendingPayment(paymentData);

      const duration = Date.now() - startTime;
      logger.info(`✅ ${validatedData.provider} payment initiated in ${duration}ms`);

      res.json({
        success: true,
        data: {
          ...result,
          paymentId: payment.id,
        },
        message: `${validatedData.provider} Mobile Money payment initiated successfully`,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Mobile Money payment failed after ${duration}ms:`, error);
      
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
   * Check Mobile Money transaction status
   * GET /api/mobile-money/status/:provider/:reference
   */
  async checkStatus(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    try {
      const { provider, reference } = req.params;

      if (!provider || !reference) {
        throw new AppError('Provider and reference are required', 400);
      }

      logger.info(`🔍 Checking ${provider} transaction status for ${reference}`);

      // Check status through mobile money service
      const result = await mobileMoneyService.checkStatus(
        provider as 'MTN' | 'AIRTEL',
        reference
      );

      // Update payment status if needed
      const payment = await paymentService.getPaymentByTransactionId(reference);
      
      if (payment) {
        const statusMap: Record<string, string> = {
          'SUCCESS': 'PAID',
          'SUCCESSFUL': 'PAID',
          'PENDING': 'PENDING',
          'FAILED': 'FAILED',
        };

        const newStatus = statusMap[result.status] || result.status;
        
        if (payment.status !== newStatus && result.status !== 'PENDING') {
          await paymentService.updatePaymentStatus(payment.id, newStatus, {
            notes: `${provider} Mobile Money status: ${result.status}`,
            metadata: {
              mobileMoneyStatus: result,
              provider,
              checkedAt: new Date().toISOString(),
            },
          });

          // If payment succeeded, update sale/order
          if (result.isSuccess) {
            const saleId = payment.metadata?.saleId;
            if (saleId) {
              await paymentService.updateSaleAfterPayment(saleId, payment.amount, payment);
            }
            const orderId = payment.metadata?.orderId;
            if (orderId) {
              await paymentService.updateOrderAfterPayment(orderId, payment.amount, payment);
            }
            await paymentService.createPaymentNotification(payment, 'succeeded');
          } else if (result.status === 'FAILED') {
            await paymentService.createPaymentNotification(payment, 'failed');
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`✅ ${provider} status checked in ${duration}ms`);

      res.json({
        success: true,
        data: {
          ...result,
          payment,
        },
        message: 'Transaction status retrieved successfully',
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Status check failed after ${duration}ms:`, error);
      next(error);
    }
  },

  /**
   * Handle Mobile Money callback (webhook)
   * POST /api/mobile-money/callback/:provider
   */
  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { provider } = req.params;
      
      logger.info(`📩 Mobile Money callback received for ${provider}:`, JSON.stringify(req.body));

      // Process callback through mobile money service
      const result = mobileMoneyService.handleCallback(
        provider as 'MTN' | 'AIRTEL',
        req.body
      );

      // Find and update payment
      const payment = await paymentService.getPaymentByTransactionId(result.reference);
      
      if (payment) {
        if (result.isSuccess) {
          // Update payment to PAID
          await paymentService.updatePaymentStatus(payment.id, 'PAID', {
            metadata: {
              mobileMoneyCallback: result,
              provider,
              callbackReceivedAt: new Date().toISOString(),
            },
            notes: `${provider} Mobile Money payment successful: ${result.status}`,
          });

          // Update sale/order
          const saleId = payment.metadata?.saleId;
          if (saleId) {
            await paymentService.updateSaleAfterPayment(saleId, payment.amount, payment);
          }
          const orderId = payment.metadata?.orderId;
          if (orderId) {
            await paymentService.updateOrderAfterPayment(orderId, payment.amount, payment);
          }

          // Create notification
          await paymentService.createPaymentNotification(payment, 'succeeded');
          
          logger.info(`✅ ${provider} payment successful: ${result.reference}`);
        } else {
          // Update payment to FAILED
          await paymentService.updatePaymentStatus(payment.id, 'FAILED', {
            notes: `${provider} Mobile Money payment failed: ${result.status}`,
            metadata: {
              mobileMoneyCallback: result,
              provider,
              callbackReceivedAt: new Date().toISOString(),
            },
          });

          await paymentService.createPaymentNotification(payment, 'failed');
          
          logger.warn(`⚠️ ${provider} payment failed: ${result.reference}`);
        }
      } else {
        logger.warn(`⚠️ No payment found for reference: ${result.reference}`);
      }

      // Always respond with success to the provider
      res.status(200).json({
        success: true,
        message: 'Callback processed successfully',
      });
    } catch (error) {
      logger.error('❌ Callback processing error:', error);
      // Always respond with success to prevent retries
      res.status(200).json({
        success: true,
        message: 'Callback received',
      });
    }
  },

  /**
   * Get available Mobile Money providers
   * GET /api/mobile-money/providers
   */
  async getProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const providers = mobileMoneyService.getAvailableProviders();

      res.json({
        success: true,
        data: providers.map(provider => ({
          provider,
          isConfigured: true,
          name: provider === 'MTN' ? 'MTN Mobile Money' : 'Airtel Money',
          countries: provider === 'MTN' 
            ? ['UG', 'RW', 'NG', 'GH', 'CM', 'CI', 'ZM']
            : ['TZ', 'KE', 'UG', 'GH', 'NG', 'RW', 'ZM'],
        })),
        message: 'Available providers retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Initiate transfer (B2C)
   * POST /api/mobile-money/transfer
   */
  async initiateTransfer(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    try {
      const validatedData = transferSchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      logger.info(`📤 Initiating ${validatedData.provider} transfer to ${validatedData.phoneNumber}`);

      const result = await mobileMoneyService.initiateTransfer(
        validatedData.provider,
        {
          phoneNumber: validatedData.phoneNumber,
          amount: validatedData.amount,
          currency: validatedData.currency || 'UGX',
          reference: validatedData.reference || `${validatedData.provider}-TRANSFER-${Date.now()}`,
          reason: validatedData.reason || 'Transfer from business',
        }
      );

      const duration = Date.now() - startTime;
      logger.info(`✅ ${validatedData.provider} transfer initiated in ${duration}ms`);

      // Create audit log for the transfer
      await prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'MOBILE_MONEY_TRANSFER',
          entityId: result.transactionId,
          entityName: `${validatedData.provider} Transfer`,
          userId: userId,
          changes: {
            provider: validatedData.provider,
            phoneNumber: validatedData.phoneNumber,
            amount: validatedData.amount,
            reference: result.reference,
          },
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      res.json({
        success: true,
        data: result,
        message: `${validatedData.provider} transfer initiated successfully`,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Transfer failed after ${duration}ms:`, error);
      
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
   * Validate account holder
   * POST /api/mobile-money/validate
   */
  async validateAccount(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    try {
      const validatedData = validateAccountSchema.parse(req.body);

      logger.info(`🔍 Validating ${validatedData.provider} account for ${validatedData.phoneNumber}`);

      // Only MTN supports account validation currently
      if (validatedData.provider === 'AIRTEL') {
        throw new AppError('Account validation is only available for MTN at this time.', 501);
      }

      const result = await mobileMoneyService.validateAccountHolder(
        validatedData.provider,
        validatedData.phoneNumber
      );

      const duration = Date.now() - startTime;
      logger.info(`✅ Account validation completed in ${duration}ms`);

      res.json({
        success: true,
        data: result,
        message: 'Account validation completed successfully',
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Account validation failed after ${duration}ms:`, error);
      
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
   * Get account balance
   * GET /api/mobile-money/balance/:provider
   */
  async getBalance(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    try {
      const { provider } = req.params;

      if (!provider) {
        throw new AppError('Provider is required', 400);
      }

      logger.info(`📊 Getting balance for ${provider}`);

      // Only MTN supports balance check currently
      if (provider === 'AIRTEL') {
        throw new AppError('Balance check is only available for MTN at this time.', 501);
      }

      const result = await mobileMoneyService.getProviderBalance(
        provider as 'MTN' | 'AIRTEL'
      );

      const duration = Date.now() - startTime;
      logger.info(`✅ Balance retrieved in ${duration}ms`);

      res.json({
        success: true,
        data: result,
        message: 'Balance retrieved successfully',
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Balance retrieval failed after ${duration}ms:`, error);
      next(error);
    }
  },

  /**
   * Get transaction history
   * GET /api/mobile-money/transactions/:provider
   */
  async getTransactionHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { provider } = req.params;
      const { page = 1, limit = 20, startDate, endDate } = req.query;

      // Build query parameters
      const params: any = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      };

      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      // Query payments for the provider
      const where: any = {
        gatewayId: provider,
        paymentMethod: 'MOBILE_MONEY',
        deletedAt: null,
      };

      if (startDate) {
        where.processedAt = { gte: new Date(startDate as string) };
      }
      if (endDate) {
        where.processedAt = { ...where.processedAt, lte: new Date(endDate as string) };
      }

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip: (params.page - 1) * params.limit,
          take: params.limit,
          orderBy: { processedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            sale: {
              select: {
                id: true,
                receiptNumber: true,
                total: true,
              },
            },
          },
        }),
        prisma.payment.count({ where }),
      ]);

      res.json({
        success: true,
        data: payments,
        pagination: {
          total,
          page: params.page,
          totalPages: Math.ceil(total / params.limit),
          limit: params.limit,
        },
        message: 'Transaction history retrieved successfully',
      });
    } catch (error) {
      logger.error('❌ Failed to get transaction history:', error);
      next(error);
    }
  },

  /**
   * Webhook health check
   * GET /api/mobile-money/webhook-health
   */
  async webhookHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const providers = mobileMoneyService.getAvailableProviders();

      res.json({
        success: true,
        data: {
          status: 'healthy',
          providers,
          configured: providers.length > 0,
          endpoints: providers.map(provider => ({
            provider,
            callbackUrl: provider === 'MTN' 
              ? process.env.MTN_CALLBACK_URL 
              : process.env.AIRTEL_CALLBACK_URL,
            isConfigured: true,
          })),
          timestamp: new Date().toISOString(),
        },
        message: 'Webhook health check passed',
      });
    } catch (error) {
      logger.error('❌ Webhook health check failed:', error);
      next(error);
    }
  },
};

export default mobileMoneyController;
