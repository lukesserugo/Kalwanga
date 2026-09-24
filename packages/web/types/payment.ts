// D:\Projects\Kalwanga\packages\web\types\payment.ts

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
// PAYMENT
// ============================================

/**
 * The shape of `Payment.metadata` as written by the backend.
 *
 * The column is `Json?` in Prisma, so it accepts anything. This
 * interface documents the keys the backend is known to write so
 * consumers get autocomplete on the common ones while keeping the
 * open-ended index signature for provider-specific fields.
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

  // ── POS metadata ─────────────────────────────────────────────
  saleId?: string;
  orderId?: string;
  cashierId?: string;
  receiptNumber?: string;

  // ── Mobile money ─────────────────────────────────────────────
  phoneNumber?: string;
  network?: string;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  mpesaCallback?: Record<string, unknown>;
  mpesaResult?: Record<string, unknown>;
  resultCode?: string;
  resultDesc?: string;

  // ── Stripe ───────────────────────────────────────────────────
  stripeCustomerId?: string | null;
  stripePaymentMethodId?: string | null;
  clientSecret?: string;
  paymentIntentStatus?: string;
  webhookPayload?: Record<string, unknown>;

  // ── PayPal / Flutterwave / Square ────────────────────────────
  approvalUrl?: string;
  authorizationUrl?: string;
  redirectUrl?: string;
  custom_id?: string;
  tx_ref?: string;
  reference?: string;
  sessionId?: string;

  // ── Card nonce (Square) ──────────────────────────────────────
  cardNonce?: string;

  // ── Return / cancel URLs (redirect providers) ────────────────
  returnUrl?: string;
  cancelUrl?: string;

  // ── Failures ─────────────────────────────────────────────────
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
  currency?: string;
  source?: string;
  customerId?: string;
  metadata?: PaymentMetadata;
  description?: string;
  tipAmount?: number;
  savePaymentMethod?: boolean;
  businessUnitId?: string;

  // ── Square ───────────────────────────────────────────────────
  cardNonce?: string;

  // ── Gateway resolution / idempotency ─────────────────────────
  gatewayId?: string;
  idempotencyKey?: string;
}

export interface RefundPaymentRequest {
  amount?: number;
  reason?: string;
  metadata?: PaymentMetadata;
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
}

// ============================================
// PAGINATED RESPONSE
// ============================================
//
// The backend returns `{ success, data: Payment[], pagination: {…} }`.
// The legacy `paymentService.getPayments` flattens this into
// `{ data, total, page, totalPages, limit }`. This interface supports
// both shapes so callers migrating to the new response don't break
// old ones.

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
  currency?: string;
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
