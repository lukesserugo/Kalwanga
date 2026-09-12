// D:\Projects\Kalwanga\packages\backend\src\services\providers\squareProviderService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { PaymentStatus } from '../generated/prisma/index.js';
import * as crypto from 'crypto';

// Note: Square uses OAuth and requires additional setup
// For simplicity, we'll use the REST API directly

interface SquareConfig {
  accessToken: string;
  environment: 'sandbox' | 'production';
  webhookSignatureKey?: string;
  locationId?: string;
  merchantId?: string;
}

interface SquarePaymentData {
  amount: number;
  currency?: string;
  sourceId: string; // Square nonce or token
  description?: string;
  saleId?: string;
  orderId?: string;
  userId?: string;
  customerId?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

interface SquareRefundData {
  amount?: number;
  reason?: string;
  idempotencyKey?: string;
}

export class SquareService extends BaseService {
  private accessToken: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;
  private webhookSignatureKey: string;
  private locationId: string;
  private merchantId: string;

  constructor(config?: Partial<SquareConfig>) {
    super();
    
    this.accessToken = config?.accessToken || process.env.SQUARE_ACCESS_TOKEN || '';
    this.environment = config?.environment || 
      (process.env.SQUARE_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    this.baseUrl = this.environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
    this.webhookSignatureKey = config?.webhookSignatureKey || process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '';
    this.locationId = config?.locationId || process.env.SQUARE_LOCATION_ID || '';
    this.merchantId = config?.merchantId || process.env.SQUARE_MERCHANT_ID || '';
  }

  validateConfig(): boolean {
    return !!(this.accessToken && this.locationId);
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2023-08-16',
    };
  }

  // ============================================
  // PAYMENT PROCESSING
  // ============================================

  /**
   * Process payment via Square
   */
  async processPayment(data: SquarePaymentData): Promise<any> {
    try {
      const idempotencyKey = data.idempotencyKey || 
        `square_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

      const paymentData = {
        idempotency_key: idempotencyKey,
        amount_money: {
          amount: Math.round(data.amount * 100), // Square uses cents
          currency: data.currency || 'USD',
        },
        source_id: data.sourceId, // Card nonce or token
        description: data.description || 'Payment via Square',
        location_id: this.locationId,
        customer_id: data.customerId,
        reference_id: data.saleId || data.orderId || `REF-${Date.now()}`,
        metadata: {
          saleId: data.saleId || '',
          orderId: data.orderId || '',
          userId: data.userId || '',
          ...data.metadata,
        },
        note: data.description || 'Payment via Square',
        autocomplete: true, // Automatically complete the payment
        delay_duration: 'PT0S', // No delay
      };

      const response = await fetch(`${this.baseUrl}/v2/payments`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`Square payment failed: ${error.errors?.[0]?.detail || JSON.stringify(error)}`, 400);
      }

      const result = await response.json();
      const payment = result.payment;

      // Create payment record
      const dbPayment = await this.prisma.payment.create({
        data: {
          amount: data.amount,
          paymentMethod: 'CREDIT_CARD',
          status: payment.status === 'COMPLETED' ? PaymentStatus.PAID : PaymentStatus.PENDING,
          transactionId: payment.id,
          reference: payment.id,
          userId: data.userId || 'system',
          gatewayId: 'SQUARE',
          notes: `Square payment: ${payment.id}`,
          processedAt: new Date(),
          metadata: {
            squarePayment: payment,
            orderId: payment.order_id,
            locationId: payment.location_id,
          },
        },
      });

      return {
        id: payment.id,
        status: payment.status === 'COMPLETED' ? 'succeeded' : 'pending',
        amount: payment.amount_money.amount / 100,
        currency: payment.amount_money.currency,
        reference: payment.id,
        provider: 'SQUARE',
        paymentId: dbPayment.id,
        paymentData: payment,
        receiptUrl: payment.receipt_url,
        orderId: payment.order_id,
      };
    } catch (error) {
      this.handleError(error, 'SquareService.processPayment');
      throw error;
    }
  }

  /**
   * Create payment using card nonce (frontend generated)
   */
  async processCardPayment(data: {
    amount: number;
    cardNonce: string;
    currency?: string;
    customerId?: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    return this.processPayment({
      amount: data.amount,
      currency: data.currency,
      sourceId: data.cardNonce,
      customerId: data.customerId,
      description: data.description,
      metadata: data.metadata,
    });
  }

  // ============================================
  // REFUND METHODS
  // ============================================

  /**
   * Refund a Square payment
   */
  async refundPayment(paymentId: string, data: SquareRefundData): Promise<any> {
    try {
      const idempotencyKey = data.idempotencyKey || 
        `square_refund_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

      // First get payment details
      const paymentResponse = await fetch(`${this.baseUrl}/v2/payments/${paymentId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!paymentResponse.ok) {
        throw new AppError('Failed to get Square payment for refund', 404);
      }

      const paymentResult = await paymentResponse.json();
      const payment = paymentResult.payment;

      if (payment.status !== 'COMPLETED') {
        throw new AppError(`Cannot refund payment with status: ${payment.status}`, 400);
      }

      // Process refund
      const refundData = {
        idempotency_key: idempotencyKey,
        payment_id: paymentId,
        amount_money: {
          amount: data.amount ? Math.round(data.amount * 100) : payment.amount_money.amount,
          currency: payment.amount_money.currency,
        },
        reason: data.reason || 'Refund requested by customer',
        location_id: this.locationId,
      };

      const response = await fetch(`${this.baseUrl}/v2/refunds`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(refundData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`Square refund failed: ${error.errors?.[0]?.detail || JSON.stringify(error)}`, 400);
      }

      const result = await response.json();
      const refund = result.refund;

      // Update payment in database
      await this.prisma.payment.updateMany({
        where: { transactionId: paymentId },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          notes: `Square refunded: ${refund.id} - ${data.reason || 'No reason provided'}`,
          metadata: { squareRefund: refund },
        },
      });

      return {
        id: refund.id,
        status: refund.status === 'COMPLETED' ? 'succeeded' : 'pending',
        amount: refund.amount_money.amount / 100,
        currency: refund.amount_money.currency,
        reference: refund.id,
        provider: 'SQUARE',
        refundData: refund,
      };
    } catch (error) {
      this.handleError(error, 'SquareService.refundPayment');
      throw error;
    }
  }

  // ============================================
  // STATUS METHODS
  // ============================================

  /**
   * Get transaction status
   */
  async getTransactionStatus(paymentId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/payments/${paymentId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new AppError('Failed to get Square payment status', 400);
      }

      const result = await response.json();
      const payment = result.payment;

      // Map Square status to internal status
      const statusMap: Record<string, string> = {
        'PENDING': 'PENDING',
        'APPROVED': 'PROCESSING',
        'COMPLETED': 'COMPLETED',
        'CANCELED': 'CANCELLED',
        'FAILED': 'FAILED',
        'REFUNDED': 'REFUNDED',
      };

      return {
        status: statusMap[payment.status] || 'PENDING',
        transactionId: payment.id,
        provider: 'SQUARE',
        paymentData: payment,
        rawStatus: payment.status,
        amount: payment.amount_money.amount / 100,
        currency: payment.amount_money.currency,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
        receiptUrl: payment.receipt_url,
        orderId: payment.order_id,
      };
    } catch (error) {
      this.handleError(error, 'SquareService.getTransactionStatus');
      throw error;
    }
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  /**
   * Handle Square webhook
   */
  async handleWebhook(payload: any, signature: string): Promise<any> {
    try {
      // Verify webhook signature if configured
      if (this.webhookSignatureKey) {
        this.verifyWebhookSignature(payload, signature);
      }

      const eventType = payload.type;
      logger.info(`Square webhook received: ${eventType}`);

      const data = payload.data?.object?.payment;

      switch (eventType) {
        case 'payment.created':
          return await this.handlePaymentCreated(data);
        case 'payment.updated':
          return await this.handlePaymentUpdated(data);
        case 'payment.completed':
          return await this.handlePaymentCompleted(data);
        case 'payment.failed':
          return await this.handlePaymentFailed(data);
        case 'payment.canceled':
          return await this.handlePaymentCanceled(data);
        case 'payment.refund.created':
          return await this.handleRefundCreated(payload.data?.object?.refund);
        case 'payment.refund.updated':
          return await this.handleRefundUpdated(payload.data?.object?.refund);
        default:
          logger.info(`Unhandled Square webhook: ${eventType}`);
          return { unhandled: true, eventType };
      }
    } catch (error) {
      this.handleError(error, 'SquareService.handleWebhook');
      throw error;
    }
  }

  private verifyWebhookSignature(payload: any, signature: string): void {
    // Square webhook signature verification
    // Uses HMAC-SHA1 with the webhook signature key
    // For production, implement proper verification
    // Reference: https://developer.squareup.com/docs/webhooks/step3-validate
    // This is a placeholder - implement proper verification in production
    if (!signature) {
      throw new AppError('Missing webhook signature', 400);
    }
    // In production, you would verify the signature here
    // const expectedSignature = crypto
    //   .createHmac('sha256', this.webhookSignatureKey)
    //   .update(JSON.stringify(payload))
    //   .digest('hex');
    // if (signature !== expectedSignature) {
    //   throw new AppError('Invalid webhook signature', 400);
    // }
  }

  private async handlePaymentCreated(data: any): Promise<any> {
    logger.info(`Square payment created: ${data?.id}`);
    return { success: true, event: 'PAYMENT_CREATED' };
  }

  private async handlePaymentUpdated(data: any): Promise<any> {
    const paymentId = data?.id;
    const status = data?.status;

    logger.info(`Square payment updated: ${paymentId} - ${status}`);

    if (paymentId) {
      await this.prisma.payment.updateMany({
        where: { transactionId: paymentId },
        data: {
          status: this.mapSquareStatusToPaymentStatus(status),
          metadata: { squareUpdate: data },
        },
      });
    }

    return { success: true, event: 'PAYMENT_UPDATED' };
  }

  private async handlePaymentCompleted(data: any): Promise<any> {
    const paymentId = data?.id;

    await this.prisma.payment.updateMany({
      where: { transactionId: paymentId },
      data: {
        status: PaymentStatus.PAID,
        processedAt: new Date(),
        notes: `Square payment completed: ${paymentId}`,
        metadata: { squarePayment: data },
      },
    });

    await this.updateSaleAfterPayment(paymentId);

    return { success: true, event: 'PAYMENT_COMPLETED' };
  }

  private async handlePaymentFailed(data: any): Promise<any> {
    const paymentId = data?.id;

    await this.prisma.payment.updateMany({
      where: { transactionId: paymentId },
      data: {
        status: PaymentStatus.FAILED,
        notes: `Square payment failed: ${data?.error?.message || 'Unknown error'}`,
        metadata: { squarePayment: data },
      },
    });

    return { success: true, event: 'PAYMENT_FAILED' };
  }

  private async handlePaymentCanceled(data: any): Promise<any> {
    const paymentId = data?.id;

    await this.prisma.payment.updateMany({
      where: { transactionId: paymentId },
      data: {
        status: PaymentStatus.FAILED,
        notes: `Square payment canceled: ${paymentId}`,
        metadata: { squarePayment: data },
      },
    });

    return { success: true, event: 'PAYMENT_CANCELED' };
  }

  private async handleRefundCreated(data: any): Promise<any> {
    const paymentId = data?.payment_id;

    await this.prisma.payment.updateMany({
      where: { transactionId: paymentId },
      data: {
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        notes: `Square refund created: ${data?.id}`,
        metadata: { squareRefund: data },
      },
    });

    return { success: true, event: 'REFUND_CREATED' };
  }

  private async handleRefundUpdated(data: any): Promise<any> {
    const paymentId = data?.payment_id;

    if (data?.status === 'COMPLETED') {
      await this.prisma.payment.updateMany({
        where: { transactionId: paymentId },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          metadata: { squareRefund: data },
        },
      });
    }

    return { success: true, event: 'REFUND_UPDATED' };
  }

  private mapSquareStatusToPaymentStatus(status: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      'PENDING': PaymentStatus.PENDING,
      'APPROVED': PaymentStatus.PROCESSING,
      'COMPLETED': PaymentStatus.PAID,
      'CANCELED': PaymentStatus.FAILED,
      'FAILED': PaymentStatus.FAILED,
      'REFUNDED': PaymentStatus.REFUNDED,
    };
    return map[status] || PaymentStatus.PENDING;
  }

  // ============================================
  // CUSTOMER METHODS
  // ============================================

  /**
   * Create customer in Square
   */
  async createCustomer(data: {
    email: string;
    name: string;
    phone?: string;
    referenceId?: string;
  }): Promise<any> {
    try {
      const customerData = {
        email_address: data.email,
        family_name: data.name,
        phone_number: data.phone,
        reference_id: data.referenceId || `CUST-${Date.now()}`,
        note: 'Created from Kalwanga POS',
      };

      const response = await fetch(`${this.baseUrl}/v2/customers`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(customerData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`Square customer creation failed: ${error.errors?.[0]?.detail}`, 400);
      }

      const result = await response.json();
      return result.customer;
    } catch (error) {
      this.handleError(error, 'SquareService.createCustomer');
      throw error;
    }
  }

  // ============================================
  // LOCATION METHODS
  // ============================================

  /**
   * Get available locations
   */
  async getLocations(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/locations`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`Failed to get Square locations: ${error.errors?.[0]?.detail}`, 400);
      }

      const result = await response.json();
      return result.locations || [];
    } catch (error) {
      this.handleError(error, 'SquareService.getLocations');
      throw error;
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async updateSaleAfterPayment(paymentId: string): Promise<void> {
    try {
      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: paymentId },
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
      logger.error('Error updating sale after Square payment:', error);
    }
  }
}
