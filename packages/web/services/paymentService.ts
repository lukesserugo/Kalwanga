// D:\Projects\Kalwanga\packages\web\services\paymentService.ts

import { api } from './api';
import {
  Payment,
  PaymentSummary,
  PaymentFilters,
  ProcessPaymentRequest,
  RefundPaymentRequest,
  CheckoutSessionRequest,
  PaginatedPaymentResponse,
} from '../types/payment';

// ============================================
// ENDPOINT PREFIXES
// ============================================
//
// The backend mounts three routers that this service touches:
//
//   /api/payments        → paymentController       (this file, mostly)
//   /api/mpesa           → mpesaController         (STK push, B2C)
//   /api/mobile-money    → mobileMoneyController   (MTN, Airtel)
//
// The `api` client prepends `NEXT_PUBLIC_API_URL`. If your client
// already includes `/api` in its baseURL, drop the `/api` prefix
// from the three constants below.

const PAYMENTS_BASE = '/payments';
const MPESA_BASE = '/mpesa';
const MOBILE_MONEY_BASE = '/mobile-money';

// ============================================
// MULTI-PROVIDER TYPES
// ============================================

export enum PaymentProvider {
  STRIPE = 'stripe',
  CASH = 'cash',
  MOBILE_MONEY = 'mobile_money',
  BANK_TRANSFER = 'bank_transfer',
  GIFT_CARD = 'gift_card',
  LOYALTY_POINTS = 'loyalty_points',
  PAYPAL = 'paypal',
  FLUTTERWAVE = 'flutterwave',
  SQUARE = 'square',
  MTN = 'mtn',
  AIRTEL = 'airtel',
  MPESA = 'mpesa',
}

/**
 * Mobile-money sub-providers the backend can actually route.
 *
 * The backend `mobileMoneyController.initiatePaymentSchema` accepts
 * only `MTN` and `AIRTEL`. M-Pesa is routed through a separate
 * service (`mpesaService`) and its own controller.
 */
export type MobileMoneyProvider = 'MTN' | 'AIRTEL' | 'MPESA';

export interface ProviderPaymentRequest extends ProcessPaymentRequest {
  provider?: PaymentProvider;
  cardNonce?: string; // For Square
  metadata?: {
    provider?: string;
    phoneNumber?: string;
    bankReference?: string;
    customerEmail?: string;
    customerName?: string;
    returnUrl?: string;
    cancelUrl?: string;
    network?: string;
    [key: string]: any;
  };
}

export interface MobileMoneyPaymentRequest extends ProcessPaymentRequest {
  metadata: {
    provider: 'MTN' | 'AIRTEL';
    phoneNumber: string;
  };
}

export interface BankTransferPaymentRequest extends ProcessPaymentRequest {
  metadata: {
    bankReference?: string;
  };
}

export interface GiftCardPaymentRequest extends ProcessPaymentRequest {
  gatewayId: string;
}

export interface LoyaltyPointsPaymentRequest extends ProcessPaymentRequest {
  customerId: string;
  metadata: {
    pointsToUse: number;
  };
}

export interface CashPaymentRequest extends ProcessPaymentRequest {
  cashRegisterId?: string;
  metadata?: {
    cashierId?: string;
    receiptNumber?: string;
  };
}

/**
 * PayPal request payload.
 *
 * ⚠ Prefer `processOnlineCheckout` over `processPayPalPayment` for
 *   the full redirect flow. `processPayPalPayment` posts to
 *   `/payments` and returns only the local Payment row — it does
 *   not surface the `approvalUrl` you need to redirect the user
 *   to PayPal.
 */
export interface PayPalPaymentRequest extends ProcessPaymentRequest {
  metadata: {
    customerEmail?: string;
    customerName?: string;
    returnUrl?: string;
    cancelUrl?: string;
    saleId?: string;
    orderId?: string;
  };
}

export interface FlutterwavePaymentRequest extends ProcessPaymentRequest {
  metadata: {
    customerEmail?: string;
    customerName?: string;
    phoneNumber?: string;
    redirectUrl?: string;
    network?: string;
  };
}

export interface SquarePaymentRequest
  extends Omit<ProcessPaymentRequest, 'metadata'> {
  cardNonce: string;
  metadata?: {
    customerEmail?: string;
    customerName?: string;
    [key: string]: any;
  };
}

export interface PaymentProviderStatus {
  id?: string;
  provider: string;
  name: string;
  code: string;
  type: 'ONLINE' | 'OFFLINE' | 'HYBRID';
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
  settings?: Record<string, any>;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePaymentProviderRequest {
  provider: string;
  name: string;
  code: string;
  type: 'ONLINE' | 'OFFLINE' | 'HYBRID';
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
  settings?: Record<string, any>;
  order?: number;
  paymentMethods?: Array<{
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
  }>;
}

export interface UpdatePaymentProviderRequest {
  name?: string;
  code?: string;
  type?: 'ONLINE' | 'OFFLINE' | 'HYBRID';
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
  settings?: Record<string, any>;
  order?: number;
}

export interface ConfigureProviderRequest {
  config: Record<string, any>;
  settings?: Record<string, any>;
}

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

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}

// ============================================
// M-PESA TYPES
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

// ============================================
// MOBILE MONEY (MTN / AIRTEL) TYPES
// ============================================

export interface InitiateMobileMoneyPaymentInput {
  provider: 'MTN' | 'AIRTEL';
  phoneNumber: string;
  amount: number;
  currency?: string;
  reference?: string;
  description?: string;
  callbackUrl?: string;
  /** POS / cart linkage — packed into the Payment metadata. */
  saleId?: string;
  orderId?: string;
  customerId?: string;
  businessUnitId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface InitiateMobileMoneyPaymentResponse {
  success: boolean;
  data: {
    transactionId: string;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSING';
    reference: string;
    message?: string;
    provider: string;
    paymentId?: string;
  };
  message: string;
}

/**
 * Response shape for `GET /api/mobile-money/status/:provider/:reference`.
 *
 * ⚠ The `payment` object lives at `data.payment`, not at the top
 *   level.
 */
export interface GetMobileMoneyStatusResponse {
  success: boolean;
  data: {
    /** 'SUCCESS' | 'PENDING' | 'FAILED' | 'PROCESSING' */
    status: string;
    reference: string;
    isSuccess: boolean;
    amount?: number;
    currency?: string;
    provider: string;
    /** Raw provider response body — shape depends on provider. */
    data?: Record<string, any>;
    /** The local `Payment` row after the status check. */
    payment?: Payment | null;
    [key: string]: any;
  };
  message: string;
}

// ============================================
// PAYPAL TYPES
// ============================================

export interface PayPalCaptureRequest {
  orderId: string;
}

export interface PayPalCaptureResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  captureData: any;
}

// ============================================
// FLUTTERWAVE TYPES
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
// SQUARE TYPES
// ============================================

export interface SquarePaymentApiRequest
  extends Omit<ProcessPaymentRequest, 'metadata'> {
  amount: number;
  cardNonce: string;
  currency?: string;
  customerId?: string;
  description?: string;
  saleId?: string;
  orderId?: string;
  businessUnitId?: string;
  metadata?: {
    customerEmail?: string;
    customerName?: string;
    saleId?: string;
    orderId?: string;
    [key: string]: any;
  };
}

export interface SquarePaymentResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  reference: string;
  provider: string;
  paymentData: any;
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
// ONLINE CHECKOUT — RE-EXPORTS
// ============================================

export type {
  NextAction,
  OnlineCheckoutRequest,
  OnlineCheckoutResponse,
} from './checkoutService';

// ============================================
// POS / ORDER FORM HELPER TYPES
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

export interface ProcessOrderPaymentInput {
  saleId: string;
  amount: number;
  paymentMethod: PosPaymentMethod;
  customerId?: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  currency?: string;
  description?: string;
  metadata?: Record<string, any>;
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
}

// ============================================
// PAYMENT SERVICE
// ============================================

export const paymentService = {
  // ============================================
  // CORE PAYMENT OPERATIONS
  // ============================================

  async processPayment(data: ProviderPaymentRequest): Promise<Payment> {
    return api.post<Payment>(PAYMENTS_BASE, data);
  },

  async processOnlineCheckout(
    data: import('./checkoutService').OnlineCheckoutRequest,
  ): Promise<import('./checkoutService').OnlineCheckoutResponse> {
    const { checkoutService } = await import('./checkoutService');
    return checkoutService.processOnlineCheckout(data);
  },

  async processCashPayment(data: CashPaymentRequest): Promise<Payment> {
    return api.post<Payment>(PAYMENTS_BASE, {
      ...data,
      paymentMethod: 'CASH',
      provider: PaymentProvider.CASH,
    });
  },

  async processMobileMoneyPayment(
    data: MobileMoneyPaymentRequest,
  ): Promise<Payment> {
    return api.post<Payment>(PAYMENTS_BASE, {
      ...data,
      paymentMethod: 'MOBILE_MONEY',
      provider: PaymentProvider.MOBILE_MONEY,
    });
  },

  async processBankTransferPayment(
    data: BankTransferPaymentRequest,
  ): Promise<Payment> {
    return api.post<Payment>(PAYMENTS_BASE, {
      ...data,
      paymentMethod: 'BANK_TRANSFER',
      provider: PaymentProvider.BANK_TRANSFER,
    });
  },

  async processGiftCardPayment(
    data: GiftCardPaymentRequest,
  ): Promise<Payment> {
    return api.post<Payment>(PAYMENTS_BASE, {
      ...data,
      paymentMethod: 'GIFT_CARD',
      provider: PaymentProvider.GIFT_CARD,
    });
  },

  async processLoyaltyPointsPayment(
    data: LoyaltyPointsPaymentRequest,
  ): Promise<Payment> {
    return api.post<Payment>(PAYMENTS_BASE, {
      ...data,
      paymentMethod: 'LOYALTY_POINTS',
      provider: PaymentProvider.LOYALTY_POINTS,
    });
  },

  async processCardPayment(data: ProcessPaymentRequest): Promise<Payment> {
    return api.post<Payment>(PAYMENTS_BASE, {
      ...data,
      provider: PaymentProvider.STRIPE,
    });
  },

  async processPayPalPayment(
    data: PayPalPaymentRequest,
  ): Promise<Payment> {
    return api.post<Payment>(PAYMENTS_BASE, {
      ...data,
      paymentMethod: 'PAYPAL',
      provider: PaymentProvider.PAYPAL,
    });
  },

  async processFlutterwavePayment(
    data: FlutterwavePaymentRequest,
  ): Promise<Payment> {
    return api.post<Payment>(PAYMENTS_BASE, {
      ...data,
      paymentMethod: 'FLUTTERWAVE',
      provider: PaymentProvider.FLUTTERWAVE,
    });
  },

  async processSquarePayment(data: SquarePaymentRequest): Promise<Payment> {
    return api.post<Payment>(`${PAYMENTS_BASE}/square/payment`, {
      ...data,
      paymentMethod: 'SQUARE',
      provider: PaymentProvider.SQUARE,
    });
  },

  async refundPayment(
    paymentId: string,
    data: RefundPaymentRequest,
  ): Promise<{
    refund: any;
    payment: Payment;
    refundedAmount: number;
    totalRefunded: number;
  }> {
    return api.post<{
      refund: any;
      payment: Payment;
      refundedAmount: number;
      totalRefunded: number;
    }>(`${PAYMENTS_BASE}/${paymentId}/refund`, data);
  },

  async getPaymentStatus(id: string): Promise<Payment> {
    return api.get<Payment>(`${PAYMENTS_BASE}/${id}`);
  },

  async getPaymentSummary(params?: {
    startDate?: string;
    endDate?: string;
    businessUnitId?: string;
    status?: string;
    paymentMethod?: string;
  }): Promise<PaymentSummary> {
    return api.get<PaymentSummary>(`${PAYMENTS_BASE}/summary`, {
      params,
    });
  },

  async getPayments(
    params?: PaymentFilters & { provider?: string },
  ): Promise<PaginatedPaymentResponse> {
    return api.get<PaginatedPaymentResponse>(PAYMENTS_BASE, { params });
  },

  // ============================================
  // MOBILE MONEY (MTN / AIRTEL)
  // ============================================

  async initiateMobileMoneyPayment(
    data: InitiateMobileMoneyPaymentInput,
  ): Promise<InitiateMobileMoneyPaymentResponse> {
    const payload = {
      provider: data.provider,
      phoneNumber: data.phoneNumber,
      amount: data.amount,
      currency: data.currency,
      reference: data.reference,
      description: data.description,
      callbackUrl: data.callbackUrl,
      saleId: data.saleId,
      orderId: data.orderId,
      metadata: {
        ...(data.metadata ?? {}),
        saleId: data.saleId,
        orderId: data.orderId,
        customerId: data.customerId,
        businessUnitId: data.businessUnitId,
        idempotencyKey: data.idempotencyKey,
      },
    };

    return api.post<InitiateMobileMoneyPaymentResponse>(
      `${MOBILE_MONEY_BASE}/pay`,
      payload,
    );
  },

  async getMobileMoneyStatus(
    provider: 'MTN' | 'AIRTEL',
    reference: string,
  ): Promise<GetMobileMoneyStatusResponse> {
    return api.get<GetMobileMoneyStatusResponse>(
      `${MOBILE_MONEY_BASE}/status/${provider}/${reference}`,
    );
  },

  async validateMobileMoneyAccount(
    provider: 'MTN' | 'AIRTEL',
    phoneNumber: string,
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    return api.post<{
      success: boolean;
      data: any;
      message: string;
    }>(`${MOBILE_MONEY_BASE}/validate`, { provider, phoneNumber });
  },

  // ============================================
  // M-PESA
  // ============================================

  async initiateMpesaSTKPush(data: MpesaSTKPushRequest): Promise<{
    success: boolean;
    data: MpesaSTKPushResponse & { paymentId?: string };
    message: string;
  }> {
    return api.post<{
      success: boolean;
      data: MpesaSTKPushResponse & { paymentId?: string };
      message: string;
    }>(`${MPESA_BASE}/stk-push`, data);
  },

  async initiatePosMpesaSTKPush(data: InitiateMpesaSTKPushInput): Promise<{
    success: boolean;
    data: MpesaSTKPushResponse & { paymentId?: string };
    message: string;
  }> {
    const { saleId, orderId, ...stkData } = data;

    return api.post<{
      success: boolean;
      data: MpesaSTKPushResponse & { paymentId?: string };
      message: string;
    }>(`${MPESA_BASE}/stk-push`, {
      ...stkData,
      saleId,
      orderId,
    });
  },

  async queryMpesaStatus(transactionId: string): Promise<{
    success: boolean;
    data: any;
    payment: any;
    message: string;
  }> {
    return api.get<{
      success: boolean;
      data: any;
      payment: any;
      message: string;
    }>(`${PAYMENTS_BASE}/mpesa-status/${transactionId}`);
  },

  async processMpesaB2C(data: {
    phoneNumber: string;
    amount: number;
    commandId?: 'BusinessPayment' | 'SalaryPayment' | 'PromotionPayment';
    remarks?: string;
    occasion?: string;
  }): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    return api.post<{
      success: boolean;
      data: any;
      message: string;
    }>(`${MPESA_BASE}/b2c`, data);
  },

  // ============================================
  // PAYMENT PROVIDER MANAGEMENT
  // ============================================

  async getPaymentProviders(params?: {
    businessUnitId?: string;
    isActive?: boolean;
    type?: string;
  }): Promise<ApiResponse<PaymentProviderStatus[]>> {
    try {
      const response = await api.get<
        ApiResponse<PaymentProviderStatus[]>
      >(`${PAYMENTS_BASE}/payment-providers`, { params });

      if (response && typeof response === 'object') {
        if ('data' in response) return response;
        if (Array.isArray(response)) {
          return { success: true, data: response };
        }
      }

      return {
        success: true,
        data: [],
        message: 'No payment providers available',
      };
    } catch (error: any) {
      console.error('Error fetching payment providers:', error);
      return {
        success: false,
        data: [],
        message: error?.message || 'Failed to fetch payment providers',
      };
    }
  },

  async getProviderStatus(
    provider: string,
    businessUnitId?: string,
  ): Promise<ApiResponse<PaymentProviderStatus>> {
    try {
      return await api.get<ApiResponse<PaymentProviderStatus>>(
        `${PAYMENTS_BASE}/payment-providers/${provider}/status`,
        { params: { businessUnitId } },
      );
    } catch (error: any) {
      console.error('Error fetching provider status:', error);
      return {
        success: false,
        message: error?.message || 'Failed to fetch provider status',
        data: undefined as any,
      };
    }
  },

  async createPaymentProvider(
    data: CreatePaymentProviderRequest,
  ): Promise<ApiResponse<PaymentProviderStatus>> {
    try {
      return await api.post<ApiResponse<PaymentProviderStatus>>(
        `${PAYMENTS_BASE}/payment-providers`,
        data,
      );
    } catch (error: any) {
      console.error('Error creating payment provider:', error);
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to create provider',
        data: undefined as any,
      };
    }
  },

  async updatePaymentProvider(
    id: string,
    data: UpdatePaymentProviderRequest,
  ): Promise<ApiResponse<PaymentProviderStatus>> {
    try {
      return await api.patch<ApiResponse<PaymentProviderStatus>>(
        `${PAYMENTS_BASE}/payment-providers/${id}`,
        data,
      );
    } catch (error: any) {
      console.error('Error updating payment provider:', error);
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to update provider',
        data: undefined as any,
      };
    }
  },

  async togglePaymentProvider(
    id: string,
    isActive: boolean,
  ): Promise<ApiResponse<PaymentProviderStatus>> {
    try {
      if (!id || id.startsWith('default_')) {
        console.warn(
          '⚠️ Cannot toggle default provider — create it in the DB first',
        );
        return {
          success: false,
          message:
            'Cannot toggle default provider. Please create a provider first.',
          data: undefined as any,
        };
      }

      return await api.patch<ApiResponse<PaymentProviderStatus>>(
        `${PAYMENTS_BASE}/payment-providers/${id}`,
        { isActive },
      );
    } catch (error: any) {
      console.error('Toggle provider error:', error);
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to toggle provider',
        data: undefined as any,
      };
    }
  },

  async deletePaymentProvider(id: string): Promise<ApiResponse<void>> {
    try {
      return await api.delete<ApiResponse<void>>(
        `${PAYMENTS_BASE}/payment-providers/${id}`,
      );
    } catch (error: any) {
      console.error('Error deleting payment provider:', error);
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to delete provider',
        data: undefined as any,
      };
    }
  },

  async updateProviderHealth(
    id: string,
    isHealthy: boolean,
  ): Promise<ApiResponse<PaymentProviderStatus>> {
    try {
      return await api.patch<ApiResponse<PaymentProviderStatus>>(
        `${PAYMENTS_BASE}/payment-providers/${id}/health`,
        { isHealthy },
      );
    } catch (error: any) {
      console.error('Error updating provider health:', error);
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to update provider health',
        data: undefined as any,
      };
    }
  },

  async configurePaymentProvider(
    id: string,
    data: ConfigureProviderRequest,
  ): Promise<ApiResponse<PaymentProviderStatus>> {
    try {
      if (!id || id.startsWith('default_')) {
        console.warn(
          '⚠️ Cannot configure default provider — create it in the DB first',
        );
        return {
          success: false,
          message:
            'Cannot configure default provider. Please create a provider first.',
          data: undefined as any,
        };
      }

      return await api.post<ApiResponse<PaymentProviderStatus>>(
        `${PAYMENTS_BASE}/payment-providers/${id}/configure`,
        data,
      );
    } catch (error: any) {
      console.error('Configure provider error:', error);
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to configure provider',
        data: undefined as any,
      };
    }
  },

  async addProviderCurrency(
    providerId: string,
    currency: string,
    conversionRate?: number,
  ): Promise<ApiResponse<any>> {
    try {
      return await api.post<ApiResponse<any>>(
        `${PAYMENTS_BASE}/payment-providers/${providerId}/currencies`,
        { currency, conversionRate },
      );
    } catch (error: any) {
      console.error('Error adding provider currency:', error);
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to add currency',
        data: undefined as any,
      };
    }
  },

  async removeProviderCurrency(
    providerId: string,
    currency: string,
  ): Promise<ApiResponse<void>> {
    try {
      return await api.delete<ApiResponse<void>>(
        `${PAYMENTS_BASE}/payment-providers/${providerId}/currencies/${currency}`,
      );
    } catch (error: any) {
      console.error('Error removing provider currency:', error);
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to remove currency',
        data: undefined as any,
      };
    }
  },

  async getProviderPaymentMethods(
    providerId: string,
  ): Promise<ApiResponse<any[]>> {
    try {
      return await api.get<ApiResponse<any[]>>(
        `${PAYMENTS_BASE}/payment-providers/${providerId}/methods`,
      );
    } catch (error: any) {
      console.error('Error fetching provider payment methods:', error);
      return {
        success: false,
        message: error?.message || 'Failed to fetch payment methods',
        data: [],
      };
    }
  },

  async createProviderPaymentMethod(
    providerId: string,
    data: any,
  ): Promise<ApiResponse<any>> {
    try {
      return await api.post<ApiResponse<any>>(
        `${PAYMENTS_BASE}/payment-providers/${providerId}/methods`,
        data,
      );
    } catch (error: any) {
      console.error('Error creating provider payment method:', error);
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to create payment method',
        data: undefined as any,
      };
    }
  },

  async updateProviderPaymentMethod(
    providerId: string,
    methodId: string,
    data: any,
  ): Promise<ApiResponse<any>> {
    try {
      return await api.patch<ApiResponse<any>>(
        `${PAYMENTS_BASE}/payment-providers/${providerId}/methods/${methodId}`,
        data,
      );
    } catch (error: any) {
      console.error('Error updating provider payment method:', error);
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to update payment method',
        data: undefined as any,
      };
    }
  },

  async deleteProviderPaymentMethod(
    providerId: string,
    methodId: string,
  ): Promise<ApiResponse<void>> {
    try {
      return await api.delete<ApiResponse<void>>(
        `${PAYMENTS_BASE}/payment-providers/${providerId}/methods/${methodId}`,
      );
    } catch (error: any) {
      console.error('Error deleting provider payment method:', error);
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to delete payment method',
        data: undefined as any,
      };
    }
  },

  // ============================================
  // STRIPE SPECIFIC METHODS
  // ============================================

  async createPaymentIntent(
    data: CreatePaymentIntentRequest,
  ): Promise<CreatePaymentIntentResponse> {
    return api.post<CreatePaymentIntentResponse>(
      `${PAYMENTS_BASE}/create-payment-intent`,
      data,
    );
  },

  async createCheckoutSession(data: CheckoutSessionRequest): Promise<any> {
    return api.post<any>(`${PAYMENTS_BASE}/checkout-session`, data);
  },

  async createStripeCustomer(): Promise<{
    customerId: string;
    alreadyExists: boolean;
  }> {
    return api.post<{
      customerId: string;
      alreadyExists: boolean;
    }>(`${PAYMENTS_BASE}/customer`);
  },

  async getCustomerPaymentMethods(): Promise<any> {
    return api.get<any>(`${PAYMENTS_BASE}/payment-methods`);
  },

  async attachPaymentMethod(paymentMethodId: string): Promise<any> {
    return api.post<any>(`${PAYMENTS_BASE}/payment-methods/attach`, {
      paymentMethodId,
    });
  },

  async detachPaymentMethod(paymentMethodId: string): Promise<any> {
    return api.delete<any>(
      `${PAYMENTS_BASE}/payment-methods/${paymentMethodId}`,
    );
  },

  // ============================================
  // PAYPAL SPECIFIC METHODS
  // ============================================

  async capturePayPalOrder(orderId: string): Promise<{
    success: boolean;
    data: PayPalCaptureResponse;
    message: string;
  }> {
    return api.post<{
      success: boolean;
      data: PayPalCaptureResponse;
      message: string;
    }>(`${PAYMENTS_BASE}/paypal/capture`, { orderId });
  },

  // ============================================
  // FLUTTERWAVE SPECIFIC METHODS
  // ============================================

  async createFlutterwaveVirtualAccount(
    data: FlutterwaveVirtualAccountRequest,
  ): Promise<{
    success: boolean;
    data: FlutterwaveVirtualAccountResponse;
    message: string;
  }> {
    return api.post<{
      success: boolean;
      data: FlutterwaveVirtualAccountResponse;
      message: string;
    }>(`${PAYMENTS_BASE}/flutterwave/virtual-account`, data);
  },

  // ============================================
  // SQUARE SPECIFIC METHODS
  // ============================================

  async processSquareCardPayment(data: SquarePaymentApiRequest): Promise<{
    success: boolean;
    data: Payment;
    message: string;
  }> {
    return api.post<{
      success: boolean;
      data: Payment;
      message: string;
    }>(`${PAYMENTS_BASE}/square/payment`, data);
  },

  async createSquareCustomer(data: SquareCustomerRequest): Promise<{
    success: boolean;
    data: SquareCustomerResponse;
    message: string;
  }> {
    return api.post<{
      success: boolean;
      data: SquareCustomerResponse;
      message: string;
    }>(`${PAYMENTS_BASE}/square/customer`, data);
  },

  // ============================================
  // POS / ORDER FORM HELPERS
  // ============================================

  async processOrderPayment(data: ProcessOrderPaymentInput): Promise<any> {
    const {
      saleId,
      amount,
      paymentMethod,
      customerId,
      cashRegisterId,
      cashRegisterSessionId,
      currency = 'USD',
      description,
      metadata,
      tipAmount,
      source,
      gatewayId,
      cardNonce,
    } = data;

    const enrichedMetadata = {
      ...(metadata || {}),
      saleId,
      source: metadata?.source ?? 'pos',
    };

    const payload: Record<string, any> = {
      amount,
      paymentMethod,
      saleId,
      currency,
      description: description ?? `Payment for sale ${saleId}`,
      metadata: enrichedMetadata,
      idempotencyKey: `pos_${saleId}_${Date.now()}`,
    };

    if (customerId) payload.customerId = customerId;
    if (cashRegisterId) payload.cashRegisterId = cashRegisterId;
    if (cashRegisterSessionId)
      payload.cashRegisterSessionId = cashRegisterSessionId;
    if (typeof tipAmount === 'number') payload.tipAmount = tipAmount;
    if (source) payload.source = source;
    if (gatewayId) payload.gatewayId = gatewayId;
    if (cardNonce) payload.cardNonce = cardNonce;

    const response = await api.post<any>(PAYMENTS_BASE, payload);
    return (response as any)?.data ?? response;
  },

  // ============================================
  // PAYMENT UTILITY METHODS
  // ============================================

  getPaymentMethodIcon(method: string): string {
    const icons: Record<string, string> = {
      CASH: '💰',
      CREDIT_CARD: '💳',
      DEBIT_CARD: '💳',
      MOBILE_MONEY: '📱',
      BANK_TRANSFER: '🏦',
      GIFT_CARD: '🎁',
      LOYALTY_POINTS: '⭐',
      CHECK: '📝',
      PAYPAL: '💸',
      FLUTTERWAVE: '🌊',
      SQUARE: '⬜',
      MPESA: '📱',
      MTN: '📱',
      AIRTEL: '📱',
    };
    return icons[method] || '💳';
  },

  getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      CASH: 'Cash',
      CREDIT_CARD: 'Credit Card',
      DEBIT_CARD: 'Debit Card',
      MOBILE_MONEY: 'Mobile Money',
      BANK_TRANSFER: 'Bank Transfer',
      GIFT_CARD: 'Gift Card',
      LOYALTY_POINTS: 'Loyalty Points',
      CHECK: 'Check',
      PAYPAL: 'PayPal',
      FLUTTERWAVE: 'Flutterwave',
      SQUARE: 'Square',
      MPESA: 'M-Pesa',
      MTN: 'MTN Mobile Money',
      AIRTEL: 'Airtel Money',
    };
    return labels[method] || method;
  },

  getPaymentStatusColor(status: string): string {
    const colors: Record<string, string> = {
      PAID: 'green',
      PENDING: 'yellow',
      FAILED: 'red',
      REFUNDED: 'gray',
      PARTIAL: 'blue',
      PROCESSING: 'purple',
      AUTHORIZED: 'indigo',
      DECLINED: 'red',
      DISPUTED: 'orange',
      CANCELLED: 'gray',
    };
    return colors[status] || 'gray';
  },

  getProviderName(provider: string): string {
    const names: Record<string, string> = {
      STRIPE: 'Stripe',
      CASH: 'Cash',
      MOBILE_MONEY: 'Mobile Money',
      BANK_TRANSFER: 'Bank Transfer',
      GIFT_CARD: 'Gift Card',
      LOYALTY_POINTS: 'Loyalty Points',
      PAYPAL: 'PayPal',
      FLUTTERWAVE: 'Flutterwave',
      SQUARE: 'Square',
      MPESA: 'M-Pesa',
      MTN: 'MTN Mobile Money',
      AIRTEL: 'Airtel Money',
    };
    return names[provider] || provider;
  },

  getProviderIcon(provider: string): string {
    const icons: Record<string, string> = {
      STRIPE: '💳',
      CASH: '💰',
      MOBILE_MONEY: '📱',
      BANK_TRANSFER: '🏦',
      GIFT_CARD: '🎁',
      LOYALTY_POINTS: '⭐',
      PAYPAL: '💸',
      FLUTTERWAVE: '🌊',
      SQUARE: '⬜',
      MPESA: '📱',
      MTN: '📱',
      AIRTEL: '📱',
    };
    return icons[provider] || '💳';
  },

  formatPaymentMethod(method: string, details?: any): string {
    let label = this.getPaymentMethodLabel(method);

    if (method === 'MOBILE_MONEY' && details?.provider) {
      label = `${details.provider} ${label}`;
    }

    if (method === 'CREDIT_CARD' && details?.last4) {
      label = `${label} •••• ${details.last4}`;
    }

    if (method === 'PAYPAL' && details?.email) {
      label = `${label} (${details.email})`;
    }

    return label;
  },

  isCardPayment(method: string): boolean {
    return (
      method === 'CREDIT_CARD' ||
      method === 'DEBIT_CARD' ||
      method === 'SQUARE'
    );
  },

  requiresRedirect(method: string): boolean {
    return method === 'PAYPAL' || method === 'FLUTTERWAVE';
  },

  requiresRedirectUrl(method: string): boolean {
    return this.requiresRedirect(method);
  },

  isInstantPayment(method: string): boolean {
    return (
      method === 'CASH' ||
      method === 'CREDIT_CARD' ||
      method === 'DEBIT_CARD' ||
      method === 'MOBILE_MONEY' ||
      method === 'LOYALTY_POINTS' ||
      method === 'GIFT_CARD' ||
      method === 'SQUARE'
    );
  },

  getSupportedProviders(paymentMethod: string): PaymentProvider[] {
    const providerMap: Record<string, PaymentProvider[]> = {
      CASH: [PaymentProvider.CASH],
      CREDIT_CARD: [
        PaymentProvider.STRIPE,
        PaymentProvider.SQUARE,
        PaymentProvider.FLUTTERWAVE,
      ],
      DEBIT_CARD: [
        PaymentProvider.STRIPE,
        PaymentProvider.SQUARE,
        PaymentProvider.FLUTTERWAVE,
      ],
      MOBILE_MONEY: [
        PaymentProvider.MPESA,
        PaymentProvider.MTN,
        PaymentProvider.AIRTEL,
      ],
      BANK_TRANSFER: [PaymentProvider.BANK_TRANSFER],
      GIFT_CARD: [PaymentProvider.GIFT_CARD],
      LOYALTY_POINTS: [PaymentProvider.LOYALTY_POINTS],
      PAYPAL: [PaymentProvider.PAYPAL],
      FLUTTERWAVE: [PaymentProvider.FLUTTERWAVE],
      SQUARE: [PaymentProvider.SQUARE],
    };
    return providerMap[paymentMethod] || [];
  },

  getProviderDisplayName(provider: PaymentProvider): string {
    const names: Record<PaymentProvider, string> = {
      [PaymentProvider.STRIPE]: 'Stripe',
      [PaymentProvider.CASH]: 'Cash Payment',
      [PaymentProvider.MOBILE_MONEY]: 'Mobile Money',
      [PaymentProvider.BANK_TRANSFER]: 'Bank Transfer',
      [PaymentProvider.GIFT_CARD]: 'Gift Card',
      [PaymentProvider.LOYALTY_POINTS]: 'Loyalty Points',
      [PaymentProvider.PAYPAL]: 'PayPal',
      [PaymentProvider.FLUTTERWAVE]: 'Flutterwave',
      [PaymentProvider.SQUARE]: 'Square',
      [PaymentProvider.MTN]: 'MTN Mobile Money',
      [PaymentProvider.AIRTEL]: 'Airtel Money',
      [PaymentProvider.MPESA]: 'M-Pesa',
    };
    return names[provider] || provider;
  },

  isProviderConfigured(provider: PaymentProviderStatus): boolean {
    return provider.configured === true;
  },

  isProviderActive(provider: PaymentProviderStatus): boolean {
    return provider.isActive === true;
  },

  isProviderHealthy(provider: PaymentProviderStatus): boolean {
    return provider.isHealthy === true;
  },

  getProviderStatusColor(provider: PaymentProviderStatus): string {
    if (!provider.isActive) return 'bg-gray-500';
    if (!provider.isHealthy) return 'bg-red-500';
    if (!provider.configured) return 'bg-yellow-500';
    return 'bg-green-500';
  },

  getProviderStatusLabel(provider: PaymentProviderStatus): string {
    if (!provider.isActive) return 'Inactive';
    if (!provider.isHealthy) return 'Unhealthy';
    if (!provider.configured) return 'Not Configured';
    return 'Active';
  },

  getTotalVolume(providers: PaymentProviderStatus[]): number {
    return providers.reduce((sum, p) => sum + (p.volume24h || 0), 0);
  },

  getTotalTransactions(providers: PaymentProviderStatus[]): number {
    return providers.reduce(
      (sum, p) => sum + (p.transactions24h || 0),
      0,
    );
  },

  getMostUsedProvider(
    providers: PaymentProviderStatus[],
  ): PaymentProviderStatus | null {
    if (!providers || providers.length === 0) return null;
    return providers.reduce((max, p) =>
      (p.transactions24h || 0) > (max.transactions24h || 0) ? p : max,
    );
  },

  getHighestVolumeProvider(
    providers: PaymentProviderStatus[],
  ): PaymentProviderStatus | null {
    if (!providers || providers.length === 0) return null;
    return providers.reduce((max, p) =>
      (p.volume24h || 0) > (max.volume24h || 0) ? p : max,
    );
  },

  requiresCardNonce(method: string): boolean {
    return method === 'SQUARE';
  },

  getPaymentMethodCategory(
    method: string,
  ): 'card' | 'mobile' | 'bank' | 'cash' | 'digital' | 'other' {
    const categories: Record<
      string,
      'card' | 'mobile' | 'bank' | 'cash' | 'digital' | 'other'
    > = {
      CREDIT_CARD: 'card',
      DEBIT_CARD: 'card',
      MOBILE_MONEY: 'mobile',
      MPESA: 'mobile',
      MTN: 'mobile',
      AIRTEL: 'mobile',
      BANK_TRANSFER: 'bank',
      CASH: 'cash',
      GIFT_CARD: 'digital',
      LOYALTY_POINTS: 'digital',
      PAYPAL: 'digital',
      FLUTTERWAVE: 'digital',
      SQUARE: 'card',
    };
    return categories[method] || 'other';
  },
};

export default paymentService;
