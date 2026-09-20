// D:\Projects\Kalwanga\packages\backend\src\controllers\paymentController.ts

import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/paymentService.js';
import { mpesaService } from '../services/mpesaService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { logger } from '../lib/logger.js';
import Stripe from 'stripe';

// ============================================
// CANONICAL ENUM VALUES
// These must stay in sync with prisma/schema.prisma
// (enum PaymentMethod / enum PaymentStatus / enum PaymentProviderEnum)
// ============================================

const PAYMENT_METHODS = [
  'CASH',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'MOBILE_MONEY',
  'BANK_TRANSFER',
  'GIFT_CARD',
  'LOYALTY_POINTS',
  'CRYPTO',
  'CHECK',
  'PAYPAL',
  'FLUTTERWAVE',
  'PAYSTACK',
  'SQUARE',
  'STRIPE',
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

const PAYMENT_PROVIDERS = [
  'STRIPE',
  'CASH',
  'MOBILE_MONEY',
  'BANK_TRANSFER',
  'GIFT_CARD',
  'LOYALTY_POINTS',
  'PAYPAL',
  'FLUTTERWAVE',
  'PAYSTACK',
  'SQUARE',
] as const;

const PAYMENT_PROVIDER_TYPES = ['ONLINE', 'OFFLINE', 'HYBRID'] as const;

// ============================================
// VALIDATION SCHEMAS
// ============================================

const processPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  saleId: z.string().optional(),
  orderId: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  currency: z.string().optional(),
  source: z.string().optional(),
  customerId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  description: z.string().optional(),
  tipAmount: z.number().min(0).optional(),
  savePaymentMethod: z.boolean().optional(),
  businessUnitId: z.string().optional(),
  cardNonce: z.string().optional(),
});

const refundSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  reason: z.string().optional(),
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
      })
    )
    .min(1, 'At least one item is required'),
  customerId: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

const attachPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
});

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
      })
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

const createPaymentIntentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  customerId: z.string().optional(),
});

const mpesaSTKPushSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number is required'),
  amount: z.number().positive('Amount must be positive'),
  accountReference: z.string().optional(),
  transactionDesc: z.string().optional(),
  callbackUrl: z.string().url().optional(),
  saleId: z.string().optional(),
  orderId: z.string().optional(),
});

const mpesaB2CSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number is required'),
  amount: z.number().positive('Amount must be positive'),
  commandId: z
    .enum(['BusinessPayment', 'SalaryPayment', 'PromotionPayment'])
    .default('BusinessPayment'),
  remarks: z.string().optional(),
  occasion: z.string().optional(),
});

const payPalCaptureSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

const flutterwaveVirtualAccountSchema = z.object({
  email: z.string().email('Valid email is required'),
  amount: z.number().positive('Amount must be positive').optional(),
  currency: z.string().optional(),
  customerName: z.string().optional(),
});

const paystackVerifySchema = z.object({
  reference: z.string().min(1, 'Reference is required'),
});

const squarePaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  cardNonce: z.string().min(1, 'Card nonce is required'),
  currency: z.string().optional(),
  customerId: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
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

function requireUserId(req: Request): string {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError('User ID is required', 401);
  }
  return userId;
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
      if (error instanceof z.ZodError) return zodError(res, error);
      next(error);
    }
  },

  // ============================================
  // M-PESA
  // ============================================

  async initiateMpesaSTKPush(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = mpesaSTKPushSchema.parse(req.body);
      const userId = requireUserId(req);

      if (!mpesaService.isConfigured()) {
        throw new AppError(
          'M-Pesa is not configured. Please contact support.',
          503
        );
      }

      const result = await mpesaService.initiateSTKPush({
        phoneNumber: validatedData.phoneNumber,
        amount: validatedData.amount,
        accountReference: validatedData.accountReference || `PAY-${Date.now()}`,
        transactionDesc: validatedData.transactionDesc || 'Payment via M-Pesa',
        callbackUrl: validatedData.callbackUrl,
      });

      const payment = await paymentService.createPendingPayment({
        amount: validatedData.amount,
        paymentMethod: 'MOBILE_MONEY',
        userId,
        saleId: validatedData.saleId,
        orderId: validatedData.orderId,
        transactionId: result.CheckoutRequestID,
        reference: result.MerchantRequestID,
        metadata: {
          checkoutRequestId: result.CheckoutRequestID,
          merchantRequestId: result.MerchantRequestID,
          phoneNumber: validatedData.phoneNumber,
          provider: 'MPESA',
        },
      });

      res.json({
        success: true,
        data: { ...result, paymentId: payment.id },
        message: 'M-Pesa STK Push initiated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
      next(error);
    }
  },

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

      const payment = await paymentService.getPaymentByTransactionId(
        transactionId
      );

      if (payment && result.ResultCode !== undefined) {
        const status = result.ResultCode === '0' ? 'PAID' : 'FAILED';
        if (payment.status !== status) {
          await paymentService.updatePaymentStatus(payment.id, status, {
            notes: `M-Pesa status: ${result.ResultDesc || 'Status updated'}`,
            metadata: { mpesaResult: result },
          });

          if (status === 'PAID') {
            if (payment.saleId) {
              await paymentService.updateSaleAfterPayment(
                payment.saleId,
                payment.amount,
                payment
              );
            }
            if (payment.orderId) {
              await paymentService.updateOrderAfterPayment(
                payment.orderId,
                payment.amount,
                payment
              );
            }
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

  async handleMpesaCallback(req: Request, res: Response, next: NextFunction) {
    try {
      logger.info('M-Pesa callback received:', JSON.stringify(req.body));

      const result = await mpesaService.handleSTKPushCallback(req.body);

      const payment = await paymentService.getPaymentByTransactionId(
        result.checkoutRequestId
      );

      if (payment) {
        if (result.isSuccess) {
          await paymentService.updatePaymentStatus(payment.id, 'PAID', {
            metadata: {
              mpesaCallback: result.callbackMetadata,
              resultCode: result.resultCode,
              resultDesc: result.resultDesc,
            },
            notes: `M-Pesa payment successful: ${result.resultDesc}`,
          });

          if (payment.saleId) {
            await paymentService.updateSaleAfterPayment(
              payment.saleId,
              payment.amount,
              payment
            );
          }
          if (payment.orderId) {
            await paymentService.updateOrderAfterPayment(
              payment.orderId,
              payment.amount,
              payment
            );
          }

          await paymentService.createPaymentNotification(payment, 'succeeded');
        } else {
          await paymentService.updatePaymentStatus(payment.id, 'FAILED', {
            notes: `M-Pesa payment failed: ${result.resultDesc}`,
            metadata: {
              mpesaCallback: result,
              resultCode: result.resultCode,
              resultDesc: result.resultDesc,
            },
          });

          await paymentService.createPaymentNotification(payment, 'failed');
        }
      }

      res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
    } catch (error) {
      logger.error('Callback processing error:', error);
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
    }
  },

  async processMpesaB2C(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = mpesaB2CSchema.parse(req.body);
      requireUserId(req);

      if (!mpesaService.isConfigured()) {
        throw new AppError(
          'M-Pesa is not configured. Please contact support.',
          503
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
        message: 'M-Pesa B2C payment initiated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
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
      if (error instanceof z.ZodError) return zodError(res, error);
      next(error);
    }
  },

  async handlePayPalWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentService.handlePayPalWebhook(
        req.body,
        req.headers as Record<string, string>
      );

      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('PayPal webhook error:', error);
      res.status(200).json({ status: 'success' });
    }
  },

  // ============================================
  // FLUTTERWAVE
  // ============================================

  async createFlutterwaveVirtualAccount(
    req: Request,
    res: Response,
    next: NextFunction
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
      if (error instanceof z.ZodError) return zodError(res, error);
      next(error);
    }
  },

  async handleFlutterwaveWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const signature = (req.headers['verif-hash'] as string) || '';

      const result = await paymentService.handleFlutterwaveWebhook(
        req.body,
        signature
      );

      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Flutterwave webhook error:', error);
      res.status(200).json({ status: 'success' });
    }
  },

  // ============================================
  // PAYSTACK
  // ============================================

  async verifyPaystackPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { reference } = paystackVerifySchema.parse(req.params);

      const result = await paymentService.verifyPaystackPayment(reference);

      res.json({
        success: true,
        data: result,
        message: 'Payment verified successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
      next(error);
    }
  },

  async handlePaystackWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = (req.headers['x-paystack-signature'] as string) || '';

      const result = await paymentService.handlePaystackWebhook(
        req.body,
        signature
      );

      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Paystack webhook error:', error);
      res.status(200).send('OK');
    }
  },

  // ============================================
  // SQUARE
  // ============================================

  async processSquarePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = squarePaymentSchema.parse(req.body);
      const userId = requireUserId(req);

      const payment = await paymentService.processPayment({
        amount: validatedData.amount,
        paymentMethod: 'SQUARE',
        userId,
        currency: validatedData.currency || 'USD',
        cardNonce: validatedData.cardNonce,
        customerId: validatedData.customerId,
        description: validatedData.description,
        metadata: validatedData.metadata,
      });

      res.json({
        success: true,
        data: payment,
        message: 'Square payment processed successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
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
      if (error instanceof z.ZodError) return zodError(res, error);
      next(error);
    }
  },

  async handleSquareWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature =
        (req.headers['x-square-hmacsha256-signature'] as string) || '';

      const result = await paymentService.handleSquareWebhook(
        req.body,
        signature
      );

      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Square webhook error:', error);
      res.status(200).send('OK');
    }
  },

  // ============================================
  // PAYMENT PROVIDER MANAGEMENT
  // ============================================

  async getPaymentProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const businessUnitId =
        (req.query.businessUnitId as string) ||
        (req as any).user?.businessUnitId;

      const providers = await paymentService.getPaymentProviders(
        userId,
        businessUnitId
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
        businessUnitId
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
            400
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
            400
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
            400
          );
        }
      }

      if (validatedData.provider === 'PAYSTACK') {
        const secretKey =
          (validatedData.config?.secretKey as string) ||
          process.env.PAYSTACK_SECRET_KEY;
        const publicKey =
          (validatedData.config?.publicKey as string) ||
          process.env.PAYSTACK_PUBLIC_KEY;
        if (!secretKey || !publicKey) {
          throw new AppError(
            'Paystack Secret Key and Public Key are required',
            400
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
            400
          );
        }
      }

      const provider = await paymentService.createPaymentProvider(
        validatedData,
        userId
      );

      res.status(201).json({
        success: true,
        data: provider,
        message: 'Payment provider created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
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
        userId
      );

      res.json({
        success: true,
        data: provider,
        message: 'Payment provider updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
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
        userId
      );

      res.json({
        success: true,
        data: provider,
        message: 'Provider health updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
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

      if (provider.provider === 'STRIPE' && config?.apiKey) {
        try {
          const stripe = new Stripe(config.apiKey as string, {
            apiVersion: '2023-10-16',
          });
          await stripe.balance.retrieve();
        } catch {
          throw new AppError('Invalid Stripe API key', 400);
        }
      }

      if (provider.provider === 'MOBILE_MONEY') {
        if (!mpesaService.isConfigured()) {
          throw new AppError(
            'M-Pesa is not configured. Please set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.',
            400
          );
        }
      }

      if (provider.provider === 'PAYPAL') {
        if (!config?.clientId || !config?.clientSecret) {
          throw new AppError(
            'PayPal Client ID and Client Secret are required',
            400
          );
        }
      }

      if (provider.provider === 'FLUTTERWAVE') {
        if (!config?.apiKey || !config?.publicKey) {
          throw new AppError(
            'Flutterwave API Key and Public Key are required',
            400
          );
        }
      }

      if (provider.provider === 'PAYSTACK') {
        if (!config?.secretKey || !config?.publicKey) {
          throw new AppError(
            'Paystack Secret Key and Public Key are required',
            400
          );
        }
      }

      if (provider.provider === 'SQUARE') {
        if (!config?.accessToken || !config?.locationId) {
          throw new AppError(
            'Square Access Token and Location ID are required',
            400
          );
        }
      }

      const updatedProvider = await paymentService.configureProvider(
        id,
        config,
        settings,
        userId
      );

      res.json({
        success: true,
        data: updatedProvider,
        message: 'Provider configured successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
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
        userId
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
    next: NextFunction
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

  async processPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = processPaymentSchema.parse(req.body);
      const userId = requireUserId(req);

      const payment = await paymentService.processPayment({
        ...validatedData,
        userId,
      });

      res.status(201).json({
        success: true,
        data: payment,
        message: 'Payment processed successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
      next(error);
    }
  },

  async refundPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { amount, reason } = refundSchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!id) {
        throw new AppError('Payment ID is required', 400);
      }

      const result = await paymentService.refundPayment(
        id,
        amount,
        reason,
        userId
      );

      res.json({
        success: true,
        data: result,
        message: 'Payment refunded successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
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

  async getPaymentSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, businessUnitId, status, paymentMethod } =
        req.query;
      const userId = requireUserId(req);

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
      logger.warn('getPaymentSummary failed, returning defaults:', error);
      res.status(200).json({
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
        message: 'Payment summary retrieved with default values',
      });
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

      const result = await paymentService.getAllPayments({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
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
      if (error instanceof z.ZodError) return zodError(res, error);
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
        metadata
      );

      res.json({
        success: true,
        data: session,
        message: 'Checkout session created',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
      next(error);
    }
  },

  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        throw new AppError('Stripe signature is required', 400);
      }

      const result = await paymentService.handleWebhook(req.body, signature);

      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Webhook error:', error);
      next(error);
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
        userId
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
        paymentMethodId
      );

      res.json({
        success: true,
        data: paymentMethod,
        message: 'Payment method attached',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return zodError(res, error);
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
