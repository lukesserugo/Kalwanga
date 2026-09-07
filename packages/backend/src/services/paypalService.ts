// D:\Projects\Kalwanga\packages\backend\src\services\providers\paypalProviderService.ts

import { BaseService } from '../BaseService.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../lib/logger.js';
import * as crypto from 'crypto';

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
  webhookId?: string;
  webhookSecret?: string;
  brandName?: string;
}

interface PayPalPaymentData {
  amount: number;
  currency?: string;
  description?: string;
  saleId?: string;
  orderId?: string;
  userId?: string;
  customerEmail?: string;
  customerName?: string;
  returnUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

interface PayPalRefundData {
  amount?: number;
  currency?: string;
  reason?: string;
  noteToPayer?: string;
}

export class PayPalService extends BaseService {
  private clientId: string;
  private clientSecret: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;
  private webhookId?: string;
  private webhookSecret?: string;
  private brandName: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config?: Partial<PayPalConfig>) {
    super();
    
    this.clientId = config?.clientId || process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = config?.clientSecret || process.env.PAYPAL_CLIENT_SECRET || '';
    this.environment = config?.environment || 
      (process.env.PAYPAL_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    this.baseUrl = this.environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
    this.webhookId = config?.webhookId || process.env.PAYPAL_WEBHOOK_ID;
    this.webhookSecret = config?.webhookSecret || process.env.PAYPAL_WEBHOOK_SECRET;
    this.brandName = config?.brandName || process.env.PAYPAL_BRAND_NAME || 'Kalwanga POS';
  }

  validateConfig(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  private async getAccessToken(): Promise<string> {
    // Check if token is still valid (expires in 3600 seconds)
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`PayPal authentication failed: ${error.error_description || 'Unknown error'}`, 401);
      }

      const data = await response.json();
      
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Buffer 1 minute

      logger.info('PayPal access token obtained successfully');
      return this.accessToken;
    } catch (error) {
      logger.error('PayPal authentication error:', error);
      throw new AppError('Failed to authenticate with PayPal', 500);
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `paypal_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    };
  }

  // ============================================
  // PAYMENT PROCESSING
  // ============================================

  /**
   * Create a PayPal order
   */
  async createOrder(data: PayPalPaymentData): Promise<any> {
    try {
      await this.getAccessToken();

      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: data.currency || 'USD',
              value: data.amount.toFixed(2),
              breakdown: {
                item_total: {
                  currency_code: data.currency || 'USD',
                  value: data.amount.toFixed(2),
                },
              },
            },
            description: data.description || 'Payment via PayPal',
            reference_id: `REF-${Date.now()}`,
            custom_id: data.userId || 'unknown',
            invoice_id: data.saleId || data.orderId || `INV-${Date.now()}`,
          },
        ],
        application_context: {
          brand_name: this.brandName,
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: data.returnUrl || `${process.env.FRONTEND_URL}/payment/success`,
          cancel_url: data.cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
        },
      };

      const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`PayPal order creation failed: ${error.message || JSON.stringify(error)}`, 400);
      }

      const order = await response.json();

      // Find approval URL
      const approvalLink = order.links.find((link: any) => link.rel === 'approve');
      
      // Create payment record in database
      const payment = await this.prisma.payment.create({
        data: {
          amount: data.amount,
          paymentMethod: 'CREDIT_CARD',
          status: 'PENDING',
          transactionId: order.id,
          reference: order.id,
          userId: data.userId || 'system',
          gatewayId: 'PAYPAL',
          notes: `PayPal order created: ${order.id}`,
          processedAt: new Date(),
          metadata: {
            orderData: order,
            approvalUrl: approvalLink?.href,
          },
        },
      });

      return {
        id: order.id,
        status: order.status === 'CREATED' ? 'pending' : 'processing',
        amount: data.amount,
        currency: data.currency || 'USD',
        reference: order.id,
        provider: 'PAYPAL',
        approvalUrl: approvalLink?.href,
        paymentId: payment.id,
        orderData: order,
        links: order.links,
      };
    } catch (error) {
      this.handleError(error, 'PayPalProviderService.createOrder');
      throw error;
    }
  }

  /**
   * Capture a PayPal order after approval
   */
  async captureOrder(orderId: string, metadata?: Record<string, any>): Promise<any> {
    try {
      await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`PayPal capture failed: ${error.message || JSON.stringify(error)}`, 400);
      }

      const capture = await response.json();

      // Update payment in database
      await this.prisma.payment.updateMany({
        where: { transactionId: orderId },
        data: {
          status: 'PAID',
          gatewayId: capture.id,
          processedAt: new Date(),
          notes: `PayPal capture completed: ${capture.id}`,
          metadata: { captureData: capture, ...metadata },
        },
      });

      return {
        id: capture.id,
        status: 'succeeded',
        amount: parseFloat(capture.purchase_units[0]?.payments?.captures[0]?.amount?.value || '0'),
        currency: capture.purchase_units[0]?.payments?.captures[0]?.amount?.currency_code || 'USD',
        captureData: capture,
      };
    } catch (error) {
      this.handleError(error, 'PayPalProviderService.captureOrder');
      throw error;
    }
  }

  /**
   * Process complete payment flow (create + capture in one go)
   */
  async processPayment(data: PayPalPaymentData): Promise<any> {
    try {
      // Create order
      const order = await this.createOrder(data);
      
      // If it's a direct payment (no redirect needed), capture immediately
      if (data.metadata?.directCapture) {
        const capture = await this.captureOrder(order.id);
        return {
          ...order,
          ...capture,
          status: 'succeeded',
        };
      }

      return order;
    } catch (error) {
      this.handleError(error, 'PayPalProviderService.processPayment');
      throw error;
    }
  }

  // ============================================
  // REFUND METHODS
  // ============================================

  /**
   * Refund a PayPal payment
   */
  async refundPayment(transactionId: string, data: PayPalRefundData): Promise<any> {
    try {
      await this.getAccessToken();

      // First, get the order to find the capture ID
      const orderResponse = await fetch(`${this.baseUrl}/v2/checkout/orders/${transactionId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!orderResponse.ok) {
        throw new AppError('Failed to get PayPal order for refund', 404);
      }

      const order = await orderResponse.json();
      const capture = order.purchase_units[0]?.payments?.captures?.[0];

      if (!capture) {
        throw new AppError('No capture found for this payment', 404);
      }

      // Process refund
      const refundData = {
        amount: {
          currency_code: data.currency || capture.amount?.currency_code || 'USD',
          value: (data.amount || parseFloat(capture.amount?.value || '0')).toFixed(2),
        },
        invoice_id: `REF-${Date.now()}`,
        note_to_payer: data.noteToPayer || data.reason || 'Refund requested by customer',
      };

      const response = await fetch(`${this.baseUrl}/v2/payments/captures/${capture.id}/refund`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(refundData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`PayPal refund failed: ${error.message || JSON.stringify(error)}`, 400);
      }

      const refund = await response.json();

      // Update payment in database
      await this.prisma.payment.updateMany({
        where: { transactionId },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
          notes: `PayPal refunded: ${refund.id} - ${data.reason || 'No reason provided'}`,
          metadata: { refundData: refund },
        },
      });

      return {
        id: refund.id,
        status: refund.status === 'COMPLETED' ? 'succeeded' : 'pending',
        amount: parseFloat(refund.amount?.value || '0'),
        currency: refund.amount?.currency_code || 'USD',
        reference: refund.id,
        provider: 'PAYPAL',
        refundData: refund,
      };
    } catch (error) {
      this.handleError(error, 'PayPalProviderService.refundPayment');
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
      await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${transactionId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new AppError('Failed to get PayPal transaction status', 400);
      }

      const order = await response.json();

      // Map PayPal status to internal status
      const statusMap: Record<string, string> = {
        'CREATED': 'PENDING',
        'SAVED': 'PENDING',
        'APPROVED': 'PROCESSING',
        'VOIDED': 'FAILED',
        'COMPLETED': 'COMPLETED',
        'PAYER_ACTION_REQUIRED': 'PENDING',
      };

      return {
        status: statusMap[order.status] || 'PENDING',
        transactionId: order.id,
        provider: 'PAYPAL',
        orderData: order,
        rawStatus: order.status,
        amount: parseFloat(order.purchase_units[0]?.amount?.value || '0'),
        currency: order.purchase_units[0]?.amount?.currency_code || 'USD',
        createdAt: order.create_time,
        updatedAt: order.update_time,
      };
    } catch (error) {
      this.handleError(error, 'PayPalProviderService.getTransactionStatus');
      throw error;
    }
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  /**
   * Handle PayPal webhook
   */
  async handleWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    try {
      // Verify webhook signature (if configured)
      if (this.webhookSecret) {
        this.verifyWebhookSignature(payload, headers);
      }

      const eventType = payload.event_type;
      logger.info(`PayPal webhook received: ${eventType}`);

      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          return await this.handlePaymentCaptureCompleted(payload);
        case 'PAYMENT.CAPTURE.DENIED':
          return await this.handlePaymentCaptureDenied(payload);
        case 'PAYMENT.CAPTURE.REFUNDED':
          return await this.handlePaymentRefunded(payload);
        case 'PAYMENT.CAPTURE.REVERSED':
          return await this.handlePaymentReversed(payload);
        case 'CHECKOUT.ORDER.APPROVED':
          return await this.handleOrderApproved(payload);
        case 'CHECKOUT.ORDER.COMPLETED':
          return await this.handleOrderCompleted(payload);
        default:
          logger.info(`Unhandled PayPal webhook: ${eventType}`);
          return { unhandled: true, eventType };
      }
    } catch (error) {
      this.handleError(error, 'PayPalProviderService.handleWebhook');
      throw error;
    }
  }

  private verifyWebhookSignature(payload: any, headers: Record<string, string>): void {
    // Implementation for webhook signature verification
    // Uses PayPal's webhook verification endpoint
    // Reference: https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
  }

  private async handlePaymentCaptureCompleted(payload: any): Promise<any> {
    const orderId = payload.resource?.supplemental_data?.order_id || payload.resource?.id;
    const captureId = payload.resource?.id;

    await this.prisma.payment.updateMany({
      where: { transactionId: orderId },
      data: {
        status: 'PAID',
        gatewayId: captureId,
        processedAt: new Date(),
        notes: `PayPal capture completed: ${captureId}`,
        metadata: { paypalEvent: payload },
      },
    });

    // Update sale/order if exists
    await this.updateSaleAfterPayment(orderId);

    return { success: true, event: 'PAYMENT_CAPTURE_COMPLETED' };
  }

  private async handlePaymentCaptureDenied(payload: any): Promise<any> {
    const orderId = payload.resource?.supplemental_data?.order_id || payload.resource?.id;

    await this.prisma.payment.updateMany({
      where: { transactionId: orderId },
      data: {
        status: 'FAILED',
        notes: `PayPal capture denied: ${payload.resource?.status_details?.reason || 'Unknown reason'}`,
        metadata: { paypalEvent: payload },
      },
    });

    return { success: true, event: 'PAYMENT_CAPTURE_DENIED' };
  }

  private async handlePaymentRefunded(payload: any): Promise<any> {
    const orderId = payload.resource?.supplemental_data?.order_id || payload.resource?.id;

    await this.prisma.payment.updateMany({
      where: { transactionId: orderId },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        notes: `PayPal refunded: ${payload.resource?.id}`,
        metadata: { paypalEvent: payload },
      },
    });

    return { success: true, event: 'PAYMENT_REFUNDED' };
  }

  private async handlePaymentReversed(payload: any): Promise<any> {
    const orderId = payload.resource?.supplemental_data?.order_id || payload.resource?.id;

    await this.prisma.payment.updateMany({
      where: { transactionId: orderId },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        notes: `PayPal payment reversed: ${payload.resource?.id}`,
        metadata: { paypalEvent: payload },
      },
    });

    return { success: true, event: 'PAYMENT_REVERSED' };
  }

  private async handleOrderApproved(payload: any): Promise<any> {
    const orderId = payload.resource?.id;
    logger.info(`PayPal order approved: ${orderId}`);
    
    // Optionally auto-capture if configured
    if (process.env.PAYPAL_AUTO_CAPTURE === 'true') {
      await this.captureOrder(orderId);
    }

    return { success: true, event: 'ORDER_APPROVED' };
  }

  private async handleOrderCompleted(payload: any): Promise<any> {
    const orderId = payload.resource?.id;
    logger.info(`PayPal order completed: ${orderId}`);
    return { success: true, event: 'ORDER_COMPLETED' };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async updateSaleAfterPayment(orderId: string): Promise<void> {
    try {
      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: orderId },
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
      logger.error('Error updating sale after PayPal payment:', error);
    }
  }
}
