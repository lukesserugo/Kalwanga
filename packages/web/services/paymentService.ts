// D:\Projects\Kalwanga\packages\web\services\paymentService.ts

import { api } from './api';
import {
  Payment,
  PaymentSummary,
  PaymentFilters,
  ProcessPaymentRequest,
  RefundPaymentRequest,
  CheckoutSessionRequest,
  PaginatedPaymentResponse
} from '../types/payment';

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
  PAYSTACK = 'paystack',
  SQUARE = 'square',
  MTN = 'mtn',
  AIRTEL = 'airtel',
}

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
    provider: 'MTN' | 'TIGO' | 'AIRTEL' | 'VODAFONE';
    phoneNumber: string;
  };
}

export interface BankTransferPaymentRequest extends ProcessPaymentRequest {
  metadata: {
    bankReference?: string;
  };
}

export interface GiftCardPaymentRequest extends ProcessPaymentRequest {
  gatewayId: string; // Gift card code
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

export interface PayPalPaymentRequest extends ProcessPaymentRequest {
  metadata: {
    customerEmail?: string;
    customerName?: string;
    returnUrl?: string;
    cancelUrl?: string;
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

export interface PaystackPaymentRequest extends ProcessPaymentRequest {
  metadata: {
    customerEmail?: string;
    customerName?: string;
    phoneNumber?: string;
    redirectUrl?: string;
  };
}

// ✅ FIXED: Use Omit to avoid duplicate metadata property
export interface SquarePaymentRequest extends Omit<ProcessPaymentRequest, 'metadata'> {
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
    // Provider-specific config
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
}

export interface MpesaSTKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference?: string;
  transactionDesc?: string;
  callbackUrl?: string;
}

export interface MpesaSTKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
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
// PAYSTACK TYPES
// ============================================

export interface PaystackVerifyRequest {
  reference: string;
}

export interface PaystackVerifyResponse {
  success: boolean;
  status: string;
  amount: number;
  currency: string;
  reference: string;
  gatewayResponse: string;
  transactionData: any;
}

// ============================================
// SQUARE TYPES - ✅ FIXED
// ============================================

export interface SquarePaymentRequest extends Omit<ProcessPaymentRequest, 'metadata'> {
  amount: number;
  cardNonce: string;
  currency?: string;
  customerId?: string;
  description?: string;
  metadata?: {
    customerEmail?: string;
    customerName?: string;
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
// PAYMENT SERVICE
// ============================================

export const paymentService = {
  // ============================================
  // CORE PAYMENT OPERATIONS
  // ============================================

  /**
   * Process payment (supports all providers)
   * POST /payments
   */
  async processPayment(data: ProviderPaymentRequest): Promise<Payment> {
    const response = await api.post<Payment>('/payments', data);
    return response;
  },

  /**
   * Process cash payment
   * POST /payments
   */
  async processCashPayment(data: CashPaymentRequest): Promise<Payment> {
    const response = await api.post<Payment>('/payments', {
      ...data,
      paymentMethod: 'CASH',
      provider: PaymentProvider.CASH,
    });
    return response;
  },

  /**
   * Process mobile money payment
   * POST /payments
   */
  async processMobileMoneyPayment(data: MobileMoneyPaymentRequest): Promise<Payment> {
    const response = await api.post<Payment>('/payments', {
      ...data,
      paymentMethod: 'MOBILE_MONEY',
      provider: PaymentProvider.MOBILE_MONEY,
    });
    return response;
  },

  /**
   * Process bank transfer payment
   * POST /payments
   */
  async processBankTransferPayment(data: BankTransferPaymentRequest): Promise<Payment> {
    const response = await api.post<Payment>('/payments', {
      ...data,
      paymentMethod: 'BANK_TRANSFER',
      provider: PaymentProvider.BANK_TRANSFER,
    });
    return response;
  },

  /**
   * Process gift card payment
   * POST /payments
   */
  async processGiftCardPayment(data: GiftCardPaymentRequest): Promise<Payment> {
    const response = await api.post<Payment>('/payments', {
      ...data,
      paymentMethod: 'GIFT_CARD',
      provider: PaymentProvider.GIFT_CARD,
    });
    return response;
  },

  /**
   * Process loyalty points payment
   * POST /payments
   */
  async processLoyaltyPointsPayment(data: LoyaltyPointsPaymentRequest): Promise<Payment> {
    const response = await api.post<Payment>('/payments', {
      ...data,
      paymentMethod: 'LOYALTY_POINTS',
      provider: PaymentProvider.LOYALTY_POINTS,
    });
    return response;
  },

  /**
   * Process Stripe card payment
   * POST /payments
   */
  async processCardPayment(data: ProcessPaymentRequest): Promise<Payment> {
    const response = await api.post<Payment>('/payments', {
      ...data,
      provider: PaymentProvider.STRIPE,
    });
    return response;
  },

  /**
   * Process PayPal payment
   * POST /payments
   */
  async processPayPalPayment(data: PayPalPaymentRequest): Promise<Payment> {
    const response = await api.post<Payment>('/payments', {
      ...data,
      paymentMethod: 'PAYPAL',
      provider: PaymentProvider.PAYPAL,
    });
    return response;
  },

  /**
   * Process Flutterwave payment
   * POST /payments
   */
  async processFlutterwavePayment(data: FlutterwavePaymentRequest): Promise<Payment> {
    const response = await api.post<Payment>('/payments', {
      ...data,
      paymentMethod: 'FLUTTERWAVE',
      provider: PaymentProvider.FLUTTERWAVE,
    });
    return response;
  },

  /**
   * Process Paystack payment
   * POST /payments
   */
  async processPaystackPayment(data: PaystackPaymentRequest): Promise<Payment> {
    const response = await api.post<Payment>('/payments', {
      ...data,
      paymentMethod: 'PAYSTACK',
      provider: PaymentProvider.PAYSTACK,
    });
    return response;
  },

  /**
   * Process Square payment
   * POST /payments/square/payment
   */
  async processSquarePayment(data: SquarePaymentRequest): Promise<Payment> {
    const response = await api.post<Payment>('/payments/square/payment', {
      ...data,
      paymentMethod: 'SQUARE',
      provider: PaymentProvider.SQUARE,
    });
    return response;
  },

  /**
   * Refund payment
   * POST /payments/:id/refund
   */
  async refundPayment(paymentId: string, data: RefundPaymentRequest): Promise<{
    refund: any;
    payment: Payment;
    refundedAmount: number;
    totalRefunded: number;
  }> {
    const response = await api.post<{
      refund: any;
      payment: Payment;
      refundedAmount: number;
      totalRefunded: number;
    }>(`/payments/${paymentId}/refund`, data);
    return response;
  },

  /**
   * Get payment status
   * GET /payments/:id
   */
  async getPaymentStatus(id: string): Promise<Payment> {
    const response = await api.get<Payment>(`/payments/${id}`);
    return response;
  },

  /**
   * Get payment summary
   * GET /payments/summary
   */
  async getPaymentSummary(params?: {
    startDate?: string;
    endDate?: string;
    businessUnitId?: string;
    status?: string;
    paymentMethod?: string;
    provider?: string;
  }): Promise<PaymentSummary> {
    const response = await api.get<PaymentSummary>('/payments/summary', { params });
    return response;
  },

  /**
   * Get all payments with filters
   * GET /payments
   */
  async getPayments(params?: PaymentFilters & { provider?: string }): Promise<PaginatedPaymentResponse> {
    const response = await api.get<PaginatedPaymentResponse>('/payments', { params });
    return response;
  },

  // ============================================
  // PAYMENT PROVIDER MANAGEMENT
  // ============================================

  /**
   * Get all active payment providers
   * GET /payment-providers
   */
  async getPaymentProviders(params?: {
    businessUnitId?: string;
    isActive?: boolean;
    type?: string;
  }): Promise<ApiResponse<PaymentProviderStatus[]>> {
    const response = await api.get<ApiResponse<PaymentProviderStatus[]>>('/payment-providers', { params });
    return response;
  },

  /**
   * Get payment provider status
   * GET /payment-providers/:provider/status
   */
  async getProviderStatus(provider: string, businessUnitId?: string): Promise<ApiResponse<PaymentProviderStatus>> {
    const response = await api.get<ApiResponse<PaymentProviderStatus>>(`/payment-providers/${provider}/status`, { 
      params: { businessUnitId } 
    });
    return response;
  },

  /**
   * Create a new payment provider
   * POST /payment-providers
   */
  async createPaymentProvider(data: CreatePaymentProviderRequest): Promise<ApiResponse<PaymentProviderStatus>> {
    const response = await api.post<ApiResponse<PaymentProviderStatus>>('/payment-providers', data);
    return response;
  },

  /**
   * Update a payment provider
   * PATCH /payment-providers/:id
   */
  async updatePaymentProvider(id: string, data: UpdatePaymentProviderRequest): Promise<ApiResponse<PaymentProviderStatus>> {
    const response = await api.patch<ApiResponse<PaymentProviderStatus>>(`/payment-providers/${id}`, data);
    return response;
  },

  /**
   * Toggle a payment provider's active status
   * PATCH /payment-providers/:id
   */
  async togglePaymentProvider(id: string, isActive: boolean): Promise<ApiResponse<PaymentProviderStatus>> {
    try {
      // ✅ FIXED: Validate ID is not a default ID
      if (!id || id.startsWith('default_')) {
        console.warn('⚠️ Cannot toggle default provider - provider must be created in database first');
        return {
          success: false,
          message: 'Cannot toggle default provider. Please create a provider first.',
          data: undefined as any,
        };
      }

      const response = await api.patch<ApiResponse<PaymentProviderStatus>>(`/payment-providers/${id}`, { isActive });
      return response;
    } catch (error: any) {
      console.error('Toggle provider error:', error);
      // Return a graceful error response
      return {
        success: false,
        message: error?.response?.data?.message || error?.message || 'Failed to toggle provider',
        data: undefined as any,
      };
    }
  },

  /**
   * Delete a payment provider (soft delete)
   * DELETE /payment-providers/:id
   */
  async deletePaymentProvider(id: string): Promise<ApiResponse<void>> {
    const response = await api.delete<ApiResponse<void>>(`/payment-providers/${id}`);
    return response;
  },

  /**
   * Update provider health status
   * PATCH /payment-providers/:id/health
   */
  async updateProviderHealth(id: string, isHealthy: boolean): Promise<ApiResponse<PaymentProviderStatus>> {
    const response = await api.patch<ApiResponse<PaymentProviderStatus>>(`/payment-providers/${id}/health`, { isHealthy });
    return response;
  },

  /**
   * Configure a payment provider
   * POST /payment-providers/:id/configure
   */
  async configurePaymentProvider(id: string, data: ConfigureProviderRequest): Promise<ApiResponse<PaymentProviderStatus>> {
    try {
      // ✅ FIXED: Validate ID is not a default ID
      if (!id || id.startsWith('default_')) {
        console.warn('⚠️ Cannot configure default provider - provider must be created in database first');
        return {
          success: false,
          message: 'Cannot configure default provider. Please create a provider first.',
          data: undefined as any,
        };
      }

      const response = await api.post<ApiResponse<PaymentProviderStatus>>(`/payment-providers/${id}/configure`, data);
      return response;
    } catch (error: any) {
      console.error('Configure provider error:', error);
      return {
        success: false,
        message: error?.response?.data?.message || error?.message || 'Failed to configure provider',
        data: undefined as any,
      };
    }
  },

  // ============================================
  // PAYMENT PROVIDER CURRENCY METHODS
  // ============================================

  /**
   * Add currency to a provider
   * POST /payment-providers/:id/currencies
   */
  async addProviderCurrency(providerId: string, currency: string, conversionRate?: number): Promise<ApiResponse<any>> {
    const response = await api.post<ApiResponse<any>>(`/payment-providers/${providerId}/currencies`, { 
      currency, 
      conversionRate 
    });
    return response;
  },

  /**
   * Remove currency from a provider
   * DELETE /payment-providers/:id/currencies/:currency
   */
  async removeProviderCurrency(providerId: string, currency: string): Promise<ApiResponse<void>> {
    const response = await api.delete<ApiResponse<void>>(`/payment-providers/${providerId}/currencies/${currency}`);
    return response;
  },

  // ============================================
  // PAYMENT METHOD CONFIG METHODS
  // ============================================

  /**
   * Get payment methods for a provider
   * GET /payment-providers/:id/methods
   */
  async getProviderPaymentMethods(providerId: string): Promise<ApiResponse<any[]>> {
    const response = await api.get<ApiResponse<any[]>>(`/payment-providers/${providerId}/methods`);
    return response;
  },

  /**
   * Create a payment method for a provider
   * POST /payment-providers/:id/methods
   */
  async createProviderPaymentMethod(providerId: string, data: any): Promise<ApiResponse<any>> {
    const response = await api.post<ApiResponse<any>>(`/payment-providers/${providerId}/methods`, data);
    return response;
  },

  /**
   * Update a payment method
   * PATCH /payment-providers/:id/methods/:methodId
   */
  async updateProviderPaymentMethod(providerId: string, methodId: string, data: any): Promise<ApiResponse<any>> {
    const response = await api.patch<ApiResponse<any>>(`/payment-providers/${providerId}/methods/${methodId}`, data);
    return response;
  },

  /**
   * Delete a payment method
   * DELETE /payment-providers/:id/methods/:methodId
   */
  async deleteProviderPaymentMethod(providerId: string, methodId: string): Promise<ApiResponse<void>> {
    const response = await api.delete<ApiResponse<void>>(`/payment-providers/${providerId}/methods/${methodId}`);
    return response;
  },

  // ============================================
  // STRIPE SPECIFIC METHODS
  // ============================================

  /**
   * Create a payment intent (Stripe)
   * POST /payments/create-payment-intent
   */
  async createPaymentIntent(data: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse> {
    const response = await api.post<CreatePaymentIntentResponse>('/payments/create-payment-intent', data);
    return response;
  },

  /**
   * Create Stripe checkout session
   * POST /payments/checkout-session
   */
  async createCheckoutSession(data: CheckoutSessionRequest): Promise<any> {
    const response = await api.post<any>('/payments/checkout-session', data);
    return response;
  },

  /**
   * Create Stripe customer
   * POST /payments/customer
   */
  async createStripeCustomer(): Promise<{
    customerId: string;
    alreadyExists: boolean;
  }> {
    const response = await api.post<{
      customerId: string;
      alreadyExists: boolean;
    }>('/payments/customer');
    return response;
  },

  /**
   * Get customer payment methods (Stripe)
   * GET /payments/payment-methods
   */
  async getCustomerPaymentMethods(): Promise<any> {
    const response = await api.get<any>('/payments/payment-methods');
    return response;
  },

  /**
   * Attach payment method (Stripe)
   * POST /payments/payment-methods/attach
   */
  async attachPaymentMethod(paymentMethodId: string): Promise<any> {
    const response = await api.post<any>('/payments/payment-methods/attach', { paymentMethodId });
    return response;
  },

  /**
   * Detach payment method (Stripe)
   * DELETE /payments/payment-methods/:id
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<any> {
    const response = await api.delete<any>(`/payments/payment-methods/${paymentMethodId}`);
    return response;
  },

  // ============================================
  // M-PESA SPECIFIC METHODS
  // ============================================

  /**
   * Initiate M-Pesa STK Push payment
   * POST /payments/mpesa-stk-push
   */
  async initiateMpesaSTKPush(data: MpesaSTKPushRequest): Promise<{
    success: boolean;
    data: MpesaSTKPushResponse & { paymentId?: string };
    message: string;
  }> {
    const response = await api.post<{
      success: boolean;
      data: MpesaSTKPushResponse & { paymentId?: string };
      message: string;
    }>('/payments/mpesa-stk-push', data);
    return response;
  },

  /**
   * Query M-Pesa transaction status
   * GET /payments/mpesa-status/:transactionId
   */
  async queryMpesaStatus(transactionId: string): Promise<{
    success: boolean;
    data: any;
    payment: any;
    message: string;
  }> {
    const response = await api.get<{
      success: boolean;
      data: any;
      payment: any;
      message: string;
    }>(`/payments/mpesa-status/${transactionId}`);
    return response;
  },

  /**
   * Process M-Pesa B2C payment
   * POST /payments/mpesa-b2c
   */
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
    const response = await api.post<{
      success: boolean;
      data: any;
      message: string;
    }>('/payments/mpesa-b2c', data);
    return response;
  },

  // ============================================
  // PAYPAL SPECIFIC METHODS
  // ============================================

  /**
   * Capture PayPal order (after user approval)
   * POST /payments/paypal/capture
   */
  async capturePayPalOrder(orderId: string): Promise<{
    success: boolean;
    data: PayPalCaptureResponse;
    message: string;
  }> {
    const response = await api.post<{
      success: boolean;
      data: PayPalCaptureResponse;
      message: string;
    }>('/payments/paypal/capture', { orderId });
    return response;
  },

  // ============================================
  // FLUTTERWAVE SPECIFIC METHODS
  // ============================================

  /**
   * Create Flutterwave virtual account
   * POST /payments/flutterwave/virtual-account
   */
  async createFlutterwaveVirtualAccount(data: FlutterwaveVirtualAccountRequest): Promise<{
    success: boolean;
    data: FlutterwaveVirtualAccountResponse;
    message: string;
  }> {
    const response = await api.post<{
      success: boolean;
      data: FlutterwaveVirtualAccountResponse;
      message: string;
    }>('/payments/flutterwave/virtual-account', data);
    return response;
  },

  // ============================================
  // PAYSTACK SPECIFIC METHODS
  // ============================================

  /**
   * Verify Paystack payment
   * POST /payments/paystack/verify
   */
  async verifyPaystackPayment(reference: string): Promise<{
    success: boolean;
    data: PaystackVerifyResponse;
    message: string;
  }> {
    const response = await api.post<{
      success: boolean;
      data: PaystackVerifyResponse;
      message: string;
    }>('/payments/paystack/verify', { reference });
    return response;
  },

  /**
   * Verify Paystack payment with reference in URL
   * GET /payments/paystack/verify/:reference
   */
  async verifyPaystackPaymentByReference(reference: string): Promise<{
    success: boolean;
    data: PaystackVerifyResponse;
    message: string;
  }> {
    const response = await api.get<{
      success: boolean;
      data: PaystackVerifyResponse;
      message: string;
    }>(`/payments/paystack/verify/${reference}`);
    return response;
  },

  // ============================================
  // SQUARE SPECIFIC METHODS
  // ============================================

  /**
   * Process Square payment using card nonce
   * POST /payments/square/payment
   */
  async processSquareCardPayment(data: SquarePaymentRequest): Promise<{
    success: boolean;
    data: Payment;
    message: string;
  }> {
    const response = await api.post<{
      success: boolean;
      data: Payment;
      message: string;
    }>('/payments/square/payment', data);
    return response;
  },

  /**
   * Create Square customer
   * POST /payments/square/customer
   */
  async createSquareCustomer(data: SquareCustomerRequest): Promise<{
    success: boolean;
    data: SquareCustomerResponse;
    message: string;
  }> {
    const response = await api.post<{
      success: boolean;
      data: SquareCustomerResponse;
      message: string;
    }>('/payments/square/customer', data);
    return response;
  },

  // ============================================
  // PAYMENT UTILITY METHODS
  // ============================================

  /**
   * Get payment method icon
   */
  getPaymentMethodIcon(method: string): string {
    const icons: Record<string, string> = {
      'CASH': '💰',
      'CREDIT_CARD': '💳',
      'DEBIT_CARD': '💳',
      'MOBILE_MONEY': '📱',
      'BANK_TRANSFER': '🏦',
      'GIFT_CARD': '🎁',
      'LOYALTY_POINTS': '⭐',
      'CHECK': '📝',
      'PAYPAL': '💸',
      'FLUTTERWAVE': '🌊',
      'PAYSTACK': '🔷',
      'SQUARE': '⬜',
      'MTN': '📱',
      'AIRTEL': '📱',
    };
    return icons[method] || '💳';
  },

  /**
   * Get payment method label
   */
  getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      'CASH': 'Cash',
      'CREDIT_CARD': 'Credit Card',
      'DEBIT_CARD': 'Debit Card',
      'MOBILE_MONEY': 'Mobile Money',
      'BANK_TRANSFER': 'Bank Transfer',
      'GIFT_CARD': 'Gift Card',
      'LOYALTY_POINTS': 'Loyalty Points',
      'CHECK': 'Check',
      'PAYPAL': 'PayPal',
      'FLUTTERWAVE': 'Flutterwave',
      'PAYSTACK': 'Paystack',
      'SQUARE': 'Square',
      'MTN': 'MTN Mobile Money',
      'AIRTEL': 'Airtel Money',
    };
    return labels[method] || method;
  },

  /**
   * Get payment status color
   */
  getPaymentStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'PAID': 'green',
      'PENDING': 'yellow',
      'FAILED': 'red',
      'REFUNDED': 'gray',
      'PARTIAL': 'blue',
      'PROCESSING': 'purple',
      'AUTHORIZED': 'indigo',
      'DECLINED': 'red',
      'DISPUTED': 'orange',
      'CANCELLED': 'gray',
    };
    return colors[status] || 'gray';
  },

  /**
   * Get provider name
   */
  getProviderName(provider: string): string {
    const names: Record<string, string> = {
      'STRIPE': 'Stripe',
      'CASH': 'Cash',
      'MOBILE_MONEY': 'Mobile Money',
      'BANK_TRANSFER': 'Bank Transfer',
      'GIFT_CARD': 'Gift Card',
      'LOYALTY_POINTS': 'Loyalty Points',
      'PAYPAL': 'PayPal',
      'FLUTTERWAVE': 'Flutterwave',
      'PAYSTACK': 'Paystack',
      'SQUARE': 'Square',
      'MTN': 'MTN Mobile Money',
      'AIRTEL': 'Airtel Money',
    };
    return names[provider] || provider;
  },

  /**
   * Get provider icon
   */
  getProviderIcon(provider: string): string {
    const icons: Record<string, string> = {
      'STRIPE': '💳',
      'CASH': '💰',
      'MOBILE_MONEY': '📱',
      'BANK_TRANSFER': '🏦',
      'GIFT_CARD': '🎁',
      'LOYALTY_POINTS': '⭐',
      'PAYPAL': '💸',
      'FLUTTERWAVE': '🌊',
      'PAYSTACK': '🔷',
      'SQUARE': '⬜',
    };
    return icons[provider] || '💳';
  },

  /**
   * Format payment method for display
   */
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

  /**
   * Check if payment method is card
   */
  isCardPayment(method: string): boolean {
    return method === 'CREDIT_CARD' || method === 'DEBIT_CARD';
  },

  /**
   * Check if payment method requires redirect
   */
  requiresRedirect(method: string): boolean {
    return method === 'CREDIT_CARD' || method === 'DEBIT_CARD' || 
           method === 'BANK_TRANSFER' || method === 'PAYPAL' ||
           method === 'FLUTTERWAVE' || method === 'PAYSTACK';
  },

  /**
   * Check if payment method is instant
   */
  isInstantPayment(method: string): boolean {
    return method === 'CASH' || method === 'CREDIT_CARD' || method === 'DEBIT_CARD' || 
           method === 'MOBILE_MONEY' || method === 'LOYALTY_POINTS' || method === 'GIFT_CARD' ||
           method === 'SQUARE';
  },

  /**
   * Get supported providers for a payment method
   */
  getSupportedProviders(paymentMethod: string): PaymentProvider[] {
    const providerMap: Record<string, PaymentProvider[]> = {
      'CASH': [PaymentProvider.CASH],
      'CREDIT_CARD': [PaymentProvider.STRIPE, PaymentProvider.PAYSTACK, PaymentProvider.FLUTTERWAVE, PaymentProvider.SQUARE],
      'DEBIT_CARD': [PaymentProvider.STRIPE, PaymentProvider.PAYSTACK, PaymentProvider.FLUTTERWAVE, PaymentProvider.SQUARE],
      'MOBILE_MONEY': [PaymentProvider.MOBILE_MONEY, PaymentProvider.MTN, PaymentProvider.AIRTEL, PaymentProvider.FLUTTERWAVE, PaymentProvider.PAYSTACK],
      'BANK_TRANSFER': [PaymentProvider.BANK_TRANSFER, PaymentProvider.FLUTTERWAVE, PaymentProvider.PAYSTACK],
      'GIFT_CARD': [PaymentProvider.GIFT_CARD],
      'LOYALTY_POINTS': [PaymentProvider.LOYALTY_POINTS],
      'PAYPAL': [PaymentProvider.PAYPAL],
      'FLUTTERWAVE': [PaymentProvider.FLUTTERWAVE],
      'PAYSTACK': [PaymentProvider.PAYSTACK],
      'SQUARE': [PaymentProvider.SQUARE],
    };
    return providerMap[paymentMethod] || [];
  },

  /**
   * Get provider display name
   */
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
      [PaymentProvider.PAYSTACK]: 'Paystack',
      [PaymentProvider.SQUARE]: 'Square',
      [PaymentProvider.MTN]: 'MTN Mobile Money',
      [PaymentProvider.AIRTEL]: 'Airtel Money',
    };
    return names[provider] || provider;
  },

  /**
   * Check if a provider is configured
   */
  isProviderConfigured(provider: PaymentProviderStatus): boolean {
    return provider.configured === true;
  },

  /**
   * Check if a provider is active
   */
  isProviderActive(provider: PaymentProviderStatus): boolean {
    return provider.isActive === true;
  },

  /**
   * Check if a provider is healthy
   */
  isProviderHealthy(provider: PaymentProviderStatus): boolean {
    return provider.isHealthy === true;
  },

  /**
   * Get provider status badge color
   */
  getProviderStatusColor(provider: PaymentProviderStatus): string {
    if (!provider.isActive) return 'bg-gray-500';
    if (!provider.isHealthy) return 'bg-red-500';
    if (!provider.configured) return 'bg-yellow-500';
    return 'bg-green-500';
  },

  /**
   * Get provider status label
   */
  getProviderStatusLabel(provider: PaymentProviderStatus): string {
    if (!provider.isActive) return 'Inactive';
    if (!provider.isHealthy) return 'Unhealthy';
    if (!provider.configured) return 'Not Configured';
    return 'Active';
  },

  /**
   * Calculate total volume across all providers
   */
  getTotalVolume(providers: PaymentProviderStatus[]): number {
    return providers.reduce((sum, p) => sum + (p.volume24h || 0), 0);
  },

  /**
   * Calculate total transactions across all providers
   */
  getTotalTransactions(providers: PaymentProviderStatus[]): number {
    return providers.reduce((sum, p) => sum + (p.transactions24h || 0), 0);
  },

  /**
   * Get the most used provider
   */
  getMostUsedProvider(providers: PaymentProviderStatus[]): PaymentProviderStatus | null {
    if (!providers || providers.length === 0) return null;
    return providers.reduce((max, p) => 
      (p.transactions24h || 0) > (max.transactions24h || 0) ? p : max
    );
  },

  /**
   * Get the provider with highest volume
   */
  getHighestVolumeProvider(providers: PaymentProviderStatus[]): PaymentProviderStatus | null {
    if (!providers || providers.length === 0) return null;
    return providers.reduce((max, p) => 
      (p.volume24h || 0) > (max.volume24h || 0) ? p : max
    );
  },

  /**
   * Check if provider requires card nonce (Square)
   */
  requiresCardNonce(method: string): boolean {
    return method === 'SQUARE';
  },

  /**
   * Check if provider requires redirect URL
   */
  requiresRedirectUrl(method: string): boolean {
    return method === 'PAYPAL' || method === 'FLUTTERWAVE' || method === 'PAYSTACK';
  },

  /**
   * Get payment method type category
   */
  getPaymentMethodCategory(method: string): 'card' | 'mobile' | 'bank' | 'cash' | 'digital' | 'other' {
    const categories: Record<string, 'card' | 'mobile' | 'bank' | 'cash' | 'digital' | 'other'> = {
      'CREDIT_CARD': 'card',
      'DEBIT_CARD': 'card',
      'MOBILE_MONEY': 'mobile',
      'MTN': 'mobile',
      'AIRTEL': 'mobile',
      'BANK_TRANSFER': 'bank',
      'CASH': 'cash',
      'GIFT_CARD': 'digital',
      'LOYALTY_POINTS': 'digital',
      'PAYPAL': 'digital',
      'FLUTTERWAVE': 'digital',
      'PAYSTACK': 'digital',
      'SQUARE': 'card',
    };
    return categories[method] || 'other';
  },

  /**
 * Add item to cart with proper validation
 */
  async addItem(productId: string, quantity: number = 1, variantId?: string): Promise<any> {
    try {
      // ✅ FIXED: Validate productId
      if (!productId || productId.trim() === '') {
        throw new Error('Product ID is required');
      }

      // ✅ FIXED: Ensure productId is a valid string
      const sanitizedProductId = productId.trim();
      
      const payload = {
        productId: sanitizedProductId,
        quantity: Math.max(1, quantity),
        ...(variantId && { variantId: variantId.trim() }),
      };

      console.log('🛒 CartService.addItem - Sending payload:', payload);

      const response = await api.post('/cart/items', payload);
      return response;
    } catch (error: any) {
      console.error('❌ CartService.addItem - Error:', error);
      if (error?.response?.status === 400) {
        const errorData = error.response?.data;
        if (errorData?.errors) {
          const errorMessages = errorData.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ');
          throw new Error(`Validation error: ${errorMessages}`);
        }
        if (errorData?.message) {
          throw new Error(errorData.message);
        }
      }
      throw error;
    }
  }
};

export default paymentService;
