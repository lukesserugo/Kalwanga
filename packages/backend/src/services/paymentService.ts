// packages/backend/src/services/paymentService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import Stripe from 'stripe';
import { Prisma } from '../generated/prisma/index.js';
import { logger } from '../lib/logger.js';
import * as crypto from 'crypto';
import { mobileMoneyService } from './mobileMoneyService.js';
import { PayPalService } from './paypalService.js';
import { FlutterwaveService } from './flutterwaveService.js';
import { SquareService } from './squareService.js';
import { stripeService } from './stripeService.js';
import { currencyService } from './currencyService.js';
import { exchangeRateService } from './exchangeRateService.js';
import { chargeCurrencyService } from './chargeCurrencyService.js';
import {
  PaymentStatus,
  PaymentProviderEnum,
  PaymentProviderType,
  PaymentMethod,
} from '../generated/prisma/index.js';

// ============================================
// STRIPE CLIENT
// ============================================
//
// All Stripe calls go through `stripeService`. See stripeService.ts
// for why the module-scoped Stripe instance was removed.

// ============================================
// CURRENCY CONTEXT — Phase 3a / Phase D1
// ============================================
//
// Every Payment row records SEVEN currency-related facts:
//
//   currency          — the LEDGER currency (BusinessUnit.currency).
//                       Required column, no schema default.
//   displayCurrency   — what the payer saw prices in. Null when the
//                       payer didn't override. NEVER used to mutate
//                       `amount`.
//   gatewayCurrency   — what the provider actually charged in.
//                       Set by `checkoutService` from the resolved
//                       ChargeContext (Phase D1). When the ledger
//                       currency is already accepted by the
//                       gateway, this equals `currency`.
//   gatewayAmount     — the amount in `gatewayCurrency`. May differ
//                       from `amount` when gatewayCurrency differs.
//   exchangeRate      — rate applied (currency → gatewayCurrency).
//   exchangeRateSource— provenance of the rate.
//   (refund side)     — `refundedAmount` is always in LEDGER
//                       currency; the refund write path converts
//                       to `gatewayCurrency` before calling the
//                       provider and records the provider's own
//                       refund id / amount in `metadata`.
//
// The `amount` column is ALWAYS the ledger amount. Never mutate it
// based on display or gateway.

interface PaymentCurrencyContext {
  /** Ledger currency — BusinessUnit.currency resolved via registry. */
  ledgerCurrency: string;
  /** Payer's chosen display currency, or null. */
  displayCurrency: string | null;
  /** What the provider charged in. Defaults to ledgerCurrency. */
  gatewayCurrency: string;
  /** Amount in gatewayCurrency. Defaults to the passed amount. */
  gatewayAmount: number;
  /** Rate applied (ledgerCurrency → gatewayCurrency). Null when same. */
  exchangeRate: number | null;
  /** Where the rate came from. Null when same currency. */
  exchangeRateSource: string | null;
}

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

  /**
   * The payer's chosen display currency, read from
   * `X-Display-Currency` by the controller and passed down.
   * Recorded on the Payment row as an audit fact. NEVER used to
   * mutate `amount` — that is always the ledger amount.
   */
  displayCurrency?: string | null;

  /**
   * What the gateway actually charged in, when different from the
   * ledger currency. Set by `checkoutService.invokeGateway` from
   * the resolved ChargeContext (Phase D1). Controllers calling
   * `processPayment` directly (POS, admin refunds) leave this
   * undefined and the context resolver defaults it to the ledger
   * currency.
   */
  gatewayCurrency?: string | null;

  /**
   * The amount the gateway actually charged, in
   * `gatewayCurrency`. When omitted, defaults to `amount`.
   */
  gatewayAmount?: number | null;

  /**
   * Rate applied (ledger → gateway). Optional. When omitted, the
   * resolver looks the rate up via `exchangeRateService` only if
   * gatewayCurrency differs from the ledger currency.
   */
  exchangeRate?: number | null;

  /**
   * Provenance of `exchangeRate`. Optional. When omitted and a
   * rate is looked up, the source comes from the rate resolver.
   */
  exchangeRateSource?: string | null;

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
  idempotencyKey?: string;
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
//
// No handler carries a hardcoded currency list. The only place a
// supported-currency list is materialized is
// `createDefaultProviders()` / `getDefaultProviders()`, and both
// source their lists from the registry via
// `currencyService.listForProvider(...)` and
// `currencyService.listAllSettlement()`.

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
      currency: data.currency,
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

    logger.info(
      `Processing mobile money payment: ${data.amount} ${data.currency} via ${providerInfo.name}`,
    );

    if (!data.metadata?.phoneNumber) {
      throw new AppError('Phone number is required for mobile money', 400);
    }

    return {
      id: `${providerInfo.prefix}_${Date.now()}_${crypto
        .randomBytes(4)
        .toString('hex')}`,
      status: 'succeeded',
      amount: data.amount,
      currency: data.currency,
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
      instructions:
        process.env.BANK_INSTRUCTIONS ||
        'Please use reference number for payment',
    };

    return {
      id: `bank_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      status: 'pending',
      amount: data.amount,
      currency: data.currency,
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
      currency: data.currency,
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
      throw new AppError(
        'Customer ID required for loyalty points payment',
        400,
      );
    }

    logger.info(
      `Processing loyalty points payment for customer: ${data.customerId}`,
    );

    const pointsNeeded = Math.ceil(data.amount * 10);

    return {
      id: `loyalty_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      status: 'succeeded',
      amount: data.amount,
      currency: data.currency,
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
    logger.info(
      `Processing MTN Mobile Money payment: ${data.amount} ${data.currency}`,
    );

    if (!data.metadata?.phoneNumber) {
      throw new AppError(
        'Phone number is required for MTN Mobile Money payment',
        400,
      );
    }

    const result = await mobileMoneyService.initiatePayment('MTN', {
      phoneNumber: data.metadata.phoneNumber,
      amount: data.amount,
      currency: data.currency,
      reference: data.metadata.accountReference || '',
      description: data.description || 'Payment via MTN Mobile Money',
      callbackUrl: data.metadata.callbackUrl,
    });

    return {
      id: result.transactionId,
      status: result.status === 'SUCCESS' ? 'succeeded' : 'pending',
      amount: data.amount,
      currency: data.currency,
      reference: result.reference,
      provider: 'MTN',
      transactionId: result.transactionId,
      customerMessage: result.message,
    };
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    const phoneNumber =
      data.metadata?.phoneNumber || data.metadata?.payerPhoneNumber;

    if (!phoneNumber) {
      throw new AppError(
        'Cannot refund MTN payment: original payer phone number is not recorded on the payment',
        400,
      );
    }

    if (!data.amount || data.amount <= 0) {
      throw new AppError('Refund amount must be positive', 400);
    }

    const result = await mobileMoneyService.refundPayment('MTN', {
      phoneNumber,
      amount: data.amount,
      currency: data.currency,
      reference: data.reference,
      reason: data.reason || 'Refund',
    });

    return {
      id: result.id,
      status: result.status,
      amount: result.amount,
      currency: result.currency,
      reference: result.reference,
      provider: 'MTN',
      refundData: result.data,
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
    logger.info(
      `Processing Airtel Mobile Money payment: ${data.amount} ${data.currency}`,
    );

    if (!data.metadata?.phoneNumber) {
      throw new AppError(
        'Phone number is required for Airtel Mobile Money payment',
        400,
      );
    }

    const result = await mobileMoneyService.initiatePayment('AIRTEL', {
      phoneNumber: data.metadata.phoneNumber,
      amount: data.amount,
      currency: data.currency,
      reference: data.metadata.accountReference || '',
      description: data.description || 'Payment via Airtel Mobile Money',
      callbackUrl: data.metadata.callbackUrl,
    });

    return {
      id: result.transactionId,
      status: result.status === 'SUCCESS' ? 'succeeded' : 'pending',
      amount: data.amount,
      currency: data.currency,
      reference: result.reference,
      provider: 'AIRTEL',
      transactionId: result.transactionId,
      customerMessage: result.message,
    };
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    const phoneNumber =
      data.metadata?.phoneNumber || data.metadata?.payerPhoneNumber;

    if (!phoneNumber) {
      throw new AppError(
        'Cannot refund Airtel payment: original payer phone number is not recorded on the payment',
        400,
      );
    }

    if (!data.amount || data.amount <= 0) {
      throw new AppError('Refund amount must be positive', 400);
    }

    const result = await mobileMoneyService.refundPayment('AIRTEL', {
      phoneNumber,
      amount: data.amount,
      currency: data.currency,
      reference: data.reference,
      reason: data.reason || 'Refund',
    });

    return {
      id: result.id,
      status: result.status,
      amount: result.amount,
      currency: result.currency,
      reference: result.reference,
      provider: 'AIRTEL',
      refundData: result.data,
    };
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return await mobileMoneyService.checkStatus('AIRTEL', transactionId);
  }
}

// ============================================
// PAYPAL PROVIDER HANDLER
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
      idempotencyKey: data.idempotencyKey,
      metadata: data.metadata,
    });

    return result;
  }

  async refundPayment(transactionId: string, data: any): Promise<any> {
    return await this.paypalService.refundPayment(transactionId, {
      amount: data.amount,
      currency: data.currency,
      reason: data.reason,
      noteToPayer: data.noteToPayer,
    });
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    return await this.paypalService.getTransactionStatus(transactionId);
  }

  async captureOrder(orderId: string): Promise<any> {
    return await this.paypalService.captureOrder(orderId);
  }

  async handleWebhook(
    payload: any,
    headers: Record<string, string>,
  ): Promise<any> {
    return await this.paypalService.handleWebhook(payload, headers);
  }
}

// ============================================
// FLUTTERWAVE PROVIDER HANDLER
// ============================================

class FlutterwaveProviderHandler implements ProviderHandler {
  private flutterwaveService: FlutterwaveService;

  constructor() {
    this.flutterwaveService = new FlutterwaveService();
  }

  validateConfig(): boolean {
    return this.flutterwaveService.validateConfig();
  }

  private mapPaymentStatusToEnum(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      succeeded: PaymentStatus.PAID,
      success: PaymentStatus.PAID,
      completed: PaymentStatus.PAID,
      pending: PaymentStatus.PENDING,
      processing: PaymentStatus.PROCESSING,
      failed: PaymentStatus.FAILED,
      cancelled: PaymentStatus.FAILED,
      refunded: PaymentStatus.REFUNDED,
    };
    return statusMap[status?.toLowerCase()] || PaymentStatus.PENDING;
  }

  async processPayment(data: any): Promise<any> {
    const result = await this.flutterwaveService.processPayment({
      amount: data.amount,
      currency: data.currency,
      paymentMethod:
        data.paymentMethod === 'MOBILE_MONEY' ? 'mobile_money' : 'card',
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
    return await this.flutterwaveService.getTransactionStatus(
      transactionId,
    );
  }

  async createVirtualAccount(data: {
    email: string;
    amount?: number;
    currency?: string;
    customerName?: string;
  }): Promise<any> {
    return await this.flutterwaveService.createVirtualAccount(data);
  }

  async handleWebhook(
    payload: any,
    signature: string,
    rawBody?: Buffer | string,
  ): Promise<any> {
    return await this.flutterwaveService.handleWebhook(
      payload,
      signature,
      rawBody,
    );
  }
}

// ============================================
// SQUARE PROVIDER HANDLER
// ============================================

class SquareProviderHandler implements ProviderHandler {
  private squareService: SquareService;

  constructor() {
    this.squareService = new SquareService();
  }

  validateConfig(): boolean {
    return this.squareService.validateConfig();
  }

  async processPayment(data: any): Promise<any> {
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
      saleId: data.saleId,
      orderId: data.orderId,
      userId: data.userId,
      metadata: data.metadata,
      idempotencyKey: data.idempotencyKey,
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

  async createCustomer(data: {
    email: string;
    name: string;
    phone?: string;
  }): Promise<any> {
    return await this.squareService.createCustomer(data);
  }

  async handleWebhook(
    payload: any,
    signature: string,
    rawBody?: Buffer | string,
    notificationUrl?: string,
  ): Promise<any> {
    return await this.squareService.handleWebhook(
      payload,
      signature,
      rawBody,
      notificationUrl,
    );
  }
}

// ============================================
// MAIN PAYMENT SERVICE
// ============================================

export class PaymentService extends BaseService {
  private handlerFactories: Map<string, () => ProviderHandler>;
  private handlerCache: Map<string, ProviderHandler>;

  constructor() {
    super();
    this.handlerFactories = new Map();
    this.handlerCache = new Map();
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    this.handlerFactories.set('CASH', () => new CashProviderHandler());
    this.handlerFactories.set(
      'MOBILE_MONEY',
      () => new MobileMoneyProviderHandler(),
    );
    this.handlerFactories.set(
      'BANK_TRANSFER',
      () => new BankTransferProviderHandler(),
    );
    this.handlerFactories.set(
      'GIFT_CARD',
      () => new GiftCardProviderHandler(),
    );
    this.handlerFactories.set(
      'LOYALTY_POINTS',
      () => new LoyaltyPointsProviderHandler(),
    );
    this.handlerFactories.set(
      'MTN',
      () => new MTNMobileMoneyProviderHandler(),
    );
    this.handlerFactories.set(
      'AIRTEL',
      () => new AirtelMobileMoneyProviderHandler(),
    );
    this.handlerFactories.set('PAYPAL', () => new PayPalProviderHandler());
    this.handlerFactories.set(
      'FLUTTERWAVE',
      () => new FlutterwaveProviderHandler(),
    );
    this.handlerFactories.set('SQUARE', () => new SquareProviderHandler());
  }

  private getProviderHandler(paymentMethod: string): ProviderHandler | null {
    const methodMap: Record<string, string> = {
      CASH: 'CASH',
      MOBILE_MONEY: 'MOBILE_MONEY',
      BANK_TRANSFER: 'BANK_TRANSFER',
      GIFT_CARD: 'GIFT_CARD',
      LOYALTY_POINTS: 'LOYALTY_POINTS',
      MTN: 'MTN',
      AIRTEL: 'AIRTEL',
      PAYPAL: 'PAYPAL',
      FLUTTERWAVE: 'FLUTTERWAVE',
      PAYSTACK: 'PAYSTACK',
      SQUARE: 'SQUARE',
      CREDIT_CARD: 'STRIPE',
      DEBIT_CARD: 'STRIPE',
    };

    const handlerKey = methodMap[paymentMethod];
    if (!handlerKey) return null;

    const cached = this.handlerCache.get(handlerKey);
    if (cached) return cached;

    const factory = this.handlerFactories.get(handlerKey);
    if (!factory) return null;

    try {
      const handler = factory();
      this.handlerCache.set(handlerKey, handler);
      return handler;
    } catch (err) {
      logger.error(
        `[payments] Failed to instantiate provider handler "${handlerKey}":`,
        err,
      );
      throw new AppError(
        `Payment provider ${handlerKey} failed to initialise. Check its environment configuration.`,
        503,
      );
    }
  }

  // ============================================
  // CURRENCY RESOLUTION
  // ============================================

  private async resolveCurrency(
    callerCurrency?: string | null,
    businessUnitId?: string | null,
  ): Promise<string> {
    if (callerCurrency && currencyService.tryGetCurrency(callerCurrency)) {
      return callerCurrency.toUpperCase();
    }

    if (callerCurrency) {
      logger.warn(
        `[payments] Caller supplied unknown currency "${callerCurrency}" — falling back to platform default.`,
      );
    }

    let businessUnitCurrency: string | null | undefined;
    if (businessUnitId) {
      try {
        const bu = await this.prisma.businessUnit.findUnique({
          where: { id: businessUnitId },
          select: { currency: true },
        });
        businessUnitCurrency = bu?.currency ?? null;
      } catch (err) {
        logger.warn(
          `[payments] Could not read currency for business unit ${businessUnitId}:`,
          err,
        );
      }
    }

    return currencyService.resolveForBusiness(businessUnitCurrency);
  }

  /**
   * Resolve the FULL currency context for a Payment row.
   *
   * ⚠ When `callerGatewayCurrency` is supplied (i.e. the caller is
   *   `checkoutService.invokeGateway`, which has already resolved a
   *   ChargeContext), this method TRUSTS the caller's values for
   *   `gatewayCurrency`, `gatewayAmount`, `exchangeRate`, and
   *   `exchangeRateSource`. It does NOT re-derive them — that would
   *   create a second source of truth and could drift from what the
   *   payer saw on the pre-payment screen.
   *
   * ⚠ When `callerGatewayCurrency` is omitted (POS, admin refunds,
   *   or any direct caller of `processPayment`), the method
   *   resolves the gateway currency itself via
   *   `exchangeRateService`. This is the backwards-compatible path.
   *
   * Behaviour:
   *   • ledgerCurrency — same walk as `resolveCurrency`.
   *   • displayCurrency — passed through if provided and known;
   *     null otherwise. NEVER affects `amount`.
   *   • gatewayCurrency — caller value if supplied & known, else
   *     the ledgerCurrency.
   *   • exchangeRate / exchangeRateSource — caller value if
   *     supplied, else resolved from `exchangeRateService` when
   *     gatewayCurrency differs from ledgerCurrency; else null/null.
   *
   * Never throws on FX failure. The Payment row must always be
   * writable — it's the ledger record.
   */
  private async resolvePaymentCurrencyContext(input: {
    callerCurrency?: string | null;
    businessUnitId?: string | null;
    displayCurrency?: string | null;
    gatewayCurrency?: string | null;
    amount: number;
    gatewayAmount?: number | null;
    /** Caller-supplied rate. Trusted when present. */
    exchangeRate?: number | null;
    /** Caller-supplied rate source. Trusted when present. */
    exchangeRateSource?: string | null;
  }): Promise<PaymentCurrencyContext> {
    const ledgerCurrency = await this.resolveCurrency(
      input.callerCurrency,
      input.businessUnitId,
    );

    // ── displayCurrency ────────────────────────────────────
    let displayCurrency: string | null = null;
    if (input.displayCurrency) {
      const normalized = input.displayCurrency.trim().toUpperCase();
      if (
        normalized &&
        normalized !== ledgerCurrency.toUpperCase() &&
        currencyService.tryGetCurrency(normalized)
      ) {
        displayCurrency = normalized;
      }
    }

    // ── gatewayCurrency ────────────────────────────────────
    let gatewayCurrency = ledgerCurrency;
    if (input.gatewayCurrency) {
      const normalized = input.gatewayCurrency.trim().toUpperCase();
      if (normalized && currencyService.tryGetCurrency(normalized)) {
        gatewayCurrency = normalized;
      }
    }

    // ── gatewayAmount ──────────────────────────────────────
    const gatewayAmount =
      typeof input.gatewayAmount === 'number' &&
      Number.isFinite(input.gatewayAmount)
        ? input.gatewayAmount
        : input.amount;

    // ── exchangeRate + source ──────────────────────────────
    // Caller-supplied values are trusted verbatim. This is the
    // Phase D1 contract — `checkoutService` already resolved them
    // via `chargeCurrencyService` and showed the payer the exact
    // rate before the checkout was allowed to proceed. Re-deriving
    // here would risk a different rate (mid-market drift, override
    // added between the preview and the confirm) than what the
    // payer acknowledged.
    let exchangeRate: number | null = null;
    let exchangeRateSource: string | null = null;

    if (
      typeof input.exchangeRate === 'number' &&
      Number.isFinite(input.exchangeRate) &&
      input.exchangeRate > 0
    ) {
      exchangeRate = input.exchangeRate;
      exchangeRateSource = input.exchangeRateSource ?? null;
    } else if (gatewayCurrency !== ledgerCurrency) {
      try {
        const resolved = await exchangeRateService.getRate(
          ledgerCurrency,
          gatewayCurrency,
        );
        exchangeRate = resolved.rate;
        exchangeRateSource = resolved.source;
      } catch (err) {
        logger.warn(
          `[payments] Could not resolve rate ${ledgerCurrency} → ${gatewayCurrency} ` +
            `for Payment. Row will be written with null rate fields. ` +
            `Reason: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    return {
      ledgerCurrency,
      displayCurrency,
      gatewayCurrency,
      gatewayAmount,
      exchangeRate,
      exchangeRateSource,
    };
  }

  // ============================================
  // CHECKOUT COMPLETION BRIDGE
  // ============================================
  //
  // ⚠ `checkoutService.ts` exposes its singleton as a DEFAULT export
  //   only. The namespace returned by `await import(...)` therefore
  //   has `default` but no named `checkoutService` member. Read the
  //   singleton via `.default` — the two destinations below are the
  //   only dynamic imports of that module in this file.

  async completeCheckoutFromGateway(
    saleId: string,
    paymentId: string,
    gatewayPayload: any,
    gatewayName: string,
  ): Promise<void> {
    if (!saleId) return;
    try {
      // Look up the sale so we can decide whether a status flip
      // is needed. A replay of the same webhook is safe: the
      // status update is idempotent.
      const sale = await this.prisma.sale.findUnique({
        where: { id: saleId },
        select: { id: true, status: true, userId: true, businessUnitId: true },
      });

      if (!sale) {
        logger.warn(
          `[webhook:${gatewayName}] completeCheckoutFromGateway: sale ${saleId} not found`,
        );
        return;
      }

      // COMPLETED is terminal for this path; nothing to do.
      if (sale.status === 'COMPLETED') {
        return;
      }

      await this.prisma.sale.update({
        where: { id: saleId },
        data: {
          status: 'COMPLETED',
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SALE',
          entityId: saleId,
          entityName: `Sale ${saleId}`,
          userId: sale.userId,
          changes: {
            action: 'GATEWAY_PAID',
            gateway: gatewayName,
            paymentId,
            previousStatus: sale.status,
            newStatus: 'COMPLETED',
            payloadSummary:
              typeof gatewayPayload === 'object' && gatewayPayload
                ? Object.keys(gatewayPayload).slice(0, 20)
                : null,
          },
          severity: 'INFO',
          businessUnitId: sale.businessUnitId,
          createdAt: new Date(),
        },
      });

      logger.info(
        `[webhook:${gatewayName}] Sale ${saleId} marked COMPLETED (payment ${paymentId})`,
      );
    } catch (err) {
      logger.error(
        `[webhook:${gatewayName}] completeCheckoutFromGateway failed for sale ${saleId}:`,
        err,
      );
    }
  }

  async failCheckoutFromGateway(
    saleId: string,
    paymentId: string,
    gatewayPayload: any,
    gatewayName: string,
    reason?: string,
  ): Promise<void> {
    if (!saleId) return;
    try {
      const sale = await this.prisma.sale.findUnique({
        where: { id: saleId },
        select: { id: true, status: true, userId: true, businessUnitId: true },
      });

      if (!sale) {
        logger.warn(
          `[webhook:${gatewayName}] failCheckoutFromGateway: sale ${saleId} not found`,
        );
        return;
      }

      // Terminal states: don't overwrite a completed or already
      // cancelled sale. A late FAILED webhook after a SUCCESS
      // must not reverse the sale.
      if (['COMPLETED', 'CANCELLED', 'REFUNDED', 'VOID', 'DELETED'].includes(sale.status)) {
        logger.info(
          `[webhook:${gatewayName}] failCheckoutFromGateway: sale ${saleId} is ${sale.status} — skipping`,
        );
        return;
      }

      await this.prisma.sale.update({
        where: { id: saleId },
        data: {
          status: 'CANCELLED',
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SALE',
          entityId: saleId,
          entityName: `Sale ${saleId}`,
          userId: sale.userId,
          changes: {
            action: 'GATEWAY_FAILED',
            gateway: gatewayName,
            paymentId,
            reason: reason || 'Gateway reported failure',
            previousStatus: sale.status,
            newStatus: 'CANCELLED',
            payloadSummary:
              typeof gatewayPayload === 'object' && gatewayPayload
                ? Object.keys(gatewayPayload).slice(0, 20)
                : null,
          },
          severity: 'HIGH',
          businessUnitId: sale.businessUnitId,
          createdAt: new Date(),
        },
      });

      logger.info(
        `[webhook:${gatewayName}] Sale ${saleId} marked CANCELLED (${reason || 'gateway failure'})`,
      );
    } catch (err) {
      logger.error(
        `[webhook:${gatewayName}] failCheckoutFromGateway failed for sale ${saleId}:`,
        err,
      );
    }
  }

  private async isWebhookProcessed(
    eventId: string,
    eventType: string,
    provider: string,
  ): Promise<boolean> {
    if (!eventId) return false;

    try {
      const existing = await this.prisma.processedWebhook.findUnique({
        where: { eventId },
      });
      if (existing) {
        logger.info(
          `[webhook:${provider}] Event ${eventId} (${eventType}) already processed — skipping`,
        );
        return true;
      }

      await this.prisma.processedWebhook.create({
        data: {
          eventId,
          eventType,
          provider,
        },
      });
      return false;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        logger.info(
          `[webhook:${provider}] Event ${eventId} raced — another worker processed it`,
        );
        return true;
      }
      logger.warn(
        `[webhook:${provider}] ProcessedWebhook check failed for ${eventId}:`,
        err,
      );
      return false;
    }
  }

  // ============================================
  // STRIPE PAYMENT METHODS
  // ============================================

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

      if (!stripeService.isStripeConfigured()) {
        throw new AppError(
          'Card payments are not configured. Please choose a different payment method.',
          503,
        );
      }

      let stripeCustomerId = customerId;
      if (!stripeCustomerId && metadata?.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: metadata.userId },
        });
        if (user) {
          const result = await this.prisma.$queryRaw<
            Array<{ stripeCustomerId: string | null }>
          >`
            SELECT "stripeCustomerId" FROM "users" WHERE "id" = ${metadata.userId}
          `;

          const storedId = result[0]?.stripeCustomerId ?? null;

          if (storedId) {
            const stillExists = await this.stripeCustomerExists(storedId);
            if (stillExists) {
              stripeCustomerId = storedId;
            } else {
              logger.warn(
                `Stale Stripe customer ${storedId} for user ${user.id} — recreating`,
              );
              await this.prisma.$executeRaw`
                UPDATE "users"
                SET "stripeCustomerId" = NULL
                WHERE "id" = ${user.id}
              `;
            }
          }

          if (!stripeCustomerId) {
            const customer = await stripeService.createCustomer(
              user.email,
              `${user.firstName} ${user.lastName}`,
              { userId: user.id, clerkId: user.clerkId },
            );
            stripeCustomerId = customer.id;

            await this.prisma.$executeRaw`
              UPDATE "users"
              SET "stripeCustomerId" = ${stripeCustomerId}
              WHERE "id" = ${user.id}
            `;
          }
        }
      }

      const paymentIntent = await stripeService.createPaymentIntent({
        amount,
        currency,
        customerId: stripeCustomerId,
        description: description || 'Payment',
        metadata: {
          ...metadata,
          platform: 'kalwanga-pos',
        },
        idempotencyKey: params.idempotencyKey,
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

  private async stripeCustomerExists(customerId: string): Promise<boolean> {
    const stripe = stripeService.getClient();
    if (!stripe) return false;

    try {
      await stripe.customers.retrieve(customerId);
      return true;
    } catch (err: any) {
      if (
        err?.code === 'resource_missing' ||
        err?.raw?.code === 'resource_missing' ||
        err?.statusCode === 404
      ) {
        return false;
      }
      throw err;
    }
  }

  async createStripeCustomer(userId: string): Promise<any> {
    try {
      if (!stripeService.isStripeConfigured()) {
        throw new AppError(
          'Card payments are not configured. Please contact support.',
          503,
        );
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) throw new AppError('User not found', 404);

      if (user.stripeCustomerId) {
        return { customerId: user.stripeCustomerId, alreadyExists: true };
      }

      const customer = await stripeService.createCustomer(
        user.email,
        `${user.firstName} ${user.lastName}`,
        { userId: user.id, clerkId: user.clerkId },
      );

      await this.prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      });

      logger.info(`Stripe customer created for user: ${user.id}`);
      return { customerId: customer.id, alreadyExists: false };
    } catch (error) {
      this.handleError(error, 'PaymentService.createStripeCustomer');
      throw error;
    }
  }

  async getCustomerPaymentMethods(userId: string): Promise<any> {
    try {
      if (!stripeService.isStripeConfigured()) {
        return { paymentMethods: [] };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) throw new AppError('User not found', 404);

      if (!user.stripeCustomerId) return { paymentMethods: [] };

      return await stripeService.listCustomerPaymentMethods(
        user.stripeCustomerId,
        'card',
      );
    } catch (error) {
      this.handleError(error, 'PaymentService.getCustomerPaymentMethods');
      throw error;
    }
  }

  async attachPaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<any> {
    try {
      if (!stripeService.isStripeConfigured()) {
        throw new AppError(
          'Card payments are not configured. Please contact support.',
          503,
        );
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) throw new AppError('User not found', 404);
      if (!user.stripeCustomerId) {
        throw new AppError('User has no Stripe customer account', 400);
      }

      const paymentMethod = await stripeService.attachPaymentMethod(
        user.stripeCustomerId,
        paymentMethodId,
      );

      const stripe = stripeService.getClient();
      if (stripe) {
        await stripe.customers.update(user.stripeCustomerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { stripePaymentMethodId: paymentMethodId },
      });

      return paymentMethod;
    } catch (error) {
      this.handleError(error, 'PaymentService.attachPaymentMethod');
      throw error;
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<any> {
    try {
      if (!stripeService.isStripeConfigured()) {
        throw new AppError(
          'Card payments are not configured. Please contact support.',
          503,
        );
      }

      return await stripeService.detachPaymentMethod(paymentMethodId);
    } catch (error) {
      this.handleError(error, 'PaymentService.detachPaymentMethod');
      throw error;
    }
  }

  async createCheckoutSession(
    items: any[],
    customerId?: string,
    successUrl?: string,
    cancelUrl?: string,
    metadata?: Record<string, any>,
  ): Promise<any> {
    try {
      if (!stripeService.isStripeConfigured()) {
        throw new AppError(
          'Card payments are not configured. Please contact support.',
          503,
        );
      }

      if (!items || items.length === 0) {
        throw new AppError('At least one item is required', 400);
      }

      return await stripeService.createCheckoutSession({
        lineItems: items.map((item: any) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          currency: item.currency,
          description: item.description,
        })),
        customerId,
        successUrl:
          successUrl ||
          `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl:
          cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
        metadata,
      });
    } catch (error) {
      this.handleError(error, 'PaymentService.createCheckoutSession');
      throw error;
    }
  }

  // ============================================
  // CORE PAYMENT METHODS
  // ============================================

  async processPayment(data: ProcessPaymentData): Promise<any> {
    try {
      const paymentMethod = String(data.paymentMethod)
        .trim()
        .toUpperCase();

      const {
        amount,
        saleId,
        orderId,
        userId,
        cashRegisterId,
        cashRegisterSessionId,
        gatewayId,
        currency: callerCurrency,
        source,
        customerId,
        metadata = {},
        description,
        tipAmount = 0,
        savePaymentMethod = false,
        businessUnitId,
        cardNonce,
        displayCurrency: displayCurrencyInput,
        gatewayCurrency: gatewayCurrencyInput,
        gatewayAmount: gatewayAmountInput,
        exchangeRate: exchangeRateInput,
        exchangeRateSource: exchangeRateSourceInput,
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

      // ── Full currency context ────────────────────────────
      // When the caller has already resolved a ChargeContext
      // (checkoutService.invokeGateway), the rate fields are
      // trusted verbatim. Otherwise they are resolved here.
      const currencyContext = await this.resolvePaymentCurrencyContext({
        callerCurrency,
        businessUnitId,
        displayCurrency: displayCurrencyInput,
        gatewayCurrency: gatewayCurrencyInput,
        amount: amount + (tipAmount || 0),
        gatewayAmount: gatewayAmountInput,
        exchangeRate: exchangeRateInput,
        exchangeRateSource: exchangeRateSourceInput,
      });

      const currency = currencyContext.ledgerCurrency;

      const idempotencyKey =
        data.idempotencyKey || this.generateIdempotencyKey(data);

      const existingByKey = await this.prisma.payment.findUnique({
        where: { idempotencyKey },
      });
      if (existingByKey) {
        logger.info(
          `[payments] Idempotency hit for key ${idempotencyKey} — returning existing payment ${existingByKey.id}`,
        );
        return {
          ...existingByKey,
          provider: (existingByKey.metadata as any)?.provider,
          providerResponse: (existingByKey.metadata as any)?.providerResponse,
          idempotent: true,
        };
      }

      let paymentResult: any;
      let transactionId: string | undefined;
      let providerName: string | undefined;

      if (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD') {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (!user) {
          throw new AppError('User not found', 404);
        }

        paymentResult = await this.processCardPayment(
          { ...data, paymentMethod },
          user,
          currency,
          idempotencyKey,
        );
        transactionId = paymentResult.id;
        providerName = 'STRIPE';
      } else {
        const handler = this.getProviderHandler(paymentMethod);
        if (!handler) {
          throw new AppError(
            `Unsupported payment method: ${paymentMethod}`,
            400,
          );
        }

        if (!handler.validateConfig()) {
          throw new AppError(
            `Provider ${paymentMethod} is not configured properly`,
            503,
          );
        }

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
          idempotencyKey,
        };

        paymentResult = await handler.processPayment(handlerData);
        transactionId =
          paymentResult.id ||
          paymentResult.transactionId ||
          paymentResult.reference;
        providerName = paymentResult.provider || paymentMethod;
      }

      let resolvedGatewayId: string | null = null;
      const methodNeedsGateway =
        paymentMethod === 'CREDIT_CARD' ||
        paymentMethod === 'DEBIT_CARD' ||
        paymentMethod === 'PAYPAL' ||
        paymentMethod === 'FLUTTERWAVE' ||
        paymentMethod === 'PAYSTACK' ||
        paymentMethod === 'SQUARE';

      if (methodNeedsGateway) {
        if (gatewayId) {
          const gatewayExists =
            await this.prisma.paymentGateway.findUnique({
              where: { id: gatewayId },
              select: { id: true },
            });
          if (gatewayExists) {
            resolvedGatewayId = gatewayExists.id;
          }
        }

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
          } else {
            logger.warn(
              `[payments] No PaymentGateway row found for provider "${providerName}". ` +
                `Payment will be recorded with gatewayId=null. ` +
                `Seed the PaymentGateway table or fix the provider name.`,
            );
          }
        }
      }

      let payment;
      try {
        // ── Write the full currency context ─────────────
        // `amount` is the ledger amount. `gatewayAmount` records
        // what the provider actually charged. If they differ,
        // `exchangeRate` records the rate used. All three are on
        // the row so reconciliation can match the provider's
        // settlement report to the ledger.
        payment = await this.prisma.payment.create({
          data: {
            idempotencyKey,
            amount: amount + (tipAmount || 0),
            currency: currencyContext.ledgerCurrency,
            displayCurrency: currencyContext.displayCurrency,
            gatewayCurrency:
              currencyContext.gatewayCurrency !==
              currencyContext.ledgerCurrency
                ? currencyContext.gatewayCurrency
                : null,
            gatewayAmount:
              currencyContext.gatewayCurrency !==
              currencyContext.ledgerCurrency
                ? currencyContext.gatewayAmount
                : null,
            exchangeRate: currencyContext.exchangeRate,
            exchangeRateSource: currencyContext.exchangeRateSource,
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
              idempotencyKey,
              currency: currencyContext.ledgerCurrency,
              displayCurrency: currencyContext.displayCurrency,
              ...metadata,
            },
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          const winner = await this.prisma.payment.findUnique({
            where: { idempotencyKey },
          });
          if (winner) {
            logger.info(
              `[payments] Idempotency race resolved for key ${idempotencyKey} — returning payment ${winner.id}`,
            );
            return {
              ...winner,
              provider: (winner.metadata as any)?.provider,
              providerResponse: (winner.metadata as any)?.providerResponse,
              idempotent: true,
            };
          }
        }
        throw err;
      }

      if (saleId) {
        await this.updateSaleAfterPayment(
          saleId,
          amount + (tipAmount || 0),
          payment,
        );
      }

      if (orderId) {
        await this.updateOrderAfterPayment(
          orderId,
          amount + (tipAmount || 0),
          payment,
        );
      }

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
            currency: currencyContext.ledgerCurrency,
            displayCurrency: currencyContext.displayCurrency,
            gatewayCurrency: currencyContext.gatewayCurrency,
            exchangeRate: currencyContext.exchangeRate,
          },
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      this.safeEmitPaymentEvent(payment, businessUnitId || '', 'processed');

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

  private mapPaymentStatusToEnum(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      succeeded: PaymentStatus.PAID,
      success: PaymentStatus.PAID,
      completed: PaymentStatus.PAID,
      pending: PaymentStatus.PENDING,
      processing: PaymentStatus.PROCESSING,
      failed: PaymentStatus.FAILED,
      cancelled: PaymentStatus.FAILED,
      refunded: PaymentStatus.REFUNDED,
    };
    return statusMap[status?.toLowerCase()] || PaymentStatus.PENDING;
  }

  private async processCardPayment(
    data: ProcessPaymentData,
    user: any,
    currency: string,
    idempotencyKey: string,
  ): Promise<any> {
    if (!data.source && !data.gatewayId) {
      throw new AppError(
        'Source token or payment method ID required for card payment',
        400,
      );
    }

    if (!stripeService.isStripeConfigured()) {
      throw new AppError(
        'Card payments are not configured. Please contact support.',
        503,
      );
    }

    let stripeCustomerId = (user as any).stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripeService.createCustomer(
        user.email,
        `${user.firstName} ${user.lastName}`,
        { userId: user.id, clerkId: user.clerkId },
      );
      stripeCustomerId = customer.id;

      await this.prisma.$executeRaw`
        UPDATE "users"
        SET "stripeCustomerId" = ${stripeCustomerId}
        WHERE "id" = ${user.id}
      `;
    }

    if (data.savePaymentMethod && data.gatewayId) {
      try {
        await stripeService.attachPaymentMethod(
          stripeCustomerId,
          data.gatewayId,
        );
      } catch (attachError) {
        logger.warn(
          'Failed to attach payment method during processCardPayment:',
          attachError,
        );
      }
    }

    const paymentIntentId = data.gatewayId || data.source;

    const paymentIntent = await stripeService.createPaymentIntent({
      amount: data.amount,
      currency,
      customerId: stripeCustomerId,
      paymentMethodId: paymentIntentId,
      description: data.description,
      confirm: !!paymentIntentId,
      metadata: {
        userId: user.id,
        saleId: data.saleId || '',
        orderId: data.orderId || '',
        ...data.metadata,
      },
      idempotencyKey,
    });

    return paymentIntent;
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  async updateSaleAfterPayment(
    saleId: string,
    amount: number,
    payment: any,
  ): Promise<void> {
    try {
      const sale = await this.prisma.sale.findUnique({
        where: { id: saleId },
        include: { payments: true },
      });

      if (!sale) return;

      const totalPaid = sale.payments.reduce(
        (acc: number, p: any) => acc + p.amount,
        0,
      );
      const status = totalPaid >= sale.total ? 'COMPLETED' : 'PROCESSING';

      await this.prisma.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: totalPaid,
          status: status as any,
        },
      });
    } catch (error) {
      logger.error('Error updating sale after payment:', error);
    }
  }

  async updateOrderAfterPayment(
    orderId: string,
    amount: number,
    payment: any,
  ): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { payment: true },
      });

      if (!order) return;

      const totalPaid = (order.payment?.amount || 0) + amount;
      const status = totalPaid >= order.total ? 'COMPLETED' : 'PROCESSING';

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: status as any,
        },
      });
    } catch (error) {
      logger.error('Error updating order after payment:', error);
    }
  }

  async createPaymentNotification(
    payment: any,
    status: string,
  ): Promise<void> {
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
          title:
            titles[status as keyof typeof titles] || `Payment ${status}`,
          message:
            messages[status as keyof typeof messages] ||
            `Your payment status has been updated to ${status}`,
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
   * Create a `Payment` row in `PENDING` state.
   *
   * Writes the full currency context. Caller may pass
   * `displayCurrency`, `gatewayCurrency`, `gatewayAmount`, and the
   * rate fields explicitly; otherwise they default to null / ledger
   * currency / amount / null.
   */
  async createPendingPayment(data: {
    amount: number;
    paymentMethod: string;
    userId: string;
    transactionId: string;
    reference: string;
    currency?: string;
    displayCurrency?: string | null;
    gatewayCurrency?: string | null;
    gatewayAmount?: number | null;
    exchangeRate?: number | null;
    exchangeRateSource?: string | null;
    saleId?: string;
    orderId?: string;
    businessUnitId?: string;
    metadata?: Record<string, any>;
    idempotencyKey?: string;
  }): Promise<any> {
    const idempotencyKey =
      data.idempotencyKey ||
      `pending_${data.paymentMethod}_${data.transactionId}`;

    const currencyContext = await this.resolvePaymentCurrencyContext({
      callerCurrency: data.currency ?? null,
      businessUnitId: data.businessUnitId ?? null,
      displayCurrency: data.displayCurrency ?? null,
      gatewayCurrency: data.gatewayCurrency ?? null,
      amount: data.amount,
      gatewayAmount: data.gatewayAmount ?? null,
      exchangeRate: data.exchangeRate ?? null,
      exchangeRateSource: data.exchangeRateSource ?? null,
    });

    try {
      return await this.prisma.payment.create({
        data: {
          idempotencyKey,
          amount: data.amount,
          currency: currencyContext.ledgerCurrency,
          displayCurrency: currencyContext.displayCurrency,
          gatewayCurrency:
            currencyContext.gatewayCurrency !==
            currencyContext.ledgerCurrency
              ? currencyContext.gatewayCurrency
              : null,
          gatewayAmount:
            currencyContext.gatewayCurrency !==
            currencyContext.ledgerCurrency
              ? currencyContext.gatewayAmount
              : null,
          exchangeRate: currencyContext.exchangeRate,
          exchangeRateSource: currencyContext.exchangeRateSource,
          paymentMethod: data.paymentMethod as any,
          status: 'PENDING',
          transactionId: data.transactionId,
          reference: data.reference,
          userId: data.userId,
          saleId: data.saleId || null,
          orderId: data.orderId || null,
          businessUnitId: data.businessUnitId || null,
          processedAt: new Date(),
          metadata: {
            ...(data.metadata || {}),
            currency: currencyContext.ledgerCurrency,
            displayCurrency: currencyContext.displayCurrency,
          },
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const existing = await this.prisma.payment.findUnique({
          where: { idempotencyKey },
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

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

  async updatePaymentStatus(
    paymentId: string,
    status: string,
    data?: Record<string, any>,
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
  //
  // ⚠ Phase D1 / D3 — refunds mirror the charge.
  //
  // When a payment was charged in a currency different from the
  // ledger (gatewayCurrency !== currency), the provider's refund
  // API settles in the CHARGE currency, not the ledger currency.
  // The provider also expects the AMOUNT in that currency.
  //
  // This method:
  //   1. Accepts the refund amount in LEDGER currency (that is
  //      what `Payment.refundedAmount` tracks, and what the Sale
  //      bookkeeping uses).
  //   2. Converts it to gatewayCurrency via `exchangeRateService`
  //      so the provider is asked for the right amount.
  //   3. Records BOTH figures on the payment row's `metadata`:
  //        refund.gatewayAmount    — what the provider was asked to refund
  //        refund.gatewayCurrency  — the currency the provider settled in
  //        refund.exchangeRate     — the rate applied
  //        refund.exchangeRateSource
  //   4. Records the LEDGER amount in `refundedAmount` so the
  //      Payment row and the Sale's `paidAmount` stay consistent.
  //
  // Fees and taxes are NOT computed into the refund. The refund is
  // the principal. When D2 is set to a non-zero fee, `feeAmount`
  // on the Payment row will be the only thing that needs to be
  // excluded from a refund — the conversion here is already
  // principal-only because `refundAmountFinal` starts from
  // `payment.amount` (which is the ledger principal, not
  // `payerTotal`).

  async refundPayment(
    paymentIdOrData: string | RefundData,
    amount?: number,
    reason?: string,
    userId?: string,
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

      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
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
            throw new AppError(
              `Payment cannot be refunded. Current status: ${payment.status}`,
              400,
            );
          }

          const refundAmountFinal = refundAmount || payment.amount;

          if (refundAmountFinal <= 0) {
            throw new AppError('Refund amount must be positive', 400);
          }

          if (refundAmountFinal > payment.amount) {
            throw new AppError(
              'Refund amount cannot exceed payment amount',
              400,
            );
          }

          // ── Determine the refund currency + amount ─────────
          // Ledger amount is authoritative for the row.
          // Provider settles in gatewayCurrency (falls back to
          // ledger currency when no conversion was applied).
          const ledgerCurrency = payment.currency;
          const paymentGatewayCurrency =
            (payment as any).gatewayCurrency ?? null;
          const paymentGatewayAmount =
            (payment as any).gatewayAmount ?? null;
          const paymentExchangeRate =
            (payment as any).exchangeRate ?? null;
          const paymentExchangeRateSource =
            (payment as any).exchangeRateSource ?? null;

          const refundCurrency =
            paymentGatewayCurrency || ledgerCurrency;

          const isConverted =
            refundCurrency.toUpperCase() !== ledgerCurrency.toUpperCase();

          // Convert the ledger refund amount to the gateway
          // currency. When the payment was not converted, this is
          // a no-op. When it was, we recompute the refund amount
          // in the gateway currency from the same rate the charge
          // used, so the provider sees a consistent figure.
          let refundGatewayAmount = refundAmountFinal;
          let refundRate = paymentExchangeRate;
          let refundRateSource = paymentExchangeRateSource;

          if (isConverted) {
            // Prefer the exact rate the charge used. This is the
            // rate the payer saw and agreed to. Re-resolving via
            // `exchangeRateService` could produce a different rate
            // (mid-market drift, new override) and would ask the
            // provider for a different amount than the charge.
            if (
              typeof refundRate === 'number' &&
              Number.isFinite(refundRate) &&
              refundRate > 0
            ) {
              const meta = currencyService.getCurrency(refundCurrency);
              const factor = Math.pow(10, meta.decimals);
              refundGatewayAmount =
                Math.round(refundAmountFinal * refundRate * factor) /
                factor;
            } else {
              // No recorded rate — fall back to the current rate.
              // This is the pre-D1 backwards-compat path; the
              // charge was written by an older client that did
              // not populate the rate fields. Log loudly so
              // reconciliation sees it.
              logger.warn(
                `[payments] Payment ${payment.id} was charged in ${refundCurrency} ` +
                  `but has no recorded exchangeRate. Falling back to the current ` +
                  `rate for the refund. The refunded gateway amount may differ ` +
                  `from the originally-charged amount.`,
              );
              try {
                const resolved = await exchangeRateService.getRate(
                  ledgerCurrency,
                  refundCurrency,
                );
                refundRate = resolved.rate;
                refundRateSource = resolved.source;
                const meta = currencyService.getCurrency(refundCurrency);
                const factor = Math.pow(10, meta.decimals);
                refundGatewayAmount =
                  Math.round(refundAmountFinal * refundRate * factor) /
                  factor;
              } catch (err) {
                throw new AppError(
                  `Cannot refund Payment ${payment.id}: it was charged in ${refundCurrency} ` +
                    `but no exchange rate is available to convert the refund from ` +
                    `${ledgerCurrency}. Set a manual override or run the provider sync.`,
                  503,
                );
              }
            }
          } else {
            // Same-currency path — no rate, no source.
            refundRate = null;
            refundRateSource = null;
            refundGatewayAmount = refundAmountFinal;
          }

          // ── Call the provider ──────────────────────────────
          let refundResult: any;

          if (
            payment.paymentMethod === 'CREDIT_CARD' ||
            payment.paymentMethod === 'DEBIT_CARD'
          ) {
            if (!payment.transactionId) {
              throw new AppError(
                'No transaction ID found for refund',
                400,
              );
            }

            if (!stripeService.isStripeConfigured()) {
              throw new AppError(
                'Card payments are not configured. Cannot process refund.',
                503,
              );
            }

            // Stripe expects minor units in the charge currency.
            // Convert major → minor here so zero-decimal and
            // three-decimal currencies work.
            const minorUnits = currencyService.toMinorUnits(
              refundGatewayAmount,
              refundCurrency,
            );

            refundResult = await stripeService.createRefund(
              payment.transactionId,
              minorUnits,
              refundReason,
            );
          } else {
            const handler = this.getProviderHandler(payment.paymentMethod);
            if (handler) {
              const handlerMetadata = {
                ...((payment.metadata as Record<string, any>) || {}),
                ...(metadata || {}),
              };

              refundResult = await handler.refundPayment(
                payment.transactionId || payment.id,
                {
                  amount: refundGatewayAmount,
                  reason: refundReason,
                  currency: refundCurrency,
                  reference: `REF-${payment.id}-${Date.now()}`,
                  metadata: handlerMetadata,
                },
              );
            } else {
              throw new AppError(
                `No handler available for refund of ${payment.paymentMethod}`,
                501,
              );
            }
          }

          // ── Persist the refund bookkeeping ─────────────────
          // `refundedAmount` is the LEDGER amount (it feeds back
          // into the Sale's `paidAmount`). The provider-facing
          // figures are stored on `metadata.refund`.
          const previouslyRefunded = payment.refundedAmount ?? 0;
          const totalRefunded = previouslyRefunded + refundAmountFinal;
          const newStatus =
            totalRefunded >= payment.amount ? 'REFUNDED' : 'PARTIAL';

          const priorRefundMeta =
            ((payment.metadata as any)?.refunds as any[]) ?? [];

          const refundMeta = {
            refundedAt: new Date().toISOString(),
            ledgerAmount: refundAmountFinal,
            ledgerCurrency,
            gatewayAmount: refundGatewayAmount,
            gatewayCurrency: refundCurrency,
            exchangeRate: refundRate,
            exchangeRateSource: refundRateSource,
            reason: refundReason || 'No reason provided',
            providerRefundId:
              refundResult?.id ||
              refundResult?.refundId ||
              refundResult?.transactionId ||
              null,
          };

          const updatedPayment = await tx.payment.update({
            where: { id: paymentId },
            data: {
              status: newStatus as any,
              refundedAmount: totalRefunded,
              refundedAt: new Date(),
              refundReason: refundReason,
              refundedBy: refundUserId,
              notes: `Refunded: ${refundResult.id} - ${
                refundReason || 'No reason provided'
              }`,
              metadata: {
                ...((payment.metadata as any) || {}),
                refunds: [...priorRefundMeta, refundMeta],
              },
            } as any,
          });

          logger.info(
            `Refund processed: ${refundResult.id} ` +
              `(ledger ${refundAmountFinal} ${ledgerCurrency}` +
              (isConverted
                ? ` → gateway ${refundGatewayAmount} ${refundCurrency} @ ${refundRate})`
                : `)`),
          );

          if (payment.saleId && payment.sale) {
            const newPaidAmount = Math.max(
              0,
              payment.sale.paidAmount - refundAmountFinal,
            );
            const saleStatus =
              newPaidAmount <= 0 ? 'REFUNDED' : 'PROCESSING';

            await tx.sale.update({
              where: { id: payment.saleId },
              data: {
                paidAmount: newPaidAmount,
                status: saleStatus as any,
              },
            });
          }

          if (payment.orderId) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: {
                status:
                  newStatus === 'REFUNDED' ? 'REFUNDED' : 'PROCESSING',
              } as any,
            });
          }

          await tx.auditLog.create({
            data: {
              action: 'UPDATE',
              entityType: 'PAYMENT',
              entityId: paymentId,
              entityName: `Payment ${paymentId}`,
              userId: refundUserId || payment.userId,
              changes: {
                action: 'REFUND',
                ledgerAmount: refundAmountFinal,
                ledgerCurrency,
                gatewayAmount: refundGatewayAmount,
                gatewayCurrency: refundCurrency,
                exchangeRate: refundRate,
                exchangeRateSource: refundRateSource,
                previousStatus: payment.status,
                newStatus: newStatus,
                refundId: refundResult.id,
                reason: refundReason || 'No reason provided',
                totalRefunded,
              },
            },
          });

          this.safeEmitPaymentEvent(
            updatedPayment,
            payment.sale?.businessUnitId || '',
            'refunded',
          );

          return {
            refund: refundResult,
            payment: updatedPayment,
            refundedAmount: refundAmountFinal,
            refundedCurrency: ledgerCurrency,
            refundedGatewayAmount: refundGatewayAmount,
            refundedGatewayCurrency: refundCurrency,
            refundRate,
            totalRefunded,
          };
        },
      );
    } catch (error) {
      this.handleError(error, 'PaymentService.refundPayment');
      throw error;
    }
  }

  // ============================================
  // GETTER METHODS
  // ============================================

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

  async getPaymentSummary(params: PaymentFilters): Promise<PaymentSummary> {
    try {
      const {
        startDate,
        endDate,
        businessUnitId,
        status,
        paymentMethod,
        provider,
      } = params;

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

      const payments = await this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          status: true,
        },
      });

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
        byMethod[payment.paymentMethod] =
          (byMethod[payment.paymentMethod] || 0) + payment.amount;
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
      logger.error('Error in getPaymentSummary:', error);
      throw error;
    }
  }

  async getAllPayments(
    params: PaymentFilters & { page?: number; limit?: number },
  ): Promise<any> {
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
  //
  // The `supportedCurrencies` arrays are sourced from the registry
  // via `currencyService.listForProvider(...)` and
  // `currencyService.listAllSettlement()`.

  async getPaymentProviders(
    userId?: string,
    businessUnitId?: string,
  ): Promise<any[]> {
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

      if (providers.length === 0) {
        providers = await this.createDefaultProviders(businessUnitId);
      }

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
              supportedCurrencies: provider.currencies.map(
                (c) => c.currency,
              ),
              supportedMethods: provider.paymentMethods.map(
                (m) => m.code,
              ),
              description:
                provider.paymentMethods[0]?.description || undefined,
              icon: provider.paymentMethods[0]?.icon || undefined,
              minAmount:
                provider.paymentMethods[0]?.minAmount || undefined,
              maxAmount:
                provider.paymentMethods[0]?.maxAmount || undefined,
              feePercentage:
                provider.paymentMethods[0]?.feePercentage || undefined,
              feeFixed: provider.paymentMethods[0]?.feeFixed || undefined,
            },
            settings:
              (provider.settings as Record<string, any>) || undefined,
            order: provider.order,
            createdAt: provider.createdAt,
            updatedAt: provider.updatedAt,
          };
        }),
      );

      return providersWithStats;
    } catch (error) {
      logger.error('Error getting payment providers:', error);
      return this.getDefaultProviders();
    }
  }

  /**
   * Registry-driven currency lists.
   *
   * Every provider's `supportedCurrencies` array is sourced from
   * `lib/currencies.ts`. No hardcoded currency lists anywhere in
   * this file.
   *
   * Mapping:
   *   STRIPE, PAYPAL, FLUTTERWAVE, PAYSTACK, SQUARE, MOBILE_MONEY
   *     → `currencyService.listForProvider(name)` — currencies the
   *       registry says this provider supports, via the `gateways`
   *       array on each registry entry.
   *
   *   CASH, GIFT_CARD, LOYALTY_POINTS
   *     → `currencyService.listAllSettlement()` — ledger-native
   *       providers accept every settlement currency by definition.
   *
   * The returned arrays are sorted for stable output.
   */
  private providerCurrencies(providerCode: string): string[] {
    const code = providerCode.toUpperCase();
    const gatewayBacked = new Set([
      'STRIPE',
      'PAYPAL',
      'FLUTTERWAVE',
      'PAYSTACK',
      'SQUARE',
      'MOBILE_MONEY',
    ]);

    if (gatewayBacked.has(code)) {
      return currencyService.listForProvider(code as any);
    }

    // Cash, Gift Card, Loyalty Points — ledger-native.
    return currencyService.listAllSettlement();
  }

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
          supportedCurrencies: this.providerCurrencies('CASH'),
          supportedMethods: ['CASH'],
          description: 'Pay with cash at the counter',
          icon: '💰',
          feePercentage: 0,
          feeFixed: 0,
        },
        currencies: this.providerCurrencies('CASH'),
        paymentMethods: [
          {
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
          },
        ],
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
          supportedCurrencies: this.providerCurrencies('STRIPE'),
          supportedMethods: ['CREDIT_CARD', 'DEBIT_CARD'],
          description: 'Pay with credit card (Visa, Mastercard, Amex)',
          icon: '💳',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 2.9,
          feeFixed: 0.3,
        },
        currencies: this.providerCurrencies('STRIPE'),
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
            feeFixed: 0.3,
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
            feeFixed: 0.3,
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
          supportedCurrencies: this.providerCurrencies('MOBILE_MONEY'),
          supportedMethods: ['MOBILE_MONEY'],
          description: 'M-Pesa, Tigo Pesa, Airtel Money',
          icon: '📱',
          minAmount: 1,
          maxAmount: 10000,
          feePercentage: 1.5,
          feeFixed: 0.1,
        },
        currencies: this.providerCurrencies('MOBILE_MONEY'),
        paymentMethods: [
          {
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
            feeFixed: 0.1,
            order: 0,
          },
        ],
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
          supportedCurrencies: this.providerCurrencies('BANK_TRANSFER'),
          supportedMethods: ['BANK_TRANSFER'],
          description: 'Direct bank transfer',
          icon: '🏦',
          minAmount: 10,
          maxAmount: 1000000,
          feePercentage: 0,
          feeFixed: 0,
        },
        currencies: this.providerCurrencies('BANK_TRANSFER'),
        paymentMethods: [
          {
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
          },
        ],
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
          supportedCurrencies: this.providerCurrencies('GIFT_CARD'),
          supportedMethods: ['GIFT_CARD'],
          description: 'Redeem your gift card',
          icon: '🎁',
          minAmount: 1,
          maxAmount: 1000,
          feePercentage: 0,
          feeFixed: 0,
        },
        currencies: this.providerCurrencies('GIFT_CARD'),
        paymentMethods: [
          {
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
          },
        ],
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
          supportedCurrencies: this.providerCurrencies('LOYALTY_POINTS'),
          supportedMethods: ['LOYALTY_POINTS'],
          description: 'Pay with your loyalty points',
          icon: '⭐',
          minAmount: 1,
          maxAmount: 1000,
          feePercentage: 0,
          feeFixed: 0,
        },
        currencies: this.providerCurrencies('LOYALTY_POINTS'),
        paymentMethods: [
          {
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
          },
        ],
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
          supportedCurrencies: this.providerCurrencies('PAYPAL'),
          supportedMethods: ['PAYPAL'],
          description: 'Pay with PayPal',
          icon: '💸',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 3.5,
          feeFixed: 0.3,
        },
        currencies: this.providerCurrencies('PAYPAL'),
        paymentMethods: [
          {
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
            feeFixed: 0.3,
            order: 0,
          },
        ],
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
          supportedCurrencies: this.providerCurrencies('FLUTTERWAVE'),
          supportedMethods: ['FLUTTERWAVE'],
          description: 'Pay with Flutterwave',
          icon: '🌊',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 1.9,
          feeFixed: 0.2,
        },
        currencies: this.providerCurrencies('FLUTTERWAVE'),
        paymentMethods: [
          {
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
            feeFixed: 0.2,
            order: 0,
          },
        ],
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
          supportedCurrencies: this.providerCurrencies('PAYSTACK'),
          supportedMethods: ['PAYSTACK'],
          description: 'Pay with Paystack',
          icon: '🔷',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 1.5,
          feeFixed: 0.2,
        },
        currencies: this.providerCurrencies('PAYSTACK'),
        paymentMethods: [
          {
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
            feeFixed: 0.2,
            order: 0,
          },
        ],
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
          supportedCurrencies: this.providerCurrencies('SQUARE'),
          supportedMethods: ['SQUARE'],
          description: 'Pay with Square',
          icon: '⬜',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 2.6,
          feeFixed: 0.3,
        },
        currencies: this.providerCurrencies('SQUARE'),
        paymentMethods: [
          {
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
            feeFixed: 0.3,
            order: 0,
          },
        ],
      },
    ];

    const buKey = businessUnitId ?? null;
    const createdProviders: any[] = [];

    for (const providerData of defaultProviders) {
      const { currencies, paymentMethods, ...providerCreateData } =
        providerData;

      const provider = await this.prisma.paymentProvider.upsert({
        where: {
          provider_businessUnitId: {
            provider: providerCreateData.provider,
            businessUnitId: buKey as any,
          },
        },
        create: {
          ...providerCreateData,
          businessUnitId: buKey || undefined,
          currencies: {
            create: currencies.map((currency: string) => ({
              currency,
              isActive: true,
            })),
          },
          paymentMethods: {
            create: paymentMethods.map((method: any) => ({
              ...method,
              businessUnitId: buKey || undefined,
            })),
          },
        },
        update: {},
        include: {
          currencies: true,
          paymentMethods: true,
        },
      });

      createdProviders.push(provider);
      logger.info(`Ensured provider: ${provider.name} (${provider.code})`);
    }

    return createdProviders;
  }

  async getProviderTransactionStats(providerId: string): Promise<{
    transactions24h: number;
    volume24h: number;
    transactions7d: number;
    volume7d: number;
    transactions30d: number;
    volume30d: number;
  }> {
    const emptyStats = {
      transactions24h: 0,
      volume24h: 0,
      transactions7d: 0,
      volume7d: 0,
      transactions30d: 0,
      volume30d: 0,
    };

    const provider = await this.prisma.paymentProvider.findUnique({
      where: { id: providerId },
      include: {
        paymentMethods: {
          select: { code: true },
        },
      },
    });

    if (!provider || provider.paymentMethods.length === 0) {
      return emptyStats;
    }

    const validEnumValues = Object.values(PaymentMethod);
    const methodCodes = provider.paymentMethods
      .map((m) => m.code)
      .filter((code) => validEnumValues.includes(code as any)) as any[];

    if (methodCodes.length === 0) {
      return emptyStats;
    }

    const now = new Date();
    const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const baseWhere = {
      paymentMethod: { in: methodCodes },
      status: 'PAID' as const,
    };

    const [agg24h, agg7d, agg30d] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { ...baseWhere, processedAt: { gte: start24h } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...baseWhere, processedAt: { gte: start7d } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...baseWhere, processedAt: { gte: start30d } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      transactions24h: agg24h._count._all,
      volume24h: agg24h._sum.amount ?? 0,
      transactions7d: agg7d._count._all,
      volume7d: agg7d._sum.amount ?? 0,
      transactions30d: agg30d._count._all,
      volume30d: agg30d._sum.amount ?? 0,
    };
  }

  getDefaultProviders(): any[] {
    // Same registry-driven lists as createDefaultProviders — this
    // is the in-memory fallback path when the DB read fails.
    const cashCurrencies = this.providerCurrencies('CASH');
    const stripeCurrencies = this.providerCurrencies('STRIPE');
    const mobileMoneyCurrencies = this.providerCurrencies('MOBILE_MONEY');
    const bankCurrencies = this.providerCurrencies('BANK_TRANSFER');
    const giftCurrencies = this.providerCurrencies('GIFT_CARD');
    const loyaltyCurrencies = this.providerCurrencies('LOYALTY_POINTS');
    const paypalCurrencies = this.providerCurrencies('PAYPAL');
    const flutterwaveCurrencies = this.providerCurrencies('FLUTTERWAVE');
    const paystackCurrencies = this.providerCurrencies('PAYSTACK');
    const squareCurrencies = this.providerCurrencies('SQUARE');

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
          supportedCurrencies: cashCurrencies,
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
          supportedCurrencies: stripeCurrencies,
          supportedMethods: ['CREDIT_CARD', 'DEBIT_CARD'],
          description: 'Pay with credit card (Visa, Mastercard, Amex)',
          icon: '💳',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 2.9,
          feeFixed: 0.3,
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
          supportedCurrencies: mobileMoneyCurrencies,
          supportedMethods: ['MOBILE_MONEY'],
          description: 'M-Pesa, Tigo Pesa, Airtel Money',
          icon: '📱',
          minAmount: 1,
          maxAmount: 10000,
          feePercentage: 1.5,
          feeFixed: 0.1,
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
          supportedCurrencies: bankCurrencies,
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
          supportedCurrencies: giftCurrencies,
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
          supportedCurrencies: loyaltyCurrencies,
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
          supportedCurrencies: paypalCurrencies,
          supportedMethods: ['PAYPAL'],
          description: 'Pay with PayPal',
          icon: '💸',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 3.5,
          feeFixed: 0.3,
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
          supportedCurrencies: flutterwaveCurrencies,
          supportedMethods: ['FLUTTERWAVE'],
          description:
            'Pay with Flutterwave (Cards, Mobile Money, Bank Transfer)',
          icon: '🌊',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 1.9,
          feeFixed: 0.2,
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
          supportedCurrencies: paystackCurrencies,
          supportedMethods: ['PAYSTACK'],
          description: 'Pay with Paystack (Cards, Bank Transfer, USSD)',
          icon: '🔷',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 1.5,
          feeFixed: 0.2,
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
          supportedCurrencies: squareCurrencies,
          supportedMethods: ['SQUARE'],
          description: 'Pay with Square (Cards, Digital Wallet)',
          icon: '⬜',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 2.6,
          feeFixed: 0.3,
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

  async getProviderStatus(
    provider: string,
    businessUnitId?: string,
  ): Promise<any> {
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
            supportedCurrencies: [currencyService.getDefault()],
            supportedMethods: [],
          },
        };
      }

      const stats = await this.getProviderTransactionStats(
        providerRecord.id,
      );

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
          supportedCurrencies: providerRecord.currencies.map(
            (c) => c.currency,
          ),
          supportedMethods: providerRecord.paymentMethods.map(
            (m) => m.code,
          ),
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
          supportedCurrencies: [currencyService.getDefault()],
          supportedMethods: [],
        },
      };
    }
  }

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
        throw new AppError(
          `Provider ${provider} already exists for this business unit`,
          400,
        );
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
              isActive:
                method.isActive !== undefined ? method.isActive : true,
              requiresRedirect: method.requiresRedirect || false,
              isInstant:
                method.isInstant !== undefined ? method.isInstant : true,
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

  async updatePaymentProvider(
    id: string,
    data: any,
    userId: string,
  ): Promise<any> {
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
      if (data.isHealthy !== undefined)
        updateData.isHealthy = data.isHealthy;
      if (data.configured !== undefined)
        updateData.configured = data.configured;
      if (data.config !== undefined) updateData.config = data.config;
      if (data.settings !== undefined)
        updateData.settings = data.settings;
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

  async configureProvider(
    id: string,
    config: any,
    settings: any,
    userId: string,
  ): Promise<any> {
    try {
      const existing = await this.prisma.paymentProvider.findUnique({
        where: { id, deletedAt: null },
      });

      if (!existing) {
        throw new AppError('Payment provider not found', 404);
      }

      const updatedConfig = {
        ...((existing.config as any) || {}),
        ...config,
      };

      const updatedSettings = {
        ...((existing.settings as any) || {}),
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

  async addProviderCurrency(
    providerId: string,
    currency: string,
    conversionRate?: number,
    userId?: string,
  ): Promise<any> {
    try {
      const existing = await this.prisma.paymentProvider.findUnique({
        where: { id: providerId, deletedAt: null },
      });

      if (!existing) {
        throw new AppError('Payment provider not found', 404);
      }

      const existingCurrency =
        await this.prisma.paymentProviderCurrency.findUnique({
          where: {
            providerId_currency: {
              providerId,
              currency,
            },
          },
        });

      if (existingCurrency) {
        throw new AppError(
          `Currency ${currency} already exists for this provider`,
          400,
        );
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

  async removeProviderCurrency(
    providerId: string,
    currency: string,
    userId?: string,
  ): Promise<void> {
    try {
      const existing = await this.prisma.paymentProvider.findUnique({
        where: { id: providerId, deletedAt: null },
      });

      if (!existing) {
        throw new AppError('Payment provider not found', 404);
      }

      const currencyRecord =
        await this.prisma.paymentProviderCurrency.findUnique({
          where: {
            providerId_currency: {
              providerId,
              currency,
            },
          },
        });

      if (!currencyRecord) {
        throw new AppError(
          `Currency ${currency} not found for this provider`,
          404,
        );
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

  async updateProviderHealthWithAudit(
    id: string,
    isHealthy: boolean,
    userId: string,
  ): Promise<any> {
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
      this.handleError(
        error,
        'PaymentService.updateProviderHealthWithAudit',
      );
      throw error;
    }
  }

  async updateProviderHealth(
    providerId: string,
    isHealthy: boolean,
  ): Promise<void> {
    try {
      await this.prisma.paymentProvider.update({
        where: { id: providerId },
        data: { isHealthy },
      });
      logger.info(
        `Provider ${providerId} health status updated to ${isHealthy}`,
      );
    } catch (error) {
      this.handleError(error, 'PaymentService.updateProviderHealth');
      throw error;
    }
  }

  async updateProviderStats(options?: {
    batchSize?: number;
    minAgeMs?: number;
    concurrency?: number;
    cursorId?: string;
  }): Promise<{
    processed: number;
    failed: number;
    skipped: number;
    nextCursor: string | null;
    durationMs: number;
  }> {
    const started = Date.now();

    const batchSize = Math.min(
      200,
      Math.max(1, options?.batchSize ?? 50),
    );
    const minAgeMs = Math.max(0, options?.minAgeMs ?? 55_000);
    const concurrency = Math.min(
      16,
      Math.max(1, options?.concurrency ?? 8),
    );

    const staleBefore = new Date(Date.now() - minAgeMs);

    const providers = await this.prisma.paymentProvider.findMany({
      where: {
        deletedAt: null,
        updatedAt: { lt: staleBefore },
        ...(options?.cursorId ? { id: { gt: options.cursorId } } : {}),
      },
      select: {
        id: true,
        paymentMethods: {
          select: { code: true },
        },
      },
      orderBy: { id: 'asc' },
      take: batchSize,
    });

    if (providers.length === 0) {
      return {
        processed: 0,
        failed: 0,
        skipped: 0,
        nextCursor: null,
        durationMs: Date.now() - started,
      };
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    const updateOne = async (provider: {
      id: string;
      paymentMethods: Array<{ code: string }>;
    }): Promise<'processed' | 'failed' | 'skipped'> => {
      try {
        const validEnumValues = new Set<string>(
          Object.values(PaymentMethod) as string[],
        );
        const methodCodes = provider.paymentMethods
          .map((m) => m.code)
          .filter((c): c is string => validEnumValues.has(c)) as any[];

        if (methodCodes.length === 0) {
          await this.prisma.paymentProvider.update({
            where: { id: provider.id },
            data: { updatedAt: new Date() },
          });
          return 'skipped';
        }

        const now = new Date();
        const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const grouped = await this.prisma.payment.groupBy({
          by: ['paymentMethod'],
          where: {
            paymentMethod: { in: methodCodes },
            status: 'PAID',
            processedAt: { gte: start30d },
          },
          _count: { _all: true },
          _sum: { amount: true },
        });

        const recent = await this.prisma.payment.findMany({
          where: {
            paymentMethod: { in: methodCodes },
            status: 'PAID',
            processedAt: { gte: start30d },
          },
          select: {
            amount: true,
            processedAt: true,
          },
        });

        let transactions24h = 0;
        let volume24h = 0;
        let transactions7d = 0;
        let volume7d = 0;
        let transactions30d = 0;
        let volume30d = 0;

        const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        for (const p of recent) {
          const at = p.processedAt?.getTime() ?? 0;
          const amt = p.amount ?? 0;

          transactions30d++;
          volume30d += amt;

          if (at >= start7d.getTime()) {
            transactions7d++;
            volume7d += amt;
          }
          if (at >= start24h.getTime()) {
            transactions24h++;
            volume24h += amt;
          }
        }

        await this.prisma.paymentProvider.update({
          where: { id: provider.id },
          data: {
            transactions24h,
            volume24h,
            transactions7d,
            volume7d,
            transactions30d,
            volume30d,
          },
        });

        void grouped;

        return 'processed';
      } catch (err) {
        logger.error(
          `[payments] updateProviderStats failed for provider ${provider.id}:`,
          err,
        );
        return 'failed';
      }
    };

    for (let i = 0; i < providers.length; i += concurrency) {
      const chunk = providers.slice(i, i + concurrency);
      const outcomes = await Promise.all(chunk.map(updateOne));

      for (const o of outcomes) {
        if (o === 'processed') processed++;
        else if (o === 'failed') failed++;
        else skipped++;
      }
    }

    const lastProvider = providers[providers.length - 1];

    return {
      processed,
      failed,
      skipped,
      nextCursor:
        providers.length === batchSize && lastProvider
          ? lastProvider.id
          : null,
      durationMs: Date.now() - started,
    };
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  async handleWebhook(payload: any, signature: string): Promise<any> {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new AppError('Webhook secret not configured', 500);
      }

      if (!stripeService.isStripeConfigured()) {
        throw new AppError(
          'Stripe is not configured. Cannot process webhook.',
          503,
        );
      }

      let event: Stripe.Event;
      try {
        event = stripeService.verifyWebhookSignature(
          payload,
          signature,
          webhookSecret,
        );
      } catch (err: any) {
        logger.error(
          `Webhook signature verification failed: ${err.message}`,
        );
        throw new AppError('Invalid webhook signature', 400);
      }

      logger.info(
        `Stripe webhook received: ${event.type} (${event.id})`,
      );

      const alreadyProcessed = await this.isWebhookProcessed(
        event.id,
        event.type,
        'STRIPE',
      );
      if (alreadyProcessed) {
        return {
          received: true,
          event: event.type,
          processed: true,
          duplicate: true,
        };
      }

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
          result = await this.handleCheckoutSessionCompleted(
            event.data.object,
          );
          break;
        case 'checkout.session.expired':
          result = await this.handleCheckoutSessionExpired(
            event.data.object,
          );
          break;
        case 'invoice.paid':
          result = await this.handleInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          result = await this.handleInvoicePaymentFailed(
            event.data.object,
          );
          break;
        case 'charge.succeeded':
          result = await this.handleChargeSucceeded(event.data.object);
          break;
        case 'charge.failed':
          result = await this.handleChargeFailed(event.data.object);
          break;
        case 'payment_method.attached':
          result = await this.handlePaymentMethodAttached(
            event.data.object,
          );
          break;
        case 'payment_method.detached':
          result = await this.handlePaymentMethodDetached(
            event.data.object,
          );
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
            processed: true,
          },
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      return {
        received: true,
        event: event.type,
        processed: true,
        result,
      };
    } catch (error) {
      logger.error('Webhook processing error:', error);
      throw error;
    }
  }

  // ============================================
  // PROVIDER-SPECIFIC WEBHOOK HANDLERS
  // ============================================

  async handlePayPalWebhook(
    payload: any,
    headers: Record<string, string>,
  ): Promise<any> {
    const paypalHandler = this.getProviderHandler(
      'PAYPAL',
    ) as PayPalProviderHandler;
    if (!paypalHandler) {
      throw new AppError('PayPal provider not available', 503);
    }

    const eventId =
      payload?.id || payload?.event_id || payload?.resource?.id || '';
    const eventType = payload?.event_type || 'unknown';
    if (eventId) {
      const already = await this.isWebhookProcessed(
        eventId,
        eventType,
        'PAYPAL',
      );
      if (already) {
        return {
          received: true,
          event: eventType,
          processed: true,
          duplicate: true,
        };
      }
    }

    const result = await paypalHandler.handleWebhook(payload, headers);

    let saleId =
      payload?.resource?.custom_id ||
      payload?.resource?.purchase_units?.[0]?.custom_id ||
      payload?.resource?.purchase_units?.[0]?.reference_id ||
      payload?.resource?.supplementary_data?.related_ids?.order_id ||
      payload?.resource?.invoice_id ||
      '';

    if (!saleId) {
      saleId = await this.resolveSaleIdFromPaymentReference(
        payload?.resource?.id ||
          payload?.resource?.supplementary_data?.related_ids?.order_id,
      );
    }

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      await this.handlePayPalPaymentCompleted(payload, saleId);
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED') {
      await this.handlePayPalPaymentFailed(payload, saleId);
    } else if (
      eventType === 'PAYMENT.CAPTURE.REFUNDED' ||
      eventType === 'PAYMENT.CAPTURE.REVERSED'
    ) {
      await this.handlePayPalPaymentRefunded(payload, saleId);
    }

    return result;
  }

  async handleFlutterwaveWebhook(
    payload: any,
    signature: string,
    rawBody?: Buffer | string,
  ): Promise<any> {
    const flutterwaveHandler = this.getProviderHandler(
      'FLUTTERWAVE',
    ) as FlutterwaveProviderHandler;
    if (!flutterwaveHandler) {
      throw new AppError('Flutterwave provider not available', 503);
    }

    const eventId =
      payload?.id ||
      payload?.data?.id ||
      payload?.txRef ||
      payload?.data?.tx_ref ||
      '';
    const eventType =
      payload?.event ||
      payload?.eventType ||
      payload?.data?.status ||
      'unknown';
    if (eventId) {
      const already = await this.isWebhookProcessed(
        String(eventId),
        eventType,
        'FLUTTERWAVE',
      );
      if (already) {
        return {
          received: true,
          event: eventType,
          processed: true,
          duplicate: true,
        };
      }
    }

    const result = await flutterwaveHandler.handleWebhook(
      payload,
      signature,
      rawBody,
    );

    let saleId =
      payload?.data?.meta?.saleId ||
      payload?.meta?.saleId ||
      payload?.data?.tx_ref ||
      payload?.tx_ref ||
      '';

    if (!saleId) {
      saleId = await this.resolveSaleIdFromPaymentReference(
        payload?.data?.tx_ref || payload?.data?.id,
      );
    }

    const status = String(
      payload?.data?.status || payload?.status || '',
    ).toLowerCase();

    if (saleId && (status === 'successful' || status === 'success')) {
      await this.completeCheckoutFromGateway(
        saleId,
        '',
        payload,
        'FLUTTERWAVE',
      );
    } else if (saleId && (status === 'failed' || status === 'cancelled')) {
      await this.failCheckoutFromGateway(
        saleId,
        '',
        payload,
        'FLUTTERWAVE',
        status,
      );
    }

    return result;
  }

  async handleSquareWebhook(
    payload: any,
    signature: string,
    rawBody?: Buffer | string,
    notificationUrl?: string,
  ): Promise<any> {
    const squareHandler = this.getProviderHandler(
      'SQUARE',
    ) as SquareProviderHandler;
    if (!squareHandler) {
      throw new AppError('Square provider not available', 503);
    }

    const eventId = payload?.event_id || payload?.id || '';
    const eventType = payload?.type || 'unknown';
    if (eventId) {
      const already = await this.isWebhookProcessed(
        eventId,
        eventType,
        'SQUARE',
      );
      if (already) {
        return {
          received: true,
          event: eventType,
          processed: true,
          duplicate: true,
        };
      }
    }

    const result = await squareHandler.handleWebhook(
      payload,
      signature,
      rawBody,
      notificationUrl,
    );

    let saleId =
      payload?.data?.object?.payment?.metadata?.saleId ||
      payload?.data?.object?.payment?.order_id ||
      '';

    if (!saleId) {
      saleId = await this.resolveSaleIdFromPaymentReference(
        payload?.data?.object?.payment?.id,
      );
    }

    const status = String(
      payload?.data?.object?.payment?.status || '',
    ).toUpperCase();

    if (saleId && status === 'COMPLETED') {
      await this.completeCheckoutFromGateway(
        saleId,
        '',
        payload,
        'SQUARE',
      );
    } else if (
      saleId &&
      (status === 'FAILED' || status === 'CANCELED')
    ) {
      await this.failCheckoutFromGateway(
        saleId,
        '',
        payload,
        'SQUARE',
        status,
      );
    }

    return result;
  }

  async capturePayPalOrder(orderId: string): Promise<any> {
    const paypalHandler = this.getProviderHandler(
      'PAYPAL',
    ) as PayPalProviderHandler;
    if (!paypalHandler) {
      throw new AppError('PayPal provider not available', 503);
    }
    return await paypalHandler.captureOrder(orderId);
  }

  async createFlutterwaveVirtualAccount(data: {
    email: string;
    amount?: number;
    currency?: string;
    customerName?: string;
  }): Promise<any> {
    const flutterwaveHandler = this.getProviderHandler(
      'FLUTTERWAVE',
    ) as FlutterwaveProviderHandler;
    if (!flutterwaveHandler) {
      throw new AppError('Flutterwave provider not available', 503);
    }
    return await flutterwaveHandler.createVirtualAccount(data);
  }

  async createSquareCustomer(data: {
    email: string;
    name: string;
    phone?: string;
  }): Promise<any> {
    const squareHandler = this.getProviderHandler(
      'SQUARE',
    ) as SquareProviderHandler;
    if (!squareHandler) {
      throw new AppError('Square provider not available', 503);
    }
    return await squareHandler.createCustomer(data);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async resolveSaleIdFromPaymentReference(
    reference?: string,
  ): Promise<string> {
    if (!reference) return '';
    try {
      const payment = await this.prisma.payment.findFirst({
        where: {
          OR: [
            { transactionId: reference },
            { reference: reference },
          ],
        },
        select: { saleId: true },
      });
      return payment?.saleId ?? '';
    } catch (err) {
      logger.warn(
        `resolveSaleIdFromPaymentReference failed for ${reference}:`,
        err,
      );
      return '';
    }
  }

  private generateIdempotencyKey(data: ProcessPaymentData): string {
    const components = [
      data.userId,
      data.amount,
      data.paymentMethod,
      data.saleId || '',
      data.orderId || '',
      data.customerId || '',
      data.idempotencyKey || '',
    ];
    return `pay_${crypto
      .createHash('sha256')
      .update(components.join('_'))
      .digest('hex')
      .slice(0, 32)}`;
  }

  private safeEmitPaymentEvent(
    payment: any,
    businessUnitId: string,
    eventType: string,
  ): void {
    try {
      logger.info(
        `💳 Payment ${eventType}: ${payment?.id || 'unknown'} - ${businessUnitId}`,
      );
    } catch (error) {
      logger.warn('Failed to emit payment event:', error);
    }
  }

  // ============================================
  // PAYPAL WEBHOOK SIDE EFFECTS
  // ============================================

  private async handlePayPalPaymentCompleted(
    payload: any,
    saleId: string,
  ): Promise<void> {
    try {
      const capture = payload?.resource;
      const captureId = capture?.id || '';
      const orderId =
        capture?.supplementary_data?.related_ids?.order_id ||
        capture?.id ||
        '';
      const amount = parseFloat(capture?.amount?.value || '0');
      const currency = capture?.amount?.currency_code || 'USD';

      const payment = await this.prisma.payment.findFirst({
        where: {
          OR: [
            { transactionId: orderId },
            { transactionId: captureId },
            { reference: orderId },
          ],
        },
        include: {
          sale: { include: { customer: true, items: true } },
          order: true,
          user: true,
        },
      });

      if (!payment) {
        logger.warn(
          `[paypal:webhook] No local Payment found for order ${orderId} / capture ${captureId}`,
        );
        return;
      }

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          transactionId: captureId || payment.transactionId,
          processedAt: new Date(),
          metadata: {
            ...((payment.metadata as any) || {}),
            paypalCapture: capture,
            paypalOrderId: orderId,
            paypalCaptureId: captureId,
            paypalAmount: amount,
            paypalCurrency: currency,
          },
        },
      });

      if (payment.sale) {
        await this.updateSaleAfterPayment(
          payment.sale.id,
          payment.amount,
          payment,
        );
        await this.createReceipt(payment.sale);
        await this.updateInventoryAfterSale(payment.sale.id);

        if (payment.sale.customerId) {
          await this.updateCustomerLoyaltyPoints(
            payment.sale.customerId,
            payment.amount,
          );
        }
      }

      if (payment.order) {
        await this.updateOrderAfterPayment(
          payment.order.id,
          payment.amount,
          payment,
        );
      }

      await this.createPaymentNotification(payment, 'succeeded');

      if (saleId) {
        await this.completeCheckoutFromGateway(
          saleId,
          payment.id,
          payload,
          'PAYPAL',
        );
      }
    } catch (err) {
      logger.error(
        '[paypal:webhook] handlePayPalPaymentCompleted failed:',
        err,
      );
    }
  }

  private async handlePayPalPaymentFailed(
    payload: any,
    saleId: string,
  ): Promise<void> {
    try {
      const capture = payload?.resource;
      const orderId =
        capture?.supplementary_data?.related_ids?.order_id ||
        capture?.id ||
        '';
      const reason =
        capture?.status_details?.reason || 'PayPal capture denied';

      const payment = await this.prisma.payment.findFirst({
        where: {
          OR: [{ transactionId: orderId }],
        },
        include: { user: true, sale: true },
      });

      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            notes: `PayPal failed: ${reason}`,
            metadata: {
              ...((payment.metadata as any) || {}),
              paypalFailure: capture,
            },
          },
        });

        await this.createPaymentNotification(payment, 'failed');
      }

      if (saleId) {
        await this.failCheckoutFromGateway(
          saleId,
          payment?.id || '',
          payload,
          'PAYPAL',
          reason,
        );
      }
    } catch (err) {
      logger.error(
        '[paypal:webhook] handlePayPalPaymentFailed failed:',
        err,
      );
    }
  }

  private async handlePayPalPaymentRefunded(
    payload: any,
    saleId: string,
  ): Promise<void> {
    try {
      const refund = payload?.resource;
      const refundId = refund?.id || '';
      const amount = parseFloat(refund?.amount?.value || '0');
      const orderId =
        refund?.supplementary_data?.related_ids?.order_id ||
        refund?.id ||
        '';

      const payment = await this.prisma.payment.findFirst({
        where: {
          OR: [
            { transactionId: orderId },
            { transactionId: refundId },
          ],
        },
        include: { sale: true, user: true },
      });

      if (!payment) {
        logger.warn(
          `[paypal:webhook] No local Payment for refund ${refundId} / order ${orderId}`,
        );
        return;
      }

      const previouslyRefunded =
        ((payment as any).refundedAmount as number | null) ?? 0;
      const totalRefunded = previouslyRefunded + amount;
      const newStatus =
        totalRefunded >= payment.amount ? 'REFUNDED' : 'PARTIAL';

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus as any,
          refundedAmount: totalRefunded,
          refundedAt: new Date(),
          notes: `PayPal refunded: ${refundId}`,
          metadata: {
            ...((payment.metadata as any) || {}),
            paypalRefund: refund,
          },
        },
      });

      if (payment.saleId && payment.sale) {
        const newPaidAmount = Math.max(
          0,
          payment.sale.paidAmount - amount,
        );
        await this.prisma.sale.update({
          where: { id: payment.saleId },
          data: {
            paidAmount: newPaidAmount,
            status: newPaidAmount <= 0 ? 'REFUNDED' : 'PROCESSING',
          },
        });
        await this.restoreInventoryAfterRefund(payment.saleId);
      }

      await this.createPaymentNotification(payment, 'refunded');
      await this.sendRefundEmail(payment);
    } catch (err) {
      logger.error(
        '[paypal:webhook] handlePayPalPaymentRefunded failed:',
        err,
      );
    }
  }

  // ============================================
  // WEBHOOK EVENT HANDLERS (STRIPE)
  // ============================================

  private async handlePaymentSuccess(paymentIntent: any): Promise<any> {
    try {
      const { id, amount, currency, metadata, customer, payment_method } =
        paymentIntent;

      logger.info(
        `Processing payment success: ${id} (${amount} ${currency})`,
      );

      const claimed = await this.prisma.payment.updateMany({
        where: {
          transactionId: id,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
        data: {
          status: 'PAID',
          processedAt: new Date(),
        },
      });

      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: id },
        include: {
          sale: { include: { customer: true, items: true } },
          order: true,
          user: true,
        },
      });

      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            metadata: {
              ...((payment.metadata as any) || {}),
              stripeCustomerId: customer || null,
              stripePaymentMethodId: payment_method || null,
            },
          },
        });
      }

      if (claimed.count > 0 && payment) {
        if (payment.sale) {
          await this.updateSaleAfterPayment(
            payment.sale.id,
            payment.amount,
            payment,
          );
          await this.createReceipt(payment.sale);
          await this.updateInventoryAfterSale(payment.sale.id);

          if (payment.sale.customerId) {
            await this.updateCustomerLoyaltyPoints(
              payment.sale.customerId,
              payment.amount,
            );
          }
        }

        if (payment.order) {
          await this.updateOrderAfterPayment(
            payment.order.id,
            payment.amount,
            payment,
          );
        }

        await this.createPaymentNotification(payment, 'succeeded');

        if (metadata?.cartId) {
          await this.clearCart(String(metadata.cartId));
        }
      }

      if (metadata?.saleId) {
        await this.completeCheckoutFromGateway(
          String(metadata.saleId),
          String(metadata.paymentId ?? payment?.id ?? ''),
          paymentIntent,
          'STRIPE',
        );
      }

      return {
        success: true,
        paymentId: payment?.id || id,
        status: 'PAID',
        duplicate: claimed.count === 0,
      };
    } catch (error) {
      logger.error('Error handling payment success:', error);
      throw error;
    }
  }

  private async handlePaymentFailed(paymentIntent: any): Promise<any> {
    try {
      const { id, last_payment_error, metadata } = paymentIntent;

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
            notes: `Failed: ${
              last_payment_error?.message || 'Unknown error'
            }`,
          },
        });

        await this.createPaymentNotification(payment, 'failed');

        if (payment.user) {
          await this.sendPaymentFailureNotification(
            payment.user,
            payment,
          );
        }
      }

      const saleId =
        metadata?.saleId || payment?.saleId || payment?.sale?.id || '';
      if (saleId) {
        await this.failCheckoutFromGateway(
          String(saleId),
          String(metadata?.paymentId ?? payment?.id ?? ''),
          paymentIntent,
          'STRIPE',
          last_payment_error?.message || 'Payment failed',
        );
      }

      return {
        success: true,
        paymentId: payment?.id || id,
        status: 'FAILED',
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
      const { id, metadata } = paymentIntent;
      logger.info(`Payment canceled: ${id}`);

      await this.prisma.payment.updateMany({
        where: { transactionId: id },
        data: {
          status: 'FAILED',
          notes: `Payment canceled: ${id}`,
        },
      });

      if (metadata?.saleId) {
        await this.failCheckoutFromGateway(
          String(metadata.saleId),
          String(metadata.paymentId ?? ''),
          paymentIntent,
          'STRIPE',
          'Payment canceled by user',
        );
      }

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
            },
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
          const newPaidAmount = Math.max(
            0,
            payment.sale.paidAmount - refundedAmount,
          );

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
        status: 'REFUNDED',
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

      logger.info(
        `Checkout session completed: ${id} (${payment_intent})`,
      );

      let createdPaymentId: string | null = null;
      let saleId: string | null = metadata?.saleId || null;

      if (payment_intent) {
        const paymentIntent = await stripeService.getPaymentIntent(
          payment_intent,
        );

        const existingPayment = await this.prisma.payment.findFirst({
          where: { transactionId: payment_intent },
        });

        if (!existingPayment) {
          const userId = metadata?.userId;
          if (!userId) {
            logger.warn(
              `Checkout session ${id} has no userId — skipping Payment creation`,
            );
            return {
              success: true,
              status: 'COMPLETED',
              skipped: true,
            };
          }

          // Full currency context for the webhook path. The BU
          // id from metadata resolves the ledger; displayCurrency
          // comes from metadata (set by the checkout flow).
          // Gateway charged in whatever Stripe actually returned
          // as `paymentIntent.currency`.
          const currencyContext = await this.resolvePaymentCurrencyContext({
            callerCurrency: paymentIntent.currency,
            businessUnitId: metadata?.businessUnitId ?? null,
            displayCurrency: metadata?.displayCurrency ?? null,
            gatewayCurrency: paymentIntent.currency,
            amount: paymentIntent.amount / 100,
          });

          const newPayment = await this.prisma.payment.create({
            data: {
              amount: paymentIntent.amount / 100,
              currency: currencyContext.ledgerCurrency,
              displayCurrency: currencyContext.displayCurrency,
              gatewayCurrency:
                currencyContext.gatewayCurrency !==
                currencyContext.ledgerCurrency
                  ? currencyContext.gatewayCurrency
                  : null,
              gatewayAmount:
                currencyContext.gatewayCurrency !==
                currencyContext.ledgerCurrency
                  ? currencyContext.gatewayAmount
                  : null,
              exchangeRate: currencyContext.exchangeRate,
              exchangeRateSource: currencyContext.exchangeRateSource,
              paymentMethod: 'CREDIT_CARD',
              status: 'PAID',
              transactionId: payment_intent,
              reference: payment_intent,
              userId,
              saleId: metadata?.saleId || null,
              orderId: metadata?.orderId || null,
              processedAt: new Date(),
              notes: `Checkout session: ${id}`,
              metadata: {
                sessionId: id,
                stripeCustomerId: customer || null,
                currency: currencyContext.ledgerCurrency,
                displayCurrency: currencyContext.displayCurrency,
              },
            },
          });
          createdPaymentId = newPayment.id;

          if (newPayment.saleId) {
            await this.updateSaleAfterPayment(
              newPayment.saleId,
              newPayment.amount,
              newPayment,
            );
          }
          if (newPayment.orderId) {
            await this.updateOrderAfterPayment(
              newPayment.orderId,
              newPayment.amount,
              newPayment,
            );
          }
        } else {
          createdPaymentId = existingPayment.id;
          if (!saleId && existingPayment.saleId) {
            saleId = existingPayment.saleId;
          }
        }
      }

      if (saleId) {
        await this.completeCheckoutFromGateway(
          saleId,
          createdPaymentId || '',
          session,
          'STRIPE',
        );
      }

      return { success: true, status: 'COMPLETED' };
    } catch (error) {
      logger.error(
        'Error handling checkout session completed:',
        error,
      );
      throw error;
    }
  }

  private async handleCheckoutSessionExpired(session: any): Promise<any> {
    try {
      const { id, metadata } = session;
      logger.info(`Checkout session expired: ${id}`);

      if (metadata?.saleId) {
        await this.failCheckoutFromGateway(
          String(metadata.saleId),
          String(metadata.paymentId ?? ''),
          session,
          'STRIPE',
          'Checkout session expired',
        );
      }

      return { success: true };
    } catch (error) {
      logger.error(
        'Error handling checkout session expired:',
        error,
      );
      throw error;
    }
  }

  private async handleInvoicePaid(invoice: any): Promise<any> {
    try {
      const { id, customer, amount_paid, metadata } = invoice;
      logger.info(`Invoice paid: ${id} - ${amount_paid}`);

      const companyId = metadata?.companyId;
      const userId = metadata?.userId;

      if (!companyId || !userId) {
        logger.warn(
          `Invoice ${id} ignored — missing metadata.companyId or metadata.userId. ` +
            `Verify the Stripe subscription metadata carries these keys.`,
        );
        return { success: true, ignored: true };
      }

      let customerId: string | null = null;

      if (customer) {
        const user = await this.prisma.user.findFirst({
          where: { stripeCustomerId: customer },
          select: { id: true, companyId: true },
        });

        if (user) {
          const scoped = await this.prisma.customer.findFirst({
            where: {
              companyId: user.companyId ?? companyId,
              email: (invoice.customer_email as string | undefined) ?? undefined,
            },
            select: { id: true },
          });

          if (scoped) {
            customerId = scoped.id;
          } else {
            const anyForCompany = await this.prisma.customer.findFirst({
              where: { companyId: user.companyId ?? companyId },
              select: { id: true },
              orderBy: { createdAt: 'desc' },
            });
            customerId = anyForCompany?.id ?? null;
          }
        }
      }

      if (!customerId) {
        logger.warn(
          `Invoice ${id} ignored — no local Customer resolvable from ` +
            `Stripe customer ${customer}. Check that the user's ` +
            `stripeCustomerId is populated and that a Customer row ` +
            `exists in the same company.`,
        );
        return { success: true, ignored: true };
      }

      await this.prisma.invoice.create({
        data: {
          invoiceNumber: `INV-${Date.now()}`,
          total: amount_paid / 100,
          subtotal: amount_paid / 100,
          status: 'PAID',
          paidAmount: amount_paid / 100,
          paidAt: new Date(),
          customerId,
          notes: `Stripe invoice: ${id}`,
          userId,
          companyId,
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
      logger.error(
        'Error handling invoice payment failed:',
        error,
      );
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

  private async handlePaymentMethodAttached(
    paymentMethod: any,
  ): Promise<any> {
    logger.info(`Payment method attached: ${paymentMethod.id}`);
    return { success: true };
  }

  private async handlePaymentMethodDetached(
    paymentMethod: any,
  ): Promise<any> {
    logger.info(`Payment method detached: ${paymentMethod.id}`);
    return { success: true };
  }

  private async handleCustomerCreated(customer: any): Promise<any> {
    logger.info(
      `Stripe customer created: ${customer.id} (${customer.email})`,
    );
    if (customer.email) {
      try {
        await this.prisma.user.updateMany({
          where: { email: customer.email },
          data: { stripeCustomerId: customer.id },
        });
      } catch (err) {
        logger.warn(
          'Could not link stripeCustomerId (user or column missing):',
          err,
        );
      }
    }
    return { success: true };
  }

  private async handleCustomerUpdated(customer: any): Promise<any> {
    logger.info(`Stripe customer updated: ${customer.id}`);
    return { success: true };
  }

  private async handleCustomerDeleted(customer: any): Promise<any> {
    logger.info(`Stripe customer deleted: ${customer.id}`);
    try {
      await this.prisma.user.updateMany({
        where: { stripeCustomerId: customer.id },
        data: { stripeCustomerId: null, stripePaymentMethodId: null },
      });
    } catch (err) {
      logger.warn('Could not clear stripeCustomerId:', err);
    }
    return { success: true };
  }

  private async handleUnhandledEvent(event: any): Promise<any> {
    try {
      const eventType: string = event?.type ?? 'unknown';

      const NOISY_EVENT_PATTERNS: RegExp[] = [
        /^invoice\.created$/,
        /^invoice\.finalized$/,
        /^invoice\.updated$/,
        /^invoice\.payment_succeeded$/,
        /^customer\.created$/,
        /^customer\.updated$/,
        /^customer\.source\./,
        /^customer\.subscription\./,
        /^payment_method\./,
        /^setup_intent\./,
        /^mandate\./,
        /^radar\./,
        /^terminal\./,
        /^issuing_/,
        /^billing_portal\./,
        /^checkout\.session\.(?!completed|expired)/,
        /^charge\.(?!succeeded|failed|refunded|dispute)/,
        /^payment_intent\.(?!succeeded|payment_failed|processing|canceled)/,
      ];

      if (NOISY_EVENT_PATTERNS.some((re) => re.test(eventType))) {
        logger.debug(
          `[webhook] Ignoring noisy Stripe event: ${eventType} (${event.id})`,
        );
        return { success: true, ignored: true, eventType };
      }

      logger.warn(
        `[webhook] Unhandled Stripe event: ${eventType} (${event.id})`,
      );

      const dayBucket = new Date().toISOString().slice(0, 10);
      const dedupeKey = `unhandled_webhook:${eventType}:${dayBucket}`;

      const existing = await this.prisma.notification.findFirst({
        where: {
          type: 'SYSTEM',
          link: dedupeKey,
        },
        select: { id: true },
      });

      if (existing) {
        logger.debug(
          `[webhook] Already notified for ${eventType} today — skipping`,
        );
        return { success: true, unhandled: true, deduped: true, eventType };
      }

      const admins = await this.prisma.user.findMany({
        where: {
          role: { in: ['SUPER_ADMIN', 'ADMIN'] },
          isActive: true,
        },
        select: { id: true },
        take: 50,
      });

      if (admins.length === 0) {
        logger.warn(
          `[webhook] No active admins to notify about ${eventType}`,
        );
      } else {
        await this.prisma.notification.createMany({
          data: admins.map((admin) => ({
            title: `Unhandled Stripe event: ${eventType}`,
            message:
              `A Stripe webhook of type "${eventType}" was received ` +
              `but has no dedicated handler. Review the event ` +
              `payload and either add a handler or add the type ` +
              `to the ignore list in paymentService.handleUnhandledEvent.`,
            type: 'SYSTEM' as const,
            priority: 'MEDIUM' as const,
            userId: admin.id,
            link: dedupeKey,
            createdAt: new Date(),
          })),
          skipDuplicates: true,
        });
      }

      return { success: true, unhandled: true, eventType };
    } catch (error) {
      logger.error('Error handling unhandled event:', error);
      return { success: true, unhandled: true, error: true };
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
      const sale = await this.prisma.sale.findUnique({
        where: { id: saleId },
        select: { businessUnitId: true },
      });
      if (!sale) {
        logger.warn(
          `[inventory] updateInventoryAfterSale: sale ${saleId} not found`,
        );
        return;
      }

      const saleItems = await this.prisma.saleItem.findMany({
        where: { saleId },
        select: {
          productId: true,
          variantId: true,
          quantity: true,
        },
      });

      for (const item of saleItems) {
        let inventoryId: string | null = null;

        if (item.variantId) {
          const variant = await this.prisma.productVariant.findUnique({
            where: { id: item.variantId },
            select: { inventoryId: true },
          });
          inventoryId = variant?.inventoryId ?? null;
        }

        if (!inventoryId) {
          const product = await this.prisma.product.findUnique({
            where: { id: item.productId },
            select: { inventoryId: true, businessUnitId: true },
          });
          inventoryId = product?.inventoryId ?? null;

          if (!inventoryId && product) {
            const fallback = await this.prisma.inventory.findFirst({
              where: {
                product: { is: { id: item.productId } },
                businessUnitId: sale.businessUnitId,
              },
              select: { id: true },
            });
            inventoryId = fallback?.id ?? null;
          }
        }

        if (!inventoryId) {
          logger.warn(
            `[inventory] No Inventory row for product ${item.productId}` +
              (item.variantId ? ` / variant ${item.variantId}` : '') +
              ` — skipping decrement`,
          );
          continue;
        }

        await this.prisma.$transaction(async (tx) => {
          const current = await tx.inventory.findUnique({
            where: { id: inventoryId! },
            select: { quantity: true, reserved: true },
          });
          if (!current) return;

          const newQuantity = Math.max(
            0,
            current.quantity - item.quantity,
          );
          const newAvailable = newQuantity - current.reserved;

          await tx.inventory.update({
            where: { id: inventoryId! },
            data: {
              quantity: newQuantity,
              available: newAvailable,
            },
          });
        });
      }
    } catch (error) {
      logger.error('Error updating inventory after sale:', error);
    }
  }

  private async restoreInventoryAfterRefund(
    saleId: string,
  ): Promise<void> {
    try {
      const sale = await this.prisma.sale.findUnique({
        where: { id: saleId },
        select: { businessUnitId: true },
      });
      if (!sale) {
        logger.warn(
          `[inventory] restoreInventoryAfterRefund: sale ${saleId} not found`,
        );
        return;
      }

      const saleItems = await this.prisma.saleItem.findMany({
        where: { saleId },
        select: {
          productId: true,
          variantId: true,
          quantity: true,
        },
      });

      for (const item of saleItems) {
        let inventoryId: string | null = null;

        if (item.variantId) {
          const variant = await this.prisma.productVariant.findUnique({
            where: { id: item.variantId },
            select: { inventoryId: true },
          });
          inventoryId = variant?.inventoryId ?? null;
        }

        if (!inventoryId) {
          const product = await this.prisma.product.findUnique({
            where: { id: item.productId },
            select: { inventoryId: true, businessUnitId: true },
          });
          inventoryId = product?.inventoryId ?? null;

          if (!inventoryId && product) {
            const fallback = await this.prisma.inventory.findFirst({
              where: {
                product: { is: { id: item.productId } },
                businessUnitId: sale.businessUnitId,
              },
              select: { id: true },
            });
            inventoryId = fallback?.id ?? null;
          }
        }

        if (!inventoryId) {
          logger.warn(
            `[inventory] No Inventory row to restore for product ${item.productId}` +
              (item.variantId ? ` / variant ${item.variantId}` : ''),
          );
          continue;
        }

        await this.prisma.$transaction(async (tx) => {
          const current = await tx.inventory.findUnique({
            where: { id: inventoryId! },
            select: { quantity: true, reserved: true },
          });
          if (!current) return;

          const newQuantity = current.quantity + item.quantity;
          const newAvailable = newQuantity - current.reserved;

          await tx.inventory.update({
            where: { id: inventoryId! },
            data: {
              quantity: newQuantity,
              available: newAvailable,
            },
          });
        });
      }
    } catch (error) {
      logger.error('Error restoring inventory after refund:', error);
    }
  }

  private async updateCustomerLoyaltyPoints(
    customerId: string,
    amount: number,
  ): Promise<void> {
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
        },
      });
    } catch (error) {
      logger.error('Error clearing cart:', error);
    }
  }

  private async sendPaymentFailureNotification(
    user: any,
    payment: any,
  ): Promise<void> {
    try {
      logger.info(
        `Payment failure notification sent for ${payment.id}`,
      );
    } catch (error) {
      logger.error(
        'Error sending payment failure notification:',
        error,
      );
    }
  }

  private async sendRefundEmail(payment: any): Promise<void> {
    try {
      logger.info(`Refund email sent for ${payment.id}`);
    } catch (error) {
      logger.error('Error sending refund email:', error);
    }
  }

  private async sendInvoicePaymentFailedNotification(
    invoice: any,
  ): Promise<void> {
    try {
      logger.info(
        `Invoice payment failed notification sent for ${invoice.id}`,
      );
    } catch (error) {
      logger.error(
        'Error sending invoice payment failed notification:',
        error,
      );
    }
  }

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

export const paymentService = new PaymentService();
export default paymentService;
