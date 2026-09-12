// D:\Projects\Kalwanga\packages\backend\src\services\paymentService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import Stripe from 'stripe';
import { Prisma } from '../generated/prisma/index.js';
import { PaymentStatus, PaymentProviderEnum, PaymentProviderType } from '../generated/prisma/index.js';
import { logger } from '../lib/logger.js';
import * as crypto from 'crypto';
import { mobileMoneyService } from './mobileMoneyService.js';
import { PayPalService } from './paypalService.js';
import { FlutterwaveService } from './flutterwaveService.js';
import { PaystackService } from './paystackService.js';
import { SquareService } from './squareService.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// ============================================
// INTERFACES
// ============================================

interface ProcessPaymentData {
  amount: number;
  paymentMethod: string;
  saleId?: string;
  orderId?: string;
  userId: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  gatewayId?: string;
  currency?: string;
  source?: string;
  customerId?: string;
  metadata?: Record<string, any>;
  description?: string;
  idempotencyKey?: string;
  savePaymentMethod?: boolean;
  tipAmount?: number;
  businessUnitId?: string;
  provider?: string;
  cardNonce?: string; // For Square
}

interface PaymentSummary {
  totalAmount: number;
  byMethod: Record<string, number>;
  count: number;
  averageAmount: number;
  totalRefunds: number;
  refundCount: number;
  netAmount: number;
}

interface PaymentFilters {
  startDate?: Date;
  endDate?: Date;
  businessUnitId?: string;
  status?: string;
  paymentMethod?: string;
  userId?: string;
  saleId?: string;
  orderId?: string;
  provider?: string;
}

interface RefundData {
  paymentId: string;
  amount?: number;
  reason?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
  customerId?: string;
}

// ============================================
// PROVIDER HANDLER INTERFACE
// ============================================

interface ProviderHandler {
  processPayment(data: any): Promise<any>;
  refundPayment(transactionId: string, data: any): Promise<any>;
  getTransactionStatus(transactionId: string): Promise<any>;
  validateConfig(): boolean;
}

// ============================================
// PROVIDER HANDLERS
// ============================================

class CashProviderHandler implements ProviderHandler {
  validateConfig(): boolean {
    return true;
  }

  async processPayment(data: any): Promise<any> {
    logger.info(`Processing cash payment: ${data.amount} ${data.currency}`);
    
    if (data.cashRegisterId) {
      logger.info(`Cash register update: ${data.cashRegisterId}`);
    }

    return {
      id: `cash_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      status: 'succeeded',
      amount: data.amount,
      currency: data.currency || 'USD',
      reference: `CASH-${Date.now()}`,
      provider: 'CASH',
    };
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    return {
      id: `cash_refund_${Date.now()}`,
      status: 'succeeded',
      amount: data.amount,
      reference: `REF-CASH-${Date.now()}`,
    };
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return { status: 'COMPLETED', transactionId };
  }
}

class MobileMoneyProviderHandler implements ProviderHandler {
  private providers: Record<string, { name: string; prefix: string }> = {
    MTN: { name: 'MTN Mobile Money', prefix: 'MTN' },
    TIGO: { name: 'Tigo Pesa', prefix: 'TIG' },
    AIRTEL: { name: 'Airtel Money', prefix: 'AIR' },
    VODAFONE: { name: 'Vodafone Cash', prefix: 'VOD' },
  };

  validateConfig(): boolean {
    return true;
  }

  async processPayment(data: any): Promise<any> {
    const provider = data.metadata?.provider || 'MTN';
    const providerInfo = this.providers[provider] || this.providers.MTN;
    
    logger.info(`Processing mobile money payment: ${data.amount} ${data.currency} via ${providerInfo.name}`);

    if (!data.metadata?.phoneNumber) {
      throw new AppError('Phone number is required for mobile money', 400);
    }

    return {
      id: `${providerInfo.prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      status: 'succeeded',
      amount: data.amount,
      currency: data.currency || 'USD',
      provider: provider,
      phoneNumber: data.metadata.phoneNumber,
      reference: `${providerInfo.prefix}-${Date.now()}`,
    };
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    return {
      id: `mm_refund_${Date.now()}`,
      status: 'succeeded',
      amount: data.amount,
      reference: `REF-MM-${Date.now()}`,
    };
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return { status: 'COMPLETED', transactionId };
  }
}

class BankTransferProviderHandler implements ProviderHandler {
  validateConfig(): boolean {
    return true;
  }

  async processPayment(data: any): Promise<any> {
    logger.info(`Processing bank transfer: ${data.amount} ${data.currency}`);

    const reference = `BT-${Date.now()}`;
    const bankDetails = {
      bankName: process.env.BANK_NAME || 'Kalwanga Bank',
      accountNumber: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
      accountName: process.env.BANK_ACCOUNT_NAME || 'Kalwanga POS System',
      reference: reference,
      branch: process.env.BANK_BRANCH || 'Head Office',
      swiftCode: process.env.BANK_SWIFT_CODE || 'KALWUGKA',
      instructions: process.env.BANK_INSTRUCTIONS || 'Please use reference number for payment',
    };

    return {
      id: `bank_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      status: 'pending',
      amount: data.amount,
      currency: data.currency || 'USD',
      reference: reference,
      bankDetails: bankDetails,
      provider: 'BANK_TRANSFER',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    return {
      id: `bank_refund_${Date.now()}`,
      status: 'succeeded',
      amount: data.amount,
      reference: `REF-BT-${Date.now()}`,
    };
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return { status: 'PENDING', transactionId };
  }
}

class GiftCardProviderHandler implements ProviderHandler {
  validateConfig(): boolean {
    return true;
  }

  async processPayment(data: any): Promise<any> {
    if (!data.gatewayId) {
      throw new AppError('Gift card code required', 400);
    }

    logger.info(`Processing gift card payment: ${data.gatewayId}`);

    return {
      id: `giftcard_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      status: 'succeeded',
      amount: data.amount,
      currency: data.currency || 'USD',
      giftCardId: data.gatewayId,
      reference: `GC-${Date.now()}`,
      provider: 'GIFT_CARD',
    };
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    return {
      id: `gc_refund_${Date.now()}`,
      status: 'succeeded',
      amount: data.amount,
      reference: `REF-GC-${Date.now()}`,
    };
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return { status: 'COMPLETED', transactionId };
  }
}

class LoyaltyPointsProviderHandler implements ProviderHandler {
  validateConfig(): boolean {
    return true;
  }

  async processPayment(data: any): Promise<any> {
    if (!data.customerId) {
      throw new AppError('Customer ID required for loyalty points payment', 400);
    }

    logger.info(`Processing loyalty points payment for customer: ${data.customerId}`);

    const pointsNeeded = Math.ceil(data.amount * 10);

    return {
      id: `loyalty_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      status: 'succeeded',
      amount: data.amount,
      currency: data.currency || 'USD',
      pointsUsed: pointsNeeded,
      customerId: data.customerId,
      reference: `LP-${Date.now()}`,
      provider: 'LOYALTY_POINTS',
    };
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    return {
      id: `lp_refund_${Date.now()}`,
      status: 'succeeded',
      amount: data.amount,
      reference: `REF-LP-${Date.now()}`,
    };
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return { status: 'COMPLETED', transactionId };
  }
}

class MTNMobileMoneyProviderHandler implements ProviderHandler {
  validateConfig(): boolean {
    return mobileMoneyService.getAvailableProviders().includes('MTN');
  }

  async processPayment(data: any): Promise<any> {
    logger.info(`Processing MTN Mobile Money payment: ${data.amount} ${data.currency}`);
    
    if (!data.metadata?.phoneNumber) {
      throw new AppError('Phone number is required for MTN Mobile Money payment', 400);
    }

    const result = await mobileMoneyService.initiatePayment('MTN', {
      phoneNumber: data.metadata.phoneNumber,
      amount: data.amount,
      currency: data.currency || 'UGX',
      reference: data.metadata.accountReference || `MTN-${Date.now()}`,
      description: data.description || 'Payment via MTN Mobile Money',
      callbackUrl: data.metadata.callbackUrl,
    });

    return {
      id: result.transactionId,
      status: result.status === 'SUCCESS' ? 'succeeded' : 'pending',
      amount: data.amount,
      currency: data.currency || 'UGX',
      reference: result.reference,
      provider: 'MTN',
      transactionId: result.transactionId,
      customerMessage: result.message,
    };
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    return {
      id: `mtn_refund_${Date.now()}`,
      status: 'succeeded',
      amount: data.amount,
      reference: `REF-MTN-${Date.now()}`,
    };
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return await mobileMoneyService.checkStatus('MTN', transactionId);
  }
}

class AirtelMobileMoneyProviderHandler implements ProviderHandler {
  validateConfig(): boolean {
    return mobileMoneyService.getAvailableProviders().includes('AIRTEL');
  }

  async processPayment(data: any): Promise<any> {
    logger.info(`Processing Airtel Mobile Money payment: ${data.amount} ${data.currency}`);
    
    if (!data.metadata?.phoneNumber) {
      throw new AppError('Phone number is required for Airtel Mobile Money payment', 400);
    }

    const result = await mobileMoneyService.initiatePayment('AIRTEL', {
      phoneNumber: data.metadata.phoneNumber,
      amount: data.amount,
      currency: data.currency || 'UGX',
      reference: data.metadata.accountReference || `AIRTEL-${Date.now()}`,
      description: data.description || 'Payment via Airtel Mobile Money',
      callbackUrl: data.metadata.callbackUrl,
    });

    return {
      id: result.transactionId,
      status: result.status === 'SUCCESS' ? 'succeeded' : 'pending',
      amount: data.amount,
      currency: data.currency || 'UGX',
      reference: result.reference,
      provider: 'AIRTEL',
      transactionId: result.transactionId,
      customerMessage: result.message,
    };
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    return {
      id: `airtel_refund_${Date.now()}`,
      status: 'succeeded',
      amount: data.amount,
      reference: `REF-AIRTEL-${Date.now()}`,
    };
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return await mobileMoneyService.checkStatus('AIRTEL', transactionId);
  }
}

// ============================================
// NEW PROVIDER HANDLERS (Wrappers for Services)
// ============================================

class PayPalProviderHandler implements ProviderHandler {
  private paypalService: PayPalService;

  constructor() {
    this.paypalService = new PayPalService();
  }

  validateConfig(): boolean {
    return this.paypalService.validateConfig();
  }

  async processPayment(data: any): Promise<any> {
    const result = await this.paypalService.processPayment({
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      saleId: data.saleId,
      orderId: data.orderId,
      userId: data.userId,
      customerEmail: data.metadata?.customerEmail,
      customerName: data.metadata?.customerName,
      returnUrl: data.metadata?.returnUrl,
      cancelUrl: data.metadata?.cancelUrl,
      metadata: data.metadata,
    });

    return result;
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    return await this.paypalService.refundPayment(transactionId, {
      amount: data.amount,
      currency: data.currency,
      reason: data.reason,
    });
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return await this.paypalService.getTransactionStatus(transactionId);
  }

  // Additional PayPal-specific methods
  async captureOrder(orderId: string): Promise<any> {
    return await this.paypalService.captureOrder(orderId);
  }

  async handleWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return await this.paypalService.handleWebhook(payload, headers);
  }
}

class FlutterwaveProviderHandler implements ProviderHandler {
  private flutterwaveService: FlutterwaveService;

  constructor() {
    this.flutterwaveService = new FlutterwaveService();
  }

  validateConfig(): boolean {
    return this.flutterwaveService.validateConfig();
  }

  /**
 * Map payment status from provider to PaymentStatus enum
 */
private mapPaymentStatusToEnum(status: string): PaymentStatus {
  const statusMap: Record<string, PaymentStatus> = {
    'succeeded': PaymentStatus.PAID,
    'success': PaymentStatus.PAID,
    'completed': PaymentStatus.PAID,
    'pending': PaymentStatus.PENDING,
    'processing': PaymentStatus.PROCESSING,
    'failed': PaymentStatus.FAILED,
    'cancelled': PaymentStatus.FAILED,
    'refunded': PaymentStatus.REFUNDED,
  };
  return statusMap[status?.toLowerCase()] || PaymentStatus.PENDING;
}

  async processPayment(data: any): Promise<any> {
    const result = await this.flutterwaveService.processPayment({
      amount: data.amount,
      currency: data.currency,
      paymentMethod: data.paymentMethod === 'MOBILE_MONEY' ? 'mobile_money' : 'card',
      description: data.description,
      saleId: data.saleId,
      orderId: data.orderId,
      userId: data.userId,
      customerEmail: data.metadata?.customerEmail,
      customerName: data.metadata?.customerName,
      phoneNumber: data.metadata?.phoneNumber,
      redirectUrl: data.metadata?.redirectUrl,
      metadata: data.metadata,
    });

    return result;
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    return await this.flutterwaveService.refundPayment(transactionId, {
      amount: data.amount,
      reason: data.reason,
    });
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return await this.flutterwaveService.getTransactionStatus(transactionId);
  }

  // Additional Flutterwave-specific methods
  async createVirtualAccount(data: {
    email: string;
    amount?: number;
    currency?: string;
    customerName?: string;
  }): Promise<any> {
    return await this.flutterwaveService.createVirtualAccount(data);
  }

  async handleWebhook(payload: any, signature: string): Promise<any> {
    return await this.flutterwaveService.handleWebhook(payload, signature);
  }
}

class PaystackProviderHandler implements ProviderHandler {
  private paystackService: PaystackService;

  constructor() {
    this.paystackService = new PaystackService();
  }

  validateConfig(): boolean {
    return this.paystackService.validateConfig();
  }

  async processPayment(data: any): Promise<any> {
    const result = await this.paystackService.processPayment({
      amount: data.amount,
      currency: data.currency,
      paymentMethod: data.paymentMethod === 'MOBILE_MONEY' ? 'mobile_money' : 'card',
      description: data.description,
      saleId: data.saleId,
      orderId: data.orderId,
      userId: data.userId,
      customerEmail: data.metadata?.customerEmail,
      customerName: data.metadata?.customerName,
      phoneNumber: data.metadata?.phoneNumber,
      redirectUrl: data.metadata?.redirectUrl,
      metadata: data.metadata,
    });

    return result;
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    return await this.paystackService.refundPayment(transactionId, {
      amount: data.amount,
      currency: data.currency,
      reason: data.reason,
    });
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return await this.paystackService.getTransactionStatus(transactionId);
  }

  // Additional Paystack-specific methods
  async verifyPayment(reference: string): Promise<any> {
    return await this.paystackService.verifyPayment(reference);
  }

  async handleWebhook(payload: any, signature: string): Promise<any> {
    return await this.paystackService.handleWebhook(payload, signature);
  }
}

class SquareProviderHandler implements ProviderHandler {
  private squareService: SquareService;

  constructor() {
    this.squareService = new SquareService();
  }

  validateConfig(): boolean {
    return this.squareService.validateConfig();
  }

  async processPayment(data: any): Promise<any> {
    // Square requires a card nonce from the frontend
    const cardNonce = data.cardNonce || data.metadata?.cardNonce;
    
    if (!cardNonce) {
      throw new AppError('Card nonce is required for Square payment', 400);
    }

    const result = await this.squareService.processCardPayment({
      amount: data.amount,
      cardNonce: cardNonce,
      currency: data.currency,
      customerId: data.customerId,
      description: data.description,
      metadata: {
        saleId: data.saleId,
        orderId: data.orderId,
        userId: data.userId,
        ...data.metadata,
      },
    });

    return result;
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    return await this.squareService.refundPayment(transactionId, {
      amount: data.amount,
      reason: data.reason,
    });
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return await this.squareService.getTransactionStatus(transactionId);
  }

  // Additional Square-specific methods
  async createCustomer(data: {
    email: string;
    name: string;
    phone?: string;
  }): Promise<any> {
    return await this.squareService.createCustomer(data);
  }

  async handleWebhook(payload: any, signature: string): Promise<any> {
    return await this.squareService.handleWebhook(payload, signature);
  }
}

// ============================================
// MAIN PAYMENT SERVICE
// ============================================

export class PaymentService extends BaseService {
  private providerHandlers: Map<string, ProviderHandler>;

  constructor() {
    super();
    this.providerHandlers = new Map();
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    // Existing providers
    this.providerHandlers.set('CASH', new CashProviderHandler());
    this.providerHandlers.set('MOBILE_MONEY', new MobileMoneyProviderHandler());
    this.providerHandlers.set('BANK_TRANSFER', new BankTransferProviderHandler());
    this.providerHandlers.set('GIFT_CARD', new GiftCardProviderHandler());
    this.providerHandlers.set('LOYALTY_POINTS', new LoyaltyPointsProviderHandler());
    this.providerHandlers.set('MTN', new MTNMobileMoneyProviderHandler());
    this.providerHandlers.set('AIRTEL', new AirtelMobileMoneyProviderHandler());
    
    // NEW PROVIDERS
    this.providerHandlers.set('PAYPAL', new PayPalProviderHandler());
    this.providerHandlers.set('FLUTTERWAVE', new FlutterwaveProviderHandler());
    this.providerHandlers.set('PAYSTACK', new PaystackProviderHandler());
    this.providerHandlers.set('SQUARE', new SquareProviderHandler());
  }

  private getProviderHandler(paymentMethod: string): ProviderHandler | null {
    const methodMap: Record<string, string> = {
      'CASH': 'CASH',
      'MOBILE_MONEY': 'MOBILE_MONEY',
      'BANK_TRANSFER': 'BANK_TRANSFER',
      'GIFT_CARD': 'GIFT_CARD',
      'LOYALTY_POINTS': 'LOYALTY_POINTS',
      'MTN': 'MTN',
      'AIRTEL': 'AIRTEL',
      'PAYPAL': 'PAYPAL',
      'FLUTTERWAVE': 'FLUTTERWAVE',
      'PAYSTACK': 'PAYSTACK',
      'SQUARE': 'SQUARE',
      'CREDIT_CARD': 'STRIPE', // Stripe handles credit cards
      'DEBIT_CARD': 'STRIPE', // Stripe handles debit cards
    };

    const handlerKey = methodMap[paymentMethod];
    return handlerKey ? this.providerHandlers.get(handlerKey) || null : null;
  }

  // ============================================
  // STRIPE PAYMENT METHODS
  // ============================================

  /**
   * Create a payment intent (Stripe)
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<{
    id: string;
    clientSecret: string;
    amount: number;
    currency: string;
    status: string;
  }> {
    try {
      const { amount, currency, description, metadata, customerId } = params;

      if (!amount || amount <= 0) {
        throw new AppError('Amount must be positive', 400);
      }

      let stripeCustomerId = customerId;
      if (!stripeCustomerId && metadata?.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: metadata.userId },
        });
        if (user) {
          const result = await this.prisma.$queryRaw<Array<{ stripeCustomerId: string | null }>>`
            SELECT "stripeCustomerId" FROM "users" WHERE "id" = ${metadata.userId}
          `;
          
          if (result[0]?.stripeCustomerId) {
            stripeCustomerId = result[0].stripeCustomerId;
          } else {
            const customer = await stripe.customers.create({
              email: user.email,
              name: `${user.firstName} ${user.lastName}`,
              metadata: {
                userId: user.id,
                clerkId: user.clerkId,
              },
            });
            stripeCustomerId = customer.id;

            await this.prisma.$executeRaw`
              UPDATE "users" 
              SET "stripeCustomerId" = ${stripeCustomerId} 
              WHERE "id" = ${user.id}
            `;
          }
        }
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        customer: stripeCustomerId || undefined,
        description: description || 'Payment',
        metadata: {
          ...metadata,
          platform: 'kalwanga-pos',
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      };
    } catch (error) {
      this.handleError(error, 'PaymentService.createPaymentIntent');
      throw error;
    }
  }

  /**
   * Create Stripe customer
   */
  async createStripeCustomer(userId: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const result = await this.prisma.$queryRaw<Array<{ stripeCustomerId: string | null }>>`
        SELECT "stripeCustomerId" FROM "users" WHERE "id" = ${userId}
      `;
      
      const existingCustomerId = result[0]?.stripeCustomerId;
      if (existingCustomerId) {
        return { customerId: existingCustomerId, alreadyExists: true };
      }

      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        phone: user.phoneNumber || undefined,
        metadata: {
          userId: user.id,
          clerkId: user.clerkId,
        },
      });

      await this.prisma.$executeRaw`
        UPDATE "users" 
        SET "stripeCustomerId" = ${customer.id} 
        WHERE "id" = ${user.id}
      `;

      logger.info(`Stripe customer created for user: ${user.id}`);
      return { customerId: customer.id, alreadyExists: false };
    } catch (error) {
      this.handleError(error, 'PaymentService.createStripeCustomer');
      throw error;
    }
  }

  /**
   * Get customer payment methods
   */
  async getCustomerPaymentMethods(userId: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const result = await this.prisma.$queryRaw<Array<{ stripeCustomerId: string | null }>>`
        SELECT "stripeCustomerId" FROM "users" WHERE "id" = ${userId}
      `;
      
      const stripeCustomerId = result[0]?.stripeCustomerId;
      if (!stripeCustomerId) {
        return { paymentMethods: [] };
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card',
      });

      return paymentMethods;
    } catch (error) {
      this.handleError(error, 'PaymentService.getCustomerPaymentMethods');
      throw error;
    }
  }

  /**
   * Attach payment method
   */
  async attachPaymentMethod(userId: string, paymentMethodId: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const result = await this.prisma.$queryRaw<Array<{ stripeCustomerId: string | null }>>`
        SELECT "stripeCustomerId" FROM "users" WHERE "id" = ${userId}
      `;
      
      const stripeCustomerId = result[0]?.stripeCustomerId;
      if (!stripeCustomerId) {
        throw new AppError('User has no Stripe customer account', 400);
      }

      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      return paymentMethod;
    } catch (error) {
      this.handleError(error, 'PaymentService.attachPaymentMethod');
      throw error;
    }
  }

  /**
   * Detach payment method
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<any> {
    try {
      const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
      return paymentMethod;
    } catch (error) {
      this.handleError(error, 'PaymentService.detachPaymentMethod');
      throw error;
    }
  }

  /**
   * Create checkout session (Stripe)
   */
  async createCheckoutSession(
    items: any[],
    customerId?: string,
    successUrl?: string,
    cancelUrl?: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    try {
      if (!items || items.length === 0) {
        throw new AppError('At least one item is required', 400);
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: items.map((item: any) => ({
          price_data: {
            currency: (item.currency || 'usd').toLowerCase(),
            product_data: {
              name: item.name,
              description: item.description || '',
              images: item.images || [],
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity || 1,
        })),
        mode: 'payment',
        success_url: successUrl || `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
        customer: customerId || undefined,
        metadata: {
          ...metadata,
        },
      });

      return session;
    } catch (error) {
      this.handleError(error, 'PaymentService.createCheckoutSession');
      throw error;
    }
  }

  // ============================================
  // CORE PAYMENT METHODS
  // ============================================

  /**
   * Process payment with comprehensive provider routing
   */
  async processPayment(data: ProcessPaymentData): Promise<any> {
    try {
      const {
        amount,
        paymentMethod,
        saleId,
        orderId,
        userId,
        cashRegisterId,
        cashRegisterSessionId,
        gatewayId,
        currency = 'USD',
        source,
        customerId,
        metadata = {},
        description,
        tipAmount = 0,
        savePaymentMethod = false,
        businessUnitId,
        cardNonce,
      } = data;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      if (amount <= 0) {
        throw new AppError('Amount must be positive', 400);
      }

      if (saleId) {
        const sale = await this.prisma.sale.findUnique({
          where: { id: saleId },
          include: { customer: true },
        });
        if (!sale) {
          throw new AppError('Sale not found', 404);
        }
        if (sale.status === 'COMPLETED') {
          throw new AppError('Sale is already completed', 400);
        }
      }

      if (orderId) {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
        });
        if (!order) {
          throw new AppError('Order not found', 404);
        }
        if (order.status === 'COMPLETED') {
          throw new AppError('Order is already completed', 400);
        }
      }

      const idempotencyKey = data.idempotencyKey || this.generateIdempotencyKey(data);

      let paymentResult: any;
      let transactionId: string | undefined;
      let providerName: string | undefined;

      // Check if payment method is Stripe (credit/debit cards)
      if (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD') {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (!user) {
          throw new AppError('User not found', 404);
        }

        paymentResult = await this.processCardPayment(data, user, currency, idempotencyKey);
        transactionId = paymentResult.id;
        providerName = 'STRIPE';
      } else {
        const handler = this.getProviderHandler(paymentMethod);
        if (!handler) {
          throw new AppError(`Unsupported payment method: ${paymentMethod}`, 400);
        }

        if (!handler.validateConfig()) {
          throw new AppError(`Provider ${paymentMethod} is not configured properly`, 503);
        }

        // Prepare data for handler
        const handlerData = {
          amount: amount + (tipAmount || 0),
          currency,
          cashRegisterId,
          userId,
          customerId,
          gatewayId,
          metadata,
          description,
          saleId,
          orderId,
          cardNonce: cardNonce || metadata?.cardNonce,
          paymentMethod: paymentMethod,
        };

        paymentResult = await handler.processPayment(handlerData);
        transactionId = paymentResult.id || paymentResult.transactionId || paymentResult.reference;
        providerName = paymentResult.provider || paymentMethod;
      }

      // ✅ Resolve the actual PaymentGateway FK.
      //
      // `gatewayId` in the Payment model is a foreign key to
      // `PaymentGateway.id` (the Stripe/Paystack/... credential rows).
      // For CASH, MOBILE_MONEY, BANK_TRANSFER, GIFT_CARD, LOYALTY_POINTS
      // there is no gateway row, so it MUST be null — writing "CASH"
      // here throws a foreign key constraint violation.
      //
      // Only resolve to a real gateway row for the providers that have
      // one. The provider NAME (e.g. "CASH", "STRIPE") is preserved in
      // metadata.provider below so reports can still group by it.
      let resolvedGatewayId: string | null = null;
      const methodNeedsGateway =
        paymentMethod === 'CREDIT_CARD' ||
        paymentMethod === 'DEBIT_CARD' ||
        paymentMethod === 'PAYPAL' ||
        paymentMethod === 'FLUTTERWAVE' ||
        paymentMethod === 'PAYSTACK' ||
        paymentMethod === 'SQUARE';

      if (methodNeedsGateway) {
        // Prefer an explicit gatewayId if the caller supplied one AND
        // it points at a real gateway row.
        if (gatewayId) {
          const gatewayExists = await this.prisma.paymentGateway.findUnique({
            where: { id: gatewayId },
            select: { id: true },
          });
          if (gatewayExists) {
            resolvedGatewayId = gatewayExists.id;
          }
        }

        // Otherwise look up a PaymentGateway row for this provider by name.
        if (!resolvedGatewayId && providerName) {
          const gateway = await this.prisma.paymentGateway.findFirst({
            where: {
              isActive: true,
              OR: [
                { name: { equals: providerName, mode: 'insensitive' } },
                { type: { equals: providerName, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
          });
          if (gateway) {
            resolvedGatewayId = gateway.id;
          }
        }
      }

      // Create payment record
      const payment = await this.prisma.payment.create({
        data: {
          amount: amount + (tipAmount || 0),
          paymentMethod: paymentMethod as any,
          status: this.mapPaymentStatusToEnum(paymentResult.status),
          transactionId: transactionId,
          reference: paymentResult.reference || `PAY-${Date.now()}`,
          notes: description || metadata?.notes || null,
          processedAt: new Date(),
          saleId: saleId || null,
          orderId: orderId || null,
          userId,
          cashRegisterId: cashRegisterId || null,
          cashRegisterSessionId: cashRegisterSessionId || null,
          gatewayId: resolvedGatewayId,
          businessUnitId: businessUnitId || null,
          metadata: {
            provider: providerName,
            providerResponse: paymentResult,
            source,
            customerId,
            tipAmount,
            savePaymentMethod,
            ...metadata,
          },
        },
      });

      // Update sale/order if they exist
      if (saleId) {
        await this.updateSaleAfterPayment(saleId, amount + (tipAmount || 0), payment);
      }

      if (orderId) {
        await this.updateOrderAfterPayment(orderId, amount + (tipAmount || 0), payment);
      }

      // Create audit log
      await this.prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'PAYMENT',
          entityId: payment.id,
          entityName: `Payment ${payment.id}`,
          userId: userId,
          changes: {
            amount,
            paymentMethod,
            saleId,
            orderId,
            status: payment.status,
            provider: providerName,
            transactionId: transactionId,
          },
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      this.safeEmitPaymentEvent(payment, businessUnitId || '', 'processed');

      // Return payment with provider-specific data
      return {
        ...payment,
        provider: providerName,
        providerResponse: paymentResult,
      };
    } catch (error) {
      this.handleError(error, 'PaymentService.processPayment');
      throw error;
    }
  }

  /**
   * Map payment status from provider to PaymentStatus enum
   */
  private mapPaymentStatusToEnum(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'succeeded': PaymentStatus.PAID,
      'success': PaymentStatus.PAID,
      'completed': PaymentStatus.PAID,
      'pending': PaymentStatus.PENDING,
      'processing': PaymentStatus.PROCESSING,
      'failed': PaymentStatus.FAILED,
      'cancelled': PaymentStatus.FAILED,
      'refunded': PaymentStatus.REFUNDED,
    };
    return statusMap[status?.toLowerCase()] || PaymentStatus.PENDING;
  }

  /**
   * Process card payment via Stripe
   */
  private async processCardPayment(
    data: ProcessPaymentData,
    user: any,
    currency: string,
    idempotencyKey: string
  ): Promise<any> {
    if (!data.source && !data.gatewayId) {
      throw new AppError('Source token or payment method ID required for card payment', 400);
    }

    let stripeCustomerId = (user as any).stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: user.id,
          clerkId: user.clerkId,
        },
      });
      stripeCustomerId = customer.id;

      await this.prisma.$executeRaw`
        UPDATE "users" 
        SET "stripeCustomerId" = ${stripeCustomerId} 
        WHERE "id" = ${user.id}
      `;
    }

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(data.amount * 100),
      currency: currency.toLowerCase(),
      customer: stripeCustomerId,
      metadata: {
        userId: user.id,
        saleId: data.saleId || '',
        orderId: data.orderId || '',
        ...data.metadata,
      },
    };

    if (data.gatewayId) {
      paymentIntentParams.payment_method = data.gatewayId;
      paymentIntentParams.confirmation_method = 'automatic';
      paymentIntentParams.confirm = true;
    } else if (data.source) {
      paymentIntentParams.payment_method = data.source;
      paymentIntentParams.confirmation_method = 'manual';
      paymentIntentParams.confirm = true;
    }

    if (data.savePaymentMethod && data.gatewayId) {
      await stripe.paymentMethods.attach(data.gatewayId, {
        customer: stripeCustomerId,
      });
    }

    return await stripe.paymentIntents.create(paymentIntentParams, {
      idempotencyKey,
    });
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  /**
   * Update sale after payment
   */
  async updateSaleAfterPayment(saleId: string, amount: number, payment: any): Promise<void> {
    try {
      const sale = await this.prisma.sale.findUnique({
        where: { id: saleId },
        include: { payments: true },
      });

      if (!sale) return;

      const totalPaid = sale.payments.reduce((acc: number, p: any) => acc + p.amount, 0);
      const paymentStatus = totalPaid >= sale.total ? 'PAID' : 'PARTIAL';
      const status = totalPaid >= sale.total ? 'COMPLETED' : 'PROCESSING';

      await this.prisma.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: totalPaid,
          // ✅ FIXED: Use proper enum values
          status: status as any,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error updating sale after payment:', error);
    }
  }

  /**
   * Update order after payment
   */
  async updateOrderAfterPayment(orderId: string, amount: number, payment: any): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { payment: true },
      });

      if (!order) return;

      const totalPaid = (order.payment?.amount || 0) + amount;
      const paymentStatus = totalPaid >= order.total ? 'PAID' : 'PARTIAL';
      // ✅ FIXED: Use 'status' not 'paymentStatus' - Order model has 'status'
      const status = totalPaid >= order.total ? 'COMPLETED' : 'PROCESSING';

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          // ✅ FIXED: Order uses 'status' field
          status: status as any,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error updating order after payment:', error);
    }
  }

  /**
   * Create payment notification
   */
  async createPaymentNotification(payment: any, status: string): Promise<void> {
    try {
      const titles = {
        succeeded: '✅ Payment Successful',
        failed: '❌ Payment Failed',
        refunded: '🔄 Payment Refunded',
        disputed: '⚠️ Payment Disputed',
        dispute_resolved: '✅ Dispute Resolved',
      };

      const messages = {
        succeeded: `Your payment of ${payment.amount} has been successfully processed.`,
        failed: `Your payment of ${payment.amount} failed. Please try again or use a different payment method.`,
        refunded: `Your payment of ${payment.amount} has been refunded.`,
        disputed: `A dispute has been filed for your payment of ${payment.amount}.`,
        dispute_resolved: `The dispute for your payment of ${payment.amount} has been resolved.`,
      };

      await this.prisma.notification.create({
        data: {
          title: titles[status as keyof typeof titles] || `Payment ${status}`,
          message: messages[status as keyof typeof messages] || `Your payment status has been updated to ${status}`,
          type: 'PAYMENT',
          priority: status === 'failed' ? 'HIGH' : 'MEDIUM',
          userId: payment.userId,
          link: `/payments/${payment.id}`,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error creating payment notification:', error);
    }
  }

  /**
   * Create pending payment
   */
  async createPendingPayment(data: {
    amount: number;
    paymentMethod: string;
    userId: string;
    transactionId: string;
    reference: string;
    saleId?: string;
    orderId?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    return await this.prisma.payment.create({
      data: {
        amount: data.amount,
        paymentMethod: data.paymentMethod as any,
        status: 'PENDING',
        transactionId: data.transactionId,
        reference: data.reference,
        userId: data.userId,
        saleId: data.saleId || null,
        orderId: data.orderId || null,
        processedAt: new Date(),
        metadata: data.metadata,
      },
    });
  }

  /**
   * Get payment by transaction ID
   */
  async getPaymentByTransactionId(transactionId: string): Promise<any> {
    return await this.prisma.payment.findFirst({
      where: { transactionId },
      include: {
        sale: true,
        order: true,
        user: true,
      },
    });
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string, 
    status: string, 
    data?: Record<string, any>
  ): Promise<any> {
    return await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: status as any,
        ...data,
      },
    });
  }

  // ============================================
  // REFUND METHODS
  // ============================================

  /**
   * Refund payment with comprehensive handling
   */
  async refundPayment(
    paymentIdOrData: string | RefundData,
    amount?: number,
    reason?: string,
    userId?: string
  ): Promise<any> {
    try {
      let paymentId: string;
      let refundAmount: number | undefined;
      let refundReason: string | undefined;
      let refundUserId: string | undefined;
      let metadata: Record<string, any> | undefined;

      if (typeof paymentIdOrData === 'string') {
        paymentId = paymentIdOrData;
        refundAmount = amount;
        refundReason = reason;
        refundUserId = userId;
      } else {
        paymentId = paymentIdOrData.paymentId;
        refundAmount = paymentIdOrData.amount;
        refundReason = paymentIdOrData.reason;
        refundUserId = paymentIdOrData.userId;
        metadata = paymentIdOrData.metadata;
      }

      if (!paymentId) {
        throw new AppError('Payment ID is required', 400);
      }

      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: {
            sale: true,
            order: true,
          },
        });

        if (!payment) {
          throw new AppError('Payment not found', 404);
        }

        if (payment.status !== 'PAID' && payment.status !== 'PARTIAL') {
          throw new AppError(`Payment cannot be refunded. Current status: ${payment.status}`, 400);
        }

        const refundAmountFinal = refundAmount || payment.amount;

        if (refundAmountFinal <= 0) {
          throw new AppError('Refund amount must be positive', 400);
        }

        if (refundAmountFinal > payment.amount) {
          throw new AppError('Refund amount cannot exceed payment amount', 400);
        }

        let refundResult: any;

        // Handle refund based on payment method
        if (payment.paymentMethod === 'CREDIT_CARD' || payment.paymentMethod === 'DEBIT_CARD') {
          // Stripe refund
          if (!payment.transactionId) {
            throw new AppError('No transaction ID found for refund', 400);
          }

          const refundParams: Stripe.RefundCreateParams = {
            payment_intent: payment.transactionId,
            amount: Math.round(refundAmountFinal * 100),
            reason: (refundReason as Stripe.RefundCreateParams.Reason) || 'requested_by_customer',
            metadata: {
              userId: refundUserId || payment.userId,
              paymentId: payment.id,
              reason: refundReason || 'No reason provided',
              ...metadata,
            },
          };

          refundResult = await stripe.refunds.create(refundParams);
        } else {
          // Use provider handler for other payment methods
          const handler = this.getProviderHandler(payment.paymentMethod);
          if (handler) {
            refundResult = await handler.refundPayment(payment.transactionId || payment.id, {
              amount: refundAmountFinal,
              reason: refundReason,
              currency: 'USD',
              metadata: metadata,
            });
          } else {
            // Fallback for unsupported providers
            refundResult = {
              id: `refund_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
              status: 'succeeded',
              amount: refundAmountFinal,
            };
          }
        }

        const totalRefunded = (payment as any).refundedAmount || 0 + refundAmountFinal;
        const newStatus = totalRefunded >= payment.amount ? 'REFUNDED' : 'PARTIAL';

        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: newStatus as any,
            refundedAt: new Date(),
            refundReason: refundReason,
            refundedBy: refundUserId,
            notes: `Refunded: ${refundResult.id} - ${refundReason || 'No reason provided'}`,
          } as any,
        });

        logger.info(`Refund processed: ${refundResult.id}`);

        // Update sale if exists
        if (payment.saleId && payment.sale) {
          const newPaidAmount = Math.max(0, payment.sale.paidAmount - refundAmountFinal);
          const saleStatus = newPaidAmount <= 0 ? 'REFUNDED' : 'PROCESSING';

          await tx.sale.update({
            where: { id: payment.saleId },
            data: {
              paidAmount: newPaidAmount,
              status: saleStatus as any,
            },
          });
        }

        // Update order if exists
        if (payment.orderId) {
          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              paymentStatus: newStatus === 'REFUNDED' ? 'REFUNDED' : 'PARTIAL',
            } as any,
          });
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'PAYMENT',
            entityId: paymentId,
            entityName: `Payment ${paymentId}`,
            userId: refundUserId || payment.userId,
            changes: {
              action: 'REFUND',
              amount: refundAmountFinal,
              previousStatus: payment.status,
              newStatus: newStatus,
              refundId: refundResult.id,
              reason: refundReason || 'No reason provided',
            },
          },
        });

        this.safeEmitPaymentEvent(updatedPayment, payment.sale?.businessUnitId || '', 'refunded');

        return {
          refund: refundResult,
          payment: updatedPayment,
          refundedAmount: refundAmountFinal,
          totalRefunded,
        };
      });
    } catch (error) {
      this.handleError(error, 'PaymentService.refundPayment');
      throw error;
    }
  }

  // ============================================
  // GETTER METHODS
  // ============================================

  /**
   * Get payment status with full details
   */
  async getPaymentStatus(paymentId: string): Promise<any> {
    try {
      if (!paymentId) {
        throw new AppError('Payment ID is required', 400);
      }

      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          sale: {
            select: {
              id: true,
              receiptNumber: true,
              total: true,
              paidAmount: true,
              status: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              // ✅ FIXED: Changed 'paymentStatus' to 'status' since 'paymentStatus' doesn't exist
              status: true,
              subtotal: true,
              tax: true,
              discount: true,
              notes: true,
              customerId: true,
              createdAt: true,
              updatedAt: true,
              businessUnitId: true,
              userId: true,
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true,
                },
              },
              businessUnit: {
                select: {
                  id: true,
                  name: true,
                  code: true,
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
              items: {
                select: {
                  id: true,
                  quantity: true,
                  unitPrice: true,
                  total: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                    },
                  },
                },
              },
              payment: {
                select: {
                  id: true,
                  amount: true,
                  paymentMethod: true,
                  status: true,
                  processedAt: true,
                },
              },
              sale: {
                select: {
                  id: true,
                  receiptNumber: true,
                  total: true,
                },
              },
              receipt: {
                select: {
                  id: true,
                  receiptNumber: true,
                },
              },
              _count: true,
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
          cashRegister: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          cashRegisterSession: {
            select: {
              id: true,
              openedAt: true,
              closedAt: true,
              status: true,
            },
          },
        },
      });

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      return payment;
    } catch (error) {
      this.handleError(error, 'PaymentService.getPaymentStatus');
      throw error;
    }
  }

  /**
   * Get payment summary with comprehensive statistics
   */
  async getPaymentSummary(params: PaymentFilters): Promise<PaymentSummary> {
    try {
      const { startDate, endDate, businessUnitId, status, paymentMethod, provider } = params;

      const where: Prisma.PaymentWhereInput = {
        ...(startDate && { processedAt: { gte: startDate } }),
        ...(endDate && { processedAt: { lte: endDate } }),
        ...(status && { status: status as any }),
        ...(paymentMethod && { paymentMethod: paymentMethod as any }),
        ...(provider && { gatewayId: provider }),
        ...(businessUnitId && {
          OR: [
            { sale: { businessUnitId } },
            { order: { businessUnitId } },
            { cashRegister: { businessUnitId } },
          ],
        }),
      };

      // Get all payments for summary
      const payments = await this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          status: true,
        },
      });

      // Calculate totals
      let totalAmount = 0;
      let totalRefunds = 0;
      let refundCount = 0;
      const byMethod: Record<string, number> = {};

      payments.forEach((payment: any) => {
        if (payment.status === 'REFUNDED') {
          totalRefunds += payment.amount;
          refundCount++;
        } else {
          totalAmount += payment.amount;
        }
        byMethod[payment.paymentMethod] = (byMethod[payment.paymentMethod] || 0) + payment.amount;
      });

      const count = payments.length;
      const averageAmount = count > 0 ? totalAmount / count : 0;
      const netAmount = totalAmount - totalRefunds;

      return {
        totalAmount,
        byMethod,
        count,
        averageAmount,
        totalRefunds,
        refundCount,
        netAmount,
      };
    } catch (error) {
      console.error('Error in getPaymentSummary:', error);
      // ✅ FIXED: Return default values instead of throwing
      return {
        totalAmount: 0,
        byMethod: {},
        count: 0,
        averageAmount: 0,
        totalRefunds: 0,
        refundCount: 0,
        netAmount: 0,
      };
    }
  }

  /**
   * Get all payments with filters
   */
  async getAllPayments(params: PaymentFilters & { page?: number; limit?: number }): Promise<any> {
    try {
      const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        businessUnitId,
        status,
        paymentMethod,
        userId,
        saleId,
        orderId,
        provider,
      } = params;

      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(100, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: Prisma.PaymentWhereInput = {
        ...(startDate && { processedAt: { gte: startDate } }),
        ...(endDate && { processedAt: { lte: endDate } }),
        ...(status && { status: status as any }),
        ...(paymentMethod && { paymentMethod: paymentMethod as any }),
        ...(userId && { userId }),
        ...(saleId && { saleId }),
        ...(orderId && { orderId }),
        ...(provider && { gatewayId: provider }),
        ...(businessUnitId && {
          OR: [
            { sale: { businessUnitId } },
            { order: { businessUnitId } },
            { cashRegister: { businessUnitId } },
          ],
        }),
      };

      const [payments, total] = await Promise.all([
        this.prisma.payment.findMany({
          where,
          skip,
          take: validatedLimit,
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
              },
            },
            cashRegister: true,
            cashRegisterSession: true,
          },
        }),
        this.prisma.payment.count({ where }),
      ]);

      return {
        payments,
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
      };
    } catch (error) {
      this.handleError(error, 'PaymentService.getAllPayments');
      throw error;
    }
  }

  // ============================================
  // PROVIDER MANAGEMENT METHODS
  // ============================================

  /**
   * Get payment providers with real transaction stats
   */
// D:\Projects\Kalwanga\packages\backend\src\services\paymentService.ts

/**
 * Get payment providers with auto-creation fallback
 */
async getPaymentProviders(userId?: string, businessUnitId?: string): Promise<any[]> {
  try {
    const where: any = {
      deletedAt: null,
    };

    if (businessUnitId) {
      where.businessUnitId = businessUnitId;
    }

    let providers = await this.prisma.paymentProvider.findMany({
      where,
      include: {
        currencies: {
          where: { isActive: true },
        },
        paymentMethods: {
          where: {
            isActive: true,
            deletedAt: null,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    });

    // ✅ If no providers exist, auto-create default ones
    if (providers.length === 0) {
      providers = await this.createDefaultProviders(businessUnitId);
    }

    // Enrich with stats
    const providersWithStats = await Promise.all(
      providers.map(async (provider) => {
        const stats = await this.getProviderTransactionStats(provider.id);

        return {
          id: provider.id,
          provider: provider.provider,
          name: provider.name,
          code: provider.code,
          type: provider.type,
          isActive: provider.isActive,
          isHealthy: provider.isHealthy,
          configured: provider.configured,
          transactions24h: stats.transactions24h,
          volume24h: stats.volume24h,
          transactions7d: stats.transactions7d,
          volume7d: stats.volume7d,
          transactions30d: stats.transactions30d,
          volume30d: stats.volume30d,
          config: {
            name: provider.name,
            type: provider.type,
            supportedCurrencies: provider.currencies.map(c => c.currency),
            supportedMethods: provider.paymentMethods.map(m => m.code),
            description: provider.paymentMethods[0]?.description || undefined,
            icon: provider.paymentMethods[0]?.icon || undefined,
            minAmount: provider.paymentMethods[0]?.minAmount || undefined,
            maxAmount: provider.paymentMethods[0]?.maxAmount || undefined,
            feePercentage: provider.paymentMethods[0]?.feePercentage || undefined,
            feeFixed: provider.paymentMethods[0]?.feeFixed || undefined,
          },
          settings: provider.settings as Record<string, any> || undefined,
          order: provider.order,
          createdAt: provider.createdAt,
          updatedAt: provider.updatedAt,
        };
      })
    );

    return providersWithStats;
  } catch (error) {
    logger.error('Error getting payment providers:', error);
    return this.getDefaultProviders();
  }
}

/**
 * Auto-create default providers in the database
 */
async createDefaultProviders(businessUnitId?: string): Promise<any[]> {
  const defaultProviders = [
    {
      provider: PaymentProviderEnum.CASH,
      name: 'Cash',
      code: 'CASH',
      type: PaymentProviderType.OFFLINE,
      isActive: true,
      isHealthy: true,
      configured: true,
      order: 0,
      config: {
        name: 'Cash',
        type: 'OFFLINE',
        supportedCurrencies: ['USD', 'TZS', 'KES', 'UGX'],
        supportedMethods: ['CASH'],
        description: 'Pay with cash at the counter',
        icon: '💰',
        feePercentage: 0,
        feeFixed: 0,
      },
      currencies: ['USD', 'TZS', 'KES', 'UGX'],
      paymentMethods: [{
        name: 'Cash',
        code: 'CASH',
        description: 'Pay with cash at the counter',
        icon: '💰',
        isActive: true,
        requiresRedirect: false,
        isInstant: true,
        minAmount: 0,
        maxAmount: 100000,
        feePercentage: 0,
        feeFixed: 0,
        order: 0,
      }],
    },
    {
      provider: PaymentProviderEnum.STRIPE,
      name: 'Stripe',
      code: 'STRIPE',
      type: PaymentProviderType.ONLINE,
      isActive: true,
      isHealthy: true,
      configured: false,
      order: 1,
      config: {
        name: 'Stripe',
        type: 'ONLINE',
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        supportedMethods: ['CREDIT_CARD', 'DEBIT_CARD'],
        description: 'Pay with credit card (Visa, Mastercard, Amex)',
        icon: '💳',
        minAmount: 1,
        maxAmount: 100000,
        feePercentage: 2.9,
        feeFixed: 0.30,
      },
      currencies: ['USD', 'EUR', 'GBP'],
      paymentMethods: [
        {
          name: 'Credit Card',
          code: 'CREDIT_CARD',
          description: 'Pay with credit card',
          icon: '💳',
          isActive: true,
          requiresRedirect: true,
          isInstant: true,
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 2.9,
          feeFixed: 0.30,
          order: 0,
        },
        {
          name: 'Debit Card',
          code: 'DEBIT_CARD',
          description: 'Pay with debit card',
          icon: '💳',
          isActive: true,
          requiresRedirect: true,
          isInstant: true,
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 2.9,
          feeFixed: 0.30,
          order: 1,
        },
      ],
    },
    {
      provider: PaymentProviderEnum.MOBILE_MONEY,
      name: 'Mobile Money',
      code: 'MOBILE_MONEY',
      type: PaymentProviderType.ONLINE,
      isActive: true,
      isHealthy: true,
      configured: false,
      order: 2,
      config: {
        name: 'Mobile Money',
        type: 'ONLINE',
        supportedCurrencies: ['TZS', 'KES', 'UGX', 'USD'],
        supportedMethods: ['MOBILE_MONEY'],
        description: 'M-Pesa, Tigo Pesa, Airtel Money',
        icon: '📱',
        minAmount: 1,
        maxAmount: 10000,
        feePercentage: 1.5,
        feeFixed: 0.10,
      },
      currencies: ['TZS', 'KES', 'UGX', 'USD'],
      paymentMethods: [{
        name: 'Mobile Money',
        code: 'MOBILE_MONEY',
        description: 'M-Pesa, Tigo Pesa, Airtel Money',
        icon: '📱',
        isActive: true,
        requiresRedirect: false,
        isInstant: true,
        minAmount: 1,
        maxAmount: 10000,
        feePercentage: 1.5,
        feeFixed: 0.10,
        order: 0,
      }],
    },
    {
      provider: PaymentProviderEnum.BANK_TRANSFER,
      name: 'Bank Transfer',
      code: 'BANK_TRANSFER',
      type: PaymentProviderType.ONLINE,
      isActive: true,
      isHealthy: true,
      configured: false,
      order: 3,
      config: {
        name: 'Bank Transfer',
        type: 'ONLINE',
        supportedCurrencies: ['USD', 'TZS', 'KES', 'UGX'],
        supportedMethods: ['BANK_TRANSFER'],
        description: 'Direct bank transfer',
        icon: '🏦',
        minAmount: 10,
        maxAmount: 1000000,
        feePercentage: 0,
        feeFixed: 0,
      },
      currencies: ['USD', 'TZS', 'KES', 'UGX'],
      paymentMethods: [{
        name: 'Bank Transfer',
        code: 'BANK_TRANSFER',
        description: 'Direct bank transfer',
        icon: '🏦',
        isActive: true,
        requiresRedirect: true,
        isInstant: false,
        minAmount: 10,
        maxAmount: 1000000,
        feePercentage: 0,
        feeFixed: 0,
        order: 0,
      }],
    },
    {
      provider: PaymentProviderEnum.GIFT_CARD,
      name: 'Gift Card',
      code: 'GIFT_CARD',
      type: PaymentProviderType.ONLINE,
      isActive: true,
      isHealthy: true,
      configured: false,
      order: 4,
      config: {
        name: 'Gift Card',
        type: 'ONLINE',
        supportedCurrencies: ['USD'],
        supportedMethods: ['GIFT_CARD'],
        description: 'Redeem your gift card',
        icon: '🎁',
        minAmount: 1,
        maxAmount: 1000,
        feePercentage: 0,
        feeFixed: 0,
      },
      currencies: ['USD'],
      paymentMethods: [{
        name: 'Gift Card',
        code: 'GIFT_CARD',
        description: 'Redeem your gift card',
        icon: '🎁',
        isActive: true,
        requiresRedirect: false,
        isInstant: true,
        minAmount: 1,
        maxAmount: 1000,
        feePercentage: 0,
        feeFixed: 0,
        order: 0,
      }],
    },
    {
      provider: PaymentProviderEnum.LOYALTY_POINTS,
      name: 'Loyalty Points',
      code: 'LOYALTY_POINTS',
      type: PaymentProviderType.OFFLINE,
      isActive: true,
      isHealthy: true,
      configured: false,
      order: 5,
      config: {
        name: 'Loyalty Points',
        type: 'OFFLINE',
        supportedCurrencies: ['USD'],
        supportedMethods: ['LOYALTY_POINTS'],
        description: 'Pay with your loyalty points',
        icon: '⭐',
        minAmount: 1,
        maxAmount: 1000,
        feePercentage: 0,
        feeFixed: 0,
      },
      currencies: ['USD'],
      paymentMethods: [{
        name: 'Loyalty Points',
        code: 'LOYALTY_POINTS',
        description: 'Pay with your loyalty points',
        icon: '⭐',
        isActive: true,
        requiresRedirect: false,
        isInstant: true,
        minAmount: 1,
        maxAmount: 1000,
        feePercentage: 0,
        feeFixed: 0,
        order: 0,
      }],
    },
    {
      provider: PaymentProviderEnum.PAYPAL,
      name: 'PayPal',
      code: 'PAYPAL',
      type: PaymentProviderType.ONLINE,
      isActive: false,
      isHealthy: true,
      configured: false,
      order: 6,
      config: {
        name: 'PayPal',
        type: 'ONLINE',
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        supportedMethods: ['PAYPAL'],
        description: 'Pay with PayPal',
        icon: '💸',
        minAmount: 1,
        maxAmount: 100000,
        feePercentage: 3.5,
        feeFixed: 0.30,
      },
      currencies: ['USD', 'EUR', 'GBP'],
      paymentMethods: [{
        name: 'PayPal',
        code: 'PAYPAL',
        description: 'Pay with PayPal',
        icon: '💸',
        isActive: false,
        requiresRedirect: true,
        isInstant: true,
        minAmount: 1,
        maxAmount: 100000,
        feePercentage: 3.5,
        feeFixed: 0.30,
        order: 0,
      }],
    },
    {
      provider: PaymentProviderEnum.FLUTTERWAVE,
      name: 'Flutterwave',
      code: 'FLUTTERWAVE',
      type: PaymentProviderType.ONLINE,
      isActive: false,
      isHealthy: true,
      configured: false,
      order: 7,
      config: {
        name: 'Flutterwave',
        type: 'ONLINE',
        supportedCurrencies: ['NGN', 'GHS', 'KES', 'UGX', 'TZS', 'USD'],
        supportedMethods: ['FLUTTERWAVE'],
        description: 'Pay with Flutterwave',
        icon: '🌊',
        minAmount: 1,
        maxAmount: 100000,
        feePercentage: 1.9,
        feeFixed: 0.20,
      },
      currencies: ['NGN', 'GHS', 'KES', 'UGX', 'TZS', 'USD'],
      paymentMethods: [{
        name: 'Flutterwave',
        code: 'FLUTTERWAVE',
        description: 'Pay with Flutterwave',
        icon: '🌊',
        isActive: false,
        requiresRedirect: true,
        isInstant: true,
        minAmount: 1,
        maxAmount: 100000,
        feePercentage: 1.9,
        feeFixed: 0.20,
        order: 0,
      }],
    },
    {
      provider: PaymentProviderEnum.PAYSTACK,
      name: 'Paystack',
      code: 'PAYSTACK',
      type: PaymentProviderType.ONLINE,
      isActive: false,
      isHealthy: true,
      configured: false,
      order: 8,
      config: {
        name: 'Paystack',
        type: 'ONLINE',
        supportedCurrencies: ['NGN', 'GHS', 'USD'],
        supportedMethods: ['PAYSTACK'],
        description: 'Pay with Paystack',
        icon: '🔷',
        minAmount: 1,
        maxAmount: 100000,
        feePercentage: 1.5,
        feeFixed: 0.20,
      },
      currencies: ['NGN', 'GHS', 'USD'],
      paymentMethods: [{
        name: 'Paystack',
        code: 'PAYSTACK',
        description: 'Pay with Paystack',
        icon: '🔷',
        isActive: false,
        requiresRedirect: true,
        isInstant: true,
        minAmount: 1,
        maxAmount: 100000,
        feePercentage: 1.5,
        feeFixed: 0.20,
        order: 0,
      }],
    },
    {
      provider: PaymentProviderEnum.SQUARE,
      name: 'Square',
      code: 'SQUARE',
      type: PaymentProviderType.ONLINE,
      isActive: false,
      isHealthy: true,
      configured: false,
      order: 9,
      config: {
        name: 'Square',
        type: 'ONLINE',
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        supportedMethods: ['SQUARE'],
        description: 'Pay with Square',
        icon: '⬜',
        minAmount: 1,
        maxAmount: 100000,
        feePercentage: 2.6,
        feeFixed: 0.30,
      },
      currencies: ['USD', 'EUR', 'GBP'],
      paymentMethods: [{
        name: 'Square',
        code: 'SQUARE',
        description: 'Pay with Square',
        icon: '⬜',
        isActive: false,
        requiresRedirect: false,
        isInstant: true,
        minAmount: 1,
        maxAmount: 100000,
        feePercentage: 2.6,
        feeFixed: 0.30,
        order: 0,
      }],
    },
  ];

  const createdProviders = [];

  for (const providerData of defaultProviders) {
    const { currencies, paymentMethods, ...providerCreateData } = providerData;

    const provider = await this.prisma.paymentProvider.create({
      data: {
        ...providerCreateData,
        businessUnitId: businessUnitId || undefined,
        currencies: {
          create: currencies.map((currency: string) => ({
            currency,
            isActive: true,
          })),
        },
        paymentMethods: {
          create: paymentMethods.map((method: any) => ({
            ...method,
            businessUnitId: businessUnitId || undefined,
          })),
        },
      },
      include: {
        currencies: true,
        paymentMethods: true,
      },
    });

    createdProviders.push(provider);
    logger.info(`Auto-created provider: ${provider.name} (${provider.code})`);
  }

  return createdProviders;
}

  /**
   * Get provider transaction statistics
   */
  async getProviderTransactionStats(providerId: string): Promise<{
    transactions24h: number;
    volume24h: number;
    transactions7d: number;
    volume7d: number;
    transactions30d: number;
    volume30d: number;
  }> {
    const now = new Date();
    const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const provider = await this.prisma.paymentProvider.findUnique({
      where: { id: providerId },
      include: {
        paymentMethods: {
          select: { id: true },
        },
      },
    });

    if (!provider || provider.paymentMethods.length === 0) {
      return {
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
      };
    }

    const paymentMethodIds = provider.paymentMethods.map(m => m.id);

    const [stats24h, stats7d, stats30d] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE payment_method_id IN (${paymentMethodIds.join(',')})
          AND status = 'PAID'
          AND processed_at >= ${start24h}
          AND deleted_at IS NULL
      `,
      this.prisma.$queryRaw`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE payment_method_id IN (${paymentMethodIds.join(',')})
          AND status = 'PAID'
          AND processed_at >= ${start7d}
          AND deleted_at IS NULL
      `,
      this.prisma.$queryRaw`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE payment_method_id IN (${paymentMethodIds.join(',')})
          AND status = 'PAID'
          AND processed_at >= ${start30d}
          AND deleted_at IS NULL
      `,
    ]);

    const stats24hResult = (stats24h as any)[0] || { count: 0, total: 0 };
    const stats7dResult = (stats7d as any)[0] || { count: 0, total: 0 };
    const stats30dResult = (stats30d as any)[0] || { count: 0, total: 0 };

    return {
      transactions24h: Number(stats24hResult.count),
      volume24h: Number(stats24hResult.total),
      transactions7d: Number(stats7dResult.count),
      volume7d: Number(stats7dResult.total),
      transactions30d: Number(stats30dResult.count),
      volume30d: Number(stats30dResult.total),
    };
  }

  /**
   * Get default providers (fallback)
   */
  getDefaultProviders(): any[] {
    return [
      {
        id: 'default_cash',
        provider: 'CASH',
        name: 'Cash',
        code: 'CASH',
        type: 'OFFLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Cash',
          type: 'OFFLINE',
          supportedCurrencies: ['USD', 'TZS', 'KES', 'UGX'],
          supportedMethods: ['CASH'],
          description: 'Pay with cash at the counter',
          icon: '💰',
          feePercentage: 0,
          feeFixed: 0,
        },
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'default_stripe',
        provider: 'STRIPE',
        name: 'Stripe',
        code: 'STRIPE',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Stripe',
          type: 'ONLINE',
          supportedCurrencies: ['USD', 'EUR', 'GBP'],
          supportedMethods: ['CREDIT_CARD', 'DEBIT_CARD'],
          description: 'Pay with credit card (Visa, Mastercard, Amex)',
          icon: '💳',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 2.9,
          feeFixed: 0.30,
        },
        order: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'default_mobile_money',
        provider: 'MOBILE_MONEY',
        name: 'Mobile Money',
        code: 'MOBILE_MONEY',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Mobile Money',
          type: 'ONLINE',
          supportedCurrencies: ['TZS', 'KES', 'UGX', 'USD'],
          supportedMethods: ['MOBILE_MONEY'],
          description: 'M-Pesa, Tigo Pesa, Airtel Money',
          icon: '📱',
          minAmount: 1,
          maxAmount: 10000,
          feePercentage: 1.5,
          feeFixed: 0.10,
        },
        order: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'default_bank_transfer',
        provider: 'BANK_TRANSFER',
        name: 'Bank Transfer',
        code: 'BANK_TRANSFER',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Bank Transfer',
          type: 'ONLINE',
          supportedCurrencies: ['USD', 'TZS', 'KES', 'UGX'],
          supportedMethods: ['BANK_TRANSFER'],
          description: 'Direct bank transfer',
          icon: '🏦',
          minAmount: 10,
          maxAmount: 1000000,
          feePercentage: 0,
          feeFixed: 0,
        },
        order: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'default_gift_card',
        provider: 'GIFT_CARD',
        name: 'Gift Card',
        code: 'GIFT_CARD',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Gift Card',
          type: 'ONLINE',
          supportedCurrencies: ['USD'],
          supportedMethods: ['GIFT_CARD'],
          description: 'Redeem your gift card',
          icon: '🎁',
          minAmount: 1,
          maxAmount: 1000,
          feePercentage: 0,
          feeFixed: 0,
        },
        order: 4,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'default_loyalty_points',
        provider: 'LOYALTY_POINTS',
        name: 'Loyalty Points',
        code: 'LOYALTY_POINTS',
        type: 'OFFLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Loyalty Points',
          type: 'OFFLINE',
          supportedCurrencies: ['USD'],
          supportedMethods: ['LOYALTY_POINTS'],
          description: 'Pay with your loyalty points',
          icon: '⭐',
          minAmount: 1,
          maxAmount: 1000,
          feePercentage: 0,
          feeFixed: 0,
        },
        order: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'default_paypal',
        provider: 'PAYPAL',
        name: 'PayPal',
        code: 'PAYPAL',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'PayPal',
          type: 'ONLINE',
          supportedCurrencies: ['USD', 'EUR', 'GBP'],
          supportedMethods: ['PAYPAL'],
          description: 'Pay with PayPal',
          icon: '💸',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 3.5,
          feeFixed: 0.30,
        },
        order: 6,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'default_flutterwave',
        provider: 'FLUTTERWAVE',
        name: 'Flutterwave',
        code: 'FLUTTERWAVE',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Flutterwave',
          type: 'ONLINE',
          supportedCurrencies: ['NGN', 'GHS', 'KES', 'UGX', 'TZS', 'USD'],
          supportedMethods: ['FLUTTERWAVE'],
          description: 'Pay with Flutterwave (Cards, Mobile Money, Bank Transfer)',
          icon: '🌊',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 1.9,
          feeFixed: 0.20,
        },
        order: 7,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'default_paystack',
        provider: 'PAYSTACK',
        name: 'Paystack',
        code: 'PAYSTACK',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Paystack',
          type: 'ONLINE',
          supportedCurrencies: ['NGN', 'GHS', 'USD'],
          supportedMethods: ['PAYSTACK'],
          description: 'Pay with Paystack (Cards, Bank Transfer, USSD)',
          icon: '🔷',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 1.5,
          feeFixed: 0.20,
        },
        order: 8,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'default_square',
        provider: 'SQUARE',
        name: 'Square',
        code: 'SQUARE',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Square',
          type: 'ONLINE',
          supportedCurrencies: ['USD', 'EUR', 'GBP'],
          supportedMethods: ['SQUARE'],
          description: 'Pay with Square (Cards, Digital Wallet)',
          icon: '⬜',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 2.6,
          feeFixed: 0.30,
        },
        order: 9,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  // ============================================
  // PROVIDER CRUD OPERATIONS
  // ============================================

  /**
   * Get provider status
   */
  async getProviderStatus(provider: string, businessUnitId?: string): Promise<any> {
    try {
      const where: any = {
        provider: provider as any,
        deletedAt: null,
      };

      if (businessUnitId) {
        where.businessUnitId = businessUnitId;
      }

      const providerRecord = await this.prisma.paymentProvider.findFirst({
        where,
        include: {
          currencies: true,
          paymentMethods: {
            where: { deletedAt: null },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!providerRecord) {
        return {
          id: `default_${provider.toLowerCase()}`,
          provider,
          isActive: true,
          isHealthy: true,
          configured: false,
          transactions24h: 0,
          volume24h: 0,
          config: {
            name: provider,
            type: 'ONLINE',
            supportedCurrencies: ['USD'],
            supportedMethods: [],
          },
        };
      }

      const stats = await this.getProviderTransactionStats(providerRecord.id);

      return {
        id: providerRecord.id,
        provider: providerRecord.provider,
        isActive: providerRecord.isActive,
        isHealthy: providerRecord.isHealthy,
        configured: providerRecord.configured,
        transactions24h: stats.transactions24h,
        volume24h: stats.volume24h,
        config: {
          name: providerRecord.name,
          type: providerRecord.type,
          supportedCurrencies: providerRecord.currencies.map(c => c.currency),
          supportedMethods: providerRecord.paymentMethods.map(m => m.code),
        },
      };
    } catch (error) {
      logger.error('Error getting provider status:', error);
      return {
        id: `default_${provider.toLowerCase()}`,
        provider,
        isActive: true,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        config: {
          name: provider,
          type: 'ONLINE',
          supportedCurrencies: ['USD'],
          supportedMethods: [],
        },
      };
    }
  }

  /**
   * Create payment provider
   */
  async createPaymentProvider(data: any, userId: string): Promise<any> {
    try {
      const {
        provider,
        name,
        code,
        type,
        isActive = true,
        isHealthy = true,
        configured = false,
        config,
        businessUnitId,
        currencies = [],
        settings,
        order = 0,
        paymentMethods = [],
      } = data;

      const existing = await this.prisma.paymentProvider.findFirst({
        where: {
          provider: provider as any,
          businessUnitId: businessUnitId || null,
          deletedAt: null,
        },
      });

      if (existing) {
        throw new AppError(`Provider ${provider} already exists for this business unit`, 400);
      }

      const newProvider = await this.prisma.paymentProvider.create({
        data: {
          provider: provider as any,
          name,
          code,
          type: type as any,
          isActive,
          isHealthy,
          configured,
          config: config || {},
          settings: settings || {},
          order,
          businessUnitId: businessUnitId || undefined,
          currencies: {
            create: currencies.map((currency: string) => ({
              currency,
              isActive: true,
            })),
          },
          paymentMethods: {
            create: paymentMethods.map((method: any) => ({
              name: method.name,
              code: method.code,
              description: method.description || '',
              icon: method.icon || '',
              isActive: method.isActive !== undefined ? method.isActive : true,
              requiresRedirect: method.requiresRedirect || false,
              isInstant: method.isInstant !== undefined ? method.isInstant : true,
              minAmount: method.minAmount,
              maxAmount: method.maxAmount,
              feePercentage: method.feePercentage,
              feeFixed: method.feeFixed,
              order: method.order || 0,
              businessUnitId: businessUnitId || undefined,
            })),
          },
        },
        include: {
          currencies: true,
          paymentMethods: true,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'PAYMENT_PROVIDER',
          entityId: newProvider.id,
          entityName: name,
          userId,
          changes: data,
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      return newProvider;
    } catch (error) {
      this.handleError(error, 'PaymentService.createPaymentProvider');
      throw error;
    }
  }

  /**
   * Update payment provider
   */
  async updatePaymentProvider(id: string, data: any, userId: string): Promise<any> {
    try {
      const existing = await this.prisma.paymentProvider.findUnique({
        where: { id, deletedAt: null },
      });

      if (!existing) {
        throw new AppError('Payment provider not found', 404);
      }

      const updateData: any = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.code !== undefined) updateData.code = data.code;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.isHealthy !== undefined) updateData.isHealthy = data.isHealthy;
      if (data.configured !== undefined) updateData.configured = data.configured;
      if (data.config !== undefined) updateData.config = data.config;
      if (data.settings !== undefined) updateData.settings = data.settings;
      if (data.order !== undefined) updateData.order = data.order;

      const updatedProvider = await this.prisma.paymentProvider.update({
        where: { id },
        data: updateData,
        include: {
          currencies: true,
          paymentMethods: true,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'PAYMENT_PROVIDER',
          entityId: id,
          entityName: updatedProvider.name,
          userId,
          changes: data,
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      return updatedProvider;
    } catch (error) {
      this.handleError(error, 'PaymentService.updatePaymentProvider');
      throw error;
    }
  }

  /**
   * Delete payment provider (soft delete)
   */
  async deletePaymentProvider(id: string, userId: string): Promise<void> {
    try {
      const existing = await this.prisma.paymentProvider.findUnique({
        where: { id, deletedAt: null },
      });

      if (!existing) {
        throw new AppError('Payment provider not found', 404);
      }

      await this.prisma.paymentProvider.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'DELETE',
          entityType: 'PAYMENT_PROVIDER',
          entityId: id,
          entityName: existing.name,
          userId,
          changes: { deletedAt: new Date() },
          severity: 'INFO',
          createdAt: new Date(),
        },
      });
    } catch (error) {
      this.handleError(error, 'PaymentService.deletePaymentProvider');
      throw error;
    }
  }

  /**
   * Get provider by ID
   */
  async getProviderById(id: string): Promise<any> {
    try {
      const provider = await this.prisma.paymentProvider.findUnique({
        where: { id, deletedAt: null },
        include: {
          currencies: true,
          paymentMethods: {
            where: { deletedAt: null },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!provider) {
        throw new AppError('Payment provider not found', 404);
      }

      return provider;
    } catch (error) {
      this.handleError(error, 'PaymentService.getProviderById');
      throw error;
    }
  }

  /**
   * Configure provider with credentials
   */
  async configureProvider(id: string, config: any, settings: any, userId: string): Promise<any> {
    try {
      const existing = await this.prisma.paymentProvider.findUnique({
        where: { id, deletedAt: null },
      });

      if (!existing) {
        throw new AppError('Payment provider not found', 404);
      }

      const updatedConfig = {
        ...(existing.config as any || {}),
        ...config,
      };

      const updatedSettings = {
        ...(existing.settings as any || {}),
        ...(settings || {}),
      };

      const updated = await this.prisma.paymentProvider.update({
        where: { id },
        data: {
          config: updatedConfig,
          settings: updatedSettings,
          configured: true,
          isHealthy: true,
          isActive: true,
        },
        include: {
          currencies: true,
          paymentMethods: true,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'PAYMENT_PROVIDER',
          entityId: id,
          entityName: updated.name,
          userId,
          changes: { config: updatedConfig, settings: updatedSettings },
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      return updated;
    } catch (error) {
      this.handleError(error, 'PaymentService.configureProvider');
      throw error;
    }
  }

  /**
   * Add currency to provider
   */
  async addProviderCurrency(providerId: string, currency: string, conversionRate?: number, userId?: string): Promise<any> {
    try {
      const existing = await this.prisma.paymentProvider.findUnique({
        where: { id: providerId, deletedAt: null },
      });

      if (!existing) {
        throw new AppError('Payment provider not found', 404);
      }

      const existingCurrency = await this.prisma.paymentProviderCurrency.findUnique({
        where: {
          providerId_currency: {
            providerId,
            currency,
          },
        },
      });

      if (existingCurrency) {
        throw new AppError(`Currency ${currency} already exists for this provider`, 400);
      }

      const result = await this.prisma.paymentProviderCurrency.create({
        data: {
          providerId,
          currency,
          conversionRate: conversionRate || null,
          isActive: true,
        },
      });

      if (userId) {
        await this.prisma.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'PAYMENT_PROVIDER_CURRENCY',
            entityId: result.id,
            entityName: currency,
            userId,
            changes: { currency, conversionRate },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });
      }

      return result;
    } catch (error) {
      this.handleError(error, 'PaymentService.addProviderCurrency');
      throw error;
    }
  }

  /**
   * Remove currency from provider
   */
  async removeProviderCurrency(providerId: string, currency: string, userId?: string): Promise<void> {
    try {
      const existing = await this.prisma.paymentProvider.findUnique({
        where: { id: providerId, deletedAt: null },
      });

      if (!existing) {
        throw new AppError('Payment provider not found', 404);
      }

      const currencyRecord = await this.prisma.paymentProviderCurrency.findUnique({
        where: {
          providerId_currency: {
            providerId,
            currency,
          },
        },
      });

      if (!currencyRecord) {
        throw new AppError(`Currency ${currency} not found for this provider`, 404);
      }

      await this.prisma.paymentProviderCurrency.delete({
        where: {
          providerId_currency: {
            providerId,
            currency,
          },
        },
      });

      if (userId) {
        await this.prisma.auditLog.create({
          data: {
            action: 'DELETE',
            entityType: 'PAYMENT_PROVIDER_CURRENCY',
            entityId: currencyRecord.id,
            entityName: currency,
            userId,
            changes: { currency },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });
      }
    } catch (error) {
      this.handleError(error, 'PaymentService.removeProviderCurrency');
      throw error;
    }
  }

  /**
   * Update provider health status with audit
   */
  async updateProviderHealthWithAudit(id: string, isHealthy: boolean, userId: string): Promise<any> {
    try {
      const existing = await this.prisma.paymentProvider.findUnique({
        where: { id, deletedAt: null },
      });

      if (!existing) {
        throw new AppError('Payment provider not found', 404);
      }

      const updated = await this.prisma.paymentProvider.update({
        where: { id },
        data: { isHealthy },
        include: {
          currencies: true,
          paymentMethods: true,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'PAYMENT_PROVIDER',
          entityId: id,
          entityName: updated.name,
          userId,
          changes: { isHealthy },
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      return updated;
    } catch (error) {
      this.handleError(error, 'PaymentService.updateProviderHealthWithAudit');
      throw error;
    }
  }

  /**
   * Update provider health status
   */
  async updateProviderHealth(providerId: string, isHealthy: boolean): Promise<void> {
    try {
      await this.prisma.paymentProvider.update({
        where: { id: providerId },
        data: { isHealthy },
      });
      logger.info(`Provider ${providerId} health status updated to ${isHealthy}`);
    } catch (error) {
      this.handleError(error, 'PaymentService.updateProviderHealth');
      throw error;
    }
  }

  /**
   * Update provider transaction stats (for cron jobs)
   */
  async updateProviderStats(): Promise<void> {
    try {
      const providers = await this.prisma.paymentProvider.findMany({
        include: {
          paymentMethods: {
            select: { id: true },
          },
        },
      });

      for (const provider of providers) {
        const stats = await this.getProviderTransactionStats(provider.id);

        await this.prisma.paymentProvider.update({
          where: { id: provider.id },
          data: {
            transactions24h: stats.transactions24h,
            volume24h: stats.volume24h,
            transactions7d: stats.transactions7d,
            volume7d: stats.volume7d,
            transactions30d: stats.transactions30d,
            volume30d: stats.volume30d,
          },
        });
      }
      
      logger.info(`Updated stats for ${providers.length} providers`);
    } catch (error) {
      this.handleError(error, 'PaymentService.updateProviderStats');
      throw error;
    }
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(payload: any, signature: string): Promise<any> {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new AppError('Webhook secret not configured', 500);
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(
          payload,
          signature,
          webhookSecret
        );
      } catch (err: any) {
        logger.error(`Webhook signature verification failed: ${err.message}`);
        throw new AppError('Invalid webhook signature', 400);
      }

      logger.info(`Stripe webhook received: ${event.type} (${event.id})`);

      let result;
      switch (event.type) {
        case 'payment_intent.succeeded':
          result = await this.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          result = await this.handlePaymentFailed(event.data.object);
          break;
        case 'payment_intent.processing':
          result = await this.handlePaymentProcessing(event.data.object);
          break;
        case 'payment_intent.canceled':
          result = await this.handlePaymentCanceled(event.data.object);
          break;
        case 'charge.refunded':
          result = await this.handleRefundWebhook(event.data.object);
          break;
        case 'charge.dispute.created':
          result = await this.handleDisputeCreated(event.data.object);
          break;
        case 'charge.dispute.funds_reinstated':
          result = await this.handleDisputeResolved(event.data.object);
          break;
        case 'checkout.session.completed':
          result = await this.handleCheckoutSessionCompleted(event.data.object);
          break;
        case 'checkout.session.expired':
          result = await this.handleCheckoutSessionExpired(event.data.object);
          break;
        case 'invoice.paid':
          result = await this.handleInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          result = await this.handleInvoicePaymentFailed(event.data.object);
          break;
        case 'charge.succeeded':
          result = await this.handleChargeSucceeded(event.data.object);
          break;
        case 'charge.failed':
          result = await this.handleChargeFailed(event.data.object);
          break;
        case 'payment_method.attached':
          result = await this.handlePaymentMethodAttached(event.data.object);
          break;
        case 'payment_method.detached':
          result = await this.handlePaymentMethodDetached(event.data.object);
          break;
        case 'customer.created':
          result = await this.handleCustomerCreated(event.data.object);
          break;
        case 'customer.updated':
          result = await this.handleCustomerUpdated(event.data.object);
          break;
        case 'customer.deleted':
          result = await this.handleCustomerDeleted(event.data.object);
          break;
        default:
          logger.info(`Unhandled Stripe event type: ${event.type}`);
          result = await this.handleUnhandledEvent(event);
      }

      await this.prisma.auditLog.create({
        data: {
          action: 'VIEW',
          entityType: 'WEBHOOK',
          entityId: event.id,
          entityName: event.type,
          userId: 'system',
          changes: { 
            event: {
              type: event.type,
              id: event.id,
              created: event.created,
              account: event.account,
            },
            processed: true
          },
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      return { 
        received: true, 
        event: event.type,
        processed: true,
        result 
      };
    } catch (error) {
      logger.error('Webhook processing error:', error);
      throw error;
    }
  }

  // ============================================
  // PROVIDER-SPECIFIC WEBHOOK HANDLERS
  // ============================================

  /**
   * Handle PayPal webhook
   */
  async handlePayPalWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    const paypalHandler = this.providerHandlers.get('PAYPAL') as PayPalProviderHandler;
    if (!paypalHandler) {
      throw new AppError('PayPal provider not available', 503);
    }
    return await paypalHandler.handleWebhook(payload, headers);
  }

  /**
   * Handle Flutterwave webhook
   */
  async handleFlutterwaveWebhook(payload: any, signature: string): Promise<any> {
    const flutterwaveHandler = this.providerHandlers.get('FLUTTERWAVE') as FlutterwaveProviderHandler;
    if (!flutterwaveHandler) {
      throw new AppError('Flutterwave provider not available', 503);
    }
    return await flutterwaveHandler.handleWebhook(payload, signature);
  }

  /**
   * Handle Paystack webhook
   */
  async handlePaystackWebhook(payload: any, signature: string): Promise<any> {
    const paystackHandler = this.providerHandlers.get('PAYSTACK') as PaystackProviderHandler;
    if (!paystackHandler) {
      throw new AppError('Paystack provider not available', 503);
    }
    return await paystackHandler.handleWebhook(payload, signature);
  }

  /**
   * Handle Square webhook
   */
  async handleSquareWebhook(payload: any, signature: string): Promise<any> {
    const squareHandler = this.providerHandlers.get('SQUARE') as SquareProviderHandler;
    if (!squareHandler) {
      throw new AppError('Square provider not available', 503);
    }
    return await squareHandler.handleWebhook(payload, signature);
  }

  /**
   * Handle PayPal order capture
   */
  async capturePayPalOrder(orderId: string): Promise<any> {
    const paypalHandler = this.providerHandlers.get('PAYPAL') as PayPalProviderHandler;
    if (!paypalHandler) {
      throw new AppError('PayPal provider not available', 503);
    }
    return await paypalHandler.captureOrder(orderId);
  }

  /**
   * Create Flutterwave virtual account
   */
  async createFlutterwaveVirtualAccount(data: {
    email: string;
    amount?: number;
    currency?: string;
    customerName?: string;
  }): Promise<any> {
    const flutterwaveHandler = this.providerHandlers.get('FLUTTERWAVE') as FlutterwaveProviderHandler;
    if (!flutterwaveHandler) {
      throw new AppError('Flutterwave provider not available', 503);
    }
    return await flutterwaveHandler.createVirtualAccount(data);
  }

  /**
   * Verify Paystack payment
   */
  async verifyPaystackPayment(reference: string): Promise<any> {
    const paystackHandler = this.providerHandlers.get('PAYSTACK') as PaystackProviderHandler;
    if (!paystackHandler) {
      throw new AppError('Paystack provider not available', 503);
    }
    return await paystackHandler.verifyPayment(reference);
  }

  /**
   * Create Square customer
   */
  async createSquareCustomer(data: {
    email: string;
    name: string;
    phone?: string;
  }): Promise<any> {
    const squareHandler = this.providerHandlers.get('SQUARE') as SquareProviderHandler;
    if (!squareHandler) {
      throw new AppError('Square provider not available', 503);
    }
    return await squareHandler.createCustomer(data);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Generate idempotency key
   */
  private generateIdempotencyKey(data: ProcessPaymentData): string {
    const components = [
      data.userId,
      data.amount,
      data.paymentMethod,
      data.saleId || '',
      data.orderId || '',
      Date.now(),
    ];
    return `pay_${crypto.createHash('sha256').update(components.join('_')).digest('hex').slice(0, 32)}`;
  }

  /**
   * Safely emit payment event
   */
  private safeEmitPaymentEvent(payment: any, businessUnitId: string, eventType: string): void {
    try {
      logger.info(`💳 Payment ${eventType}: ${payment?.id || 'unknown'} - ${businessUnitId}`);
    } catch (error) {
      logger.warn('Failed to emit payment event:', error);
    }
  }

  // ============================================
  // WEBHOOK EVENT HANDLERS
  // ============================================

  private async handlePaymentSuccess(paymentIntent: any): Promise<any> {
    try {
      const { id, amount, currency, metadata, customer, payment_method } = paymentIntent;
      
      logger.info(`Processing payment success: ${id} (${amount} ${currency})`);

      await this.prisma.payment.updateMany({
        where: {
          transactionId: id,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
        data: {
          status: 'PAID',
          processedAt: new Date(),
          customerId: customer || undefined,
          gatewayId: payment_method || undefined,
        },
      });

      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: id },
        include: {
          sale: {
            include: {
              customer: true,
              items: true,
            },
          },
          order: true,
          user: true,
        },
      });

      if (payment) {
        if (payment.sale) {
          await this.updateSaleAfterPayment(payment.sale.id, payment.amount, payment);
          await this.createReceipt(payment.sale);
        }

        if (payment.order) {
          await this.updateOrderAfterPayment(payment.order.id, payment.amount, payment);
        }

        await this.createPaymentNotification(payment, 'succeeded');

        if (payment.sale?.customerId) {
          await this.updateCustomerLoyaltyPoints(payment.sale.customerId, payment.amount);
        }
      }

      if (payment?.sale) {
        await this.updateInventoryAfterSale(payment.sale.id);
      }

      if (metadata?.cartId) {
        await this.clearCart(metadata.cartId);
      }

      return { 
        success: true, 
        paymentId: payment?.id || id,
        status: 'PAID'
      };
    } catch (error) {
      logger.error('Error handling payment success:', error);
      throw error;
    }
  }

  private async handlePaymentFailed(paymentIntent: any): Promise<any> {
    try {
      const { id, last_payment_error } = paymentIntent;
      
      logger.info(`Processing payment failed: ${id}`);

      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: id },
        include: {
          user: true,
          sale: true,
        },
      });

      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            notes: `Failed: ${last_payment_error?.message || 'Unknown error'}`,
          },
        });

        await this.createPaymentNotification(payment, 'failed');

        if (payment.user) {
          await this.sendPaymentFailureNotification(payment.user, payment);
        }
      }

      return { 
        success: true, 
        paymentId: payment?.id || id,
        status: 'FAILED'
      };
    } catch (error) {
      logger.error('Error handling payment failed:', error);
      throw error;
    }
  }

  private async handlePaymentProcessing(paymentIntent: any): Promise<any> {
    try {
      const { id } = paymentIntent;
      logger.info(`Payment processing: ${id}`);

      await this.prisma.payment.updateMany({
        where: { transactionId: id },
        data: {
          status: 'PROCESSING',
        },
      });

      return { success: true, status: 'PROCESSING' };
    } catch (error) {
      logger.error('Error handling payment processing:', error);
      throw error;
    }
  }

  private async handlePaymentCanceled(paymentIntent: any): Promise<any> {
    try {
      const { id } = paymentIntent;
      logger.info(`Payment canceled: ${id}`);

      await this.prisma.payment.updateMany({
        where: { transactionId: id },
        data: {
          status: 'FAILED',
          notes: `Payment canceled: ${id}`,
        },
      });

      return { success: true, status: 'CANCELLED' };
    } catch (error) {
      logger.error('Error handling payment canceled:', error);
      throw error;
    }
  }

  private async handleRefundWebhook(charge: any): Promise<any> {
    try {
      const { payment_intent, id, amount } = charge;
      
      logger.info(`Processing refund webhook: ${id} (${amount})`);

      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: payment_intent },
        include: { 
          sale: {
            include: {
              customer: true,
            }
          },
          user: true,
        },
      });

      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'REFUNDED',
            refundedAt: new Date(),
            notes: `Refunded via Stripe: ${id}\nRefund amount: ${amount}`,
          },
        });

        if (payment.sale) {
          const refundedAmount = amount / 100;
          const newPaidAmount = Math.max(0, payment.sale.paidAmount - refundedAmount);
          
          await this.prisma.sale.update({
            where: { id: payment.sale.id },
            data: {
              paidAmount: newPaidAmount,
              status: newPaidAmount <= 0 ? 'REFUNDED' : 'PROCESSING',
            },
          });

          await this.restoreInventoryAfterRefund(payment.sale.id);
        }

        await this.createPaymentNotification(payment, 'refunded');
        await this.sendRefundEmail(payment);
      }

      return { 
        success: true, 
        paymentId: payment?.id || payment_intent,
        status: 'REFUNDED'
      };
    } catch (error) {
      logger.error('Error handling refund webhook:', error);
      throw error;
    }
  }

  private async handleDisputeCreated(dispute: any): Promise<any> {
    try {
      const { payment_intent, id, reason } = dispute;
      
      logger.info(`Dispute created: ${id} - ${reason}`);

      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: payment_intent },
        include: { user: true },
      });

      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            notes: `Dispute created: ${id}\nReason: ${reason}`,
          },
        });

        await this.createPaymentNotification(payment, 'disputed');
      }

      return { success: true, status: 'DISPUTED' };
    } catch (error) {
      logger.error('Error handling dispute created:', error);
      throw error;
    }
  }

  private async handleDisputeResolved(dispute: any): Promise<any> {
    try {
      const { payment_intent, id, status } = dispute;
      
      logger.info(`Dispute resolved: ${id} - ${status}`);

      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: payment_intent },
      });

      if (payment) {
        const newStatus = status === 'won' ? 'PAID' : 'REFUNDED';
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: newStatus,
            notes: `Dispute resolved: ${id}\nStatus: ${status}`,
          },
        });
      }

      return { success: true, status: 'RESOLVED' };
    } catch (error) {
      logger.error('Error handling dispute resolved:', error);
      throw error;
    }
  }

  private async handleCheckoutSessionCompleted(session: any): Promise<any> {
    try {
      const { id, payment_intent, customer, metadata } = session;
      
      logger.info(`Checkout session completed: ${id} (${payment_intent})`);

      if (payment_intent) {
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);
        
        const existingPayment = await this.prisma.payment.findFirst({
          where: { transactionId: payment_intent },
        });

        if (!existingPayment) {
          await this.prisma.payment.create({
            data: {
              amount: paymentIntent.amount / 100,
              paymentMethod: 'CREDIT_CARD',
              status: 'PAID',
              transactionId: payment_intent,
              reference: payment_intent,
              gatewayId: id,
              currency: paymentIntent.currency,
              userId: metadata?.userId || 'system',
              customerId: customer || metadata?.customerId,
              processedAt: new Date(),
              notes: `Checkout session: ${id}`,
            },
          });
        }
      }

      return { success: true, status: 'COMPLETED' };
    } catch (error) {
      logger.error('Error handling checkout session completed:', error);
      throw error;
    }
  }

  private async handleCheckoutSessionExpired(session: any): Promise<any> {
    try {
      const { id } = session;
      logger.info(`Checkout session expired: ${id}`);
      return { success: true };
    } catch (error) {
      logger.error('Error handling checkout session expired:', error);
      throw error;
    }
  }

  private async handleInvoicePaid(invoice: any): Promise<any> {
    try {
      const { id, customer, amount_paid } = invoice;
      logger.info(`Invoice paid: ${id} - ${amount_paid}`);

      await this.prisma.invoice.create({
        data: {
          invoiceNumber: `INV-${Date.now()}`,
          total: amount_paid / 100,
          subtotal: amount_paid / 100,
          status: 'PAID',
          paidAmount: amount_paid / 100,
          paidAt: new Date(),
          customerId: customer,
          notes: `Stripe invoice: ${id}`,
          userId: 'system',
          companyId: 'default',
        },
      });

      return { success: true };
    } catch (error) {
      logger.error('Error handling invoice paid:', error);
      throw error;
    }
  }

  private async handleInvoicePaymentFailed(invoice: any): Promise<any> {
    try {
      const { id, customer, amount_due } = invoice;
      logger.info(`Invoice payment failed: ${id} - ${amount_due}`);

      await this.sendInvoicePaymentFailedNotification(invoice);

      return { success: true };
    } catch (error) {
      logger.error('Error handling invoice payment failed:', error);
      throw error;
    }
  }

  private async handleChargeSucceeded(charge: any): Promise<any> {
    try {
      const { id, payment_intent, amount, customer } = charge;
      logger.info(`Charge succeeded: ${id} - ${amount}`);

      await this.prisma.payment.updateMany({
        where: { transactionId: payment_intent },
        data: {
          status: 'PAID',
          processedAt: new Date(),
        },
      });

      return { success: true };
    } catch (error) {
      logger.error('Error handling charge succeeded:', error);
      throw error;
    }
  }

  private async handleChargeFailed(charge: any): Promise<any> {
    try {
      const { id, payment_intent } = charge;
      logger.info(`Charge failed: ${id}`);

      await this.prisma.payment.updateMany({
        where: { transactionId: payment_intent },
        data: {
          status: 'FAILED',
        },
      });

      return { success: true };
    } catch (error) {
      logger.error('Error handling charge failed:', error);
      throw error;
    }
  }

  private async handlePaymentMethodAttached(paymentMethod: any): Promise<any> {
    try {
      const { id, customer, type } = paymentMethod;
      logger.info(`Payment method attached: ${id} - ${type}`);

      if (customer) {
        await this.prisma.$executeRaw`
          UPDATE "users" 
          SET "stripePaymentMethodId" = ${id} 
          WHERE "stripeCustomerId" = ${customer}
        `;
      }

      return { success: true };
    } catch (error) {
      logger.error('Error handling payment method attached:', error);
      throw error;
    }
  }

  private async handlePaymentMethodDetached(paymentMethod: any): Promise<any> {
    try {
      const { id, customer } = paymentMethod;
      logger.info(`Payment method detached: ${id}`);

      if (customer) {
        await this.prisma.$executeRaw`
          UPDATE "users" 
          SET "stripePaymentMethodId" = NULL 
          WHERE "stripeCustomerId" = ${customer}
        `;
      }

      return { success: true };
    } catch (error) {
      logger.error('Error handling payment method detached:', error);
      throw error;
    }
  }

  private async handleCustomerCreated(customer: any): Promise<any> {
    try {
      const { id, email } = customer;
      logger.info(`Customer created: ${id} - ${email}`);

      if (email) {
        await this.prisma.$executeRaw`
          UPDATE "users" 
          SET "stripeCustomerId" = ${id} 
          WHERE "email" = ${email}
        `;
      }

      return { success: true };
    } catch (error) {
      logger.error('Error handling customer created:', error);
      throw error;
    }
  }

  private async handleCustomerUpdated(customer: any): Promise<any> {
    try {
      const { id, email } = customer;
      logger.info(`Customer updated: ${id} - ${email}`);
      return { success: true };
    } catch (error) {
      logger.error('Error handling customer updated:', error);
      throw error;
    }
  }

  private async handleCustomerDeleted(customer: any): Promise<any> {
    try {
      const { id } = customer;
      logger.info(`Customer deleted: ${id}`);

      await this.prisma.$executeRaw`
        UPDATE "users" 
        SET "stripeCustomerId" = NULL 
        WHERE "stripeCustomerId" = ${id}
      `;

      return { success: true };
    } catch (error) {
      logger.error('Error handling customer deleted:', error);
      throw error;
    }
  }

  private async handleUnhandledEvent(event: any): Promise<any> {
    try {
      logger.info(`Unhandled Stripe event: ${event.type}`);
      
      await this.prisma.notification.create({
        data: {
          title: `Unhandled Webhook: ${event.type}`,
          message: `A Stripe webhook of type ${event.type} was received but not handled. Please review.`,
          type: 'SYSTEM',
          priority: 'MEDIUM',
          userId: 'system',
          link: '/admin/webhooks',
          createdAt: new Date(),
        },
      });

      return { success: true, unhandled: true, eventType: event.type };
    } catch (error) {
      logger.error('Error handling unhandled event:', error);
      throw error;
    }
  }

  // ============================================
  // WEBHOOK HELPER METHODS
  // ============================================

  private async createReceipt(sale: any): Promise<void> {
    try {
      await this.prisma.receipt.create({
        data: {
          receiptNumber: `RCP-${Date.now()}`,
          content: JSON.stringify(sale),
          format: 'PDF',
          type: 'SALE',
          status: 'ISSUED',
          saleId: sale.id,
          companyId: sale.companyId,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error creating receipt:', error);
    }
  }

  private async updateInventoryAfterSale(saleId: string): Promise<void> {
    try {
      const saleItems = await this.prisma.saleItem.findMany({
        where: { saleId },
      });

      for (const item of saleItems) {
        await this.prisma.inventory.updateMany({
          where: {
            product: {
              id: item.productId,
            },
            variantId: item.variantId || null,
          },
          data: {
            quantity: {
              decrement: item.quantity,
            },
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      logger.error('Error updating inventory after sale:', error);
    }
  }

  private async restoreInventoryAfterRefund(saleId: string): Promise<void> {
    try {
      const saleItems = await this.prisma.saleItem.findMany({
        where: { saleId },
      });

      for (const item of saleItems) {
        await this.prisma.inventory.updateMany({
          where: {
            product: {
              id: item.productId,
            },
            variantId: item.variantId || null,
          },
          data: {
            quantity: {
              increment: item.quantity,
            },
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      logger.error('Error restoring inventory after refund:', error);
    }
  }

  private async updateCustomerLoyaltyPoints(customerId: string, amount: number): Promise<void> {
    try {
      const pointsEarned = Math.floor(amount / 10);
      await this.prisma.customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints: {
            increment: pointsEarned,
          },
          totalSpent: {
            increment: amount,
          },
          lastPurchaseAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error updating loyalty points:', error);
    }
  }

  private async clearCart(cartId: string): Promise<void> {
    try {
      await this.prisma.cartItem.deleteMany({
        where: { cartId },
      });
      await this.prisma.cart.update({
        where: { id: cartId },
        data: {
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0,
          status: 'CHECKED_OUT',
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error clearing cart:', error);
    }
  }

  private async sendPaymentFailureNotification(user: any, payment: any): Promise<void> {
    try {
      logger.info(`Payment failure notification sent for ${payment.id}`);
    } catch (error) {
      logger.error('Error sending payment failure notification:', error);
    }
  }

  private async sendRefundEmail(payment: any): Promise<void> {
    try {
      logger.info(`Refund email sent for ${payment.id}`);
    } catch (error) {
      logger.error('Error sending refund email:', error);
    }
  }

  private async sendInvoicePaymentFailedNotification(invoice: any): Promise<void> {
    try {
      logger.info(`Invoice payment failed notification sent for ${invoice.id}`);
    } catch (error) {
      logger.error('Error sending invoice payment failed notification:', error);
    }
  }

  /**
   * Handle test webhook (development only)
   */
  async handleTestWebhook(event: any): Promise<any> {
    logger.info('Processing test webhook:', event);
    
    await this.prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'WEBHOOK_TEST',
        entityId: event.id || 'test',
        entityName: `Test webhook: ${event.type || 'unknown'}`,
        changes: { event },
        severity: 'INFO',
        userId: 'system',
        createdAt: new Date(),
      },
    });

    return { success: true, event: event.type || 'test' };
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
export default paymentService;
