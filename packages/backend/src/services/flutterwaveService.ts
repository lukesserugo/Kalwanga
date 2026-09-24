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

// ============================================
// HELPERS
// ============================================

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Currencies Flutterwave accepts that have no decimal subdivision.
 * Amounts in these currencies must be integers.
 */
const ZERO_DECIMAL_CURRENCIES = new Set(['UGX', 'RWF', 'XAF', 'XOF', 'TZS', 'KMF', 'DJF', 'GNF', 'JPY', 'VND']);

function assertValidAmount(amount: number, currency: string): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('Amount must be a positive number', 400);
  }
  if (ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) && !Number.isInteger(amount)) {
    throw new AppError(
      `Amount for ${currency} must be an integer (zero-decimal currency)`,
      400,
    );
  }
}

/**
 * Constant-time string comparison. Returns false on length mismatch
 * without leaking length through timing.
 */
function safeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Extract a short, safe summary of an HTTP error for logging. Never
 * logs Authorization headers or the full request body.
 */
async function summarizeHttpError(response: Response): Promise<string> {
  let body: any = null;
  try {
    body = await response.clone().json();
  } catch {
    try {
      body = await response.clone().text();
    } catch {
      body = null;
    }
  }
  const msg =
    (body && (body.message || body.error || body.error_description)) ||
    (typeof body === 'string' ? body.slice(0, 200) : 'provider error');
  return `HTTP ${response.status}: ${msg}`;
}

// ============================================
// SERVICE
// ============================================

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
    this.encryptionKey =
      config?.encryptionKey || process.env.FLUTTERWAVE_ENCRYPTION_KEY || '';
    this.environment =
      config?.environment ||
      (process.env.FLUTTERWAVE_ENVIRONMENT as 'sandbox' | 'production') ||
      'sandbox';
    this.baseUrl = 'https://api.flutterwave.com/v3';
    this.secretHash =
      config?.secretHash || process.env.FLUTTERWAVE_SECRET_HASH || '';
    this.merchantName =
      config?.merchantName ||
      process.env.FLUTTERWAVE_MERCHANT_NAME ||
      'Kalwanga POS';
    this.title =
      config?.title || process.env.FLUTTERWAVE_TITLE || 'Kalwanga POS Payment';
    this.logo = config?.logo || process.env.FLUTTERWAVE_LOGO || '';
  }

  validateConfig(): boolean {
    return !!(this.apiKey && this.publicKey);
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Internal fetch wrapper. Enforces timeout and throws AppError on
   * non-2xx with the provider's own message surfaced.
   */
  private async request(
    path: string,
    init: RequestInit & { parseError?: boolean } = {},
  ): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        ...this.getHeaders(),
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const summary = await summarizeHttpError(response);
      logger.error(`Flutterwave request failed: ${init.method || 'GET'} ${path} — ${summary}`);
      throw new AppError(`Flutterwave request failed: ${summary}`, response.status >= 500 ? 502 : 400);
    }

    return response.json();
  }

  // ============================================
  // PAYMENT PROCESSING
  // ============================================

  /**
   * Process payment via Flutterwave.
   *
   * Amount is in MAJOR units (e.g. 100.00 NGN = 100, not 10000).
   * Zero-decimal currencies (UGX, RWF, ...) require integer amounts.
   */
  async processPayment(data: FlutterwavePaymentData): Promise<any> {
    try {
      const currency = (data.currency || 'UGX').toUpperCase();
      assertValidAmount(data.amount, currency);

      if (!data.userId) {
        throw new AppError(
          'userId is required to create a Flutterwave payment (Payment.userId is a non-null FK)',
          400,
        );
      }

      const txRef = `FLW-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

      let paymentData: any = {
        tx_ref: txRef,
        amount: data.amount,
        currency,
        payment_options: this.getPaymentOptions(data.paymentMethod),
        redirect_url:
          data.redirectUrl || `${process.env.FRONTEND_URL}/payment/verify`,
        customer: {
          email: data.customerEmail || 'customer@example.com',
          phonenumber:
            data.phoneNumber || data.metadata?.phoneNumber || '',
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

      paymentData = this.enrichPaymentData(paymentData, data);

      const result = await this.request('/payments', {
        method: 'POST',
        body: JSON.stringify(paymentData),
      });

      if (!result?.data?.link) {
        throw new AppError(
          `Flutterwave did not return a payment link: ${result?.message || 'unknown'}`,
          502,
        );
      }

      const paymentMethodEnum = this.mapPaymentMethodToEnum(data.paymentMethod);

      // Do NOT set gatewayId here — it's a FK to PaymentGateway.id.
      // `paymentService.processPayment` resolves the real gateway row
      // and passes it in via the handler's caller. Setting the literal
      // string 'FLUTTERWAVE' would orphan the payment or throw on the
      // FK constraint.
      const payment = await this.prisma.payment.create({
        data: {
          amount: data.amount,
          currency,
          paymentMethod: paymentMethodEnum,
          status: PaymentStatus.PENDING,
          transactionId: txRef,
          reference: result.data.tx_ref,
          userId: data.userId,
          notes: `Flutterwave payment initiated: ${result.data.id}`,
          processedAt: new Date(),
          metadata: {
            provider: 'FLUTTERWAVE',
            flwRef: result.data.flw_ref,
            flwTransactionId: result.data.id,
            txRef,
            saleId: data.saleId,
            orderId: data.orderId,
            phoneNumber: data.phoneNumber || data.metadata?.phoneNumber,
            customerEmail: data.customerEmail,
            paymentData: result.data,
          },
        },
      });

      return {
        id: result.data.id,
        status: 'pending',
        amount: data.amount,
        currency,
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
      card: PaymentMethod.CREDIT_CARD,
      mobile_money: PaymentMethod.MOBILE_MONEY,
      bank_transfer: PaymentMethod.BANK_TRANSFER,
      ussd: PaymentMethod.MOBILE_MONEY,
      mpesa: PaymentMethod.MOBILE_MONEY,
    };
    return map[method || 'card'] || PaymentMethod.CREDIT_CARD;
  }

  private getPaymentOptions(paymentMethod?: string): string {
    const options: Record<string, string> = {
      card: 'card',
      mobile_money:
        'mpesa,mobilemoneyghana,mobilemoneyrwanda,mobilemoneyuganda,mobilemoneyzambia,mobilemoneytanzania',
      bank_transfer: 'banktransfer',
      ussd: 'ussd',
      mpesa: 'mpesa',
    };
    return options[paymentMethod || 'card'] || 'card';
  }

  private enrichPaymentData(
    paymentData: any,
    data: FlutterwavePaymentData,
  ): any {
    const method = data.paymentMethod || 'card';
    const phone = data.phoneNumber || data.metadata?.phoneNumber;

    switch (method) {
      case 'mobile_money':
        paymentData.meta = {
          ...paymentData.meta,
          network: data.metadata?.network || 'MTN',
          phone_number: phone,
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
          phone,
        };
        break;
      case 'mpesa':
        paymentData.meta = {
          ...paymentData.meta,
          phone_number: phone,
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
   * Refund a Flutterwave payment.
   *
   * Accumulates `refundedAmount` and only flips to `REFUNDED` when the
   * cumulative refund equals the original amount. Partial refunds land
   * in `PARTIAL`. Metadata is merged, not replaced.
   */
  async refundPayment(
    transactionId: string,
    data: FlutterwaveRefundData,
  ): Promise<any> {
    try {
      // Fetch original transaction to (a) validate the amount and (b)
      // find the local Payment row we're going to update.
      const transaction = await this.request(`/transactions/${transactionId}`, {
        method: 'GET',
      });

      const originalAmount: number = Number(transaction?.data?.amount ?? 0);
      const currency: string = (transaction?.data?.currency || 'USD').toUpperCase();

      const refundAmount = data.amount ?? originalAmount;
      assertValidAmount(refundAmount, currency);

      if (refundAmount > originalAmount) {
        throw new AppError(
          `Refund amount ${refundAmount} exceeds original amount ${originalAmount}`,
          400,
        );
      }

      const refundData = {
        amount: refundAmount,
        refund_reason: data.reason || 'Refund requested by customer',
        customer_note: data.customerNote || '',
        merchant_note: data.merchantNote || '',
      };

      const refund = await this.request(
        `/transactions/${transactionId}/refund`,
        {
          method: 'POST',
          body: JSON.stringify(refundData),
        },
      );

      if (!refund?.data?.id) {
        throw new AppError(
          `Flutterwave refund failed: ${refund?.message || 'no refund id returned'}`,
          502,
        );
      }

      // Accumulate refundedAmount and compute the correct status.
      const payment = await this.prisma.payment.findFirst({
        where: { transactionId },
      });

      if (payment) {
        const previouslyRefunded = payment.refundedAmount ?? 0;
        const totalRefunded = previouslyRefunded + refundAmount;
        const newStatus =
          totalRefunded >= payment.amount
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIAL;

        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: newStatus,
            refundedAmount: totalRefunded,
            refundedAt: new Date(),
            refundReason: data.reason || null,
            notes: `Flutterwave refund ${refund.data.id}: ${data.reason || 'No reason provided'}`,
            metadata: {
              ...((payment.metadata as Record<string, any>) || {}),
              lastFlutterwaveRefund: refund.data,
            },
          },
        });
      }

      return {
        id: refund.data.id,
        status: refund.data.status === 'completed' ? 'succeeded' : 'pending',
        amount: refund.data.amount ?? refundAmount,
        currency,
        reference: refund.data.reference ?? refund.data.id,
        provider: 'FLUTTERWAVE',
        refundData: refund.data,
      };
    } catch (error) {
      this.handleError(error, 'FlutterwaveService.refundPayment');
      throw error;
    }
  }

  /**
   * Poll the status of a previously created refund.
   */
  async checkRefundStatus(refundId: string): Promise<any> {
    try {
      const result = await this.request(`/refunds/${refundId}`, {
        method: 'GET',
      });

      const statusMap: Record<string, string> = {
        completed: 'succeeded',
        processed: 'succeeded',
        pending: 'pending',
        failed: 'failed',
      };

      return {
        id: result.data?.id ?? refundId,
        status: statusMap[result.data?.status] ?? 'pending',
        amount: result.data?.amount,
        currency: result.data?.currency,
        reference: result.data?.reference,
        rawStatus: result.data?.status,
        provider: 'FLUTTERWAVE',
        data: result.data,
      };
    } catch (error) {
      this.handleError(error, 'FlutterwaveService.checkRefundStatus');
      throw error;
    }
  }

  // ============================================
  // STATUS METHODS
  // ============================================

  /**
   * Get transaction status.
   *
   * Accepts either a Flutterwave numeric transaction ID (`data.id`) or
   * a `tx_ref`. The verify endpoint takes the numeric ID; if you pass
   * a tx_ref the endpoint will 404. `paymentService` stores the
   * numeric ID in `metadata.flwTransactionId` and the tx_ref in
   * `transactionId`, so callers should pass whichever they have.
   */
  async getTransactionStatus(transactionId: string): Promise<any> {
    try {
      const result = await this.request(
        `/transactions/${transactionId}/verify`,
        { method: 'GET' },
      );

      const statusMap: Record<string, string> = {
        pending: 'PENDING',
        successful: 'COMPLETED',
        success: 'COMPLETED',
        failed: 'FAILED',
        cancelled: 'CANCELLED',
        reversed: 'REFUNDED',
      };

      const raw = String(result.data?.status || '').toLowerCase();
      return {
        status: statusMap[raw] || 'PENDING',
        transactionId,
        provider: 'FLUTTERWAVE',
        transactionData: result.data,
        rawStatus: raw,
        amount: result.data?.amount,
        currency: result.data?.currency,
        customer: result.data?.customer,
        paymentType: result.data?.payment_type,
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
   * Verify a Flutterwave webhook.
   *
   * Flutterwave does NOT hash or sign the body. It sends the value of
   * your `FLUTTERWAVE_SECRET_HASH` verbatim in the `verif-hash`
   * header. Verification is a constant-time string equality.
   *
   * The `rawBody` argument is required — passing a re-serialized JSON
   * object would work here only by accident because we're doing plain
   * equality, but taking the raw body keeps the contract honest and
   * makes it impossible to accidentally start hashing the wrong bytes
   * later.
   */
  verifySignature(rawBody: Buffer | string, verifHash: string): void {
    if (!this.secretHash) {
      // Fail closed. A missing secret means we cannot distinguish a
      // genuine webhook from a forged one, so we refuse to process.
      throw new AppError(
        'FLUTTERWAVE_SECRET_HASH is not configured — refusing to accept webhooks',
        500,
      );
    }

    if (!verifHash) {
      throw new AppError('Missing verif-hash header', 400);
    }

    if (!safeEqualString(verifHash, this.secretHash)) {
      logger.warn('Flutterwave webhook signature mismatch');
      throw new AppError('Invalid Flutterwave webhook signature', 400);
    }
  }

  /**
   * Handle a Flutterwave webhook.
   *
   * `signature` is the value of the `verif-hash` header. `rawBody` is
   * the raw request buffer — the controller is responsible for
   * preserving it via `express.raw({ type: 'application/json' })` on
   * this route.
   *
   * The handler returns a structured result rather than throwing on
   * unhandled event types, so the caller can always ack (2xx) the
   * provider. Unhandled events are logged and acknowledged.
   */
  async handleWebhook(
    payload: any,
    signature: string,
    rawBody?: Buffer | string,
  ): Promise<any> {
    try {
      // If rawBody isn't supplied, we can't reliably verify — but the
      // signature check is still a plain string compare, so we fall
      // back to stringifying the payload only for compatibility with
      // existing callers. New callers should pass rawBody.
      const bodyForVerification =
        rawBody ?? Buffer.from(JSON.stringify(payload));

      this.verifySignature(bodyForVerification, signature);

      const event = payload?.event;
      if (!event) {
        logger.warn('Flutterwave webhook missing event field');
        return { acknowledged: true, event: 'unknown' };
      }

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

  /**
   * Find the local Payment row by Flutterwave transaction reference.
   * Flutterwave sends `tx_ref` (our own reference) in `data.tx_ref`
   * and a numeric `data.id`. We store our own `tx_ref` as
   * `Payment.transactionId` at creation, so that's the primary key.
   */
  private async findPaymentByTxRef(txRef: string): Promise<any | null> {
    if (!txRef) return null;
    return this.prisma.payment.findFirst({
      where: {
        OR: [
          { transactionId: txRef },
          { reference: txRef },
          { metadata: { path: ['flwTransactionId'], equals: txRef } },
        ],
      },
      include: { sale: true, order: true },
    });
  }

  private async handleChargeCompleted(data: any): Promise<any> {
    const txRef: string = data?.tx_ref;
    if (!txRef) {
      logger.warn('Flutterwave charge.completed missing tx_ref');
      return { acknowledged: true, event: 'CHARGE_COMPLETED', skipped: true };
    }

    const payment = await this.findPaymentByTxRef(txRef);
    if (!payment) {
      logger.warn(`Flutterwave charge.completed for unknown tx_ref ${txRef}`);
      return { acknowledged: true, event: 'CHARGE_COMPLETED', skipped: true };
    }

    // Terminal-state guard: if the payment already resolved, don't
    // touch it again. Webhooks can be re-delivered.
    if (['PAID', 'FAILED', 'REFUNDED'].includes(payment.status)) {
      return { acknowledged: true, event: 'CHARGE_COMPLETED', duplicate: true };
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        processedAt: new Date(),
        notes: `Flutterwave charge completed: ${data.id}`,
        metadata: {
          ...((payment.metadata as Record<string, any>) || {}),
          flwResponse: data,
          flwTransactionId: data.id,
        },
      },
    });

    await this.updateSaleAfterPayment(txRef, payment);

    return { success: true, event: 'CHARGE_COMPLETED', paymentId: payment.id };
  }

  private async handleChargeFailed(data: any): Promise<any> {
    const txRef: string = data?.tx_ref;
    if (!txRef) {
      return { acknowledged: true, event: 'CHARGE_FAILED', skipped: true };
    }

    const payment = await this.findPaymentByTxRef(txRef);
    if (!payment) {
      return { acknowledged: true, event: 'CHARGE_FAILED', skipped: true };
    }
    if (['PAID', 'FAILED', 'REFUNDED'].includes(payment.status)) {
      return { acknowledged: true, event: 'CHARGE_FAILED', duplicate: true };
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        notes: `Flutterwave charge failed: ${data.status}`,
        metadata: {
          ...((payment.metadata as Record<string, any>) || {}),
          flwResponse: data,
        },
      },
    });

    return { success: true, event: 'CHARGE_FAILED', paymentId: payment.id };
  }

  private async handleChargeRefunded(data: any): Promise<any> {
    const txRef: string = data?.tx_ref;
    if (!txRef) {
      return { acknowledged: true, event: 'CHARGE_REFUNDED', skipped: true };
    }

    const payment = await this.findPaymentByTxRef(txRef);
    if (!payment) {
      return { acknowledged: true, event: 'CHARGE_REFUNDED', skipped: true };
    }

    // Flutterwave does not reliably send the refund amount on
    // charge.refunded in the same shape across versions. Prefer the
    // explicit amount if present; otherwise mark as fully refunded.
    const refundedNow =
      typeof data?.amount_refunded === 'number'
        ? data.amount_refunded
        : typeof data?.amount === 'number'
        ? data.amount
        : payment.amount;

    const previouslyRefunded = payment.refundedAmount ?? 0;
    const totalRefunded = Math.min(
      payment.amount,
      previouslyRefunded + refundedNow,
    );
    const newStatus =
      totalRefunded >= payment.amount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIAL;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        refundedAmount: totalRefunded,
        refundedAt: new Date(),
        notes: `Flutterwave charge refunded: ${data.id}`,
        metadata: {
          ...((payment.metadata as Record<string, any>) || {}),
          flwResponse: data,
        },
      },
    });

    return { success: true, event: 'CHARGE_REFUNDED', paymentId: payment.id };
  }

  private async handleChargeReversed(data: any): Promise<any> {
    // A reversal is a full refund pushed back by the issuer.
    // Treat as fully refunded regardless of what the payload says.
    const txRef: string = data?.tx_ref;
    if (!txRef) {
      return { acknowledged: true, event: 'CHARGE_REVERSED', skipped: true };
    }

    const payment = await this.findPaymentByTxRef(txRef);
    if (!payment) {
      return { acknowledged: true, event: 'CHARGE_REVERSED', skipped: true };
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REFUNDED,
        refundedAmount: payment.amount,
        refundedAt: new Date(),
        notes: `Flutterwave charge reversed: ${data.id}`,
        metadata: {
          ...((payment.metadata as Record<string, any>) || {}),
          flwResponse: data,
        },
      },
    });

    return { success: true, event: 'CHARGE_REVERSED', paymentId: payment.id };
  }

  private async handleTransferCompleted(data: any): Promise<any> {
    logger.info(`Flutterwave transfer completed: ${data?.id}`);
    return { success: true, event: 'TRANSFER_COMPLETED' };
  }

  private async handleTransferFailed(data: any): Promise<any> {
    logger.info(`Flutterwave transfer failed: ${data?.id}`);
    return { success: true, event: 'TRANSFER_FAILED' };
  }

  // ============================================
  // VIRTUAL ACCOUNT METHODS
  // ============================================

  /**
   * Create a virtual bank account for bank-transfer payments.
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
        amount: data.amount ?? 0,
        currency: data.currency || 'UGX',
        tx_ref: `VA-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        is_permanent: data.isPermanent ?? false,
        narration: {
          customer: data.customerName || 'Customer',
          merchant: this.merchantName,
        },
      };

      const result = await this.request('/virtual-account-numbers', {
        method: 'POST',
        body: JSON.stringify(accountData),
      });

      return {
        accountNumber: result.data?.account_number,
        bankName: result.data?.bank_name,
        bankCode: result.data?.bank_code,
        reference: result.data?.tx_ref,
        amount: result.data?.amount,
        currency: result.data?.currency,
        expiresAt: result.data?.expires_at,
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

  /**
   * Update the local Sale after a Flutterwave payment succeeds.
   *
   * Fixes vs. the old implementation:
   *   - Removed `paymentStatus: 'PAID'` — `Sale` has no such field;
   *     the old code would have thrown at runtime on the first
   *     successful payment.
   *   - Uses `{ increment }` on `paidAmount` instead of overwriting,
   *     so partial payments accumulate correctly.
   *   - Recomputes `status` from the resulting `paidAmount` vs. `total`
   *     instead of unconditionally marking `COMPLETED`.
   *
   * The downstream side effects (receipt, inventory, loyalty, cart)
   * are handled by `paymentService.completeCheckoutFromGateway`, which
   * the webhook router should call after this service returns. This
   * helper only updates the Sale row itself, matching the previous
   * scope.
   */
  private async updateSaleAfterPayment(
    txRef: string,
    paymentOverride?: any,
  ): Promise<void> {
    try {
      const payment =
        paymentOverride ??
        (await this.prisma.payment.findFirst({
          where: {
            OR: [
              { transactionId: txRef },
              { reference: txRef },
            ],
          },
          include: { sale: true },
        }));

      if (!payment?.saleId) return;

      const sale = payment.sale ?? (await this.prisma.sale.findUnique({
        where: { id: payment.saleId },
      }));
      if (!sale) return;

      const newPaidAmount = sale.paidAmount + payment.amount;
      const newStatus =
        newPaidAmount >= sale.total
          ? 'COMPLETED'
          : newPaidAmount > 0
          ? 'PROCESSING'
          : sale.status;

      await this.prisma.sale.update({
        where: { id: payment.saleId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus as any,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error updating sale after Flutterwave payment:', error);
    }
  }
}
