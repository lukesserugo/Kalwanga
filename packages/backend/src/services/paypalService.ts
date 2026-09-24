// src/services/paypalService.ts
//
// PayPal integration — v2 Orders API.
//
// Environment variables:
//   PAYPAL_CLIENT_ID
//   PAYPAL_CLIENT_SECRET
//   PAYPAL_ENVIRONMENT        "sandbox" | "production"
//   PAYPAL_WEBHOOK_ID         webhook id from the PayPal dashboard
//   PAYPAL_BRAND_NAME         shown on the PayPal approval page
//   PAYPAL_AUTO_CAPTURE       "true" to auto-capture on ORDER_APPROVED
//   FRONTEND_URL              used for default return/cancel URLs
//
// There is NO shared webhook secret. PayPal signs deliveries with
// the five `paypal-transmission-*` headers and verification is done
// by calling PayPal's /v1/notifications/verify-webhook-signature
// endpoint.

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import * as crypto from 'crypto';

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
  webhookId?: string;
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

const REQUEST_TIMEOUT_MS = 30_000;

export class PayPalService extends BaseService {
  private clientId: string;
  private clientSecret: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;
  private webhookId?: string;
  private brandName: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config?: Partial<PayPalConfig>) {
    super();

    this.clientId = config?.clientId || process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret =
      config?.clientSecret || process.env.PAYPAL_CLIENT_SECRET || '';
    this.environment =
      config?.environment ||
      (process.env.PAYPAL_ENVIRONMENT as 'sandbox' | 'production') ||
      'sandbox';
    this.baseUrl =
      this.environment === 'sandbox'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';
    this.webhookId = config?.webhookId || process.env.PAYPAL_WEBHOOK_ID;
    this.brandName =
      config?.brandName || process.env.PAYPAL_BRAND_NAME || 'Kalwanga POS';
  }

  validateConfig(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  private async getAccessToken(): Promise<string> {
    // Return cached token while still valid. Buffer of 60s guards
    // against requests that start just before expiry.
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString('base64');

      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        logger.error('[paypal:auth] Token request rejected', {
          status: response.status,
          error,
        });
        throw new AppError(
          `PayPal authentication failed: ${
            (error as any).error_description || 'Unknown error'
          }`,
          401,
        );
      }

      const data = await response.json();

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + data.expires_in * 1000 - 60000;

      logger.info('PayPal access token obtained successfully');
      return this.accessToken as string;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('PayPal authentication error:', error);
      throw new AppError('Failed to authenticate with PayPal', 500);
    }
  }

  /**
   * Build request headers with the provided access token.
   *
   * Callers must fetch the token via `await this.getAccessToken()`
   * and pass it in — do NOT read `this.accessToken` directly, as it
   * may be stale if the process skipped the refresh path.
   *
   * `PayPal-Request-Id` is PayPal's idempotency header. A unique
   * value is generated per request unless the caller supplies one.
   */
  private getHeaders(
    accessToken: string,
    requestId?: string,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id':
        requestId ||
        `paypal_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    };
  }

  // ============================================
  // PAYMENT PROCESSING
  // ============================================

  /**
   * Create a PayPal order.
   *
   * Uses the v2 Orders API with `payment_source.paypal.experience_context`.
   * The legacy `application_context` block is NOT sent.
   *
   * The `amount.breakdown` block is intentionally omitted — PayPal
   * rejects `breakdown.item_total` when no corresponding `items[]`
   * array is present. The top-level `value` alone is what PayPal
   * charges.
   *
   * The `custom_id` and `invoice_id` both carry the local sale id
   * (falling back to orderId) so the webhook handler can find the
   * right Sale regardless of which field it reads first.
   *
   * ⚠ `return_url` and `cancel_url` must be well-formed URLs.
   *   PayPal validates them against RFC 3986 and rejects any URL
   *   that contains a character outside the allowed set. Curly
   *   braces (`{`, `}`) are NOT allowed — a `{REFERENCE}` template
   *   placeholder produces INVALID_PARAMETER_SYNTAX.
   *
   *   PayPal appends `?token=<orderId>&PayerID=<payerId>` to the
   *   return_url itself when redirecting the user back. The
   *   frontend reads the `token` query parameter to obtain the
   *   order id and then calls the capture endpoint.
   */
  async createOrder(data: PayPalPaymentData): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const currency = data.currency || 'USD';
      const value = data.amount.toFixed(2);

      const baseFrontendUrl =
        process.env.FRONTEND_URL || 'http://localhost:3000';

      // Sanitize: strip any `{...}` placeholder segments that a
      // caller may have injected. PayPal rejects curly braces in
      // URLs. The literal "source=paypal" marker is preserved so
      // the frontend knows the user came back from PayPal.
      const sanitizeUrl = (raw: string): string =>
        raw.replace(/\{[^}]*\}/g, '');

      const returnUrl = sanitizeUrl(
        data.returnUrl || `${baseFrontendUrl}/checkout?source=paypal`,
      );
      const cancelUrl = sanitizeUrl(
        data.cancelUrl || `${baseFrontendUrl}/checkout?cancel=1`,
      );

      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value,
            },
            description: (data.description || 'Payment via PayPal').slice(
              0,
              127,
            ),
            reference_id: 'default',
            custom_id: data.saleId || data.orderId || 'unknown',
            invoice_id:
              data.saleId || data.orderId || `INV-${Date.now()}`,
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: this.brandName.slice(0, 127),
              landing_page: 'LOGIN',
              user_action: 'PAY_NOW',
              return_url: returnUrl,
              cancel_url: cancelUrl,
            },
          },
        },
      };

      logger.info('[paypal:createOrder] Sending order to PayPal', {
        amount: value,
        currency,
        saleId: data.saleId,
        orderId: data.orderId,
        returnUrl,
        cancelUrl,
      });

      const response = await fetch(
        `${this.baseUrl}/v2/checkout/orders`,
        {
          method: 'POST',
          headers: this.getHeaders(accessToken, data.idempotencyKey),
          body: JSON.stringify(orderData),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));

        logger.error('[paypal:createOrder] PayPal rejected the order', {
          status: response.status,
          body: JSON.stringify(errorBody, null, 2),
          outgoingPayload: JSON.stringify(orderData, null, 2),
        });

        throw new AppError(
          `PayPal order creation failed: ${
            (errorBody as any).message || JSON.stringify(errorBody)
          }`,
          400,
        );
      }

      const order = await response.json();

      const approvalLink = order.links?.find(
        (link: any) =>
          link.rel === 'approve' || link.rel === 'payer-action',
      );

      const payment = await this.prisma.payment.create({
        data: {
          amount: data.amount,
          currency,
          paymentMethod: 'PAYPAL',
          status: 'PENDING',
          transactionId: order.id,
          reference: order.id,
          userId: data.userId || 'system',
          gatewayId: 'PAYPAL',
          notes: `PayPal order created: ${order.id}`,
          processedAt: new Date(),
          metadata: {
            provider: 'PAYPAL',
            orderData: order,
            approvalUrl: approvalLink?.href,
            saleId: data.saleId || null,
            orderId: data.orderId || null,
            idempotencyKey: data.idempotencyKey || null,
          },
        },
      });

      return {
        id: order.id,
        status: order.status === 'CREATED' ? 'pending' : 'processing',
        amount: data.amount,
        currency,
        reference: order.id,
        provider: 'PAYPAL',
        approvalUrl: approvalLink?.href,
        paymentId: payment.id,
        orderData: order,
        links: order.links,
      };
    } catch (error) {
      this.handleError(error, 'PayPalService.createOrder');
      throw error;
    }
  }

  /**
   * Capture a PayPal order after approval.
   */
  async captureOrder(
    orderId: string,
    metadata?: Record<string, any>,
  ): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {
          method: 'POST',
          headers: this.getHeaders(accessToken),
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        logger.error('[paypal:captureOrder] PayPal rejected capture', {
          status: response.status,
          body: JSON.stringify(errorBody, null, 2),
        });
        throw new AppError(
          `PayPal capture failed: ${
            (errorBody as any).message || JSON.stringify(errorBody)
          }`,
          400,
        );
      }

      const capture = await response.json();

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
        amount: parseFloat(
          capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount
            ?.value || '0',
        ),
        currency:
          capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount
            ?.currency_code || 'USD',
        captureData: capture,
      };
    } catch (error) {
      this.handleError(error, 'PayPalService.captureOrder');
      throw error;
    }
  }

  /**
   * Complete payment flow — create order, optionally capture.
   */
  async processPayment(data: PayPalPaymentData): Promise<any> {
    try {
      const order = await this.createOrder(data);

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
      this.handleError(error, 'PayPalService.processPayment');
      throw error;
    }
  }

  // ============================================
  // REFUND METHODS
  // ============================================

  async refundPayment(
    transactionId: string,
    data: PayPalRefundData,
  ): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      // Fetch the order to find the capture id.
      const orderResponse = await fetch(
        `${this.baseUrl}/v2/checkout/orders/${transactionId}`,
        {
          method: 'GET',
          headers: this.getHeaders(accessToken),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );

      if (!orderResponse.ok) {
        throw new AppError('Failed to get PayPal order for refund', 404);
      }

      const order = await orderResponse.json();
      const capture = order.purchase_units?.[0]?.payments?.captures?.[0];

      if (!capture) {
        throw new AppError('No capture found for this payment', 404);
      }

      const refundData = {
        amount: {
          currency_code:
            data.currency || capture.amount?.currency_code || 'USD',
          value: (
            data.amount || parseFloat(capture.amount?.value || '0')
          ).toFixed(2),
        },
        invoice_id: `REF-${Date.now()}`,
        note_to_payer:
          data.noteToPayer ||
          data.reason ||
          'Refund requested by customer',
      };

      const response = await fetch(
        `${this.baseUrl}/v2/payments/captures/${capture.id}/refund`,
        {
          method: 'POST',
          headers: this.getHeaders(accessToken),
          body: JSON.stringify(refundData),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        logger.error('[paypal:refund] PayPal rejected refund', {
          status: response.status,
          body: JSON.stringify(errorBody, null, 2),
        });
        throw new AppError(
          `PayPal refund failed: ${
            (errorBody as any).message || JSON.stringify(errorBody)
          }`,
          400,
        );
      }

      const refund = await response.json();

      await this.prisma.payment.updateMany({
        where: { transactionId },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
          notes: `PayPal refunded: ${refund.id} - ${
            data.reason || 'No reason provided'
          }`,
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
      this.handleError(error, 'PayPalService.refundPayment');
      throw error;
    }
  }

  // ============================================
  // STATUS METHODS
  // ============================================

  async getTransactionStatus(transactionId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2/checkout/orders/${transactionId}`,
        {
          method: 'GET',
          headers: this.getHeaders(accessToken),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        throw new AppError(
          'Failed to get PayPal transaction status',
          400,
        );
      }

      const order = await response.json();

      const statusMap: Record<string, string> = {
        CREATED: 'PENDING',
        SAVED: 'PENDING',
        APPROVED: 'PROCESSING',
        VOIDED: 'FAILED',
        COMPLETED: 'COMPLETED',
        PAYER_ACTION_REQUIRED: 'PENDING',
      };

      return {
        status: statusMap[order.status] || 'PENDING',
        transactionId: order.id,
        provider: 'PAYPAL',
        orderData: order,
        rawStatus: order.status,
        amount: parseFloat(
          order.purchase_units?.[0]?.amount?.value || '0',
        ),
        currency:
          order.purchase_units?.[0]?.amount?.currency_code || 'USD',
        createdAt: order.create_time,
        updatedAt: order.update_time,
      };
    } catch (error) {
      this.handleError(error, 'PayPalService.getTransactionStatus');
      throw error;
    }
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  /**
   * Handle PayPal webhook.
   *
   * Verification is mandatory. If `verifyWebhookSignature` throws
   * (missing headers, missing webhook id, PayPal says the signature
   * is bad, or the verification call itself fails), the error
   * propagates to the caller and the webhook is not processed.
   */
  async handleWebhook(
    payload: any,
    headers: Record<string, string>,
  ): Promise<any> {
    try {
      await this.verifyWebhookSignature(payload, headers);

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
      this.handleError(error, 'PayPalService.handleWebhook');
      throw error;
    }
  }

  /**
   * Verify a PayPal webhook signature.
   *
   * PayPal does not use a shared HMAC secret. Instead it sends five
   * transmission headers describing the delivery, and you verify by
   * calling PayPal back at /v1/notifications/verify-webhook-signature
   * with those headers plus the webhook id and the full event body.
   *
   * Reference:
   *   https://developer.paypal.com/api/webhooks/v1/#verify-webhook-signature
   *
   * Fails closed on every path that means "do not trust this
   * request":
   *
   *   - missing headers                 → 400
   *   - missing PAYPAL_WEBHOOK_ID       → 500
   *   - verification endpoint unreachable → 503
   *   - verification endpoint 5xx       → 503
   *   - verification_status != SUCCESS  → 400
   */
  private async verifyWebhookSignature(
    payload: any,
    headers: Record<string, string>,
  ): Promise<boolean> {
    // PayPal's five required transmission headers. Header names are
    // case-insensitive per HTTP, and Express lowercases them.
    const getHeader = (name: string): string => {
      const lower = name.toLowerCase();
      const value = headers[lower] ?? headers[name];
      if (Array.isArray(value)) return value[0] ?? '';
      return value ?? '';
    };

    const transmissionId = getHeader('paypal-transmission-id');
    const transmissionTime = getHeader('paypal-transmission-time');
    const certUrl = getHeader('paypal-cert-url');
    const authAlgo = getHeader('paypal-auth-algo');
    const transmissionSig = getHeader('paypal-transmission-sig');

    if (
      !transmissionId ||
      !transmissionTime ||
      !certUrl ||
      !authAlgo ||
      !transmissionSig
    ) {
      logger.warn('[paypal:webhook] Missing transmission headers', {
        hasId: !!transmissionId,
        hasTime: !!transmissionTime,
        hasCertUrl: !!certUrl,
        hasAlgo: !!authAlgo,
        hasSig: !!transmissionSig,
      });
      throw new AppError(
        'Missing PayPal webhook transmission headers',
        400,
      );
    }

    if (!this.webhookId) {
      // Refuse to process webhooks we cannot verify.
      throw new AppError(
        'PAYPAL_WEBHOOK_ID is not configured — refusing to accept webhooks',
        500,
      );
    }

    // The verification payload requires the raw event body as a
    // JSON object. We pass `payload` unchanged — PayPal compares
    // the canonical serialisation to the signature, so re-keying
    // the object would break verification.
    const verificationBody = {
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: this.webhookId,
      webhook_event: payload,
    };

    let response: Response;
    try {
      const accessToken = await this.getAccessToken();
      response = await fetch(
        `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(verificationBody),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch (err) {
      // Network / DNS / TLS problem reaching PayPal. Do not accept
      // the webhook — throw a 503 so the route can return non-2xx
      // and PayPal will retry later.
      logger.error('[paypal:webhook] Verification call failed', err);
      throw new AppError(
        'Failed to reach PayPal for webhook verification',
        503,
      );
    }

    if (!response.ok) {
      // PayPal returned 4xx/5xx to our verification call.
      const body = await response.text().catch(() => '');
      logger.error('[paypal:webhook] Verification endpoint rejected', {
        status: response.status,
        body: body.slice(0, 500),
      });
      throw new AppError(
        `PayPal webhook verification failed: HTTP ${response.status}`,
        response.status >= 500 ? 503 : 400,
      );
    }

    const result = (await response.json()) as {
      verification_status?: string;
    };

    if (result.verification_status !== 'SUCCESS') {
      logger.warn('[paypal:webhook] Signature verification not SUCCESS', {
        verification_status: result.verification_status,
      });
      throw new AppError('Invalid PayPal webhook signature', 400);
    }

    logger.info('[paypal:webhook] Signature verified');
    return true;
  }

  private async handlePaymentCaptureCompleted(
    payload: any,
  ): Promise<any> {
    const orderId =
      payload.resource?.supplemental_data?.order_id ||
      payload.resource?.id;
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

    await this.updateSaleAfterPayment(orderId);

    return { success: true, event: 'PAYMENT_CAPTURE_COMPLETED' };
  }

  private async handlePaymentCaptureDenied(
    payload: any,
  ): Promise<any> {
    const orderId =
      payload.resource?.supplemental_data?.order_id ||
      payload.resource?.id;

    await this.prisma.payment.updateMany({
      where: { transactionId: orderId },
      data: {
        status: 'FAILED',
        notes: `PayPal capture denied: ${
          payload.resource?.status_details?.reason || 'Unknown reason'
        }`,
        metadata: { paypalEvent: payload },
      },
    });

    return { success: true, event: 'PAYMENT_CAPTURE_DENIED' };
  }

  private async handlePaymentRefunded(payload: any): Promise<any> {
    const orderId =
      payload.resource?.supplemental_data?.order_id ||
      payload.resource?.id;

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
    const orderId =
      payload.resource?.supplemental_data?.order_id ||
      payload.resource?.id;

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

  /**
   * Mark the local Sale COMPLETED after a successful PayPal capture.
   *
   * NOTE: The `Sale` model has no `paymentStatus` column. Only
   * `status` and `paidAmount` are writable on this row.
   */
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

export default PayPalService;
