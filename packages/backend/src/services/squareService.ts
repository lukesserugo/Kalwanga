// D:\Projects\Kalwanga\packages\backend\src\services\providers\squareProviderService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { PaymentStatus } from '../generated/prisma/index.js';
import * as crypto from 'crypto';

// Square is used via its REST API. OAuth is not required for a single
// merchant integration — a long-lived access token from the developer
// dashboard is sufficient.

interface SquareConfig {
  accessToken: string;
  environment: 'sandbox' | 'production';
  webhookSignatureKey?: string;
  /**
   * The exact URL Square is configured to POST webhooks to. Required
   * for signature verification — Square signs `notificationUrl +
   * rawBody`, so we must know the URL byte-for-byte. Read from
   * SQUARE_WEBHOOK_URL.
   */
  webhookUrl?: string;
  locationId?: string;
  merchantId?: string;
}

interface SquarePaymentData {
  amount: number; // major units on input (e.g. 10.50 USD = 10.50)
  currency?: string;
  sourceId: string; // Square nonce or card-on-file token
  description?: string;
  saleId?: string;
  orderId?: string;
  userId?: string;
  customerId?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

interface SquareRefundData {
  amount?: number; // major units
  reason?: string;
  idempotencyKey?: string;
}

// ============================================
// HELPERS
// ============================================

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Square always takes and returns amounts in the smallest unit of the
 * currency (cents for USD, pence for GBP, etc.). We expose major units
 * to callers and convert at the boundary.
 */
function toMinorUnits(majorUnits: number): number {
  return Math.round(majorUnits * 100);
}

function toMajorUnits(minorUnits: number): number {
  return minorUnits / 100;
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
  const firstError = body?.errors?.[0];
  const msg =
    firstError?.detail ||
    firstError?.code ||
    body?.message ||
    (typeof body === 'string' ? body.slice(0, 200) : 'provider error');
  return `HTTP ${response.status}: ${msg}`;
}

// ============================================
// SERVICE
// ============================================

export class SquareService extends BaseService {
  private accessToken: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;
  private webhookSignatureKey: string;
  private webhookUrl: string;
  private locationId: string;
  private merchantId: string;

  constructor(config?: Partial<SquareConfig>) {
    super();

    this.accessToken =
      config?.accessToken || process.env.SQUARE_ACCESS_TOKEN || '';
    this.environment =
      config?.environment ||
      (process.env.SQUARE_ENVIRONMENT as 'sandbox' | 'production') ||
      'sandbox';
    this.baseUrl =
      this.environment === 'sandbox'
        ? 'https://connect.squareupsandbox.com'
        : 'https://connect.squareup.com';
    this.webhookSignatureKey =
      config?.webhookSignatureKey ||
      process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ||
      '';
    this.webhookUrl =
      config?.webhookUrl || process.env.SQUARE_WEBHOOK_URL || '';
    this.locationId =
      config?.locationId || process.env.SQUARE_LOCATION_ID || '';
    this.merchantId =
      config?.merchantId || process.env.SQUARE_MERCHANT_ID || '';
  }

  validateConfig(): boolean {
    return !!(this.accessToken && this.locationId);
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2024-06-04',
    };
  }

  private async request(
    path: string,
    init: RequestInit = {},
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
      logger.error(
        `Square request failed: ${init.method || 'GET'} ${path} — ${summary}`,
      );
      throw new AppError(
        `Square request failed: ${summary}`,
        response.status >= 500 ? 502 : 400,
      );
    }

    return response.json();
  }

  // ============================================
  // PAYMENT PROCESSING
  // ============================================

  /**
   * Process a payment via Square.
   *
   * Amount is in MAJOR units on input (10.50 USD = 10.50). The service
   * converts to cents for the wire and stores the major-unit value in
   * `Payment.amount` to match the rest of the codebase.
   */
  async processPayment(data: SquarePaymentData): Promise<any> {
    try {
      if (!Number.isFinite(data.amount) || data.amount <= 0) {
        throw new AppError('Amount must be a positive number', 400);
      }

      if (!data.sourceId) {
        throw new AppError('sourceId (card nonce or token) is required', 400);
      }

      if (!data.userId) {
        throw new AppError(
          'userId is required to create a Square payment (Payment.userId is a non-null FK)',
          400,
        );
      }

      if (!this.locationId) {
        throw new AppError(
          'SQUARE_LOCATION_ID is not configured — cannot create payments',
          503,
        );
      }

      const currency = (data.currency || 'USD').toUpperCase();
      const idempotencyKey =
        data.idempotencyKey ||
        `square_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

      const paymentData = {
        idempotency_key: idempotencyKey,
        amount_money: {
          amount: toMinorUnits(data.amount),
          currency,
        },
        source_id: data.sourceId,
        description: data.description || 'Payment via Square',
        location_id: this.locationId,
        customer_id: data.customerId,
        reference_id:
          data.saleId || data.orderId || `REF-${Date.now()}`,
        metadata: {
          saleId: data.saleId || '',
          orderId: data.orderId || '',
          userId: data.userId || '',
          ...data.metadata,
        },
        note: data.description || 'Payment via Square',
        autocomplete: true,
        delay_duration: 'PT0S',
      };

      const result = await this.request('/v2/payments', {
        method: 'POST',
        body: JSON.stringify(paymentData),
      });

      const payment = result.payment;
      if (!payment?.id) {
        throw new AppError('Square did not return a payment id', 502);
      }

      // Do NOT set gatewayId here — it's a FK to PaymentGateway.id.
      // paymentService.processPayment resolves the real gateway row.
      const dbPayment = await this.prisma.payment.create({
        data: {
          amount: data.amount, // major units
          currency,
          paymentMethod: 'CREDIT_CARD',
          status:
            payment.status === 'COMPLETED'
              ? PaymentStatus.PAID
              : payment.status === 'FAILED' || payment.status === 'CANCELED'
              ? PaymentStatus.FAILED
              : PaymentStatus.PENDING,
          transactionId: payment.id,
          reference: payment.id,
          userId: data.userId,
          notes: `Square payment: ${payment.id}`,
          processedAt: new Date(),
          metadata: {
            provider: 'SQUARE',
            idempotencyKey,
            squarePayment: payment,
            squareOrderId: payment.order_id,
            locationId: payment.location_id,
            saleId: data.saleId,
            orderId: data.orderId,
            receiptUrl: payment.receipt_url,
          },
        },
      });

      return {
        id: payment.id,
        status: payment.status === 'COMPLETED' ? 'succeeded' : 'pending',
        amount: toMajorUnits(payment.amount_money.amount),
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
   * Convenience wrapper for card-nonce flows.
   */
  async processCardPayment(data: {
    amount: number;
    cardNonce: string;
    currency?: string;
    customerId?: string;
    description?: string;
    saleId?: string;
    orderId?: string;
    userId?: string;
    metadata?: Record<string, any>;
    idempotencyKey?: string;
  }): Promise<any> {
    return this.processPayment({
      amount: data.amount,
      currency: data.currency,
      sourceId: data.cardNonce,
      customerId: data.customerId,
      description: data.description,
      saleId: data.saleId,
      orderId: data.orderId,
      userId: data.userId,
      metadata: data.metadata,
      idempotencyKey: data.idempotencyKey,
    });
  }

  // ============================================
  // REFUND METHODS
  // ============================================

  /**
   * Refund a Square payment.
   *
   * Accumulates `refundedAmount`; only flips to REFUNDED when the
   * cumulative total equals the original. Metadata is merged, not
   * replaced. Amount is accepted in major units and converted to
   * minor for the wire.
   */
  async refundPayment(
    paymentId: string,
    data: SquareRefundData,
  ): Promise<any> {
    try {
      const idempotencyKey =
        data.idempotencyKey ||
        `square_refund_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

      // Fetch the original payment to validate amount and currency.
      const paymentResult = await this.request(
        `/v2/payments/${encodeURIComponent(paymentId)}`,
        { method: 'GET' },
      );

      const payment = paymentResult.payment;
      if (!payment) {
        throw new AppError('Square payment not found', 404);
      }

      // Square allows refunds on APPROVED and COMPLETED. Anything else
      // (FAILED, CANCELED) cannot be refunded.
      if (payment.status !== 'COMPLETED' && payment.status !== 'APPROVED') {
        throw new AppError(
          `Cannot refund Square payment with status: ${payment.status}`,
          400,
        );
      }

      const originalAmountMajor = toMajorUnits(payment.amount_money.amount);
      const refundAmountMajor = data.amount ?? originalAmountMajor;

      if (!Number.isFinite(refundAmountMajor) || refundAmountMajor <= 0) {
        throw new AppError('Refund amount must be a positive number', 400);
      }
      if (refundAmountMajor > originalAmountMajor) {
        throw new AppError(
          `Refund amount ${refundAmountMajor} exceeds original amount ${originalAmountMajor}`,
          400,
        );
      }

      const refundData = {
        idempotency_key: idempotencyKey,
        payment_id: paymentId,
        amount_money: {
          amount: toMinorUnits(refundAmountMajor),
          currency: payment.amount_money.currency,
        },
        reason: data.reason || 'Refund requested by customer',
        location_id: this.locationId,
      };

      const result = await this.request('/v2/refunds', {
        method: 'POST',
        body: JSON.stringify(refundData),
      });

      const refund = result.refund;
      if (!refund?.id) {
        throw new AppError('Square did not return a refund id', 502);
      }

      const refundAmountFromProvider = toMajorUnits(
        refund.amount_money.amount ?? toMinorUnits(refundAmountMajor),
      );

      // Accumulate on the local Payment row.
      const localPayment = await this.prisma.payment.findFirst({
        where: { transactionId: paymentId },
      });

      if (localPayment) {
        const previouslyRefunded = localPayment.refundedAmount ?? 0;
        const totalRefunded = previouslyRefunded + refundAmountFromProvider;
        const newStatus =
          totalRefunded >= localPayment.amount
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIAL;

        await this.prisma.payment.update({
          where: { id: localPayment.id },
          data: {
            status: newStatus,
            refundedAmount: totalRefunded,
            refundedAt: new Date(),
            refundReason: data.reason || null,
            notes: `Square refunded: ${refund.id} — ${data.reason || 'No reason provided'}`,
            metadata: {
              ...((localPayment.metadata as Record<string, any>) || {}),
              lastSquareRefund: refund,
            },
          },
        });
      }

      return {
        id: refund.id,
        status: refund.status === 'COMPLETED' ? 'succeeded' : 'pending',
        amount: refundAmountFromProvider,
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

  /**
   * Poll the status of a previously created refund.
   */
  async checkRefundStatus(refundId: string): Promise<any> {
    try {
      const result = await this.request(
        `/v2/refunds/${encodeURIComponent(refundId)}`,
        { method: 'GET' },
      );

      const refund = result.refund;
      const statusMap: Record<string, string> = {
        COMPLETED: 'succeeded',
        PENDING: 'pending',
        APPROVED: 'pending',
        REJECTED: 'failed',
        FAILED: 'failed',
      };

      return {
        id: refund?.id ?? refundId,
        status: statusMap[String(refund?.status || '')] ?? 'pending',
        amount: refund?.amount_money
          ? toMajorUnits(refund.amount_money.amount)
          : undefined,
        currency: refund?.amount_money?.currency,
        reference: refund?.id ?? refundId,
        rawStatus: refund?.status,
        provider: 'SQUARE',
        data: refund,
      };
    } catch (error) {
      this.handleError(error, 'SquareService.checkRefundStatus');
      throw error;
    }
  }

  // ============================================
  // STATUS METHODS
  // ============================================

  async getTransactionStatus(paymentId: string): Promise<any> {
    try {
      const result = await this.request(
        `/v2/payments/${encodeURIComponent(paymentId)}`,
        { method: 'GET' },
      );

      const payment = result.payment;

      const statusMap: Record<string, string> = {
        PENDING: 'PENDING',
        APPROVED: 'PROCESSING',
        COMPLETED: 'COMPLETED',
        CANCELED: 'CANCELLED',
        FAILED: 'FAILED',
        REFUNDED: 'REFUNDED',
      };

      return {
        status: statusMap[payment.status] || 'PENDING',
        transactionId: payment.id,
        provider: 'SQUARE',
        paymentData: payment,
        rawStatus: payment.status,
        amount: toMajorUnits(payment.amount_money.amount),
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
   * Verify a Square webhook.
   *
   * Square's scheme:
   *   - Algorithm: HMAC-SHA256
   *   - Signed payload: `notificationUrl + rawBody` (concatenation,
   *     no separator)
   *   - Header: `x-square-hmacsha256-signature`
   *   - Digest encoding: base64
   *
   * `rawBody` MUST be the raw bytes of the request as received, and
   * `notificationUrl` MUST be the exact URL Square was configured
   * with. Any deviation — a re-serialized body, a URL with a
   * different query string, a missing trailing slash — breaks the
   * HMAC.
   *
   * Reference:
   *   https://developer.squareup.com/docs/webhooks/step3-validate
   */
  verifySignature(
    rawBody: Buffer | string,
    signature: string,
    notificationUrl?: string,
  ): void {
    if (!this.webhookSignatureKey) {
      // Fail closed: without the key we cannot distinguish a genuine
      // webhook from a forged one.
      throw new AppError(
        'SQUARE_WEBHOOK_SIGNATURE_KEY is not configured — refusing to accept webhooks',
        500,
      );
    }

    const url = notificationUrl || this.webhookUrl;
    if (!url) {
      throw new AppError(
        'SQUARE_WEBHOOK_URL is not configured — cannot verify webhook signatures',
        500,
      );
    }

    if (!signature) {
      throw new AppError('Missing x-square-hmacsha256-signature header', 400);
    }

    const bodyString = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : rawBody;

    const payload = url + bodyString;

    const expected = crypto
      .createHmac('sha256', this.webhookSignatureKey)
      .update(payload, 'utf8')
      .digest('base64');

    if (!safeEqualString(signature, expected)) {
      logger.warn('Square webhook signature mismatch');
      throw new AppError('Invalid Square webhook signature', 400);
    }
  }

  /**
   * Handle a Square webhook.
   *
   * `signature` is the value of `x-square-hmacsha256-signature`.
   * `rawBody` is the raw request buffer — the controller is
   * responsible for preserving it via
   * `express.raw({ type: 'application/json' })` on this route.
   */
  async handleWebhook(
    payload: any,
    signature: string,
    rawBody?: Buffer | string,
    notificationUrl?: string,
  ): Promise<any> {
    try {
      const bodyForVerification =
        rawBody ?? Buffer.from(JSON.stringify(payload), 'utf8');
      this.verifySignature(bodyForVerification, signature, notificationUrl);

      const eventType = payload?.type;
      if (!eventType) {
        logger.warn('Square webhook missing type field');
        return { acknowledged: true, event: 'unknown' };
      }

      logger.info(`Square webhook received: ${eventType}`);

      const data = payload?.data?.object?.payment;
      const refund = payload?.data?.object?.refund;

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
        case 'refund.created':
        case 'payment.refund.created':
          return await this.handleRefundCreated(refund);
        case 'refund.updated':
        case 'payment.refund.updated':
          return await this.handleRefundUpdated(refund);
        default:
          logger.info(`Unhandled Square webhook: ${eventType}`);
          return { unhandled: true, eventType };
      }
    } catch (error) {
      this.handleError(error, 'SquareService.handleWebhook');
      throw error;
    }
  }

  private async findPaymentBySquareId(paymentId: string): Promise<any | null> {
    if (!paymentId) return null;
    return this.prisma.payment.findFirst({
      where: {
        OR: [
          { transactionId: paymentId },
          { reference: paymentId },
        ],
      },
      include: { sale: true },
    });
  }

  private async handlePaymentCreated(data: any): Promise<any> {
    logger.info(`Square payment created: ${data?.id}`);
    return { success: true, event: 'PAYMENT_CREATED' };
  }

  private async handlePaymentUpdated(data: any): Promise<any> {
    const paymentId = data?.id;
    const status = data?.status;

    logger.info(`Square payment updated: ${paymentId} - ${status}`);

    if (!paymentId) {
      return { acknowledged: true, event: 'PAYMENT_UPDATED', skipped: true };
    }

    const local = await this.findPaymentBySquareId(paymentId);
    if (!local) {
      return { acknowledged: true, event: 'PAYMENT_UPDATED', skipped: true };
    }

    // Terminal-state guard: don't regress a resolved payment.
    if (['REFUNDED'].includes(local.status)) {
      return { acknowledged: true, event: 'PAYMENT_UPDATED', duplicate: true };
    }

    await this.prisma.payment.update({
      where: { id: local.id },
      data: {
        status: this.mapSquareStatusToPaymentStatus(status),
        metadata: {
          ...((local.metadata as Record<string, any>) || {}),
          squareUpdate: data,
        },
      },
    });

    return { success: true, event: 'PAYMENT_UPDATED', paymentId: local.id };
  }

  private async handlePaymentCompleted(data: any): Promise<any> {
    const paymentId = data?.id;
    if (!paymentId) {
      return { acknowledged: true, event: 'PAYMENT_COMPLETED', skipped: true };
    }

    const local = await this.findPaymentBySquareId(paymentId);
    if (!local) {
      return { acknowledged: true, event: 'PAYMENT_COMPLETED', skipped: true };
    }
    if (['PAID', 'REFUNDED'].includes(local.status)) {
      return { acknowledged: true, event: 'PAYMENT_COMPLETED', duplicate: true };
    }

    await this.prisma.payment.update({
      where: { id: local.id },
      data: {
        status: PaymentStatus.PAID,
        processedAt: new Date(),
        notes: `Square payment completed: ${paymentId}`,
        metadata: {
          ...((local.metadata as Record<string, any>) || {}),
          squarePayment: data,
        },
      },
    });

    await this.updateSaleAfterPayment(paymentId, local);

    return { success: true, event: 'PAYMENT_COMPLETED', paymentId: local.id };
  }

  private async handlePaymentFailed(data: any): Promise<any> {
    const paymentId = data?.id;
    if (!paymentId) {
      return { acknowledged: true, event: 'PAYMENT_FAILED', skipped: true };
    }

    const local = await this.findPaymentBySquareId(paymentId);
    if (!local) {
      return { acknowledged: true, event: 'PAYMENT_FAILED', skipped: true };
    }
    if (['PAID', 'FAILED', 'REFUNDED'].includes(local.status)) {
      return { acknowledged: true, event: 'PAYMENT_FAILED', duplicate: true };
    }

    await this.prisma.payment.update({
      where: { id: local.id },
      data: {
        status: PaymentStatus.FAILED,
        notes: `Square payment failed: ${data?.error?.message || 'Unknown error'}`,
        metadata: {
          ...((local.metadata as Record<string, any>) || {}),
          squarePayment: data,
        },
      },
    });

    return { success: true, event: 'PAYMENT_FAILED', paymentId: local.id };
  }

  private async handlePaymentCanceled(data: any): Promise<any> {
    const paymentId = data?.id;
    if (!paymentId) {
      return { acknowledged: true, event: 'PAYMENT_CANCELED', skipped: true };
    }

    const local = await this.findPaymentBySquareId(paymentId);
    if (!local) {
      return { acknowledged: true, event: 'PAYMENT_CANCELED', skipped: true };
    }
    if (['PAID', 'FAILED', 'REFUNDED'].includes(local.status)) {
      return { acknowledged: true, event: 'PAYMENT_CANCELED', duplicate: true };
    }

    await this.prisma.payment.update({
      where: { id: local.id },
      data: {
        status: PaymentStatus.FAILED,
        notes: `Square payment canceled: ${paymentId}`,
        metadata: {
          ...((local.metadata as Record<string, any>) || {}),
          squarePayment: data,
        },
      },
    });

    return { success: true, event: 'PAYMENT_CANCELED', paymentId: local.id };
  }

  private async handleRefundCreated(refund: any): Promise<any> {
    const paymentId = refund?.payment_id;
    if (!paymentId) {
      return { acknowledged: true, event: 'REFUND_CREATED', skipped: true };
    }

    const local = await this.findPaymentBySquareId(paymentId);
    if (!local) {
      return { acknowledged: true, event: 'REFUND_CREATED', skipped: true };
    }

    // Square sends the refund amount. If unavailable, fall back to the
    // full remaining amount (which equals full refund for a first
    // refund, and zero for a duplicate — the accumulation handles it).
    const refundAmountMajor = refund?.amount_money
      ? toMajorUnits(refund.amount_money.amount)
      : Math.max(0, local.amount - (local.refundedAmount ?? 0));

    const previouslyRefunded = local.refundedAmount ?? 0;
    const totalRefunded = Math.min(
      local.amount,
      previouslyRefunded + refundAmountMajor,
    );
    const newStatus =
      totalRefunded >= local.amount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIAL;

    await this.prisma.payment.update({
      where: { id: local.id },
      data: {
        status: newStatus,
        refundedAmount: totalRefunded,
        refundedAt: new Date(),
        notes: `Square refund created: ${refund?.id}`,
        metadata: {
          ...((local.metadata as Record<string, any>) || {}),
          lastSquareRefund: refund,
        },
      },
    });

    return { success: true, event: 'REFUND_CREATED', paymentId: local.id };
  }

  private async handleRefundUpdated(refund: any): Promise<any> {
    const paymentId = refund?.payment_id;
    if (!paymentId) {
      return { acknowledged: true, event: 'REFUND_UPDATED', skipped: true };
    }

    const local = await this.findPaymentBySquareId(paymentId);
    if (!local) {
      return { acknowledged: true, event: 'REFUND_UPDATED', skipped: true };
    }

    if (refund?.status === 'COMPLETED') {
      const refundAmountMajor = refund?.amount_money
        ? toMajorUnits(refund.amount_money.amount)
        : Math.max(0, local.amount - (local.refundedAmount ?? 0));

      const previouslyRefunded = local.refundedAmount ?? 0;
      const totalRefunded = Math.min(
        local.amount,
        previouslyRefunded + refundAmountMajor,
      );
      const newStatus =
        totalRefunded >= local.amount
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIAL;

      await this.prisma.payment.update({
        where: { id: local.id },
        data: {
          status: newStatus,
          refundedAmount: totalRefunded,
          refundedAt: new Date(),
          metadata: {
            ...((local.metadata as Record<string, any>) || {}),
            lastSquareRefund: refund,
          },
        },
      });
    }

    return { success: true, event: 'REFUND_UPDATED', paymentId: local.id };
  }

  private mapSquareStatusToPaymentStatus(status: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      PENDING: PaymentStatus.PENDING,
      APPROVED: PaymentStatus.PROCESSING,
      COMPLETED: PaymentStatus.PAID,
      CANCELED: PaymentStatus.FAILED,
      FAILED: PaymentStatus.FAILED,
      REFUNDED: PaymentStatus.REFUNDED,
    };
    return map[status] || PaymentStatus.PENDING;
  }

  // ============================================
  // CUSTOMER METHODS
  // ============================================

  async createCustomer(data: {
    email: string;
    name: string;
    phone?: string;
    referenceId?: string;
    idempotencyKey?: string;
  }): Promise<any> {
    try {
      const customerData = {
        idempotency_key:
          data.idempotencyKey ||
          `square_cust_${Date.now()}_${crypto
            .randomBytes(6)
            .toString('hex')}`,
        email_address: data.email,
        family_name: data.name,
        phone_number: data.phone,
        reference_id: data.referenceId || `CUST-${Date.now()}`,
        note: 'Created from Kalwanga POS',
      };

      const result = await this.request('/v2/customers', {
        method: 'POST',
        body: JSON.stringify(customerData),
      });

      return result.customer;
    } catch (error) {
      this.handleError(error, 'SquareService.createCustomer');
      throw error;
    }
  }

  // ============================================
  // LOCATION METHODS
  // ============================================

  async getLocations(): Promise<any[]> {
    try {
      const result = await this.request('/v2/locations', { method: 'GET' });
      return result.locations || [];
    } catch (error) {
      this.handleError(error, 'SquareService.getLocations');
      throw error;
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Update the local Sale after a Square payment succeeds.
   *
   * Fixes vs. the old implementation:
   *   - Removed `paymentStatus: 'PAID'` — `Sale` has no such field.
   *   - Accumulates `paidAmount` and recomputes `status` from the
   *     resulting value vs. `total`, instead of unconditionally
   *     marking `COMPLETED`.
   *
   * Downstream side effects (receipt, inventory, loyalty, cart) are
   * handled by `paymentService.completeCheckoutFromGateway`, which the
   * webhook controller should call after this service returns.
   */
  private async updateSaleAfterPayment(
    paymentId: string,
    paymentOverride?: any,
  ): Promise<void> {
    try {
      const payment =
        paymentOverride ??
        (await this.prisma.payment.findFirst({
          where: { transactionId: paymentId },
          include: { sale: true },
        }));

      if (!payment?.saleId) return;

      const sale =
        payment.sale ??
        (await this.prisma.sale.findUnique({
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
      logger.error('Error updating sale after Square payment:', error);
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const squareService = new SquareService();
export default squareService;
