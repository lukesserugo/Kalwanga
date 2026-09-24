// D:\Projects\Kalwanga\packages\backend\src\services\mobileMoneyService.ts

import axios, { AxiosInstance } from 'axios';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import * as crypto from 'crypto';

// ============================================
// INTERFACES
// ============================================

interface MTNConfig {
  apiUserId: string;
  apiKey: string;
  subscriptionKey: string;
  environment: 'sandbox' | 'production';
  baseUrl: string;
  callbackUrl: string;
  merchantCode: string;
  country: 'UG' | 'RW' | 'NG' | 'GH' | 'CM' | 'CI' | 'ZM';
  currency: string;
  apiSecret: string;
}

interface AirtelConfig {
  clientId: string;
  clientSecret: string;
  country: 'TZ' | 'KE' | 'UG' | 'GH' | 'NG' | 'RW' | 'ZM';
  baseUrl: string;
  callbackUrl: string;
  merchantCode: string;
  currency: string;
  apiKey: string;
  apiSecret: string;
}

interface MobileMoneyPaymentRequest {
  phoneNumber: string;
  amount: number;
  currency: string;
  reference: string;
  description?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

interface MobileMoneyPaymentResponse {
  transactionId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSING';
  reference: string;
  message?: string;
  data?: any;
  provider: string;
}

interface MobileMoneyTransactionStatus {
  status: string;
  reference: string;
  isSuccess: boolean;
  amount?: number;
  currency?: string;
  data?: any;
  provider: string;
}

interface MobileMoneyRefundRequest {
  /**
   * The original transaction reference the refund is against.
   * Used to derive the payout reference if `reference` is not supplied.
   */
  originalReference: string;
  /**
   * Amount to refund. If omitted, the provider attempts a full refund
   * (Disbursement API requires an explicit amount, so for mobile money
   * this is effectively required — we throw if it's missing).
   */
  amount?: number;
  currency?: string;
  reason?: string;
  /**
   * Idempotency key for the refund itself. If omitted a fresh one
   * is generated. Callers SHOULD pass a stable value (e.g. the
   * `Refund.id` from the DB) so retries don't double-pay.
   */
  reference?: string;
}

interface MobileMoneyRefundResponse {
  id: string;
  status: 'succeeded' | 'pending' | 'failed';
  amount: number;
  currency: string;
  reference: string;
  provider: string;
  data?: any;
}

// ============================================
// COUNTRY CONFIGURATIONS
// ============================================

const COUNTRY_CONFIGS: Record<
  string,
  { currency: string; countryCode: string; phonePrefix: string; isZeroDecimal: boolean }
> = {
  // MTN Countries
  UG: { currency: 'UGX', countryCode: '256', phonePrefix: '256', isZeroDecimal: true },
  RW: { currency: 'RWF', countryCode: '250', phonePrefix: '250', isZeroDecimal: true },
  NG: { currency: 'NGN', countryCode: '234', phonePrefix: '234', isZeroDecimal: false },
  GH: { currency: 'GHS', countryCode: '233', phonePrefix: '233', isZeroDecimal: false },
  CM: { currency: 'XAF', countryCode: '237', phonePrefix: '237', isZeroDecimal: true },
  CI: { currency: 'XOF', countryCode: '225', phonePrefix: '225', isZeroDecimal: true },
  ZM: { currency: 'ZMW', countryCode: '260', phonePrefix: '260', isZeroDecimal: false },
  // Airtel Countries
  TZ: { currency: 'TZS', countryCode: '255', phonePrefix: '255', isZeroDecimal: true },
  KE: { currency: 'KES', countryCode: '254', phonePrefix: '254', isZeroDecimal: false },
  ZA: { currency: 'ZAR', countryCode: '27', phonePrefix: '27', isZeroDecimal: false },
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

// ============================================
// SHARED HELPERS
// ============================================

/**
 * Validate that an amount is legal for the given currency.
 * Zero-decimal currencies (UGX, RWF, XAF, XOF, TZS) must be integers.
 */
function assertValidAmount(amount: number, currency: string, zeroDecimal: boolean): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('Amount must be a positive number', 400);
  }
  if (zeroDecimal && !Number.isInteger(amount)) {
    throw new AppError(
      `Amount for ${currency} must be an integer (no decimals in zero-decimal currencies)`,
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
 * Extract a short, safe summary of an axios error for logging. Never
 * logs Authorization headers or full request bodies.
 */
function summarizeAxiosError(error: any): string {
  if (error?.response) {
    const status = error.response.status;
    const data = error.response.data;
    const msg =
      (data && (data.message || data.error_description || data.error)) ||
      (typeof data === 'string' ? data.slice(0, 200) : 'provider error');
    return `HTTP ${status}: ${msg}`;
  }
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return 'timeout';
  }
  return error?.message || 'unknown error';
}

// ============================================
// MTN MOBILE MONEY SERVICE
// ============================================

export class MTNMobileMoneyService {
  private static instance: MTNMobileMoneyService;
  private config: MTNConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private isInitialized: boolean = false;
  private http: AxiosInstance;

  private constructor() {
    const country = (process.env.MTN_COUNTRY as MTNConfig['country']) || 'UG';
    const countryConfig = COUNTRY_CONFIGS[country] || COUNTRY_CONFIGS.UG;

    this.config = {
      apiUserId: process.env.MTN_API_USER_ID || '',
      apiKey: process.env.MTN_API_KEY || '',
      subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY || '',
      environment:
        (process.env.MTN_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      baseUrl: process.env.MTN_BASE_URL || 'https://sandbox.momodeveloper.mtn.com',
      callbackUrl:
        process.env.MTN_CALLBACK_URL ||
        'http://localhost:3001/api/mobile-money/mtn/callback',
      merchantCode: process.env.MTN_MERCHANT_CODE || '',
      country,
      currency: countryConfig.currency,
      apiSecret: process.env.MTN_API_SECRET || '',
    };

    this.http = axios.create({
      timeout: DEFAULT_REQUEST_TIMEOUT_MS,
      // Never let axios throw on 4xx — we want to inspect them.
      validateStatus: () => true,
    });

    this.validateConfig();
  }

  public static getInstance(): MTNMobileMoneyService {
    if (!MTNMobileMoneyService.instance) {
      MTNMobileMoneyService.instance = new MTNMobileMoneyService();
    }
    return MTNMobileMoneyService.instance;
  }

  private validateConfig(): void {
    const required: (keyof MTNConfig)[] = ['apiUserId', 'apiKey', 'subscriptionKey'];
    const missing = required.filter((key) => !this.config[key]);

    if (missing.length > 0) {
      logger.warn(`⚠️ Missing MTN configuration: ${missing.join(', ')}`);
      this.isInitialized = false;
    } else {
      this.isInitialized = true;
      logger.info('✅ MTN Mobile Money configured successfully');
      logger.info(
        `   Country: ${this.config.country}, Currency: ${this.config.currency}`,
      );
      logger.info(`   Environment: ${this.config.environment}`);
    }
  }

  isConfigured(): boolean {
    return this.isInitialized;
  }

  private getBaseUrl(): string {
    return this.config.baseUrl;
  }

  private getCountryConfig() {
    return COUNTRY_CONFIGS[this.config.country] || COUNTRY_CONFIGS.UG;
  }

  private formatPhoneNumber(phone: string): string {
    if (!phone) {
      throw new AppError('Phone number is required', 400);
    }
    let cleaned = phone.replace(/\D/g, '');
    const { countryCode } = this.getCountryConfig();

    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.startsWith(countryCode)) {
      cleaned = cleaned.substring(countryCode.length);
    }
    cleaned = countryCode + cleaned;

    // MTN expects MSISDN in E.164 without the leading '+'.
    if (cleaned.length < 11 || cleaned.length > 15) {
      throw new AppError(`Invalid MSISDN: ${phone}`, 400);
    }
    return cleaned;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.accessToken;
    }

    const auth = Buffer.from(
      `${this.config.apiUserId}:${this.config.apiKey}`,
    ).toString('base64');

    const response = await this.http.post(
      `${this.getBaseUrl()}/collection/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.status !== 200 || !response.data?.access_token) {
      logger.error(
        `Failed to get MTN access token: HTTP ${response.status}`,
      );
      throw new AppError('Failed to authenticate with MTN Mobile Money', 502);
    }

    this.accessToken = response.data.access_token as string;
    this.tokenExpiry =
      Date.now() + (response.data.expires_in || 3600) * 1000;
    logger.info('✅ MTN access token obtained');
    return this.accessToken;
  }

  // ============================================
  // PAYMENT (COLLECTION)
  // ============================================

  async initiatePayment(
    request: MobileMoneyPaymentRequest,
  ): Promise<MobileMoneyPaymentResponse> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }

    const countryConfig = this.getCountryConfig();
    const currency = request.currency || this.config.currency;
    assertValidAmount(request.amount, currency, countryConfig.isZeroDecimal);

    const phoneNumber = this.formatPhoneNumber(request.phoneNumber);
    const reference =
      request.reference ||
      crypto.randomUUID(); // MTN requires UUID for X-Reference-Id

    const token = await this.getAccessToken();

    const requestBody = {
      amount: request.amount.toString(),
      currency,
      externalId: reference,
      payer: {
        partyIdType: 'MSISDN',
        partyId: phoneNumber,
      },
      payerMessage: request.description || 'Payment for order',
      payeeNote: request.description || 'Payment for order',
    };

    logger.info(
      `📱 MTN payment: ${phoneNumber} - ${request.amount} ${currency} (ref ${reference})`,
    );

    const response = await this.http.post(
      `${this.getBaseUrl()}/collection/v1_0/requesttopay`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'X-Reference-Id': reference,
          'X-Target-Environment': this.config.environment,
          'Content-Type': 'application/json',
        },
      },
    );

    // MTN returns 202 Accepted with an empty body on success.
    if (response.status !== 202) {
      logger.error(
        `❌ MTN payment failed: HTTP ${response.status} — ${summarizeAxiosError(
          { response },
        )}`,
      );
      throw this.mapMtnError(response.status, response.data);
    }

    logger.info(`✅ MTN payment initiated: ${reference}`);

    return {
      transactionId: reference,
      status: 'PENDING',
      reference,
      message: 'Payment initiated successfully',
      data: { referenceId: reference },
      provider: 'MTN',
    };
  }

  private mapMtnError(status: number, body: any): AppError {
    const detail =
      body?.message || body?.error || body?.error_description || 'MTN error';
    if (status === 400) return new AppError(`Invalid MTN request: ${detail}`, 400);
    if (status === 401) return new AppError('MTN authentication failed', 401);
    if (status === 403) return new AppError('MTN subscription key unauthorized', 403);
    if (status === 404) return new AppError('MTN resource not found', 404);
    if (status === 409) return new AppError(`MTN duplicate reference: ${detail}`, 409);
    if (status === 429) return new AppError('MTN rate limit exceeded', 429);
    if (status >= 500) return new AppError(`MTN upstream error: ${detail}`, 502);
    return new AppError(`MTN error: ${detail}`, 500);
  }

  // ============================================
  // STATUS
  // ============================================

  async checkTransactionStatus(
    reference: string,
  ): Promise<MobileMoneyTransactionStatus> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }
    if (!reference) {
      throw new AppError('Reference is required', 400);
    }

    const token = await this.getAccessToken();

    const response = await this.http.get(
      `${this.getBaseUrl()}/collection/v1_0/requesttopay/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'X-Target-Environment': this.config.environment,
        },
      },
    );

    if (response.status === 404) {
      // Not found — likely still being processed, or wrong reference.
      return {
        status: 'PENDING',
        reference,
        isSuccess: false,
        provider: 'MTN',
        data: response.data,
      };
    }

    if (response.status !== 200) {
      logger.error(
        `❌ MTN status check failed: HTTP ${response.status} — ${summarizeAxiosError(
          { response },
        )}`,
      );
      throw this.mapMtnError(response.status, response.data);
    }

    const raw = response.data?.status as string | undefined;
    const statusMap: Record<string, string> = {
      SUCCESSFUL: 'SUCCESS',
      PENDING: 'PENDING',
      FAILED: 'FAILED',
      REJECTED: 'FAILED',
      TIMEOUT: 'FAILED',
      ONGOING: 'PROCESSING',
    };
    const mappedStatus = statusMap[raw || ''] || 'PENDING';

    return {
      status: mappedStatus,
      reference,
      isSuccess: raw === 'SUCCESSFUL',
      amount: response.data?.amount ? parseFloat(response.data.amount) : undefined,
      currency: response.data?.currency,
      data: response.data,
      provider: 'MTN',
    };
  }

  // ============================================
  // CALLBACK PARSING
  // ============================================

  /**
   * Parse an MTN callback body into a normalised envelope.
   *
   * ⚠ The result of this method is NOT authoritative. Callers MUST
   *   re-verify by calling `checkTransactionStatus()` before flipping
   *   the Payment row. MTN does not sign callbacks; the only thing
   *   this can safely do is tell you "something happened for
   *   reference X".
   */
  handleCallback(body: any): MobileMoneyTransactionStatus {
    try {
      logger.info('📩 MTN callback received');

      if (!body || typeof body !== 'object') {
        throw new AppError('Invalid MTN callback payload', 400);
      }

      const reference =
        body.reference ||
        body.externalId ||
        body.transactionId ||
        body['xReferenceId'] ||
        body['X-Reference-Id'];

      if (!reference) {
        throw new AppError('MTN callback missing reference', 400);
      }

      const rawStatus = (body.status || body.financialTransactionId
        ? body.status
        : body.status) as string | undefined;

      // MTN callback payloads use SUCCESSFUL / FAILED.
      let mapped: 'SUCCESS' | 'FAILED' | 'PENDING' = 'PENDING';
      if (rawStatus === 'SUCCESSFUL') mapped = 'SUCCESS';
      else if (rawStatus === 'FAILED' || rawStatus === 'REJECTED') mapped = 'FAILED';

      const amountRaw = body.amount ?? body.paidAmount;
      const amount =
        amountRaw !== undefined ? parseFloat(String(amountRaw)) : undefined;

      return {
        status: mapped,
        reference,
        isSuccess: mapped === 'SUCCESS',
        amount: Number.isFinite(amount as number) ? (amount as number) : undefined,
        currency: body.currency,
        data: body,
        provider: 'MTN',
      };
    } catch (error: any) {
      logger.error('❌ Failed to handle MTN callback:', error?.message || error);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to handle MTN callback', 500);
    }
  }

  async validatePayment(reference: string): Promise<boolean> {
    try {
      const status = await this.checkTransactionStatus(reference);
      return status.isSuccess;
    } catch (error) {
      logger.error('❌ MTN payment validation failed:', summarizeAxiosError(error));
      return false;
    }
  }

  // ============================================
  // ACCOUNT INFO
  // ============================================

  async getAccountBalance(): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }

    const token = await this.getAccessToken();
    const response = await this.http.get(
      `${this.getBaseUrl()}/collection/v1_0/account/balance`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'X-Target-Environment': this.config.environment,
        },
      },
    );

    if (response.status !== 200) {
      logger.error(
        `❌ Failed to get MTN balance: HTTP ${response.status} — ${summarizeAxiosError(
          { response },
        )}`,
      );
      throw this.mapMtnError(response.status, response.data);
    }

    logger.info('📊 MTN balance retrieved');
    return response.data;
  }

  async validateAccountHolder(phoneNumber: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const response = await this.http.get(
        `${this.getBaseUrl()}/collection/v1_0/accountholder/msisdn/${formattedPhone}/basicuserinfo`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
            'X-Target-Environment': this.config.environment,
          },
        },
      );

      if (response.status !== 200) {
        return {
          phoneNumber: formattedPhone,
          status: 'UNKNOWN',
          isActive: false,
          error:
            response.data?.message ||
            `MTN returned HTTP ${response.status}`,
        };
      }

      return {
        phoneNumber: formattedPhone,
        status: response.data?.status,
        isActive: response.data?.status === 'ACTIVE',
        data: response.data,
      };
    } catch (error: any) {
      logger.error(
        '❌ Account holder validation failed:',
        summarizeAxiosError(error),
      );
      return {
        phoneNumber,
        status: 'UNKNOWN',
        isActive: false,
        error: error?.message || 'Failed to validate account holder',
      };
    }
  }

  // ============================================
  // DISBURSEMENT (B2C) — used for transfers AND refunds
  // ============================================

  async initiateTransfer(params: {
    phoneNumber: string;
    amount: number;
    currency?: string;
    reference?: string;
    reason?: string;
  }): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }

    const countryConfig = this.getCountryConfig();
    const currency = params.currency || this.config.currency;
    assertValidAmount(params.amount, currency, countryConfig.isZeroDecimal);

    const phoneNumber = this.formatPhoneNumber(params.phoneNumber);
    const reference = params.reference || crypto.randomUUID();
    const token = await this.getAccessToken();

    const requestBody = {
      amount: params.amount.toString(),
      currency,
      externalId: reference,
      payee: {
        partyIdType: 'MSISDN',
        partyId: phoneNumber,
      },
      payerMessage: params.reason || 'Transfer from business',
      payeeNote: params.reason || 'Transfer from business',
    };

    logger.info(
      `📤 MTN transfer: ${phoneNumber} - ${params.amount} ${currency} (ref ${reference})`,
    );

    const response = await this.http.post(
      `${this.getBaseUrl()}/disbursement/v1_0/transfer`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'X-Reference-Id': reference,
          'X-Target-Environment': this.config.environment,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.status !== 202) {
      logger.error(
        `❌ MTN transfer failed: HTTP ${response.status} — ${summarizeAxiosError(
          { response },
        )}`,
      );
      throw this.mapMtnError(response.status, response.data);
    }

    logger.info(`✅ MTN transfer initiated: ${reference}`);

    return {
      transactionId: reference,
      status: 'PENDING',
      reference,
      message: 'Transfer initiated successfully',
      data: { referenceId: reference },
    };
  }

  /**
   * Refund a previously collected payment by pushing money back to the
   * payer via the Disbursement API.
   *
   * MTN's Collection API has no refund endpoint, so a refund is
   * modelled as an outbound transfer to the original payer's MSISDN.
   * The caller MUST supply the original payer's phone number — this
   * method does not have access to the DB to look it up.
   */
  async refundPayment(params: {
    phoneNumber: string;
    amount: number;
    currency?: string;
    reference?: string;
    reason?: string;
  }): Promise<MobileMoneyRefundResponse> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }

    const countryConfig = this.getCountryConfig();
    const currency = params.currency || this.config.currency;
    assertValidAmount(params.amount, currency, countryConfig.isZeroDecimal);

    const reference = params.reference || crypto.randomUUID();

    const transferResult = await this.initiateTransfer({
      phoneNumber: params.phoneNumber,
      amount: params.amount,
      currency,
      reference,
      reason: params.reason || 'Refund',
    });

    return {
      id: transferResult.transactionId,
      // Disbursement is async on MTN's side; final status comes from
      // polling checkTransferStatus — we return 'pending' here and
      // let the caller reconcile.
      status: 'pending',
      amount: params.amount,
      currency,
      reference,
      provider: 'MTN',
      data: transferResult.data,
    };
  }

  /**
   * Poll a disbursement transfer. Mirrors checkTransactionStatus but
   * hits the disbursement endpoint.
   */
  async checkTransferStatus(reference: string): Promise<MobileMoneyTransactionStatus> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }

    const token = await this.getAccessToken();
    const response = await this.http.get(
      `${this.getBaseUrl()}/disbursement/v1_0/transfer/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'X-Target-Environment': this.config.environment,
        },
      },
    );

    if (response.status === 404) {
      return {
        status: 'PENDING',
        reference,
        isSuccess: false,
        provider: 'MTN',
      };
    }

    if (response.status !== 200) {
      throw this.mapMtnError(response.status, response.data);
    }

    const raw = response.data?.status as string | undefined;
    const statusMap: Record<string, string> = {
      SUCCESSFUL: 'SUCCESS',
      PENDING: 'PENDING',
      FAILED: 'FAILED',
      REJECTED: 'FAILED',
      TIMEOUT: 'FAILED',
      ONGOING: 'PROCESSING',
    };
    return {
      status: statusMap[raw || ''] || 'PENDING',
      reference,
      isSuccess: raw === 'SUCCESSFUL',
      amount: response.data?.amount ? parseFloat(response.data.amount) : undefined,
      currency: response.data?.currency,
      data: response.data,
      provider: 'MTN',
    };
  }
}

// ============================================
// AIRTEL MOBILE MONEY SERVICE
// ============================================

export class AirtelMobileMoneyService {
  private static instance: AirtelMobileMoneyService;
  private config: AirtelConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private isInitialized: boolean = false;
  private http: AxiosInstance;

  private constructor() {
    const country = (process.env.AIRTEL_COUNTRY as AirtelConfig['country']) || 'UG';
    const countryConfig = COUNTRY_CONFIGS[country] || COUNTRY_CONFIGS.UG;

    this.config = {
      clientId: process.env.AIRTEL_CLIENT_ID || '',
      clientSecret: process.env.AIRTEL_CLIENT_SECRET || '',
      country,
      baseUrl: process.env.AIRTEL_BASE_URL || 'https://openapi.airtel.africa',
      callbackUrl:
        process.env.AIRTEL_CALLBACK_URL ||
        'http://localhost:3001/api/mobile-money/airtel/callback',
      merchantCode: process.env.AIRTEL_MERCHANT_CODE || '',
      currency: countryConfig.currency,
      apiKey: process.env.AIRTEL_API_KEY || '',
      apiSecret: process.env.AIRTEL_API_SECRET || '',
    };

    this.http = axios.create({
      timeout: DEFAULT_REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });

    this.validateConfig();
  }

  public static getInstance(): AirtelMobileMoneyService {
    if (!AirtelMobileMoneyService.instance) {
      AirtelMobileMoneyService.instance = new AirtelMobileMoneyService();
    }
    return AirtelMobileMoneyService.instance;
  }

  private validateConfig(): void {
    const required: (keyof AirtelConfig)[] = ['clientId', 'clientSecret'];
    const missing = required.filter((key) => !this.config[key]);

    if (missing.length > 0) {
      logger.warn(`⚠️ Missing Airtel configuration: ${missing.join(', ')}`);
      this.isInitialized = false;
    } else {
      this.isInitialized = true;
      logger.info('✅ Airtel Mobile Money configured successfully');
      logger.info(
        `   Country: ${this.config.country}, Currency: ${this.config.currency}`,
      );
    }
  }

  isConfigured(): boolean {
    return this.isInitialized;
  }

  private getBaseUrl(): string {
    return this.config.baseUrl;
  }

  private getCountryConfig() {
    return COUNTRY_CONFIGS[this.config.country] || COUNTRY_CONFIGS.UG;
  }

  private formatPhoneNumber(phone: string): string {
    if (!phone) {
      throw new AppError('Phone number is required', 400);
    }
    let cleaned = phone.replace(/\D/g, '');
    const { countryCode } = this.getCountryConfig();

    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (cleaned.startsWith(countryCode)) {
      cleaned = cleaned.substring(countryCode.length);
    }
    cleaned = countryCode + cleaned;

    if (cleaned.length < 11 || cleaned.length > 15) {
      throw new AppError(`Invalid MSISDN: ${phone}`, 400);
    }
    return cleaned;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.accessToken;
    }

    const response = await this.http.post(
      `${this.getBaseUrl()}/auth/oauth2/token`,
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'client_credentials',
      },
      { headers: { 'Content-Type': 'application/json' } },
    );

    if (response.status !== 200 || !response.data?.access_token) {
      logger.error(
        `Failed to get Airtel access token: HTTP ${response.status}`,
      );
      throw new AppError('Failed to authenticate with Airtel Mobile Money', 502);
    }

    this.accessToken = response.data.access_token as string;
    this.tokenExpiry = Date.now() + (response.data.expires_in || 3600) * 1000;
    logger.info('✅ Airtel access token obtained');
    return this.accessToken;
  }

  // ============================================
  // PAYMENT (COLLECTION)
  // ============================================

  async initiatePayment(
    request: MobileMoneyPaymentRequest,
  ): Promise<MobileMoneyPaymentResponse> {
    if (!this.isConfigured()) {
      throw new AppError('Airtel Mobile Money is not configured.', 503);
    }

    const countryConfig = this.getCountryConfig();
    const currency = request.currency || this.config.currency;
    assertValidAmount(request.amount, currency, countryConfig.isZeroDecimal);

    const phoneNumber = this.formatPhoneNumber(request.phoneNumber);
    const reference = request.reference || crypto.randomUUID();
    const token = await this.getAccessToken();

    const requestBody = {
      transaction: {
        amount: request.amount,
        currency,
        id: reference,
        description: request.description || 'Payment for order',
      },
      payer: {
        type: 'MSISDN',
        msisdn: phoneNumber,
        country: this.config.country,
      },
      callback_url: request.callbackUrl || this.config.callbackUrl,
    };

    logger.info(
      `📱 Airtel payment: ${phoneNumber} - ${request.amount} ${currency} (ref ${reference})`,
    );

    const response = await this.http.post(
      `${this.getBaseUrl()}/merchant/v1/payments/`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Country': this.config.country,
          'X-Currency': currency,
        },
      },
    );

    if (response.status !== 200 && response.status !== 201 && response.status !== 202) {
      logger.error(
        `❌ Airtel payment failed: HTTP ${response.status} — ${summarizeAxiosError(
          { response },
        )}`,
      );
      throw this.mapAirtelError(response.status, response.data);
    }

    const apiStatus = response.data?.status?.code || response.data?.status;
    const mapped: 'PENDING' | 'SUCCESS' | 'FAILED' =
      apiStatus === '200' || apiStatus === 'SUCCESS'
        ? 'PENDING' // Airtel returns 200 on accept but the payment is still pending user confirmation
        : 'PENDING';

    logger.info(`✅ Airtel payment initiated: ${reference}`);

    return {
      transactionId: response.data?.data?.transaction?.id || reference,
      status: mapped,
      reference,
      message: response.data?.status?.message || 'Payment initiated successfully',
      data: response.data,
      provider: 'AIRTEL',
    };
  }

  private mapAirtelError(status: number, body: any): AppError {
    const detail =
      body?.status?.message ||
      body?.message ||
      body?.error_description ||
      'Airtel error';
    if (status === 400) return new AppError(`Invalid Airtel request: ${detail}`, 400);
    if (status === 401) return new AppError('Airtel authentication failed', 401);
    if (status === 403) return new AppError('Airtel credentials unauthorized', 403);
    if (status === 404) return new AppError('Airtel resource not found', 404);
    if (status === 429) return new AppError('Airtel rate limit exceeded', 429);
    if (status >= 500) return new AppError(`Airtel upstream error: ${detail}`, 502);
    return new AppError(`Airtel error: ${detail}`, 500);
  }

  // ============================================
  // STATUS
  // ============================================

  async checkTransactionStatus(
    reference: string,
  ): Promise<MobileMoneyTransactionStatus> {
    if (!this.isConfigured()) {
      throw new AppError('Airtel Mobile Money is not configured.', 503);
    }
    if (!reference) {
      throw new AppError('Reference is required', 400);
    }

    const token = await this.getAccessToken();
    const response = await this.http.get(
      `${this.getBaseUrl()}/standard/v1/payments/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Country': this.config.country,
          'X-Currency': this.config.currency,
        },
      },
    );

    if (response.status === 404) {
      return {
        status: 'PENDING',
        reference,
        isSuccess: false,
        provider: 'AIRTEL',
      };
    }

    if (response.status !== 200) {
      logger.error(
        `❌ Airtel status check failed: HTTP ${response.status} — ${summarizeAxiosError(
          { response },
        )}`,
      );
      throw this.mapAirtelError(response.status, response.data);
    }

    // Airtel's canonical response nests transaction details under `data.transaction`.
    const tx = response.data?.data?.transaction || {};
    const raw = (tx.status || response.data?.status?.code || '').toString().toUpperCase();

    const statusMap: Record<string, string> = {
      SUCCESS: 'SUCCESS',
      TS: 'SUCCESS', // legacy code
      PENDING: 'PENDING',
      TIP: 'PENDING', // "transaction in progress"
      FAILED: 'FAILED',
      TF: 'FAILED', // legacy code
      AMBIGUOUS: 'PENDING',
      CANCELLED: 'FAILED',
      CANCELED: 'FAILED',
    };
    const mappedStatus = statusMap[raw] || 'PENDING';

    return {
      status: mappedStatus,
      reference,
      isSuccess: mappedStatus === 'SUCCESS',
      amount: tx.amount ? Number(tx.amount) : undefined,
      currency: tx.currency,
      data: response.data,
      provider: 'AIRTEL',
    };
  }

  // ============================================
  // CALLBACK PARSING
  // ============================================

  /**
   * Parse an Airtel callback body. Same caveat as MTN: the result is
   * NOT authoritative. Callers must re-verify via `checkTransactionStatus`.
   */
  handleCallback(body: any): MobileMoneyTransactionStatus {
    try {
      logger.info('📩 Airtel callback received');

      if (!body || typeof body !== 'object') {
        throw new AppError('Invalid Airtel callback payload', 400);
      }

      const tx = body.transaction || body.data?.transaction || {};
      const reference = tx.id || body.reference || body.transactionId;

      if (!reference) {
        throw new AppError('Airtel callback missing reference', 400);
      }

      const rawStatus = (tx.status || body.status || '').toString().toUpperCase();
      let mapped: 'SUCCESS' | 'FAILED' | 'PENDING' = 'PENDING';
      if (rawStatus === 'SUCCESS' || rawStatus === 'TS') mapped = 'SUCCESS';
      else if (
        rawStatus === 'FAILED' ||
        rawStatus === 'TF' ||
        rawStatus === 'CANCELLED' ||
        rawStatus === 'CANCELED'
      ) {
        mapped = 'FAILED';
      }

      return {
        status: mapped,
        reference,
        isSuccess: mapped === 'SUCCESS',
        amount: tx.amount ? Number(tx.amount) : undefined,
        currency: tx.currency,
        data: body,
        provider: 'AIRTEL',
      };
    } catch (error: any) {
      logger.error('❌ Failed to handle Airtel callback:', error?.message || error);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to handle Airtel callback', 500);
    }
  }

  async validatePayment(reference: string): Promise<boolean> {
    try {
      const status = await this.checkTransactionStatus(reference);
      return status.isSuccess;
    } catch (error) {
      logger.error('❌ Airtel payment validation failed:', summarizeAxiosError(error));
      return false;
    }
  }

  // ============================================
  // DISBURSEMENT (B2C) — used for transfers AND refunds
  // ============================================

  async initiateTransfer(params: {
    phoneNumber: string;
    amount: number;
    currency?: string;
    reference?: string;
    reason?: string;
  }): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('Airtel Mobile Money is not configured.', 503);
    }

    const countryConfig = this.getCountryConfig();
    const currency = params.currency || this.config.currency;
    assertValidAmount(params.amount, currency, countryConfig.isZeroDecimal);

    const phoneNumber = this.formatPhoneNumber(params.phoneNumber);
    const reference = params.reference || crypto.randomUUID();
    const token = await this.getAccessToken();

    const requestBody = {
      payee: {
        type: 'MSISDN',
        msisdn: phoneNumber,
        country: this.config.country,
      },
      reference,
      currency,
      amount: params.amount,
      pin: process.env.AIRTEL_DISBURSEMENT_PIN || '',
      description: params.reason || 'Transfer from business',
      callback_url: this.config.callbackUrl,
    };

    logger.info(
      `📤 Airtel transfer: ${phoneNumber} - ${params.amount} ${currency} (ref ${reference})`,
    );

    const response = await this.http.post(
      `${this.getBaseUrl()}/standard/v1/disbursements/`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Country': this.config.country,
          'X-Currency': currency,
        },
      },
    );

    if (response.status !== 200 && response.status !== 201 && response.status !== 202) {
      logger.error(
        `❌ Airtel transfer failed: HTTP ${response.status} — ${summarizeAxiosError(
          { response },
        )}`,
      );
      throw this.mapAirtelError(response.status, response.data);
    }

    logger.info(`✅ Airtel transfer initiated: ${reference}`);

    return {
      transactionId: response.data?.data?.transaction?.id || reference,
      status: 'PENDING',
      reference,
      message: response.data?.status?.message || 'Transfer initiated successfully',
      data: response.data,
    };
  }

  async refundPayment(params: {
    phoneNumber: string;
    amount: number;
    currency?: string;
    reference?: string;
    reason?: string;
  }): Promise<MobileMoneyRefundResponse> {
    if (!this.isConfigured()) {
      throw new AppError('Airtel Mobile Money is not configured.', 503);
    }

    const countryConfig = this.getCountryConfig();
    const currency = params.currency || this.config.currency;
    assertValidAmount(params.amount, currency, countryConfig.isZeroDecimal);

    const reference = params.reference || crypto.randomUUID();

    const transferResult = await this.initiateTransfer({
      phoneNumber: params.phoneNumber,
      amount: params.amount,
      currency,
      reference,
      reason: params.reason || 'Refund',
    });

    return {
      id: transferResult.transactionId,
      status: 'pending',
      amount: params.amount,
      currency,
      reference,
      provider: 'AIRTEL',
      data: transferResult.data,
    };
  }

  async checkTransferStatus(reference: string): Promise<MobileMoneyTransactionStatus> {
    if (!this.isConfigured()) {
      throw new AppError('Airtel Mobile Money is not configured.', 503);
    }

    const token = await this.getAccessToken();
    const response = await this.http.get(
      `${this.getBaseUrl()}/standard/v1/disbursements/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Country': this.config.country,
          'X-Currency': this.config.currency,
        },
      },
    );

    if (response.status === 404) {
      return { status: 'PENDING', reference, isSuccess: false, provider: 'AIRTEL' };
    }
    if (response.status !== 200) {
      throw this.mapAirtelError(response.status, response.data);
    }

    const tx = response.data?.data?.transaction || {};
    const raw = (tx.status || '').toString().toUpperCase();
    const statusMap: Record<string, string> = {
      SUCCESS: 'SUCCESS',
      TS: 'SUCCESS',
      PENDING: 'PENDING',
      TIP: 'PENDING',
      FAILED: 'FAILED',
      TF: 'FAILED',
      AMBIGUOUS: 'PENDING',
    };
    return {
      status: statusMap[raw] || 'PENDING',
      reference,
      isSuccess: statusMap[raw] === 'SUCCESS',
      amount: tx.amount ? Number(tx.amount) : undefined,
      currency: tx.currency,
      data: response.data,
      provider: 'AIRTEL',
    };
  }
}

// ============================================
// GENERIC MOBILE MONEY SERVICE (façade)
// ============================================

export class MobileMoneyService {
  private mtnService: MTNMobileMoneyService;
  private airtelService: AirtelMobileMoneyService;

  constructor() {
    this.mtnService = MTNMobileMoneyService.getInstance();
    this.airtelService = AirtelMobileMoneyService.getInstance();

    logger.info('📱 Mobile Money Service initialized');
    logger.info(`   MTN: ${this.mtnService.isConfigured() ? '✅' : '❌'} Configured`);
    logger.info(
      `   Airtel: ${this.airtelService.isConfigured() ? '✅' : '❌'} Configured`,
    );
  }

  isConfigured(): boolean {
    return this.mtnService.isConfigured() || this.airtelService.isConfigured();
  }

  getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.mtnService.isConfigured()) providers.push('MTN');
    if (this.airtelService.isConfigured()) providers.push('AIRTEL');
    return providers;
  }

  async initiatePayment(
    provider: 'MTN' | 'AIRTEL',
    request: MobileMoneyPaymentRequest,
  ): Promise<MobileMoneyPaymentResponse> {
    if (provider === 'MTN') {
      if (!this.mtnService.isConfigured()) {
        throw new AppError('MTN Mobile Money is not configured.', 503);
      }
      return this.mtnService.initiatePayment(request);
    }
    if (provider === 'AIRTEL') {
      if (!this.airtelService.isConfigured()) {
        throw new AppError('Airtel Mobile Money is not configured.', 503);
      }
      return this.airtelService.initiatePayment(request);
    }
    throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
  }

  async checkStatus(
    provider: 'MTN' | 'AIRTEL',
    reference: string,
  ): Promise<MobileMoneyTransactionStatus> {
    if (provider === 'MTN') return this.mtnService.checkTransactionStatus(reference);
    if (provider === 'AIRTEL') return this.airtelService.checkTransactionStatus(reference);
    throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
  }

  handleCallback(
    provider: 'MTN' | 'AIRTEL',
    body: any,
  ): MobileMoneyTransactionStatus {
    if (provider === 'MTN') return this.mtnService.handleCallback(body);
    if (provider === 'AIRTEL') return this.airtelService.handleCallback(body);
    throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
  }

  async validatePayment(
    provider: 'MTN' | 'AIRTEL',
    reference: string,
  ): Promise<boolean> {
    if (provider === 'MTN') return this.mtnService.validatePayment(reference);
    if (provider === 'AIRTEL') return this.airtelService.validatePayment(reference);
    throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
  }

  async getProviderBalance(provider: 'MTN' | 'AIRTEL'): Promise<any> {
    if (provider === 'MTN') return this.mtnService.getAccountBalance();
    if (provider === 'AIRTEL') {
      throw new AppError('Airtel balance API not implemented yet', 501);
    }
    throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
  }

  async validateAccountHolder(
    provider: 'MTN' | 'AIRTEL',
    phoneNumber: string,
  ): Promise<any> {
    if (provider === 'MTN') return this.mtnService.validateAccountHolder(phoneNumber);
    if (provider === 'AIRTEL') {
      throw new AppError(
        `Account holder validation not available for ${provider}`,
        501,
      );
    }
    throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
  }

  async initiateTransfer(
    provider: 'MTN' | 'AIRTEL',
    params: {
      phoneNumber: string;
      amount: number;
      currency?: string;
      reference?: string;
      reason?: string;
    },
  ): Promise<any> {
    if (provider === 'MTN') {
      if (!this.mtnService.isConfigured()) {
        throw new AppError('MTN Mobile Money is not configured.', 503);
      }
      return this.mtnService.initiateTransfer(params);
    }
    if (provider === 'AIRTEL') {
      if (!this.airtelService.isConfigured()) {
        throw new AppError('Airtel Mobile Money is not configured.', 503);
      }
      return this.airtelService.initiateTransfer(params);
    }
    throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
  }

  /**
   * Refund via the provider's Disbursement API. Returns 'pending' for
   * the initial response — the caller is expected to reconcile via
   * `checkRefundStatus()` once the provider settles.
   */
  async refundPayment(
    provider: 'MTN' | 'AIRTEL',
    params: {
      phoneNumber: string;
      amount: number;
      currency?: string;
      reference?: string;
      reason?: string;
    },
  ): Promise<MobileMoneyRefundResponse> {
    if (provider === 'MTN') {
      if (!this.mtnService.isConfigured()) {
        throw new AppError('MTN Mobile Money is not configured.', 503);
      }
      return this.mtnService.refundPayment(params);
    }
    if (provider === 'AIRTEL') {
      if (!this.airtelService.isConfigured()) {
        throw new AppError('Airtel Mobile Money is not configured.', 503);
      }
      return this.airtelService.refundPayment(params);
    }
    throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
  }

  /**
   * Poll a refund/transfer that was initiated via refundPayment.
   */
  async checkRefundStatus(
    provider: 'MTN' | 'AIRTEL',
    reference: string,
  ): Promise<MobileMoneyTransactionStatus> {
    if (provider === 'MTN') return this.mtnService.checkTransferStatus(reference);
    if (provider === 'AIRTEL') return this.airtelService.checkTransferStatus(reference);
    throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
  }
}

export const mobileMoneyService = new MobileMoneyService();
export default mobileMoneyService;
