// packages/backend/src/services/mobileMoneyService.ts

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
   * The currency the caller expects the charge to settle in.
   *
   * ⚠ Phase D1: MTN and Airtel derive their settlement currency
   *   from their own country config (`MTN_COUNTRY`,
   *   `AIRTEL_COUNTRY`) via the registry. This service is the
   *   LAST mile — the currency decision MUST have been made
   *   before calling `initiatePayment`. The `chargeCurrencyService`
   *   resolves the correct currency for the caller (which for
   *   mobile money is the provider's country currency), and the
   *   caller passes it here.
   *
   *   Passing a currency that does NOT match the country-derived
   *   one is a bug, not a payer error. It means the caller skipped
   *   the resolver. The service REJECTS the request with a 400
   *   explaining how to fix it (see `assertCurrencyMatches`).
   *
   *   Declared optional so callers who genuinely have no currency
   *   (health probes, admin tools) can omit it and let the
   *   provider's country currency apply. In that case the
   *   country currency wins and no reject fires.
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

/**
 * TTL for the credential cache. Credentials are read from
 * `process.env` once and reused for this long. In practice the
 * values never change at runtime (env is fixed at boot), so a
 * long TTL is safe. A TTL exists so that a hot-reloaded dev
 * environment picks up `.env` edits without a full restart.
 */
const CREDENTIAL_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

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

/**
 * ⚠ Phase D1 — assert that the caller-supplied currency matches
 * the provider's country-derived settlement currency.
 *
 * The provider's country currency is authoritative. The caller
 * MUST have resolved the charge currency via
 * `chargeCurrencyService.resolve(...)` before calling here — that
 * resolver returns the provider's country currency for mobile
 * money by construction. A mismatch means the caller bypassed the
 * resolver.
 *
 * Behaviour:
 *   • Caller omits `currency` → OK. The country currency applies.
 *   • Caller passes the country currency → OK.
 *   • Caller passes a different currency → REJECT with a 400
 *     that explains where the resolver lives.
 *
 * This replaces the previous "log a warning and silently
 * override" behaviour. Silent overrides hide resolver bugs in
 * production; the charge is written to the provider in a currency
 * the caller did not expect, and nothing in the logs is loud
 * enough to notice.
 */
function assertCurrencyMatches(
  provider: 'MTN' | 'AIRTEL',
  callerCurrency: string | undefined,
  countryCurrency: string,
  country: string,
): void {
  if (!callerCurrency) return;

  const caller = callerCurrency.trim().toUpperCase();
  const countryCode = countryCurrency.trim().toUpperCase();

  if (caller === countryCode) return;

  throw new AppError(
    `[${provider}] Currency mismatch: caller passed ${caller}, but ` +
      `${provider === 'MTN' ? 'MTN_COUNTRY' : 'AIRTEL_COUNTRY'}=${country} ` +
      `requires ${countryCode}. The charge currency must be resolved via ` +
      `chargeCurrencyService.resolve() BEFORE calling initiatePayment — ` +
      `that resolver returns the provider's country currency for mobile money.`,
    400,
  );
}

// ============================================
// CACHED CONFIG READERS
// ============================================
//
// These are the SINGLE point where MTN / Airtel credentials are
// read from `process.env`. Every other part of the codebase —
// including `checkoutService` — must go through these readers or
// through the `isMtnConfigured()` / `isAirtelConfigured()`
// helpers below.
//
// Caching rationale:
//   - Env is fixed at boot. Reading it on every call is waste.
//   - A TTL (rather than a one-shot cache) lets dev hot-reload
//     pick up `.env` edits without a full restart.
//   - The cache key is the provider name; there is no
//     per-company variant because MTN / Airtel config is
//     currently global (env-driven). If per-company credentials
//     are added later, this key must be extended.

interface CachedConfig<T> {
  value: T;
  loadedAt: number;
}

let mtnConfigCache: CachedConfig<MTNConfig> | null = null;
let airtelConfigCache: CachedConfig<AirtelConfig> | null = null;

function readMtnConfig(): MTNConfig {
  const now = Date.now();
  if (mtnConfigCache && now - mtnConfigCache.loadedAt < CREDENTIAL_CACHE_TTL_MS) {
    return mtnConfigCache.value;
  }

  const country = (process.env.MTN_COUNTRY || 'UG').toUpperCase();
  // Resolve the currency from the country via the registry.
  // Throws if the country isn't supported by the registry — a
  // boot-time misconfiguration surfaces immediately rather than
  // at first checkout.
  const currency = currencyService.resolveForCountry(country);

  const value: MTNConfig = {
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

  mtnConfigCache = { value, loadedAt: now };
  return value;
}

function readAirtelConfig(): AirtelConfig {
  const now = Date.now();
  if (
    airtelConfigCache &&
    now - airtelConfigCache.loadedAt < CREDENTIAL_CACHE_TTL_MS
  ) {
    return airtelConfigCache.value;
  }

  const country = (process.env.AIRTEL_COUNTRY || 'UG').toUpperCase();
  const currency = currencyService.resolveForCountry(country);

  const value: AirtelConfig = {
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

  airtelConfigCache = { value, loadedAt: now };
  return value;
}

/**
 * Force-invalidate the credential cache. Call this after editing
 * `.env` in development, or from an admin config-update handler
 * once per-company credentials are introduced.
 *
 * Also used by tests to guarantee a fresh read between cases.
 */
export function clearMobileMoneyCredentialCache(): void {
  mtnConfigCache = null;
  airtelConfigCache = null;
}

// ============================================
// PUBLIC CONFIGURATION PROBES
// ============================================
//
// `checkoutService` (and anything else that needs to know whether
// a provider is usable) should call these instead of reading
// `process.env` directly. They hit the cache, so asking them 10
// times in one request costs one env read.

/**
 * True when MTN's required credentials are present.
 *
 * Required: apiUserId, apiKey, subscriptionKey.
 * (apiSecret is not used by the collection flow; it is kept in
 * the config for future use but is not part of the gate.)
 */
export function isMtnConfigured(): boolean {
  const cfg = readMtnConfig();
  return Boolean(
    cfg.apiUserId &&
      cfg.apiKey &&
      cfg.subscriptionKey &&
      cfg.apiUserId.trim() !== '' &&
      cfg.apiKey.trim() !== '' &&
      cfg.subscriptionKey.trim() !== '',
  );
}

/**
 * True when Airtel's required credentials are present.
 *
 * Required: clientId, clientSecret.
 */
export function isAirtelConfigured(): boolean {
  const cfg = readAirtelConfig();
  return Boolean(
    cfg.clientId &&
      cfg.clientSecret &&
      cfg.clientId.trim() !== '' &&
      cfg.clientSecret.trim() !== '',
  );
}

/**
 * Return the names of the MTN env vars that are currently missing,
 * for use in error messages and logs. Empty array when configured.
 */
export function missingMtnKeys(): string[] {
  const cfg = readMtnConfig();
  const missing: string[] = [];
  if (!cfg.apiUserId) missing.push('MTN_API_USER_ID');
  if (!cfg.apiKey) missing.push('MTN_API_KEY');
  if (!cfg.subscriptionKey) missing.push('MTN_SUBSCRIPTION_KEY');
  return missing;
}

/**
 * Return the names of the Airtel env vars that are currently
 * missing. Empty array when configured.
 */
export function missingAirtelKeys(): string[] {
  const cfg = readAirtelConfig();
  const missing: string[] = [];
  if (!cfg.clientId) missing.push('AIRTEL_CLIENT_ID');
  if (!cfg.clientSecret) missing.push('AIRTEL_CLIENT_SECRET');
  return missing;
}

// ============================================
// ENV PRESENCE LOGGING
// ============================================
//
// These still read `process.env` directly because their entire
// purpose is to report what is (or is not) set. They run once at
// startup per provider, so the extra reads are irrelevant.

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
    // Cached — see readMtnConfig(). This getter no longer hits
    // `process.env` on every access.
    return readMtnConfig();
  }

  /**
   * Names of the MTN config keys that are empty in the cached
   * config. Reads the cache, not env.
   */
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

    // The country determines the currency. A caller-supplied
    // currency MUST match — a mismatch means the caller bypassed
    // `chargeCurrencyService.resolve()`. Reject loudly.
    assertCurrencyMatches(
      'MTN',
      request.currency,
      cfg.currency,
      cfg.country,
    );

    const currency = cfg.currency;

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

    // Same rule as initiatePayment — the country currency is
    // authoritative, and a mismatched caller-supplied currency
    // means the resolver was skipped.
    assertCurrencyMatches(
      'MTN',
      params.currency,
      cfg.currency,
      cfg.country,
    );

    const currency = cfg.currency;

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
// `AIRTEL_COUNTRY` via the registry, and a mismatched caller-
// supplied currency is REJECTED (see `assertCurrencyMatches`).

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
    // Cached — see readAirtelConfig().
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

    // Same rule as MTN — country currency is authoritative, and a
    // mismatched caller-supplied currency is a resolver bug.
    assertCurrencyMatches(
      'AIRTEL',
      request.currency,
      cfg.currency,
      cfg.country,
    );

    const currency = cfg.currency;

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

    // Same rule — country currency is authoritative.
    assertCurrencyMatches(
      'AIRTEL',
      params.currency,
      cfg.currency,
      cfg.country,
    );

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
