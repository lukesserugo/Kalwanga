// D:\Projects\Kalwanga\packages\backend\src\services\providers\flutterwaveService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import * as crypto from 'crypto';
import { PaymentMethod, PaymentStatus } from '../generated/prisma/index.js';

interface FlutterwaveConfig {
  apiKey: string;
  publicKey: string;
  encryptionKey?: string;
  environment: 'sandbox' | 'production';
  secretHash?: string;
  merchantName?: string;
  title?: string;
  logo?: string;
}

interface FlutterwavePaymentData {
  amount: number;
  currency?: string;
  paymentMethod?: 'card' | 'mobile_money' | 'bank_transfer' | 'ussd' | 'mpesa';
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

interface FlutterwaveRefundData {
  amount?: number;
  reason?: string;
  customerNote?: string;
  merchantNote?: string;
}

export class FlutterwaveService extends BaseService {
  private apiKey: string;
  private publicKey: string;
  private encryptionKey: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;
  private secretHash: string;
  private merchantName: string;
  private title: string;
  private logo: string;

  constructor(config?: Partial<FlutterwaveConfig>) {
    super();
    
    this.apiKey = config?.apiKey || process.env.FLUTTERWAVE_API_KEY || '';
    this.publicKey = config?.publicKey || process.env.FLUTTERWAVE_PUBLIC_KEY || '';
    this.encryptionKey = config?.encryptionKey || process.env.FLUTTERWAVE_ENCRYPTION_KEY || '';
    this.environment = config?.environment || 
      (process.env.FLUTTERWAVE_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    this.baseUrl = 'https://api.flutterwave.com/v3';
    this.secretHash = config?.secretHash || process.env.FLUTTERWAVE_SECRET_HASH || '';
    this.merchantName = config?.merchantName || process.env.FLUTTERWAVE_MERCHANT_NAME || 'Kalwanga POS';
    this.title = config?.title || process.env.FLUTTERWAVE_TITLE || 'Kalwanga POS Payment';
    this.logo = config?.logo || process.env.FLUTTERWAVE_LOGO || '';
  }

  validateConfig(): boolean {
    return !!(this.apiKey && this.publicKey && this.encryptionKey);
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  // ============================================
  // PAYMENT PROCESSING
  // ============================================

  /**
   * Process payment via Flutterwave
   */
  async processPayment(data: FlutterwavePaymentData): Promise<any> {
    try {
      const txRef = `FLW-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      
      let paymentData: any = {
        tx_ref: txRef,
        amount: data.amount,
        currency: data.currency || 'UGX',
        payment_options: this.getPaymentOptions(data.paymentMethod),
        redirect_url: data.redirectUrl || `${process.env.FRONTEND_URL}/payment/verify`,
        customer: {
          email: data.customerEmail || 'customer@example.com',
          phonenumber: data.phoneNumber || data.metadata?.phoneNumber || '256700000000',
          name: data.customerName || 'Customer',
        },
        customizations: {
          title: this.title,
          description: data.description || 'Payment via Flutterwave',
          logo: this.logo,
        },
        meta: {
          saleId: data.saleId || '',
          orderId: data.orderId || '',
          userId: data.userId || '',
          source: data.metadata?.source || 'pos',
          ...data.metadata,
        },
      };

      // Handle different payment methods
      paymentData = this.enrichPaymentData(paymentData, data);

      // Initiate payment
      const response = await fetch(`${this.baseUrl}/payments`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`Flutterwave payment initiation failed: ${error.message || JSON.stringify(error)}`, 400);
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
          transactionId: txRef,
          reference: result.data.tx_ref,
          userId: data.userId || 'system',
          gatewayId: 'FLUTTERWAVE',
          notes: `Flutterwave payment initiated: ${result.data.id}`,
          processedAt: new Date(),
          metadata: {
            flwRef: result.data.flw_ref,
            transactionId: result.data.id,
            paymentData: result.data,
          },
        },
      });

      return {
        id: result.data.id,
        status: result.status === 'success' ? 'pending' : 'failed',
        amount: data.amount,
        currency: data.currency || 'UGX',
        reference: result.data.tx_ref,
        provider: 'FLUTTERWAVE',
        paymentLink: result.data.link,
        transactionId: result.data.id,
        flwRef: result.data.flw_ref,
        paymentId: payment.id,
        customerMessage: result.message,
        paymentData: result.data,
      };
    } catch (error) {
      this.handleError(error, 'FlutterwaveService.processPayment');
      throw error;
    }
  }

  private mapPaymentMethodToEnum(method?: string): PaymentMethod {
    const map: Record<string, PaymentMethod> = {
      'card': PaymentMethod.CREDIT_CARD,
      'mobile_money': PaymentMethod.MOBILE_MONEY,
      'bank_transfer': PaymentMethod.BANK_TRANSFER,
      'ussd': PaymentMethod.MOBILE_MONEY,
      'mpesa': PaymentMethod.MOBILE_MONEY,
    };
    return map[method || 'card'] || PaymentMethod.CREDIT_CARD;
  }

  private getPaymentOptions(paymentMethod?: string): string {
    const options: Record<string, string> = {
      'card': 'card',
      'mobile_money': 'mpesa,mobilemoneyghana,mobilemoneyrwanda,mobilemoneyuganda,mobilemoneyzambia,mobilemoneytanzania',
      'bank_transfer': 'banktransfer',
      'ussd': 'ussd',
      'mpesa': 'mpesa',
    };
    return options[paymentMethod || 'card'] || 'card';
  }

  private enrichPaymentData(paymentData: any, data: FlutterwavePaymentData): any {
    const method = data.paymentMethod || 'card';

    switch (method) {
      case 'mobile_money':
        paymentData.meta = {
          ...paymentData.meta,
          network: data.metadata?.network || 'MTN',
          phone_number: data.phoneNumber || data.metadata?.phoneNumber,
        };
        break;
      case 'bank_transfer':
        paymentData.bank_transfer = {
          bank_code: data.metadata?.bankCode || '',
          bank_account: data.metadata?.bankAccount || '',
        };
        break;
      case 'ussd':
        paymentData.ussd = {
          network: data.metadata?.network || 'MTN',
          phone: data.phoneNumber || data.metadata?.phoneNumber,
        };
        break;
      case 'mpesa':
        paymentData.meta = {
          ...paymentData.meta,
          phone_number: data.phoneNumber || data.metadata?.phoneNumber,
        };
        break;
      default:
        break;
    }

    return paymentData;
  }

  // ============================================
  // REFUND METHODS
  // ============================================

  /**
   * Refund a Flutterwave payment
   */
  async refundPayment(transactionId: string, data: FlutterwaveRefundData): Promise<any> {
    try {
      // Get transaction first to verify amount
      const transactionResponse = await fetch(`${this.baseUrl}/transactions/${transactionId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!transactionResponse.ok) {
        throw new AppError('Failed to get Flutterwave transaction', 404);
      }

      const transaction = await transactionResponse.json();

      // Process refund
      const refundData = {
        amount: data.amount || transaction.data.amount,
        refund_reason: data.reason || 'Refund requested by customer',
        customer_note: data.customerNote || '',
        merchant_note: data.merchantNote || '',
      };

      const response = await fetch(`${this.baseUrl}/transactions/${transactionId}/refund`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(refundData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`Flutterwave refund failed: ${error.message || JSON.stringify(error)}`, 400);
      }

      const refund = await response.json();

      // Update payment in database
      await this.prisma.payment.updateMany({
        where: { transactionId },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          notes: `Flutterwave refunded: ${refund.data.id} - ${data.reason || 'No reason provided'}`,
          metadata: { refundData: refund.data },
        },
      });

      return {
        id: refund.data.id,
        status: refund.data.status === 'completed' ? 'succeeded' : 'pending',
        amount: refund.data.amount,
        reference: refund.data.reference,
        provider: 'FLUTTERWAVE',
        refundData: refund.data,
      };
    } catch (error) {
      this.handleError(error, 'FlutterwaveService.refundPayment');
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
      const response = await fetch(`${this.baseUrl}/transactions/${transactionId}/verify`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new AppError('Failed to get Flutterwave transaction status', 400);
      }

      const result = await response.json();

      // Map Flutterwave status to internal status
      const statusMap: Record<string, string> = {
        'pending': 'PENDING',
        'successful': 'COMPLETED',
        'failed': 'FAILED',
        'cancelled': 'CANCELLED',
        'reversed': 'REFUNDED',
      };

      return {
        status: statusMap[result.data.status] || 'PENDING',
        transactionId: transactionId,
        provider: 'FLUTTERWAVE',
        transactionData: result.data,
        rawStatus: result.data.status,
        amount: result.data.amount,
        currency: result.data.currency,
        customer: result.data.customer,
        paymentType: result.data.payment_type,
      };
    } catch (error) {
      this.handleError(error, 'FlutterwaveService.getTransactionStatus');
      throw error;
    }
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  /**
   * Handle Flutterwave webhook
   */
  async handleWebhook(payload: any, signature: string): Promise<any> {
    try {
      // Verify webhook signature if secret hash is configured
      if (this.secretHash) {
        this.verifyWebhookSignature(payload, signature);
      }

      const event = payload.event;
      logger.info(`Flutterwave webhook received: ${event}`);

      switch (event) {
        case 'charge.completed':
          return await this.handleChargeCompleted(payload.data);
        case 'charge.failed':
          return await this.handleChargeFailed(payload.data);
        case 'charge.refunded':
          return await this.handleChargeRefunded(payload.data);
        case 'charge.reversed':
          return await this.handleChargeReversed(payload.data);
        case 'transfer.completed':
          return await this.handleTransferCompleted(payload.data);
        case 'transfer.failed':
          return await this.handleTransferFailed(payload.data);
        default:
          logger.info(`Unhandled Flutterwave webhook: ${event}`);
          return { unhandled: true, event };
      }
    } catch (error) {
      this.handleError(error, 'FlutterwaveService.handleWebhook');
      throw error;
    }
  }

  private verifyWebhookSignature(payload: any, signature: string): void {
    const computedSignature = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload) + this.secretHash)
      .digest('hex');

    if (signature !== computedSignature) {
      throw new AppError('Invalid Flutterwave webhook signature', 400);
    }
  }

  private async handleChargeCompleted(data: any): Promise<any> {
    const txRef = data.tx_ref;

    await this.prisma.payment.updateMany({
      where: { transactionId: txRef },
      data: {
        status: PaymentStatus.PAID,
        gatewayId: data.id,
        processedAt: new Date(),
        notes: `Flutterwave charge completed: ${data.id}`,
        metadata: { flwResponse: data },
      },
    });

    // Update sale/order if exists
    await this.updateSaleAfterPayment(txRef);

    return { success: true, event: 'CHARGE_COMPLETED' };
  }

  private async handleChargeFailed(data: any): Promise<any> {
    const txRef = data.tx_ref;

    await this.prisma.payment.updateMany({
      where: { transactionId: txRef },
      data: {
        status: PaymentStatus.FAILED,
        notes: `Flutterwave charge failed: ${data.status}`,
        metadata: { flwResponse: data },
      },
    });

    return { success: true, event: 'CHARGE_FAILED' };
  }

  private async handleChargeRefunded(data: any): Promise<any> {
    const txRef = data.tx_ref;

    await this.prisma.payment.updateMany({
      where: { transactionId: txRef },
      data: {
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        notes: `Flutterwave charge refunded: ${data.id}`,
        metadata: { flwResponse: data },
      },
    });

    return { success: true, event: 'CHARGE_REFUNDED' };
  }

  private async handleChargeReversed(data: any): Promise<any> {
    const txRef = data.tx_ref;

    await this.prisma.payment.updateMany({
      where: { transactionId: txRef },
      data: {
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        notes: `Flutterwave charge reversed: ${data.id}`,
        metadata: { flwResponse: data },
      },
    });

    return { success: true, event: 'CHARGE_REVERSED' };
  }

  private async handleTransferCompleted(data: any): Promise<any> {
    logger.info(`Flutterwave transfer completed: ${data.id}`);
    return { success: true, event: 'TRANSFER_COMPLETED' };
  }

  private async handleTransferFailed(data: any): Promise<any> {
    logger.info(`Flutterwave transfer failed: ${data.id}`);
    return { success: true, event: 'TRANSFER_FAILED' };
  }

  // ============================================
  // VIRTUAL ACCOUNT METHODS
  // ============================================

  /**
   * Create virtual bank account for bank transfer payments
   */
  async createVirtualAccount(data: {
    email: string;
    amount?: number;
    currency?: string;
    customerName?: string;
    isPermanent?: boolean;
  }): Promise<any> {
    try {
      const accountData = {
        email: data.email || 'customer@example.com',
        amount: data.amount || 0,
        currency: data.currency || 'UGX',
        tx_ref: `VA-${Date.now()}`,
        is_permanent: data.isPermanent || false,
        narations: {
          customer: data.customerName || 'Customer',
          merchant: this.merchantName,
        },
      };

      const response = await fetch(`${this.baseUrl}/virtual-account-numbers`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(accountData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError(`Failed to create Flutterwave virtual account: ${error.message}`, 400);
      }

      const result = await response.json();

      return {
        accountNumber: result.data.account_number,
        bankName: result.data.bank_name,
        bankCode: result.data.bank_code,
        reference: result.data.tx_ref,
        amount: result.data.amount,
        currency: result.data.currency,
        expiresAt: result.data.expires_at,
        provider: 'FLUTTERWAVE',
      };
    } catch (error) {
      this.handleError(error, 'FlutterwaveService.createVirtualAccount');
      throw error;
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async updateSaleAfterPayment(txRef: string): Promise<void> {
    try {
      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: txRef },
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
      logger.error('Error updating sale after Flutterwave payment:', error);
    }
  }
}
