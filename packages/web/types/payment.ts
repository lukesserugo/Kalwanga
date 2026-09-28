// packages/web/types/payment.ts

import { Sale } from './sale';
import { Order } from './order';
import { User, Company, BusinessUnit } from './user';
import { PaymentMethod, PaymentStatus } from './enums';
import {
  CashRegister,
  CashRegisterSession,
  CashTransaction,
} from './register';

// ============================================
// CURRENCY
// ============================================
//
// The backend no longer uses a Prisma `Currency` enum for
// `Payment.currency` or `BusinessUnit.currency` — those columns are
// free strings, resolved by `currencyService.resolveForBusiness`
// against the `lib/currencies.ts` registry. This type is kept for
// backwards compatibility with any web code that still imports
// `Currency` from this module; new code should use `string` and
// treat the value as an ISO 4217 code.
export type Currency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'NGN'
  | 'KES'
  | 'ZAR'
  | 'GHS'
  | 'UGX'
  | 'TZS'
  | (string & {});

// ============================================
// PAYMENT
// ============================================

/**
 * The shape of `Payment.metadata` as written by the backend.
 *
 * The column is `Json?` in Prisma, so it accepts anything. This
 * interface documents the keys the backend is known to write so
 * consumers get autocomplete on the common ones while keeping the
 * open-ended index signature for provider-specific fields.
 *
 * The backend writes these keys from two places:
 *   - `paymentService.processPayment` (direct payment path)
 *   - `checkoutService.processOnlineCheckout` (gateway redirect path)
 * plus the webhook handlers, which merge provider payloads in.
 */
export interface PaymentMetadata {
  // ── Backend-authored provider context ────────────────────────
  provider?: string;
  providerResponse?: Record<string, unknown>;
  source?: string;
  idempotencyKey?: string;
  customerId?: string;
  tipAmount?: number;
  savePaymentMethod?: boolean;
  /**
   * The currency the backend actually charged in, resolved by
   * `paymentService.resolveCurrency` (business unit → env →
   * registry default). Recorded explicitly so the audit trail
   * shows what applied when the caller omitted `currency`.
   */
  currency?: string;

  // ── POS metadata ─────────────────────────────────────────────
  saleId?: string;
  orderId?: string;
  cashierId?: string;
  receiptNumber?: string;

  // ── Online checkout (phase-1 metadata) ───────────────────────
  returnUrl?: string | null;
  cancelUrl?: string | null;
  giftCardCode?: string | null;
  mobileMoneyProvider?: string | null;

  // ── Mobile money ─────────────────────────────────────────────
  phoneNumber?: string;
  payerPhoneNumber?: string;
  network?: string;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  mpesaCallback?: Record<string, unknown>;
  mpesaResult?: Record<string, unknown>;
  resultCode?: string;
  resultDesc?: string;
  customerMessage?: string;

  // ── Stripe ───────────────────────────────────────────────────
  stripeCustomerId?: string | null;
  stripePaymentMethodId?: string | null;
  clientSecret?: string;
  paymentIntentStatus?: string;
  webhookPayload?: Record<string, unknown>;
  sessionId?: string;

  // ── PayPal ───────────────────────────────────────────────────
  approvalUrl?: string;
  paypalCapture?: Record<string, unknown>;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paypalAmount?: number;
  paypalCurrency?: string;
  paypalFailure?: Record<string, unknown>;
  paypalRefund?: Record<string, unknown>;

  // ── Flutterwave / Square ─────────────────────────────────────
  authorizationUrl?: string;
  redirectUrl?: string;
  custom_id?: string;
  tx_ref?: string;
  reference?: string;
  squarePayment?: Record<string, unknown>;

  // ── Card nonce (Square) ──────────────────────────────────────
  cardNonce?: string;

  // ── Gateway lifecycle (online checkout) ──────────────────────
  gateway?: string;
  gatewayStatus?: string;
  gatewayResponse?: Record<string, unknown>;
  gatewayError?: {
    message?: string;
    code?: string;
    type?: string;
  };
  failedAt?: string;
  confirmedAt?: string;

  // ── Open-ended escape hatch ──────────────────────────────────
  [key: string]: unknown;
}

export interface Payment {
  id: string;
  amount: number;
  /**
   * ISO 4217 code. Populated by the backend's currency resolver:
   *   - direct path (`POST /payments`): `resolveCurrency()` walks
   *     caller → businessUnit.currency → DEFAULT_CURRENCY →
   *     registry default.
   *   - online path (`POST /checkout/online`): read from
   *     `businessUnit.currency` via
   *     `checkoutService.resolveBusinessUnitCurrency`.
   *
   * Declared optional here for forward-compat with pre-refactor
   * rows that predate the column being populated.
   */
  currency?: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  reference?: string;
  notes?: string;
  metadata?: PaymentMetadata;
  processedAt: string;
  refundedAt?: string;
  refundReason?: string;
  refundedBy?: string;
  refundedAmount?: number;
  saleId?: string;
  sale?: Sale;
  orderId?: string;
  order?: Order;
  cashRegisterId?: string;
  cashRegister?: CashRegister;
  cashRegisterSessionId?: string;
  cashRegisterSession?: CashRegisterSession;
  userId: string;
  user?: User;
  gatewayId?: string;
  paymentGateway?: PaymentGateway;
  businessUnitId?: string;
  businessUnit?: BusinessUnit;
  /**
   * Server-side idempotency key. `@unique` on the Prisma model, so
   * a retry with the same key returns the original row instead of
   * creating a duplicate.
   */
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// PAYMENT GATEWAY (legacy credential row)
// ============================================

/**
 * The `PaymentGateway` model row. This is the credential store — one
 * row per (provider, company). The `Payment.gatewayId` FK points at
 * this table, NOT at `PaymentProvider`.
 *
 * Distinct from `PaymentProviderStatus`, which is the newer
 * per-business-unit configuration surface.
 */
export type GatewayType =
  | 'stripe'
  | 'paypal'
  | 'flutterwave'
  | 'square'
  | 'mpesa'
  | string;

export interface GatewayCredentials {
  apiKey?: string;
  publicKey?: string;
  secretKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  locationId?: string;
  encryptionKey?: string;
  webhookSecret?: string;
  consumerKey?: string;
  consumerSecret?: string;
  shortcode?: string;
  passkey?: string;
  [key: string]: unknown;
}

export interface PaymentGateway {
  id: string;
  name: string;
  type: GatewayType;
  isActive: boolean;
  credentials: GatewayCredentials;
  testMode: boolean;
  createdAt: string;
  updatedAt: string;
  companyId: string;
  company?: Company;
  payments?: Payment[];
}

// ============================================
// SUMMARY & FILTERS
// ============================================

export interface PaymentSummary {
  totalAmount: number;
  byMethod: Record<string, number>;
  count: number;
  averageAmount: number;
  totalRefunds: number;
  refundCount: number;
  netAmount: number;
}

export interface PaymentFilters {
  startDate?: string;
  endDate?: string;
  businessUnitId?: string;
  status?: string;
  paymentMethod?: string;
  userId?: string;
  saleId?: string;
  orderId?: string;
  /**
   * Filters by `Payment.gatewayId` on the backend — i.e. by the
   * `PaymentGateway` credential row, NOT by `PaymentProvider`. The
   * backend's `getPaymentSummary` and `getAllPayments` both map
   * `provider` to `{ gatewayId: provider }`.
   */
  provider?: string;
  page?: number;
  limit?: number;
}

export interface PaymentSearchParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  businessUnitId?: string;
  status?: string;
  paymentMethod?: string;
  userId?: string;
  saleId?: string;
  orderId?: string;
  /** Same caveat as `PaymentFilters.provider` — maps to `gatewayId`. */
  provider?: string;
}

// ============================================
// REQUEST SHAPES
// ============================================

/**
 * Body for `POST /payments` and `POST /checkout/online`.
 *
 * `paidAmount` is NOT part of this interface — the online checkout
 * endpoint computes the amount server-side. The POS path sends
 * `amount` and relies on the legacy `processPaymentSchema` accepting
 * it as the tendered amount.
 */
export interface ProcessPaymentRequest {
  amount: number;
  paymentMethod: string;
  saleId?: string;
  orderId?: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  /**
   * Optional. When omitted, the backend resolves the currency from
   * the business unit (then `DEFAULT_CURRENCY`, then the registry
   * default). Do NOT default this to `'USD'` on the client — a
   * Ugandan deployment charging a Ugandan customer must default to
   * UGX, or MTN/Airtel reject the request outright.
   */
  currency?: string;
  source?: string;
  customerId?: string;
  metadata?: PaymentMetadata;
  description?: string;
  tipAmount?: number;
  savePaymentMethod?: boolean;
  /**
   * Business unit the payment belongs to. The backend reads this
   * (via `paymentService.resolveCurrency`) to pick the currency
   * when `currency` is omitted. Without it, only the platform
   * default applies.
   */
  businessUnitId?: string;

  // ── Square ───────────────────────────────────────────────────
  cardNonce?: string;

  // ── Gateway resolution / idempotency ─────────────────────────
  gatewayId?: string;
  /**
   * Caller-supplied idempotency key. The backend's
   * `Payment.idempotencyKey` column is `@unique`; two concurrent
   * requests with the same key produce one Payment, not two.
   *
   * If omitted, the backend derives a deterministic key from the
   * payment's salient fields (userId, amount, method, saleId,
   * orderId, customerId).
   */
  idempotencyKey?: string;

  /**
   * Advisory provider hint. The backend declares this on
   * `ProcessPaymentData` but does not currently read it — the
   * concrete provider is derived from `paymentMethod` (e.g.
   * `CREDIT_CARD` → STRIPE). Declared here so the web service's
   * `ProviderPaymentRequest` extension can set it without a
   * structural-widening error.
   */
  provider?: string;
}

export interface RefundPaymentRequest {
  amount?: number;
  reason?: string;
  metadata?: PaymentMetadata;
  /**
   * User performing the refund. Written to
   * `Payment.refundedBy` and used as the `AuditLog.userId` on the
   * refund audit row.
   */
  userId?: string;
}

export interface CheckoutSessionRequest {
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    currency?: string;
    description?: string;
    images?: string[];
  }>;
  customerId?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: PaymentMetadata;
  /**
   * Forwarded to Stripe as the `Idempotency-Key` request option.
   * The backend's `createCheckoutSession` does not currently
   * forward it, but Stripe accepts it, so declaring it here is
   * forward-compatible.
   */
  idempotencyKey?: string;
}

// ============================================
// PAGINATED RESPONSE
// ============================================
//
// The backend's `getAllPayments` returns
// `{ payments, total, page, limit, totalPages }`. The legacy
// `paymentService.getPayments` in the web service flattens this
// into `{ data, total, page, totalPages, limit }`. This interface
// supports both shapes so callers migrating to the new response
// don't break old ones.

export interface PaymentPagination {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface PaginatedPaymentResponse {
  data: Payment[];

  // Legacy flattened fields — kept non-optional so existing callers
  // that read `.total` at the top level keep working.
  total: number;
  page: number;
  totalPages: number;
  limit: number;

  // Canonical backend shape — optional so responses from the newer
  // endpoints (which only send `pagination`) type-check.
  pagination?: PaymentPagination;
  success?: boolean;
  message?: string;
}

// ============================================
// PAYMENT PROVIDER TYPES
// ============================================
//
// Re-declared here (matching the shapes exported from
// `services/paymentService.ts`) so a caller can import the type from
// `@/types/payment` without pulling in the service module.

export type PaymentProviderType = 'ONLINE' | 'OFFLINE' | 'HYBRID';

/**
 * Mirrors the backend's `PaymentProviderEnum` in `schema.prisma`.
 *
 * Note: the Prisma `PaymentMethod` enum also has `MTN`, `AIRTEL`,
 * and `PAYPAL`/`FLUTTERWAVE`/`SQUARE` entries, but
 * `PaymentProviderEnum` does NOT include MTN/AIRTEL/MPESA — those
 * are sub-providers of `MOBILE_MONEY`. Keep this union in sync with
 * the Prisma enum, not with `PaymentMethod`.
 *
 * ⚠ `PAYSTACK` is intentionally absent. It was removed from the
 *   backend's `PAYMENT_PROVIDERS` constant and from the
 *   `paymentService` handler registry; no factory exists for it,
 *   and the UI no longer offers it. Re-adding it here without
 *   re-adding the backend handler would let a caller type-check a
 *   request that fails at runtime with
 *   "Unsupported payment method: PAYSTACK".
 */
export type PaymentProviderName =
  | 'STRIPE'
  | 'CASH'
  | 'MOBILE_MONEY'
  | 'BANK_TRANSFER'
  | 'GIFT_CARD'
  | 'LOYALTY_POINTS'
  | 'PAYPAL'
  | 'FLUTTERWAVE'
  | 'SQUARE';

export interface PaymentProviderStatus {
  id?: string;
  /**
   * The `PaymentProviderEnum` value (`'STRIPE'`, `'MOBILE_MONEY'`,
   * …). Distinct from `code`, which is the string the provider
   * itself uses.
   */
  provider: string;
  name: string;
  code: string;
  type: PaymentProviderType;
  isActive: boolean;
  isHealthy: boolean;
  configured: boolean;
  transactions24h: number;
  volume24h: number;
  transactions7d: number;
  volume7d: number;
  transactions30d: number;
  volume30d: number;
  /**
   * Derived by the backend from the provider's FIRST
   * `PaymentMethodConfig` row (`provider.paymentMethods[0]`). That
   * means `description`, `icon`, `minAmount`, `maxAmount`,
   * `feePercentage`, and `feeFixed` are only populated when the
   * first method happens to carry them — other methods on the same
   * provider are not consulted.
   */
  config: {
    name: string;
    type: string;
    supportedCurrencies: string[];
    supportedMethods: string[];
    description?: string;
    icon?: string;
    minAmount?: number;
    maxAmount?: number;
    feePercentage?: number;
    feeFixed?: number;
  };
  settings?: Record<string, unknown>;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentProviderMethodConfig {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
  requiresRedirect?: boolean;
  isInstant?: boolean;
  minAmount?: number;
  maxAmount?: number;
  feePercentage?: number;
  feeFixed?: number;
  order?: number;
}

export interface CreatePaymentProviderRequest {
  provider: PaymentProviderName | string;
  name: string;
  code: string;
  type: PaymentProviderType;
  isActive?: boolean;
  isHealthy?: boolean;
  configured?: boolean;
  config?: {
    name: string;
    type: string;
    supportedCurrencies: string[];
    supportedMethods: string[];
    description?: string;
    icon?: string;
    minAmount?: number;
    maxAmount?: number;
    feePercentage?: number;
    feeFixed?: number;
    apiKey?: string;
    publicKey?: string;
    secretKey?: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    locationId?: string;
    encryptionKey?: string;
    webhookSecret?: string;
  };
  businessUnitId?: string;
  currencies?: string[];
  settings?: Record<string, unknown>;
  order?: number;
  paymentMethods?: PaymentProviderMethodConfig[];
}

export interface UpdatePaymentProviderRequest {
  name?: string;
  code?: string;
  type?: PaymentProviderType;
  isActive?: boolean;
  isHealthy?: boolean;
  configured?: boolean;
  config?: {
    name?: string;
    type?: string;
    supportedCurrencies?: string[];
    supportedMethods?: string[];
    description?: string;
    icon?: string;
    minAmount?: number;
    maxAmount?: number;
    feePercentage?: number;
    feeFixed?: number;
  };
  settings?: Record<string, unknown>;
  order?: number;
}

export interface ConfigureProviderRequest {
  config: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

// ============================================
// STRIPE PAYMENT INTENT
// ============================================

export interface CreatePaymentIntentRequest {
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
  customerId?: string;
  /**
   * Forwarded to Stripe as the `Idempotency-Key` request option.
   * Without it, a client-side retry (network drop, timeout)
   * creates a second PaymentIntent and double-charges the
   * customer.
   */
  idempotencyKey?: string;
}

export interface CreatePaymentIntentResponse {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

// ============================================
// M-PESA
// ============================================

export interface MpesaSTKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference?: string;
  transactionDesc?: string;
  callbackUrl?: string;
  saleId?: string;
  orderId?: string;
  customerId?: string;
  businessUnitId?: string;
  idempotencyKey?: string;
  /**
   * Optional. M-Pesa is currency-locked to the country of the
   * shortcode (KE → KES, TZ → TZS, …). The backend's
   * `mpesaSTKPushSchema` does not declare this field, and
   * `mobileMoneyService` overrides whatever the caller sends with
   * the country config. Declared here so a caller can pass it
   * without a TS2353 excess-property error; the backend will
   * ignore it.
   */
  currency?: string;
}

export interface MpesaSTKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface MpesaB2CRequest {
  phoneNumber: string;
  amount: number;
  commandId?: 'BusinessPayment' | 'SalaryPayment' | 'PromotionPayment';
  remarks?: string;
  occasion?: string;
}

// ============================================
// PAYPAL
// ============================================

export interface PayPalCaptureRequest {
  orderId: string;
}

export interface PayPalCaptureResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  captureData: Record<string, unknown>;
}

// ============================================
// FLUTTERWAVE
// ============================================

export interface FlutterwaveVirtualAccountRequest {
  email: string;
  amount?: number;
  currency?: string;
  customerName?: string;
}

export interface FlutterwaveVirtualAccountResponse {
  accountNumber: string;
  bankName: string;
  bankCode: string;
  reference: string;
  amount: number;
  currency: string;
  expiresAt: string;
  provider: string;
}

// ============================================
// SQUARE
// ============================================

export interface SquarePaymentApiRequest {
  amount: number;
  cardNonce: string;
  currency?: string;
  customerId?: string;
  description?: string;
  saleId?: string;
  orderId?: string;
  businessUnitId?: string;
  metadata?: PaymentMetadata;
}

export interface SquarePaymentResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  reference: string;
  provider: string;
  paymentData: Record<string, unknown>;
  receiptUrl?: string;
  orderId?: string;
}

export interface SquareCustomerRequest {
  email: string;
  name: string;
  phone?: string;
}

export interface SquareCustomerResponse {
  id: string;
  email: string;
  name: string;
  phone?: string;
  referenceId?: string;
}

// ============================================
// ONLINE CHECKOUT TYPES (RE-EXPORT)
// ============================================
//
// These live in `services/checkoutService.ts` because they're
// closely coupled to that service's contract. Re-exported here so
// callers can import them from `@/types/payment` if they prefer a
// single type-import site.

export type {
  NextAction,
  OnlineCheckoutRequest,
  OnlineCheckoutResponse,
} from '../services/checkoutService';

// ============================================
// PROVIDER UTILITY TYPES
// ============================================

export type PosPaymentMethod =
  | 'CASH'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'MOBILE_MONEY'
  | 'BANK_TRANSFER'
  | 'GIFT_CARD'
  | 'LOYALTY_POINTS'
  | 'CHECK'
  | 'PAYPAL'
  | 'FLUTTERWAVE'
  | 'SQUARE';

export type PaymentMethodCategory =
  | 'card'
  | 'mobile'
  | 'bank'
  | 'cash'
  | 'digital'
  | 'other';

export interface ProcessOrderPaymentInput {
  saleId: string;
  amount: number;
  paymentMethod: PosPaymentMethod;
  customerId?: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  /**
   * Optional. When omitted, the backend resolves the currency from
   * `businessUnitId` (then env → registry default). Do NOT default
   * to `'USD'` on the client.
   */
  currency?: string;
  /**
   * Forwarded so the backend can read `businessUnit.currency`
   * during resolution.
   */
  businessUnitId?: string;
  /**
   * Stable idempotency key. If omitted, the web service uses
   * `pos_${saleId}` — deterministic and timestamp-free, so a retry
   * of the same sale returns the original Payment row instead of
   * double-charging.
   *
   * Supply an explicit key for legitimate second charges on the
   * same sale (partial payments, split tender).
   */
  idempotencyKey?: string;
  description?: string;
  metadata?: PaymentMetadata;
  tipAmount?: number;
  source?: string;
  gatewayId?: string;
  cardNonce?: string;
}

export interface InitiateMpesaSTKPushInput {
  phoneNumber: string;
  amount: number;
  accountReference?: string;
  transactionDesc?: string;
  callbackUrl?: string;
  saleId?: string;
  orderId?: string;
  customerId?: string;
  businessUnitId?: string;
  idempotencyKey?: string;
  /**
   * Optional. M-Pesa ignores this — the shortcode country is
   * authoritative. Declared so callers can pass it without a
   * TS2353 excess-property error. See `MpesaSTKPushRequest`.
   */
  currency?: string;
}

// ============================================
// API RESPONSE WRAPPER
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: PaymentPagination;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}
