// D:\Projects\Kalwanga\packages\backend\src\services\mobileMoneyService.ts

import axios, { AxiosInstance } from 'axios';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import * as crypto from 'crypto';
import { currencyService } from './currencyService.js';

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
  country: string;
  currency: string;
  apiSecret: string;
}

interface AirtelConfig {
  clientId: string;
  clientSecret: string;
  country: string;
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
  /**
   * Optional. MTN and Airtel derive their currency from their own
   * country config (`MTN_COUNTRY`, `AIRTEL_COUNTRY`). A caller
   * cannot force a currency here — the value is logged and
   * discarded when it disagrees with the country-derived one.
   *
   * Declared optional so callers can omit it (or pass `undefined`
   * explicitly) without a TS2322. This is the intended usage from
   * `checkoutService.invokeGateway`, which passes `undefined`
   * deliberately to signal "let the country config decide".
   */
  currency?: string;
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

interface MobileMoneyRefundResponse {
  id: string;
  status: 'succeeded' | 'pending' | 'failed';
  amount: number;
  currency: string;
  reference: string;
  provider: string;
  data?: any;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

// ============================================
// SHARED HELPERS
// ============================================

function safeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

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

function stringifyBody(body: unknown, maxLen = 500): string {
  if (body === undefined) return '<undefined>';
  if (body === null) return '<null>';
  if (typeof body === 'string') return body === '' ? '<empty string>' : body;
  try {
    const json = JSON.stringify(body);
    return json.length > maxLen ? json.slice(0, maxLen) + '…' : json;
  } catch {
    return String(body);
  }
}

// ============================================
// LAZY ENV READERS
// ============================================
//
// Currency and country are derived from the registry via
// `currencyService`, driven by `MTN_COUNTRY` / `AIRTEL_COUNTRY`.
// No hardcoded COUNTRY_CONFIGS table anywhere — the registry is
// the single source of truth. Nothing in this file hardcodes a
// currency; the registry decides, per deployment.

function readMtnConfig(): MTNConfig {
  const country = (process.env.MTN_COUNTRY || 'UG').toUpperCase();
  // Resolve the currency from the country via the registry.
  // Throws if the country isn't supported by the registry — a
  // boot-time misconfiguration surfaces immediately rather than
  // at first checkout.
  const currency = currencyService.resolveForCountry(country);

  return {
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
    currency,
    apiSecret: process.env.MTN_API_SECRET || '',
  };
}

function readAirtelConfig(): AirtelConfig {
  const country = (process.env.AIRTEL_COUNTRY || 'UG').toUpperCase();
  const currency = currencyService.resolveForCountry(country);

  return {
    clientId: process.env.AIRTEL_CLIENT_ID || '',
    clientSecret: process.env.AIRTEL_CLIENT_SECRET || '',
    country,
    baseUrl: process.env.AIRTEL_BASE_URL || 'https://openapi.airtel.africa',
    callbackUrl:
      process.env.AIRTEL_CALLBACK_URL ||
      'http://localhost:3001/api/mobile-money/airtel/callback',
    merchantCode: process.env.AIRTEL_MERCHANT_CODE || '',
    currency,
    apiKey: process.env.AIRTEL_API_KEY || '',
    apiSecret: process.env.AIRTEL_API_SECRET || '',
  };
}

// ============================================
// ENV PRESENCE LOGGING
// ============================================

function logMtnEnvPresence(): void {
  const names = [
    'MTN_API_USER_ID',
    'MTN_API_KEY',
    'MTN_API_SECRET',
    'MTN_SUBSCRIPTION_KEY',
    'MTN_ENVIRONMENT',
    'MTN_BASE_URL',
    'MTN_CALLBACK_URL',
    'MTN_COUNTRY',
    'MTN_MERCHANT_CODE',
  ] as const;

  const snapshot = Object.fromEntries(
    names.map((n) => [
      n,
      process.env[n]
        ? `${String(process.env[n]).slice(0, 6)}…(${String(process.env[n]).length})`
        : '(empty)',
    ]),
  );

  logger.info('[MTN env check]', snapshot);
}

function logAirtelEnvPresence(): void {
  const names = [
    'AIRTEL_CLIENT_ID',
    'AIRTEL_CLIENT_SECRET',
    'AIRTEL_API_KEY',
    'AIRTEL_API_SECRET',
    'AIRTEL_BASE_URL',
    'AIRTEL_CALLBACK_URL',
    'AIRTEL_COUNTRY',
    'AIRTEL_MERCHANT_CODE',
  ] as const;

  const snapshot = Object.fromEntries(
    names.map((n) => [
      n,
      process.env[n]
        ? `${String(process.env[n]).slice(0, 6)}…(${String(process.env[n]).length})`
        : '(empty)',
    ]),
  );

  logger.info('[Airtel env check]', snapshot);
}

// ============================================
// MTN MOBILE MONEY SERVICE
// ============================================

export class MTNMobileMoneyService {
  private static instance: MTNMobileMoneyService;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private http: AxiosInstance;
  private loggedEnvOnce = false;

  private constructor() {
    this.http = axios.create({
      timeout: DEFAULT_REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });
  }

  public static getInstance(): MTNMobileMoneyService {
    if (!MTNMobileMoneyService.instance) {
      MTNMobileMoneyService.instance = new MTNMobileMoneyService();
    }
    return MTNMobileMoneyService.instance;
  }

  private get config(): MTNConfig {
    return readMtnConfig();
  }

  private missingRequiredKeys(): (keyof MTNConfig)[] {
    const cfg = this.config;
    const required: (keyof MTNConfig)[] = [
      'apiUserId',
      'apiKey',
      'subscriptionKey',
    ];
    return required.filter((key) => {
      const v = cfg[key];
      return v === undefined || v === null || String(v).trim() === '';
    });
  }

  isConfigured(): boolean {
    return this.missingRequiredKeys().length === 0;
  }

  logConfigurationState(): void {
    if (!this.loggedEnvOnce) {
      logMtnEnvPresence();
      this.loggedEnvOnce = true;
    }

    const missing = this.missingRequiredKeys();
    if (missing.length > 0) {
      logger.warn(`⚠️ Missing MTN configuration: ${missing.join(', ')}`);
      return;
    }

    const cfg = this.config;
    logger.info('✅ MTN Mobile Money configured successfully');
    logger.info(`   Country: ${cfg.country}, Currency: ${cfg.currency}`);
    logger.info(`   Environment: ${cfg.environment}`);
    logger.info(`   Base URL: ${cfg.baseUrl}`);
  }

  private getBaseUrl(): string {
    return this.config.baseUrl;
  }

  private formatPhoneNumber(phone: string): string {
    if (!phone) {
      throw new AppError('Phone number is required', 400);
    }
    let cleaned = phone.replace(/\D/g, '');
    const cfg = this.config;
    const prefix = currencyService.phonePrefix(cfg.currency) ?? '';

    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (prefix && cleaned.startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length);
    }
    cleaned = prefix + cleaned;

    if (cleaned.length < 10 || cleaned.length > 15) {
      throw new AppError(`Invalid MSISDN: ${phone}`, 400);
    }
    return cleaned;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.accessToken;
    }

    const cfg = this.config;
    const auth = Buffer.from(
      `${cfg.apiUserId}:${cfg.apiKey}`,
    ).toString('base64');

    const response = await this.http.post(
      `${this.getBaseUrl()}/collection/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Ocp-Apim-Subscription-Key': cfg.subscriptionKey,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.status !== 200 || !response.data?.access_token) {
      logger.error(
        `Failed to get MTN access token: HTTP ${response.status} — ${summarizeAxiosError(
          { response },
        )}`,
      );
      logger.error(`[MTN] raw token response body: ${stringifyBody(response.data)}`);
      logger.error(`[MTN] token config in play:`, {
        country: cfg.country,
        currency: cfg.currency,
        environment: cfg.environment,
        baseUrl: cfg.baseUrl,
        hasApiUserId: Boolean(cfg.apiUserId),
        hasApiKey: Boolean(cfg.apiKey),
        hasSubscriptionKey: Boolean(cfg.subscriptionKey),
      });
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
      const missing = this.missingRequiredKeys();
      throw new AppError(
        `MTN Mobile Money is not configured (missing: ${missing.join(', ')}).`,
        503,
      );
    }

    const cfg = this.config;

    // The country determines the currency. Any caller-supplied
    // currency is logged and discarded when it disagrees.
    const currency = cfg.currency;
    if (
      request.currency &&
      request.currency.toUpperCase() !== currency.toUpperCase()
    ) {
      logger.warn(
        `[MTN] Caller passed currency=${request.currency} but country=${cfg.country} requires ${currency}. Overriding.`,
      );
    }

    currencyService.assertValidAmount(request.amount, currency);

    const phoneNumber = this.formatPhoneNumber(request.phoneNumber);
    const reference = request.reference || crypto.randomUUID();
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
          'Ocp-Apim-Subscription-Key': cfg.subscriptionKey,
          'X-Reference-Id': reference,
          'X-Target-Environment': cfg.environment,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.status !== 202) {
      logger.error(
        `❌ MTN payment failed: HTTP ${response.status} — ${summarizeAxiosError(
          { response },
        )}`,
      );
      throw this.mapMtnError(response.status, response.data, requestBody);
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

  /**
   * Map an HTTP failure from MTN into an `AppError`.
   *
   * ⚠ The `detail` extraction order matters. MTN's MoMo API is
   *   inconsistent across tenants and endpoint versions: some
   *   return `{ message }`, some `{ error }`, some `{ code }`, and
   *   the newer gateway returns `{ detail }` or `{ details }`.
   *   Every shape we've seen in the wild is checked, and if none
   *   match we fall back to a JSON slice so the log still carries
   *   the raw body.
   *
   * ⚠ The caller's request body is threaded in so the log can
   *   pair the failure with the payload that produced it. This is
   *   the single most useful diagnostic when debugging "Invalid
   *   MTN request: MTN error" — the four config fields below tell
   *   you which environment, country, currency, and endpoint were
   *   used.
   */
  private mapMtnError(
    status: number,
    body: any,
    requestBody?: Record<string, unknown>,
  ): AppError {
    const detail =
      body?.message ||
      body?.error_description ||
      body?.error ||
      body?.code ||
      body?.detail ||
      body?.details ||
      body?.reason ||
      body?.errorMessage ||
      (typeof body === 'string' && body ? body : undefined) ||
      (body ? JSON.stringify(body).slice(0, 200) : undefined) ||
      'MTN error';

    logger.error(`[MTN] HTTP ${status} on requesttopay: ${detail}`);
    logger.error(`[MTN] raw response body: ${stringifyBody(body)}`);

    const cfg = this.config;
    logger.error(`[MTN] config in play:`, {
      country: cfg.country,
      currency: cfg.currency,
      environment: cfg.environment,
      baseUrl: cfg.baseUrl,
    });

    if (requestBody) {
      logger.error(`[MTN] request body: ${stringifyBody(requestBody)}`);
    }

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
  // STATUS / CALLBACK / BALANCE / VALIDATE
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

    const cfg = this.config;
    const token = await this.getAccessToken();

    const response = await this.http.get(
      `${this.getBaseUrl()}/collection/v1_0/requesttopay/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Ocp-Apim-Subscription-Key': cfg.subscriptionKey,
          'X-Target-Environment': cfg.environment,
        },
      },
    );

    if (response.status === 404) {
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

  async getAccountBalance(): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }
    const cfg = this.config;
    const token = await this.getAccessToken();
    const response = await this.http.get(
      `${this.getBaseUrl()}/collection/v1_0/account/balance`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Ocp-Apim-Subscription-Key': cfg.subscriptionKey,
          'X-Target-Environment': cfg.environment,
        },
      },
    );

    if (response.status !== 200) {
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
      const cfg = this.config;
      const token = await this.getAccessToken();
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const response = await this.http.get(
        `${this.getBaseUrl()}/collection/v1_0/accountholder/msisdn/${formattedPhone}/basicuserinfo`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': cfg.subscriptionKey,
            'X-Target-Environment': cfg.environment,
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
      logger.error('❌ Account holder validation failed:', summarizeAxiosError(error));
      return {
        phoneNumber,
        status: 'UNKNOWN',
        isActive: false,
        error: error?.message || 'Failed to validate account holder',
      };
    }
  }

  // ============================================
  // DISBURSEMENT (B2C)
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

    const cfg = this.config;
    const currency = cfg.currency;

    if (
      params.currency &&
      params.currency.toUpperCase() !== currency.toUpperCase()
    ) {
      logger.warn(
        `[MTN] Transfer caller passed currency=${params.currency} but country=${cfg.country} requires ${currency}. Overriding.`,
      );
    }

    currencyService.assertValidAmount(params.amount, currency);

    const phoneNumber = this.formatPhoneNumber(params.phoneNumber);
    const reference = params.reference || crypto.randomUUID();
    const token = await this.getAccessToken();

    const requestBody = {
      amount: params.amount.toString(),
      currency,
      externalId: reference,
      payee: { partyIdType: 'MSISDN', partyId: phoneNumber },
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
          'Ocp-Apim-Subscription-Key': cfg.subscriptionKey,
          'X-Reference-Id': reference,
          'X-Target-Environment': cfg.environment,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.status !== 202) {
      throw this.mapMtnError(response.status, response.data, requestBody);
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
    const currency = this.config.currency;
    currencyService.assertValidAmount(params.amount, currency);
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
      provider: 'MTN',
      data: transferResult.data,
    };
  }

  async checkTransferStatus(reference: string): Promise<MobileMoneyTransactionStatus> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }
    const cfg = this.config;
    const token = await this.getAccessToken();
    const response = await this.http.get(
      `${this.getBaseUrl()}/disbursement/v1_0/transfer/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Ocp-Apim-Subscription-Key': cfg.subscriptionKey,
          'X-Target-Environment': cfg.environment,
        },
      },
    );

    if (response.status === 404) {
      return { status: 'PENDING', reference, isSuccess: false, provider: 'MTN' };
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
//
// Same structure as MTN — currency is derived from
// `AIRTEL_COUNTRY` via the registry.

export class AirtelMobileMoneyService {
  private static instance: AirtelMobileMoneyService;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private http: AxiosInstance;
  private loggedEnvOnce = false;

  private constructor() {
    this.http = axios.create({
      timeout: DEFAULT_REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });
  }

  public static getInstance(): AirtelMobileMoneyService {
    if (!AirtelMobileMoneyService.instance) {
      AirtelMobileMoneyService.instance = new AirtelMobileMoneyService();
    }
    return AirtelMobileMoneyService.instance;
  }

  private get config(): AirtelConfig {
    return readAirtelConfig();
  }

  private missingRequiredKeys(): (keyof AirtelConfig)[] {
    const cfg = this.config;
    const required: (keyof AirtelConfig)[] = ['clientId', 'clientSecret'];
    return required.filter((key) => {
      const v = cfg[key];
      return v === undefined || v === null || String(v).trim() === '';
    });
  }

  isConfigured(): boolean {
    return this.missingRequiredKeys().length === 0;
  }

  logConfigurationState(): void {
    if (!this.loggedEnvOnce) {
      logAirtelEnvPresence();
      this.loggedEnvOnce = true;
    }

    const missing = this.missingRequiredKeys();
    if (missing.length > 0) {
      logger.warn(`⚠️ Missing Airtel configuration: ${missing.join(', ')}`);
    } else {
      const cfg = this.config;
      logger.info('✅ Airtel Mobile Money configured successfully');
      logger.info(`   Country: ${cfg.country}, Currency: ${cfg.currency}`);
      logger.info(`   Base URL: ${cfg.baseUrl}`);
    }
  }

  private getBaseUrl(): string {
    return this.config.baseUrl;
  }

  private formatPhoneNumber(phone: string): string {
    if (!phone) throw new AppError('Phone number is required', 400);
    let cleaned = phone.replace(/\D/g, '');
    const prefix = currencyService.phonePrefix(this.config.currency) ?? '';

    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (prefix && cleaned.startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length);
    }
    cleaned = prefix + cleaned;

    if (cleaned.length < 10 || cleaned.length > 15) {
      throw new AppError(`Invalid MSISDN: ${phone}`, 400);
    }
    return cleaned;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.accessToken;
    }

    const cfg = this.config;
    const response = await this.http.post(
      `${this.getBaseUrl()}/auth/oauth2/token`,
      {
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: 'client_credentials',
      },
      { headers: { 'Content-Type': 'application/json' } },
    );

    if (response.status !== 200 || !response.data?.access_token) {
      logger.error(`Failed to get Airtel access token: HTTP ${response.status}`);
      logger.error(`[Airtel] raw token response body: ${stringifyBody(response.data)}`);
      logger.error(`[Airtel] token config in play:`, {
        country: cfg.country,
        currency: cfg.currency,
        baseUrl: cfg.baseUrl,
        hasClientId: Boolean(cfg.clientId),
        hasClientSecret: Boolean(cfg.clientSecret),
      });
      throw new AppError('Failed to authenticate with Airtel Mobile Money', 502);
    }

    this.accessToken = response.data.access_token as string;
    this.tokenExpiry = Date.now() + (response.data.expires_in || 3600) * 1000;
    logger.info('✅ Airtel access token obtained');
    return this.accessToken;
  }

  async initiatePayment(
    request: MobileMoneyPaymentRequest,
  ): Promise<MobileMoneyPaymentResponse> {
    if (!this.isConfigured()) {
      const missing = this.missingRequiredKeys();
      throw new AppError(
        `Airtel Mobile Money is not configured (missing: ${missing.join(', ')}).`,
        503,
      );
    }

    const cfg = this.config;
    const currency = cfg.currency;

    if (
      request.currency &&
      request.currency.toUpperCase() !== currency.toUpperCase()
    ) {
      logger.warn(
        `[Airtel] Caller passed currency=${request.currency} but country=${cfg.country} requires ${currency}. Overriding.`,
      );
    }

    currencyService.assertValidAmount(request.amount, currency);

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
        country: cfg.country,
      },
      callback_url: request.callbackUrl || cfg.callbackUrl,
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
          'X-Country': cfg.country,
          'X-Currency': currency,
        },
      },
    );

    if (
      response.status !== 200 &&
      response.status !== 201 &&
      response.status !== 202
    ) {
      logger.error(
        `❌ Airtel payment failed: HTTP ${response.status} — ${summarizeAxiosError(
          { response },
        )}`,
      );
      throw this.mapAirtelError(response.status, response.data, requestBody);
    }

    logger.info(`✅ Airtel payment initiated: ${reference}`);

    return {
      transactionId: response.data?.data?.transaction?.id || reference,
      status: 'PENDING',
      reference,
      message: response.data?.status?.message || 'Payment initiated successfully',
      data: response.data,
      provider: 'AIRTEL',
    };
  }

  /**
   * Map an HTTP failure from Airtel into an `AppError`.
   *
   * Same reasoning as `MTNMobileMoneyService.mapMtnError`: broaden
   * the detail extraction so the log carries Airtel's actual
   * reason, and pair it with the resolved config so a 400 is
   * diagnosable without grepping the env.
   */
  private mapAirtelError(
    status: number,
    body: any,
    requestBody?: Record<string, unknown>,
  ): AppError {
    const detail =
      body?.status?.message ||
      body?.message ||
      body?.error_description ||
      body?.error ||
      body?.code ||
      body?.detail ||
      body?.details ||
      body?.reason ||
      body?.errorMessage ||
      (typeof body === 'string' && body ? body : undefined) ||
      (body ? JSON.stringify(body).slice(0, 200) : undefined) ||
      'Airtel error';

    logger.error(`[Airtel] HTTP ${status}: ${detail}`);
    logger.error(`[Airtel] raw response body: ${stringifyBody(body)}`);

    const cfg = this.config;
    logger.error(`[Airtel] config in play:`, {
      country: cfg.country,
      currency: cfg.currency,
      baseUrl: cfg.baseUrl,
    });

    if (requestBody) {
      logger.error(`[Airtel] request body: ${stringifyBody(requestBody)}`);
    }

    if (status === 400) return new AppError(`Invalid Airtel request: ${detail}`, 400);
    if (status === 401) return new AppError('Airtel authentication failed', 401);
    if (status === 403) return new AppError('Airtel credentials unauthorized', 403);
    if (status === 404) return new AppError('Airtel resource not found', 404);
    if (status === 429) return new AppError('Airtel rate limit exceeded', 429);
    if (status >= 500) return new AppError(`Airtel upstream error: ${detail}`, 502);
    return new AppError(`Airtel error: ${detail}`, 500);
  }

  async checkTransactionStatus(
    reference: string,
  ): Promise<MobileMoneyTransactionStatus> {
    if (!this.isConfigured()) {
      throw new AppError('Airtel Mobile Money is not configured.', 503);
    }
    if (!reference) throw new AppError('Reference is required', 400);

    const cfg = this.config;
    const token = await this.getAccessToken();
    const response = await this.http.get(
      `${this.getBaseUrl()}/standard/v1/payments/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Country': cfg.country,
          'X-Currency': cfg.currency,
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
    const raw = (tx.status || response.data?.status?.code || '').toString().toUpperCase();
    const statusMap: Record<string, string> = {
      SUCCESS: 'SUCCESS',
      TS: 'SUCCESS',
      PENDING: 'PENDING',
      TIP: 'PENDING',
      FAILED: 'FAILED',
      TF: 'FAILED',
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
      ) mapped = 'FAILED';

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
    const cfg = this.config;
    const currency = cfg.currency;
    currencyService.assertValidAmount(params.amount, currency);

    const phoneNumber = this.formatPhoneNumber(params.phoneNumber);
    const reference = params.reference || crypto.randomUUID();
    const token = await this.getAccessToken();

    const requestBody = {
      payee: { type: 'MSISDN', msisdn: phoneNumber, country: cfg.country },
      reference,
      currency,
      amount: params.amount,
      pin: process.env.AIRTEL_DISBURSEMENT_PIN || '',
      description: params.reason || 'Transfer from business',
      callback_url: cfg.callbackUrl,
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
          'X-Country': cfg.country,
          'X-Currency': currency,
        },
      },
    );

    if (
      response.status !== 200 &&
      response.status !== 201 &&
      response.status !== 202
    ) {
      throw this.mapAirtelError(response.status, response.data, requestBody);
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
    const currency = this.config.currency;
    currencyService.assertValidAmount(params.amount, currency);
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
    const cfg = this.config;
    const token = await this.getAccessToken();
    const response = await this.http.get(
      `${this.getBaseUrl()}/standard/v1/disbursements/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Country': cfg.country,
          'X-Currency': cfg.currency,
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
    this.mtnService.logConfigurationState();
    this.airtelService.logConfigurationState();

    logger.info('📱 Mobile Money Service initialized');
    logger.info(`   MTN: ${this.mtnService.isConfigured() ? '✅' : '❌'} Configured`);
    logger.info(`   Airtel: ${this.airtelService.isConfigured() ? '✅' : '❌'} Configured`);
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

  isProviderConfigured(provider: 'MTN' | 'AIRTEL'): boolean {
    if (provider === 'MTN') return this.mtnService.isConfigured();
    if (provider === 'AIRTEL') return this.airtelService.isConfigured();
    return false;
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
