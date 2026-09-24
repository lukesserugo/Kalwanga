// D:\Projects\Kalwanga\packages\web\services\checkoutService.ts

import { api } from './api';
import type { Sale } from '../types/sale';
import type { Payment } from '../types/payment';
import type { PaymentMethod } from './saleService';

export type { PaymentMethod } from './saleService';

export { newIdempotencyKey } from './cartService';

import type {
  DiscountType,
  CanonicalPaymentMethod,
  CheckoutSaleStatus,
  CheckoutPaymentStatus,

  CheckoutData,
  AddCheckoutItemRequest,
  UpdateCheckoutItemRequest,
  ProcessCheckoutPaymentRequest,
  ApplyCheckoutDiscountRequest,
  EmailCheckoutReceiptRequest,
  CancelCheckoutRequest,
  VoidCheckoutRequest,
  UpdateCheckoutRequest,
  GetCheckoutsQuery,
  GetCheckoutHistoryQuery,
  GetCustomerCheckoutHistoryQuery,
  GetCheckoutStatsQuery,
  ExportCheckoutsQuery,
  ExportCheckoutDataQuery,

  CheckoutPagination,
  CheckoutListResponse,
  CheckoutSingleResponse,
  CheckoutReceipt,
  CheckoutReceiptItem,
  CheckoutResponse,
  CheckoutWithPaymentResponse,
  CheckoutSummary,
  CheckoutSummaryItem,
  CheckoutStats,
  PaymentMethodOption,
  CheckoutSettings,
  CheckoutSettingsUpdate,
  CheckoutSettingsResponse,
  CheckoutExportJsonResponse,

  ValidateCheckoutRequest,
  ValidateCheckoutResponse,
  CalculateTotalsRequest,
  CalculateTotalsResponse,
} from '../types/checkout';

export type {
  DiscountType,
  CanonicalPaymentMethod,
  CheckoutSaleStatus,
  CheckoutPaymentStatus,
  CheckoutData,
  AddCheckoutItemRequest,
  UpdateCheckoutItemRequest,
  ProcessCheckoutPaymentRequest,
  ApplyCheckoutDiscountRequest,
  EmailCheckoutReceiptRequest,
  CancelCheckoutRequest,
  VoidCheckoutRequest,
  UpdateCheckoutRequest,
  GetCheckoutsQuery,
  GetCheckoutHistoryQuery,
  GetCustomerCheckoutHistoryQuery,
  GetCheckoutStatsQuery,
  ExportCheckoutsQuery,
  ExportCheckoutDataQuery,
  CheckoutPagination,
  CheckoutListResponse,
  CheckoutSingleResponse,
  CheckoutReceipt,
  CheckoutReceiptItem,
  CheckoutResponse,
  CheckoutWithPaymentResponse,
  CheckoutSummary,
  CheckoutSummaryItem,
  CheckoutStats,
  PaymentMethodOption,
  CheckoutSettings,
  CheckoutSettingsUpdate,
  CheckoutSettingsResponse,
  CheckoutExportJsonResponse,
  ValidateCheckoutRequest,
  ValidateCheckoutResponse,
  CalculateTotalsRequest,
  CalculateTotalsResponse,
};

// ============================================
// MOBILE MONEY PROVIDER (backend routing hint)
// ============================================
//
// The backend supports three mobile-money providers, all of which
// arrive as `paymentMethod: 'MOBILE_MONEY'`:
//
//   MPESA   → mpesaService (Safaricom STK push)
//   MTN     → mobileMoneyService.initiatePayment('MTN', ...)
//   AIRTEL  → mobileMoneyService.initiatePayment('AIRTEL', ...)
//
// The frontend uses this field to tell the backend which provider
// the user picked. Without it, the backend defaults to MPESA.
//
// ⚠ This field is opt-in. If the backend deployment hasn't been
//   updated to accept it, it's silently ignored (Zod strips
//   unknown keys). Safe to send in all cases.

export type MobileMoneyProvider = 'MPESA' | 'MTN' | 'AIRTEL';

// ============================================
// ONLINE CHECKOUT — GATEWAY TYPES
// ============================================

export interface OnlineCheckoutRequest {
  cartId: string;
  customerId?: string;
  paymentMethod: CanonicalPaymentMethod | string;

  discount?: number;
  notes?: string;
  applyLoyaltyPoints?: boolean;
  businessUnitId?: string;

  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  customerAddress?: string;

  idempotencyKey?: string;

  returnUrl?: string;
  cancelUrl?: string;

  /** Square Web SDK card nonce. Required for `SQUARE`. */
  cardNonce?: string;
  /** Stripe PaymentMethod id (pm_xxx) for server-side confirm. */
  paymentMethodId?: string;
  /**
   * Gift card code for `paymentMethod === 'GIFT_CARD'`. The service
   * also mirrors this onto `gatewayId` so backends that expect the
   * code there resolve it correctly.
   */
  giftCardCode?: string;

  /**
   * Mobile-money provider selector.
   *
   * Only meaningful when `paymentMethod === 'MOBILE_MONEY'`. Tells
   * the backend whether to route to M-Pesa, MTN, or Airtel.
   *
   * When omitted, the backend defaults to `'MPESA'` (the historical
   * behaviour).
   */
  mobileMoneyProvider?: MobileMoneyProvider;

  discountType?: DiscountType | null;
  promotionCode?: string | null;
  promotionDiscount?: number;
}

/**
 * Discriminated union describing what the frontend must do next
 * after `POST /checkout/online` returns.
 */
export type NextAction =
  | { type: 'CONFIRM_STRIPE'; clientSecret: string }
  | { type: 'REDIRECT'; url: string }
  | { type: 'AWAIT_STK_PUSH'; message: string; checkoutRequestId: string }
  | { type: 'OFFLINE'; message: string }
  | { type: 'NONE' };

export interface OnlineCheckoutResponse extends CheckoutResponse {
  clientSecret?: string;
  redirectUrl?: string;
  mpesa?: {
    checkoutRequestId: string;
    customerMessage: string;
  };
  nextAction: NextAction;
}

// ============================================
// BACKWARD-COMPATIBLE LIST RESPONSES
// ============================================

function withLegacyListAccessors<T>(
  response: CheckoutListResponse<T>,
): CheckoutListResponse<T> & {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
} {
  const { pagination } = response;

  Object.defineProperties(response, {
    total: {
      get: () => pagination.total,
      enumerable: false,
      configurable: true,
    },
    page: {
      get: () => pagination.page,
      enumerable: false,
      configurable: true,
    },
    totalPages: {
      get: () => pagination.totalPages,
      enumerable: false,
      configurable: true,
    },
    limit: {
      get: () => pagination.limit,
      enumerable: false,
      configurable: true,
    },
  });

  return response as CheckoutListResponse<T> & {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export type CheckoutListReturn<T> = CheckoutListResponse<T> & {
  /** @deprecated Read `pagination.total`. */
  total: number;
  /** @deprecated Read `pagination.page`. */
  page: number;
  /** @deprecated Read `pagination.totalPages`. */
  totalPages: number;
  /** @deprecated Read `pagination.limit`. */
  limit: number;
};

// ============================================
// NOT-IMPLEMENTED GUARD
// ============================================

class NotImplementedError extends Error {
  readonly methodName: string;
  readonly missingRoute: string;

  constructor(methodName: string, missingRoute: string) {
    super(
      `checkoutService.${methodName} calls ${missingRoute}, which is not ` +
        `implemented on the backend. Either add the route or remove the ` +
        `method from the web service.`,
    );
    this.name = 'NotImplementedError';
    this.methodName = methodName;
    this.missingRoute = missingRoute;
  }
}

function notImplemented(
  methodName: string,
  missingRoute: string,
): never {
  throw new NotImplementedError(methodName, missingRoute);
}

export { NotImplementedError };

// ============================================
// ERROR CLASSIFICATION HELPERS
// ============================================
//
// The backend can reject an online checkout for several reasons.
// Two of them require the frontend to react differently from the
// generic "show the error message" path:
//
//   409 IDEMPOTENCY_CANCELLED
//     The previous attempt at this idempotency key failed and was
//     cancelled. The caller should clear its cached key and retry.
//     Showing the raw 409 body to the user is confusing; the UX
//     should be a "please retry" prompt.
//
//   503 M-Pesa not configured
//     The server is missing M-Pesa credentials. Not retryable from
//     the client. The message is already user-friendly ("M-Pesa is
//     not configured. Please contact support.") so it's fine to
//     surface verbatim, but callers might want to disable the
//     M-Pesa button.

/**
 * True if the thrown error is the "previous idempotency key
 * matched a cancelled sale" 409 from the backend.
 *
 * Callers that hold an idempotency key should clear it and prompt
 * the user to retry. The next submission will be treated as a
 * fresh attempt by the backend.
 */
export function isIdempotencyConflict(error: unknown): boolean {
  const anyErr = error as {
    response?: {
      status?: number;
      data?: { code?: string };
    };
  };

  return (
    anyErr?.response?.status === 409 &&
    anyErr?.response?.data?.code === 'IDEMPOTENCY_CANCELLED'
  );
}

/**
 * True if the thrown error is a "provider not configured" 503.
 *
 * The provider is not retryable from the client. The caller should
 * surface the message and (optionally) disable the method.
 */
export function isProviderUnavailable(error: unknown): boolean {
  const anyErr = error as {
    response?: { status?: number };
  };
  return anyErr?.response?.status === 503;
}

// ============================================
// CHECKOUT SERVICE
// ============================================

export const checkoutService = {
  // ============================================
  // CORE CHECKOUT OPERATIONS
  // ============================================

  /**
   * Create a new checkout from a cart.
   * POST /checkout
   */
  async createCheckout(
    data: CheckoutData,
  ): Promise<CheckoutResponse> {
    return api.post<CheckoutResponse>('/checkout', data);
  },

  /**
   * Process an OFFLINE checkout (cash / bank transfer / check).
   * POST /checkout
   */
  async processCheckout(
    data: CheckoutData,
  ): Promise<CheckoutResponse> {
    const payload: Record<string, unknown> = {
      cartId: data.cartId,
      paymentMethod: data.paymentMethod,
      paidAmount: data.paidAmount,
    };

    if (data.customerId !== undefined) payload.customerId = data.customerId;
    if (data.discount !== undefined) payload.discount = data.discount;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.cashRegisterId !== undefined)
      payload.cashRegisterId = data.cashRegisterId;
    if (data.cashRegisterSessionId !== undefined)
      payload.cashRegisterSessionId = data.cashRegisterSessionId;
    if (data.applyLoyaltyPoints !== undefined)
      payload.applyLoyaltyPoints = data.applyLoyaltyPoints;
    if (data.businessUnitId !== undefined)
      payload.businessUnitId = data.businessUnitId;
    if (data.customerEmail !== undefined)
      payload.customerEmail = data.customerEmail;
    if (data.customerPhone !== undefined)
      payload.customerPhone = data.customerPhone;
    if (data.customerName !== undefined)
      payload.customerName = data.customerName;
    if (data.customerAddress !== undefined)
      payload.customerAddress = data.customerAddress;
    if (data.idempotencyKey !== undefined)
      payload.idempotencyKey = data.idempotencyKey;

    if (data.discountType !== undefined)
      payload.discountType = data.discountType;
    if (data.promotionCode !== undefined)
      payload.promotionCode = data.promotionCode;
    if (data.promotionDiscount !== undefined)
      payload.promotionDiscount = data.promotionDiscount;

    if (data.cardNonce !== undefined) payload.cardNonce = data.cardNonce;
    if (data.giftCardCode !== undefined) {
      payload.giftCardCode = data.giftCardCode;
      if (payload.gatewayId === undefined) {
        payload.gatewayId = data.giftCardCode;
      }
    }

    console.log('🧾 processCheckout payload:', payload);

    return api.post<CheckoutResponse>('/checkout', payload);
  },

  /**
   * Process an ONLINE checkout (card / PayPal / Flutterwave /
   * Paystack / Square / Mobile Money / M-Pesa / Gift card).
   * POST /checkout/online
   */
  async processOnlineCheckout(
    data: OnlineCheckoutRequest,
  ): Promise<OnlineCheckoutResponse> {
    const payload: Record<string, unknown> = {
      cartId: data.cartId,
      paymentMethod: data.paymentMethod,
    };

    if (data.customerId !== undefined)
      payload.customerId = data.customerId;
    if (data.discount !== undefined) payload.discount = data.discount;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.applyLoyaltyPoints !== undefined)
      payload.applyLoyaltyPoints = data.applyLoyaltyPoints;
    if (data.businessUnitId !== undefined)
      payload.businessUnitId = data.businessUnitId;

    if (data.customerEmail !== undefined)
      payload.customerEmail = data.customerEmail;
    if (data.customerPhone !== undefined)
      payload.customerPhone = data.customerPhone;
    if (data.customerName !== undefined)
      payload.customerName = data.customerName;
    if (data.customerAddress !== undefined)
      payload.customerAddress = data.customerAddress;

    if (data.idempotencyKey !== undefined)
      payload.idempotencyKey = data.idempotencyKey;

    if (data.returnUrl !== undefined) payload.returnUrl = data.returnUrl;
    if (data.cancelUrl !== undefined) payload.cancelUrl = data.cancelUrl;
    if (data.cardNonce !== undefined) payload.cardNonce = data.cardNonce;
    if (data.paymentMethodId !== undefined)
      payload.paymentMethodId = data.paymentMethodId;

    // Gift card code: sent under both names so backends that read
    // `giftCardCode` and backends that read `gatewayId` both work.
    if (data.giftCardCode !== undefined) {
      payload.giftCardCode = data.giftCardCode;
      if (payload.gatewayId === undefined) {
        payload.gatewayId = data.giftCardCode;
      }
    }

    // Mobile-money provider hint. Only sent when the caller
    // supplied it. Ignored by backends that haven't added the
    // field yet (Zod strips unknown keys).
    if (data.mobileMoneyProvider !== undefined) {
      payload.mobileMoneyProvider = data.mobileMoneyProvider;
    }

    if (data.discountType !== undefined)
      payload.discountType = data.discountType;
    if (data.promotionCode !== undefined)
      payload.promotionCode = data.promotionCode;
    if (data.promotionDiscount !== undefined)
      payload.promotionDiscount = data.promotionDiscount;

    console.log('🌐 processOnlineCheckout payload:', payload);

    return api.post<OnlineCheckoutResponse>('/checkout/online', payload);
  },

  /**
   * Process checkout with integrated payment.
   */
  async processCheckoutWithPayment(
    data: CheckoutData,
  ): Promise<CheckoutWithPaymentResponse> {
    const checkout = await this.processCheckout(data);

    const payment: Payment =
      checkout.payment ??
      ({
        saleId: checkout.sale.id,
        amount: checkout.receipt.total,
        paymentMethod: checkout.receipt.paymentMethod,
        status: 'PAID',
      } as unknown as Payment);

    return { checkout, payment };
  },

  // ============================================
  // LIST / READ
  // ============================================

  async getCheckouts(
    params?: GetCheckoutsQuery,
  ): Promise<CheckoutListReturn<Sale>> {
    const response = await api.get<CheckoutListResponse<Sale>>(
      '/checkout',
      { params },
    );
    return withLegacyListAccessors(response);
  },

  async getCheckoutById(id: string): Promise<Sale> {
    return api.get<Sale>(`/checkout/${id}`);
  },

  async getCheckoutByReceiptNumber(
    receiptNumber: string,
  ): Promise<Sale> {
    return api.get<Sale>(`/checkout/receipt/${receiptNumber}`);
  },

  async getCheckoutHistory(
    params?: GetCheckoutHistoryQuery,
  ): Promise<CheckoutListReturn<Sale>> {
    const response = await api.get<CheckoutListResponse<Sale>>(
      '/checkout/history',
      { params },
    );
    return withLegacyListAccessors(response);
  },

  async getCustomerCheckoutHistory(
    customerId: string,
    params?: GetCustomerCheckoutHistoryQuery,
  ): Promise<
    CheckoutListReturn<Sale> & {
      /** @deprecated Read `data`. */
      history: Sale[];
    }
  > {
    const response = await api.get<CheckoutListResponse<Sale>>(
      `/checkout/customer/${customerId}/history`,
      { params },
    );
    const withList = withLegacyListAccessors(response);

    Object.defineProperty(withList, 'history', {
      get: () => withList.data,
      enumerable: false,
      configurable: true,
    });

    return withList as CheckoutListReturn<Sale> & { history: Sale[] };
  },

  // ============================================
  // UPDATE / STATUS
  // ============================================

  async updateCheckout(
    id: string,
    data: UpdateCheckoutRequest,
  ): Promise<Sale> {
    return api.put<Sale>(`/checkout/${id}`, data);
  },

  async completeCheckout(id: string): Promise<Sale> {
    return api.post<Sale>(`/checkout/${id}/complete`);
  },

  async cancelCheckout(
    id: string,
    data?: CancelCheckoutRequest,
  ): Promise<Sale> {
    return api.post<Sale>(`/checkout/${id}/cancel`, data ?? {});
  },

  async voidCheckout(
    saleId: string,
    data?: VoidCheckoutRequest,
  ): Promise<Sale> {
    return api.post<Sale>(`/checkout/${saleId}/void`, data ?? {});
  },

  async deleteCheckout(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    return api.delete<{ success: boolean; message: string }>(
      `/checkout/${id}`,
    );
  },

  // ============================================
  // CHECKOUT ITEM OPERATIONS
  // ============================================

  async getCheckoutItems(id: string): Promise<CheckoutReceiptItem[]> {
    return api.get<CheckoutReceiptItem[]>(`/checkout/${id}/items`);
  },

  async addCheckoutItem(
    id: string,
    data: AddCheckoutItemRequest,
  ): Promise<Sale> {
    return api.post<Sale>(`/checkout/${id}/items`, data);
  },

  async updateCheckoutItem(
    id: string,
    itemId: string,
    data: UpdateCheckoutItemRequest,
  ): Promise<Sale> {
    return api.put<Sale>(`/checkout/${id}/items/${itemId}`, data);
  },

  async removeCheckoutItem(
    id: string,
    itemId: string,
  ): Promise<{ success: boolean; message: string }> {
    return api.delete<{ success: boolean; message: string }>(
      `/checkout/${id}/items/${itemId}`,
    );
  },

  // ============================================
  // DISCOUNT OPERATIONS
  // ============================================

  async applyDiscount(
    id: string,
    data: ApplyCheckoutDiscountRequest,
  ): Promise<Sale> {
    return api.post<Sale>(`/checkout/${id}/discount`, data);
  },

  async removeDiscount(id: string): Promise<Sale> {
    return api.delete<Sale>(`/checkout/${id}/discount`);
  },

  // ============================================
  // PAYMENT OPERATIONS (POST-CHECKOUT)
  // ============================================

  async processPayment(
    id: string,
    data: ProcessCheckoutPaymentRequest,
  ): Promise<Payment> {
    return api.post<Payment>(`/checkout/${id}/pay`, data);
  },

  async getPaymentMethods(): Promise<PaymentMethodOption[]> {
    const response = await api.get<
      CheckoutSingleResponse<PaymentMethodOption[]>
    >('/checkout/payment-methods');
    return response.data;
  },

  // ============================================
  // RECEIPT OPERATIONS
  // ============================================

  async getCheckoutReceipt(id: string): Promise<CheckoutReceipt> {
    return api.get<CheckoutReceipt>(`/checkout/${id}/receipt`);
  },

  async getCheckoutSummaryByCart(
    cartId: string,
  ): Promise<CheckoutSummary> {
    return api.get<CheckoutSummary>(`/checkout/summary/${cartId}`);
  },

  async getCheckoutSummaryBySale(
    id: string,
  ): Promise<CheckoutSummary> {
    return api.get<CheckoutSummary>(`/checkout/${id}/summary`);
  },

  /** @deprecated Renamed. */
  async getCheckoutSummary(id: string): Promise<CheckoutSummary> {
    return api.get<CheckoutSummary>(`/checkout/${id}/summary`);
  },

  async sendReceiptEmail(
    id: string,
    data?: EmailCheckoutReceiptRequest,
  ): Promise<{ success: boolean; message: string; email: string }> {
    return api.post<{
      success: boolean;
      message: string;
      email: string;
    }>(`/checkout/${id}/email-receipt`, data ?? {});
  },

  // ============================================
  // STATISTICS OPERATIONS
  // ============================================

  async getCheckoutStats(
    params?: GetCheckoutStatsQuery,
  ): Promise<CheckoutStats> {
    return api.get<CheckoutStats>('/checkout/stats/summary', {
      params,
    });
  },

  // ============================================
  // SETTINGS OPERATIONS
  // ============================================

  async getCheckoutSettings(): Promise<CheckoutSettingsResponse> {
    return api.get<CheckoutSettingsResponse>('/checkout/settings');
  },

  async updateCheckoutSettings(
    settings: CheckoutSettingsUpdate,
  ): Promise<CheckoutSettingsResponse> {
    return api.put<CheckoutSettingsResponse>(
      '/checkout/settings',
      settings,
    );
  },

  // ============================================
  // EXPORT OPERATIONS
  // ============================================

  async exportCheckouts(
    params?: ExportCheckoutsQuery,
  ): Promise<Blob | CheckoutExportJsonResponse> {
    const format = params?.format ?? 'csv';
    if (format === 'json') {
      return api.get<CheckoutExportJsonResponse>(
        '/checkout/export/all',
        { params },
      );
    }
    return api.get<Blob>('/checkout/export/all', {
      params,
      responseType: 'blob',
    });
  },

  async exportCheckoutData(
    params?: ExportCheckoutDataQuery,
  ): Promise<Blob | CheckoutExportJsonResponse> {
    const format = params?.format ?? 'csv';
    if (format === 'json') {
      return api.get<CheckoutExportJsonResponse>('/checkout/export', {
        params,
      });
    }
    return api.get<Blob>('/checkout/export', {
      params,
      responseType: 'blob',
    });
  },

  // ============================================
  // UNIMPLEMENTED BACKEND ROUTES
  // ============================================

  /** @deprecated Backend has no `POST /checkout/validate`. */
  async validateCheckout(
    _data: ValidateCheckoutRequest,
  ): Promise<ValidateCheckoutResponse> {
    return notImplemented(
      'validateCheckout',
      'POST /checkout/validate',
    );
  },

  /** @deprecated Backend has no `POST /checkout/calculate`. */
  async calculateTotals(
    _data: CalculateTotalsRequest,
  ): Promise<CalculateTotalsResponse> {
    return notImplemented(
      'calculateTotals',
      'POST /checkout/calculate',
    );
  },

  /** @deprecated Use `getCheckoutStats()`. */
  async getStats(): Promise<never> {
    return notImplemented('getStats', 'GET /checkout/stats');
  },

  /** @deprecated Backend has no `GET /checkout/stats/export`. */
  async exportStats(): Promise<never> {
    return notImplemented(
      'exportStats',
      'GET /checkout/stats/export',
    );
  },

  /** @deprecated Backend has no `GET /checkout/:id/payment-status`. */
  async getCheckoutPaymentStatus(_checkoutId: string): Promise<never> {
    return notImplemented(
      'getCheckoutPaymentStatus',
      'GET /checkout/:id/payment-status',
    );
  },

  /** @deprecated Backend has no `GET /checkout/:id/payments`. */
  async getCheckoutPayments(_checkoutId: string): Promise<never> {
    return notImplemented(
      'getCheckoutPayments',
      'GET /checkout/:id/payments',
    );
  },

  /** @deprecated Backend has no `POST /checkout/:id/refund`. */
  async refundCheckoutPayment(
    _checkoutId: string,
    _data: {
      paymentId: string;
      amount?: number;
      reason?: string;
    },
  ): Promise<never> {
    return notImplemented(
      'refundCheckoutPayment',
      'POST /checkout/:id/refund',
    );
  },

  /** @deprecated Use `getCheckoutByReceiptNumber(receiptNumber)`. */
  async getReceiptByNumber(_receiptNumber: string): Promise<never> {
    return notImplemented(
      'getReceiptByNumber',
      'GET /checkout/receipt/number/:receiptNumber',
    );
  },

  /** @deprecated Use `getCheckouts({ limit, offset })`. */
  async getAllCheckouts(): Promise<never> {
    return notImplemented(
      'getAllCheckouts',
      'GET /checkout/admin/all',
    );
  },

  /** @deprecated Use `sendReceiptEmail(id, { email })`. */
  async sendReceiptEmailLegacy(
    _saleId: string,
    _email: string,
  ): Promise<never> {
    return notImplemented(
      'sendReceiptEmailLegacy',
      'POST /checkout/receipt/email',
    );
  },

  /** @deprecated Backend has no `GET /checkout/receipt/print/:id`. */
  async printReceipt(_saleId: string): Promise<never> {
    return notImplemented(
      'printReceipt',
      'GET /checkout/receipt/print/:saleId',
    );
  },

  /** @deprecated Backend has no `GET /checkout/receipt/pdf/:id`. */
  async getReceiptPdf(_saleId: string): Promise<never> {
    return notImplemented(
      'getReceiptPdf',
      'GET /checkout/receipt/pdf/:saleId',
    );
  },

  /** @deprecated Backend has no `POST /checkout/receipt/resend`. */
  async resendReceiptEmail(_saleId: string): Promise<never> {
    return notImplemented(
      'resendReceiptEmail',
      'POST /checkout/receipt/resend',
    );
  },

  /** @deprecated Use `cancelCheckout(id, { reason })`. */
  async cancelCheckoutLegacy(
    _saleId: string,
    _reason?: string,
  ): Promise<never> {
    return notImplemented(
      'cancelCheckoutLegacy',
      'POST /checkout/cancel/:saleId',
    );
  },

  /** @deprecated Use `getCheckoutSummaryByCart(cartId)`. */
  async getCheckoutByCart(_cartId: string): Promise<never> {
    return notImplemented(
      'getCheckoutByCart',
      'GET /checkout/cart/:cartId',
    );
  },

  // ============================================
  // LEGACY / COMPATIBILITY (WORKING)
  // ============================================

  /** @deprecated Use `getCheckoutReceipt(id)`. */
  async getReceipt(id: string): Promise<CheckoutReceipt> {
    return this.getCheckoutReceipt(id);
  },
};

// ============================================
// MODULE-LEVEL RE-EXPORTS
// ============================================

export type { Sale };
export default checkoutService;
