// D:\Projects\Kalwanga\packages\backend\src\services\paystackService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { PaymentMethod, PaymentStatus } from '../generated/prisma/index.js';
import * as crypto from 'crypto';

interface PaystackConfig {
  secretKey: string;
  publicKey: string;
  webhookSecret?: string;
}

interface PaystackPaymentData {
  amount: number;
  currency?: string;
  paymentMethod?: 'card' | 'mobile_money' | 'bank_transfer' | 'ussd' | 'bank';
  description?: string;
  saleId?: string;
  orderId?: string;
  userId?: string;
  customerEmail?: string;
  customerName?: string;
  phoneNumber?: string;
  redirectUrl?: string;
  metadata?: Record<string, any>;
}

interface PaystackRefundData {
  amount?: number;
  currency?: string;
  reason?: string;
  customerNote?: string;
  merchantNote?: string;
}

export class PaystackService extends BaseService {
  private secretKey: string;
  private publicKey: string;
  private webhookSecret: string;
  private baseUrl: string;

  constructor(config?: Partial<PaystackConfig>) {
    super();
    
    this.secretKey = config?.secretKey || process.env.PAYSTACK_SECRET_KEY || '';
    this.publicKey = config?.publicKey || process.env.PAYSTACK_PUBLIC_KEY || '';
    this.webhookSecret = config?.webhookSecret || process.env.PAYSTACK_WEBHOOK_SECRET || '';
    this.baseUrl = 'https://api.paystack.co';
  }

  validateConfig(): boolean {
    return !!(this.secretKey && this.publicKey);
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  // ============================================
  // PAYMENT PROCESSING
  // ============================================

  /**
   * Process payment via Paystack
   */
  async processPayment(data: PaystackPaymentData): Promise<any> {
    try {
      const reference = `PAY-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      
      let paymentData: any = {
        email: data.customerEmail || 'customer@example.com',
        amount: Math.round(data.amount * 100), // Paystack uses kobo
        currency: data.currency || 'NGN',
        reference: reference,
        callback_url: data.redirectUrl || `${process.env.FRONTEND_URL}/payment/verify`,
        metadata: {
          saleId: data.saleId || '',
          orderId: data.orderId || '',
          userId: data.userId || '',
          custom_fields: [
            {
              display_name: 'Sale ID',
              variable_name: 'sale_id',
              value: data.saleId || '',
            },
            {
              display_name: 'Order ID',
              variable_name: 'order_id',
              value: data.orderId || '',
            },
          ],
          ...data.metadata,
        },
      };

      // Handle different payment channels
      const channels = this.getPaymentChannels(data.paymentMethod);
      paymentData.channels = channels;

      // Handle mobile money specifics
      if (data.paymentMethod === 'mobile_money') {
        paymentData.mobile_money = {
          provider: data.metadata?.provider || 'mtn',
          phone: data.phoneNumber || data.metadata?.phoneNumber,
        };
      }

      // Handle USSD specifics
      if (data.paymentMethod === 'ussd') {
        paymentData.ussd = {
          provider: data.metadata?.provider || 'mtn',
          phone: data.phoneNumber || data.metadata?.phoneNumber,
        };
      }

      // Initiate payment
      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`Paystack payment initialization failed: ${error.message || JSON.stringify(error)}`, 400);
      }

      const result = await response.json();

      // Map payment method to enum
      const paymentMethodEnum = this.mapPaymentMethodToEnum(data.paymentMethod);

      // Create payment record
      const payment = await this.prisma.payment.create({
        data: {
          amount: data.amount,
          paymentMethod: paymentMethodEnum,
          status: PaymentStatus.PENDING,
          transactionId: reference,
          reference: result.data.reference,
          userId: data.userId || 'system',
          gatewayId: 'PAYSTACK',
          notes: `Paystack payment initialized: ${result.data.id}`,
          processedAt: new Date(),
          metadata: {
            accessCode: result.data.access_code,
            paymentData: result.data,
          },
        },
      });

      return {
        id: result.data.id,
        status: 'pending',
        amount: data.amount,
        currency: data.currency || 'NGN',
        reference: result.data.reference,
        provider: 'PAYSTACK',
        authorizationUrl: result.data.authorization_url,
        accessCode: result.data.access_code,
        paymentId: payment.id,
        transactionData: result.data,
      };
    } catch (error) {
      this.handleError(error, 'PaystackService.processPayment');
      throw error;
    }
  }

  private getPaymentChannels(method?: string): string[] {
    const channels: Record<string, string[]> = {
      'card': ['card'],
      'mobile_money': ['mobile_money'],
      'bank_transfer': ['bank', 'ussd'],
      'ussd': ['ussd'],
      'bank': ['bank'],
    };
    return channels[method || 'card'] || ['card'];
  }

  private mapPaymentMethodToEnum(method?: string): PaymentMethod {
    const map: Record<string, PaymentMethod> = {
      'card': PaymentMethod.CREDIT_CARD,
      'mobile_money': PaymentMethod.MOBILE_MONEY,
      'bank_transfer': PaymentMethod.BANK_TRANSFER,
      'ussd': PaymentMethod.MOBILE_MONEY,
      'bank': PaymentMethod.BANK_TRANSFER,
    };
    return map[method || 'card'] || PaymentMethod.CREDIT_CARD;
  }

  private mapPaymentMethod(method?: string): string {
    const map: Record<string, string> = {
      'card': 'CREDIT_CARD',
      'mobile_money': 'MOBILE_MONEY',
      'bank_transfer': 'BANK_TRANSFER',
      'ussd': 'MOBILE_MONEY',
      'bank': 'BANK_TRANSFER',
    };
    return map[method || 'card'] || 'CREDIT_CARD';
  }

  // ============================================
  // PAYMENT VERIFICATION
  // ============================================

  /**
   * Verify a payment after callback
   */
  async verifyPayment(reference: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/transaction/verify/${reference}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`Paystack verification failed: ${error.message}`, 400);
      }

      const result = await response.json();
      const data = result.data;

      // Update payment status
      const status = data.status === 'success' ? PaymentStatus.PAID : 
                     data.status === 'failed' ? PaymentStatus.FAILED : PaymentStatus.PENDING;

      await this.prisma.payment.updateMany({
        where: { transactionId: reference },
        data: {
          status: status,
          gatewayId: data.id,
          processedAt: new Date(),
          notes: `Paystack verified: ${data.id} - ${data.gateway_response}`,
          metadata: { verificationData: data },
        },
      });

      // Update sale if exists
      if (status === PaymentStatus.PAID) {
        await this.updateSaleAfterPayment(reference);
      }

      return {
        success: true,
        status: status,
        amount: data.amount / 100,
        currency: data.currency,
        reference: data.reference,
        gatewayResponse: data.gateway_response,
        transactionData: data,
      };
    } catch (error) {
      this.handleError(error, 'PaystackService.verifyPayment');
      throw error;
    }
  }

  // ============================================
  // REFUND METHODS
  // ============================================

  /**
   * Refund a Paystack payment
   */
  async refundPayment(transactionId: string, data: PaystackRefundData): Promise<any> {
    try {
      // First verify transaction exists
      const transactionResponse = await fetch(`${this.baseUrl}/transaction/verify/${transactionId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!transactionResponse.ok) {
        throw new AppError('Failed to get Paystack transaction', 404);
      }

      const transaction = await transactionResponse.json();

      // Process refund
      const refundData = {
        transaction: transactionId,
        amount: data.amount ? Math.round(data.amount * 100) : undefined,
        currency: data.currency || 'NGN',
        customer_note: data.customerNote || data.reason || 'Refund requested by customer',
        merchant_note: data.merchantNote || '',
      };

      const response = await fetch(`${this.baseUrl}/refund`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(refundData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`Paystack refund failed: ${error.message || JSON.stringify(error)}`, 400);
      }

      const refund = await response.json();

      // Update payment in database
      await this.prisma.payment.updateMany({
        where: { transactionId },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          notes: `Paystack refunded: ${refund.data.id} - ${data.reason || 'No reason provided'}`,
          metadata: { refundData: refund.data },
        },
      });

      return {
        id: refund.data.id,
        status: refund.data.status === 'processed' ? 'succeeded' : 'pending',
        amount: refund.data.amount / 100,
        reference: refund.data.reference,
        provider: 'PAYSTACK',
        refundData: refund.data,
      };
    } catch (error) {
      this.handleError(error, 'PaystackService.refundPayment');
      throw error;
    }
  }

  // ============================================
  // STATUS METHODS
  // ============================================

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/transaction/verify/${transactionId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new AppError('Failed to get Paystack transaction status', 400);
      }

      const result = await response.json();
      const data = result.data;

      // Map Paystack status to internal status
      const statusMap: Record<string, string> = {
        'pending': 'PENDING',
        'success': 'COMPLETED',
        'failed': 'FAILED',
        'abandoned': 'CANCELLED',
        'reversed': 'REFUNDED',
      };

      return {
        status: statusMap[data.status] || 'PENDING',
        transactionId: transactionId,
        provider: 'PAYSTACK',
        transactionData: data,
        rawStatus: data.status,
        amount: data.amount / 100,
        currency: data.currency,
        customer: data.customer,
        gatewayResponse: data.gateway_response,
        channel: data.channel,
        fees: data.fees / 100,
      };
    } catch (error) {
      this.handleError(error, 'PaystackService.getTransactionStatus');
      throw error;
    }
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  /**
   * Handle Paystack webhook
   */
  async handleWebhook(payload: any, signature: string): Promise<any> {
    try {
      // Verify webhook signature
      if (this.webhookSecret) {
        this.verifyWebhookSignature(payload, signature);
      }

      const event = payload.event;
      logger.info(`Paystack webhook received: ${event}`);

      switch (event) {
        case 'charge.success':
          return await this.handleChargeSuccess(payload.data);
        case 'charge.failed':
          return await this.handleChargeFailed(payload.data);
        case 'charge.dispute.created':
          return await this.handleDisputeCreated(payload.data);
        case 'charge.dispute.resolved':
          return await this.handleDisputeResolved(payload.data);
        case 'refund.processed':
          return await this.handleRefundProcessed(payload.data);
        case 'transfer.success':
          return await this.handleTransferSuccess(payload.data);
        case 'transfer.failed':
          return await this.handleTransferFailed(payload.data);
        default:
          logger.info(`Unhandled Paystack webhook: ${event}`);
          return { unhandled: true, event };
      }
    } catch (error) {
      this.handleError(error, 'PaystackService.handleWebhook');
      throw error;
    }
  }

  private verifyWebhookSignature(payload: any, signature: string): void {
    const computedSignature = crypto
      .createHmac('sha512', this.webhookSecret || this.secretKey)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== computedSignature) {
      throw new AppError('Invalid Paystack webhook signature', 400);
    }
  }

  private async handleChargeSuccess(data: any): Promise<any> {
    const reference = data.reference;

    await this.prisma.payment.updateMany({
      where: { transactionId: reference },
      data: {
        status: PaymentStatus.PAID,
        gatewayId: data.id,
        processedAt: new Date(),
        notes: `Paystack charge successful: ${data.id}`,
        metadata: { paystackData: data },
      },
    });

    await this.updateSaleAfterPayment(reference);

    return { success: true, event: 'CHARGE_SUCCESS' };
  }

  private async handleChargeFailed(data: any): Promise<any> {
    const reference = data.reference;

    await this.prisma.payment.updateMany({
      where: { transactionId: reference },
      data: {
        status: PaymentStatus.FAILED,
        notes: `Paystack charge failed: ${data.gateway_response}`,
        metadata: { paystackData: data },
      },
    });

    return { success: true, event: 'CHARGE_FAILED' };
  }

  private async handleDisputeCreated(data: any): Promise<any> {
    const reference = data.reference;

    await this.prisma.payment.updateMany({
      where: { transactionId: reference },
      data: {
        status: PaymentStatus.FAILED,
        notes: `Paystack dispute created: ${data.dispute_id}`,
        metadata: { paystackData: data },
      },
    });

    return { success: true, event: 'DISPUTE_CREATED' };
  }

  private async handleDisputeResolved(data: any): Promise<any> {
    const reference = data.reference;

    await this.prisma.payment.updateMany({
      where: { transactionId: reference },
      data: {
        status: data.resolution === 'resolved' ? PaymentStatus.PAID : PaymentStatus.REFUNDED,
        notes: `Paystack dispute resolved: ${data.dispute_id}`,
        metadata: { paystackData: data },
      },
    });

    return { success: true, event: 'DISPUTE_RESOLVED' };
  }

  private async handleRefundProcessed(data: any): Promise<any> {
    const reference = data.reference;

    await this.prisma.payment.updateMany({
      where: { transactionId: reference },
      data: {
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        notes: `Paystack refund processed: ${data.id}`,
        metadata: { paystackData: data },
      },
    });

    return { success: true, event: 'REFUND_PROCESSED' };
  }

  private async handleTransferSuccess(data: any): Promise<any> {
    logger.info(`Paystack transfer success: ${data.id}`);
    return { success: true, event: 'TRANSFER_SUCCESS' };
  }

  private async handleTransferFailed(data: any): Promise<any> {
    logger.info(`Paystack transfer failed: ${data.id}`);
    return { success: true, event: 'TRANSFER_FAILED' };
  }

  // ============================================
  // PLAN & SUBSCRIPTION METHODS
  // ============================================

  /**
   * Create subscription plan
   */
  async createPlan(data: {
    name: string;
    amount: number;
    interval: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'biennially';
    currency?: string;
    description?: string;
    sendInvoices?: boolean;
    sendSMS?: boolean;
    invoiceLimit?: number;
  }): Promise<any> {
    try {
      const planData = {
        name: data.name,
        description: data.description || '',
        amount: Math.round(data.amount * 100),
        interval: data.interval,
        currency: data.currency || 'NGN',
        send_invoices: data.sendInvoices !== undefined ? data.sendInvoices : true,
        send_sms: data.sendSMS || false,
        invoice_limit: data.invoiceLimit || 0,
      };

      const response = await fetch(`${this.baseUrl}/plan`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(planData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`Failed to create Paystack plan: ${error.message}`, 400);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      this.handleError(error, 'PaystackService.createPlan');
      throw error;
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async updateSaleAfterPayment(reference: string): Promise<void> {
    try {
      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: reference },
        include: { sale: true },
      });

      if (payment?.saleId) {
        await this.prisma.sale.update({
          where: { id: payment.saleId },
          data: {
            paidAmount: { increment: payment.amount },
            paymentStatus: 'PAID',
            status: 'COMPLETED',
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      logger.error('Error updating sale after Paystack payment:', error);
    }
  }
}
