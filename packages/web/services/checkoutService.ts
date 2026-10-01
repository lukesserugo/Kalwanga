// packages/web/services/checkoutService.ts

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

  ChargePreviewRequest,
  ChargePreviewResponse,

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

  ChargePreviewRequest,
  ChargePreviewResponse,

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
// The backend supports three mobile-money providers:
//
//   MPESA   → mpesaService (Safaricom STK push), selected via
//             `paymentMethod: 'MPESA'`
//   MTN     → mobileMoneyService.initiatePayment('MTN', ...)
//             selected via `paymentMethod: 'MTN'` or via
//             `paymentMethod: 'MOBILE_MONEY'` + this field set
//   AIRTEL  → mobileMoneyService.initiatePayment('AIRTEL', ...)
//             selected the same way
//
// The frontend uses this field to tell the backend which of the
// MTN/AIRTEL sub-providers the user picked when the umbrella
// `MOBILE_MONEY` method is chosen.
//
// ⚠ Only MTN and AIRTEL are routed through this field. `MPESA`
//   is a distinct `paymentMethod` — sending
//   `{ paymentMethod: 'MOBILE_MONEY', mobileMoneyProvider: 'MPESA' }`
//   routes to the MTN/AIRTEL handler family, which has no MPESA
//   branch and will reject. Use `paymentMethod: 'MPESA'` instead.
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

    /**
   * Manual card data for CREDIT_CARD / DEBIT_CARD.
   *
   * The raw PAN, expiry, CVC, and cardholder name. `checkoutService`
   * does NOT send these to the backend — before any network request
   * leaves the browser, `paymentService.createCardPaymentMethod()`
   * converts them to a Stripe PaymentMethod id (`pm_xxx`), and only
   * that id is forwarded as `paymentMethodId`. The backend never
   * sees the card number.
   */
  manualCard?: {
    number: string;
    expMonth: number;
    expYear: number;
    cvc: string;
    holder: string;
  };
  /**
   * Business unit override.
   *
   * The backend resolves the currency (and company, for audit
   * purposes) from this field when supplied, falling back to
   * `cart.businessUnitId` otherwise. As of the latest backend
   * controller rewrite, a caller-supplied value is *dropped* and
   * the cart's BU wins — the field exists on the wire for forward
   * compatibility and for admin tooling that needs to override the
   * BU on a specific sale. Most callers should omit it.
   */
  businessUnitId?: string;

  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  customerAddress?: string;

  /**
   * Idempotency key.
   *
   * ⚠ Strongly recommended. The backend's idempotency short-circuit
   *   only fires when this key is present. Omit it and every retry
   *   creates a fresh Sale and a fresh Payment. On the online path
   *   that means a client retry after a network drop can produce a
   *   second PaymentIntent (Stripe) or STK push (M-Pesa).
   *
   * Prefer a UUID. The backend persists this on
   * `Sale.idempotencyKey` (a `@unique` column). The web's
   * `newIdempotencyKey()` from `cartService` produces a UUID and is
   * the right thing to call here.
   *
   * ⚠ Do NOT reuse a key from a previous *successful* attempt on
   *   the same cart. The backend will short-circuit and return the
   *   original Sale, which is usually what you want — but if the
   *   user is deliberately re-checking out after an edit, generate
   *   a fresh key.
   */
  idempotencyKey?: string;

  returnUrl?: string;
  cancelUrl?: string;

  /** Square Web SDK card nonce. Required for `SQUARE`. */
  cardNonce?: string;
  /** Stripe PaymentMethod id (pm_xxx) for server-side confirm. */
  paymentMethodId?: string;
  /**
   * Gift card code for `paymentMethod === 'GIFT_CARD'`. The service
   * also mirrors this onto `gatewayId` in the outgoing payload so
   * backends that expect the code there resolve it correctly.
   */
  giftCardCode?: string;
  /**
   * Backend-compatible gift-card code key. Prefer `giftCardCode` —
   * this field exists for callers that need to bypass the mirror
   * (e.g. when both keys carry different values, which is not
   * recommended). When both are set, the service sends both and the
   * backend reads `giftCardCode ?? gatewayId`.
   */
  gatewayId?: string;

  /**
   * Mobile-money provider selector.
   *
   * Only meaningful when `paymentMethod === 'MOBILE_MONEY'`. Tells
   * the backend whether to route to MTN or Airtel.
   *
   * ⚠ Do NOT send `'MPESA'` here. The backend's MOBILE_MONEY
   *   handler family covers MTN and Airtel only. To route to
   *   M-Pesa, set `paymentMethod: 'MPESA'` instead.
   *
   * When omitted, the backend defaults to `'MTN'`.
   */
  mobileMoneyProvider?: MobileMoneyProvider;

  discountType?: DiscountType | null;
  promotionCode?: string | null;
  promotionDiscount?: number;

  // ── Phase D1: charge-currency acknowledgement ────────────
  /**
   * The payer's affirmative acceptance of the converted charge
   * amount, shown on the pre-payment screen.
   *
   * ⚠ Send `true` ONLY when the payer has seen the conversion
   *   preview (via `checkoutService.chargePreview(...)`) and
   *   ticked the confirm box. The backend rejects the checkout
   *   with a 409 and `code: 'CHARGE_CONTEXT_REQUIRED'` when a
   *   conversion is required and this field is absent or `false`.
   *
   *   When the charge currency equals the ledger currency (the
   *   common case), this field is ignored.
   *
   *   Get the preview first. If
   *   `preview.charge.currency === preview.ledger.currency`,
   *   no conversion is happening and this field is unnecessary.
   */
  chargeContextAcknowledged?: boolean;
}

/**
 * Discriminated union describing what the frontend must do next
 * after `POST /checkout/online` returns.
 *
 * ⚠ A 409 `IDEMPOTENCY_CANCELLED` response does NOT contain a
 *   `nextAction` — the request failed at the idempotency layer
 *   before any gateway call. Detect it with `isIdempotencyConflict`
 *   and prompt a retry, not by reading `nextAction`.
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
// Three of them require the frontend to react differently from the
// generic "show the error message" path:
//
//   409 IDEMPOTENCY_CANCELLED
//     The previous attempt at this idempotency key failed and was
//     cancelled. The caller should clear its cached key and retry.
//     Showing the raw 409 body to the user is confusing; the UX
//     should be a "please retry" prompt.
//
//   409 CHARGE_CONTEXT_REQUIRED (Phase D1)
//     The resolved charge currency differs from the ledger
//     currency and the payer has not acknowledged the converted
//     amount. The caller should re-fetch the charge preview via
//     `chargePreview(...)`, render it, and require the payer to
//     tick the confirm box before retrying. Do NOT retry with
//     `chargeContextAcknowledged: true` on the client's own
//     initiative — the payer must see the (possibly changed)
//     amount before agreeing to it.
//
//   503 (any message)
//     The server is missing credentials for the chosen provider.
//     Not retryable from the client. The message is already
//     user-friendly ("M-Pesa is not configured. Please contact
//     support.") so it's fine to surface verbatim, but callers
//     might want to disable the corresponding method button.

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
 * True if the thrown error is the "converted charge not
 * acknowledged" 409 from the backend.
 *
 * The payload carries `code: 'CHARGE_CONTEXT_REQUIRED'`. The
 * caller should re-fetch the charge preview via
 * `checkoutService.chargePreview(...)`, re-render the confirm
 * screen with the fresh rate, and require the payer to
 * acknowledge again. Do NOT auto-retry with
 * `chargeContextAcknowledged: true` — the payer must see the
 * new amount before agreeing to it.
 */
export function isChargeContextRequired(error: unknown): boolean {
  const anyErr = error as {
    response?: {
      status?: number;
      data?: { code?: string };
    };
  };

  return (
    anyErr?.response?.status === 409 &&
    anyErr?.response?.data?.code === 'CHARGE_CONTEXT_REQUIRED'
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
   *
   * ⚠ Prefer `processCheckout` — it forwards every optional field
   *   (`cashRegisterId`, `idempotencyKey`, promotion fields, etc.)
   *   that the backend accepts. This method sends `data` verbatim,
   *   which works if `CheckoutData` already carries what you need
   *   but will silently drop anything the type doesn't declare.
   */
  async createCheckout(
    data: CheckoutData,
  ): Promise<CheckoutResponse> {
    return api.post<CheckoutResponse>('/checkout', data);
  },

  /**
   * Process an OFFLINE checkout (cash / bank transfer / check).
   * POST /checkout
   *
   * Card / PayPal / Flutterwave / Square / Mobile Money are
   * rejected by the backend with a 400 pointing at
   * `POST /checkout/online`. Use `processOnlineCheckout` for those.
   *
   * ⚠ Offline methods never convert — the ledger currency is the
   *   charge currency by construction. `chargeContextAcknowledged`
   *   is forwarded for parity with the online path in case a
   *   future offline method does convert.
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

    // ── Phase D1: charge-currency acknowledgement ────────
    // Offline methods never convert, but forwarded for parity
    // with the online path in case a future method does.
    if (data.chargeContextAcknowledged !== undefined)
      payload.chargeContextAcknowledged = data.chargeContextAcknowledged;

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
   * Square / Mobile Money / M-Pesa / Gift card).
   * POST /checkout/online
   *
   * ⚠ `paidAmount` is NOT sent. The backend computes the total from
   *   the cart, product prices, and loyalty redemption. Sending a
   *   client-computed total is ignored on this path.
   *
   * ⚠ The backend's idempotency short-circuit only fires when
   *   `idempotencyKey` is present. Prefer `newIdempotencyKey()`
   *   from `cartService` and store it alongside the in-flight
   *   attempt so retries reuse it.
   *
   * ⚠ Phase D1: when the resolved charge currency differs from
   *   the ledger currency, the backend rejects the checkout with
   *   a 409 `CHARGE_CONTEXT_REQUIRED` unless
   *   `chargeContextAcknowledged: true` is on the body. Call
   *   `chargePreview(...)` first, render the disclosure and the
   *   converted amount, and set the flag only after the payer
   *   ticks the confirm box.
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
    // A caller-supplied `gatewayId` wins if present (documented
    // escape hatch on the request type).
    if (data.gatewayId !== undefined) {
      payload.gatewayId = data.gatewayId;
    }
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

    // ── Phase D1: charge-currency acknowledgement ────────
    // Only sent when the caller has explicitly acknowledged.
    // The backend rejects a converted charge without it.
    if (data.chargeContextAcknowledged !== undefined) {
      payload.chargeContextAcknowledged = data.chargeContextAcknowledged;
    }

    console.log('🌐 processOnlineCheckout payload:', payload);

    return api.post<OnlineCheckoutResponse>('/checkout/online', payload);
  },

  /**
   * Resolve the charge preview for a cart + payment method.
   * POST /checkout/charge-preview
   *
   * ⚠ Call this BEFORE `processOnlineCheckout`. When the cart's
   *   ledger currency is not accepted by the chosen gateway, the
   *   response carries:
   *     • `charge.total`  — the amount the gateway will bill, in
   *                         `charge.currency`
   *     • `rate.value`    — the rate applied
   *     • `disclosure`    — the sentence the payer must read
   *     • `requiresPayerConfirmation: true`
   *
   *   Render all four. Do NOT paraphrase the disclosure. When
   *   `requiresPayerConfirmation` is true, block the confirm
   *   button until the payer ticks a checkbox, then send
   *   `chargeContextAcknowledged: true` on
   *   `processOnlineCheckout`.
   *
   * ⚠ `available: false` is NOT an error. The response has no
   *   `charge` block and a `reason` string. Render the reason and
   *   disable the payment method — there is no FX rate for this
   *   pair, so the charge cannot proceed. Do not call
   *   `processOnlineCheckout` in this state.
   *
   * ⚠ Read-only. Nothing is written server-side. Calling this
   *   for every method the payer hovers over is safe and cheap.
   *   Rates can move between preview and checkout; when they do,
   *   the checkout returns 409 `CHARGE_CONTEXT_REQUIRED` and the
   *   frontend must re-fetch the preview via
   *   `isChargeContextRequired(err)`.
   */
  async chargePreview(
    data: ChargePreviewRequest,
  ): Promise<ChargePreviewResponse> {
    const payload: Record<string, unknown> = {
      cartId: data.cartId,
      paymentMethod: data.paymentMethod,
    };

    if (data.mobileMoneyProvider !== undefined) {
      payload.mobileMoneyProvider = data.mobileMoneyProvider;
    }

    const response = await api.post<
      CheckoutSingleResponse<ChargePreviewResponse>
    >('/checkout/charge-preview', payload);

    return response.data;
  },

  /**
   * Process checkout with integrated payment.
   *
   * ⚠ The backend only returns a `payment` on routes that create
   *   one. If the response lacks a `payment`, this method throws
   *   rather than fabricating a `Payment` object — the previous
   *   behaviour returned a plain object literal that looked like a
   *   `Payment` but had no `id`, `userId`, or `processedAt`, which
   *   silently broke every consumer that read those fields.
   *
   *   Use `processOnlineCheckout` if you need the payment.
   */
  async processCheckoutWithPayment(
    data: CheckoutData,
  ): Promise<CheckoutWithPaymentResponse> {
    const checkout = await this.processCheckout(data);

    const payment = checkout.payment as Payment | undefined;
    if (!payment || !payment.id) {
      throw new Error(
        'processCheckoutWithPayment: backend did not return a Payment. ' +
          'Use processOnlineCheckout() for gateway-backed checkouts, or ' +
          'read checkout.receipt for the offline summary.',
      );
    }

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
    // ⚠ The backend route reads `:id` — this method keeps the
    //   `saleId` parameter name for backward compatibility with
    //   existing callers, but the value goes into the URL's `:id`
    //   segment regardless.
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

  /**
   * Record an ADDITIONAL payment against an existing checkout
   * (split / partial tender).
   *
   * ⚠ This is NOT the gateway-call entry point. The initial card /
   *   PayPal / Flutterwave / Mobile Money charge happens on
   *   `POST /checkout/online`. Use this route only to record a
   *   second tender against the same sale.
   */
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

  /** @deprecated Renamed. Use `getCheckoutSummaryBySale`. */
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

  /**
   * Update checkout settings.
   *
   * ⚠ The backend validates the body with a `.strict()` schema.
   *   Unknown keys are rejected with a 400. `CheckoutSettingsUpdate`
   *   MUST match the backend's accepted key set exactly. If you
   *   add a field here and it's not on the backend schema, this
   *   call will start failing where it previously succeeded (the
   *   old backend controller didn't validate at all).
   */
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

  /**
   * Export checkouts (admin scope).
   *
   * `params` accepts either `dateFrom`/`dateTo` or
   * `startDate`/`endDate` — the backend controller reads both.
   */
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

  /**
   * Export checkout data (self-scoped).
   *
   * `params` accepts either `dateFrom`/`dateTo` or
   * `startDate`/`endDate` — the backend controller reads both.
   */
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
  //
  // These methods exist to document backend routes that the web
  // service has historically referenced but that don't exist on the
  // server. Calling them throws `NotImplementedError` immediately
  // with a message that names the missing route. This is safer than
  // a silent 404 — a compile-time `never` return type catches a
  // mistaken call at build time, and a loud runtime error names the
  // exact route a future contributor needs to add.

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
