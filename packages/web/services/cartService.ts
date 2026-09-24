// D:\Projects\Kalwanga\packages\web\services\cartService.ts

import { api } from './api';
import type { PaymentMethod } from './saleService';

export type { PaymentMethod } from './saleService';

// Re-export the canonical cart shapes so existing imports keep working.
// Do NOT redefine `Cart` or `CartItem` here — see `types/cart.ts`.
export type {
  Cart,
  CartItem,
  CartItemInput,
  CartCustomer,
  CartItemProduct,
  CartItemVariant,
  CartStatus,
  CartDiscountType,
  CartSummary,
  CartSummaryItem,
  CartCountResponse,
  CartHistoryResponse,
  SyncResult,
  SplitCartResult,
} from '../types/cart';

import type {
  Cart,
  CartItemInput,
  CartSummary,
  CartCountResponse,
  CartHistoryResponse,
  SyncResult,
  SplitCartResult,
} from '../types/cart';

// ============================================
// SERVICE-SPECIFIC TYPES
// ============================================

export interface CheckoutOptions {
  customerId?: string;
  /**
   * Narrowed to the shared canonical set so a typo becomes a build-time
   * error rather than a runtime 400 from the backend.
   */
  paymentMethod: PaymentMethod;
  /**
   * `0` is valid — loyalty-only and fully-discounted checkouts.
   */
  paidAmount: number;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  notes?: string;
  /**
   * Optional idempotency key. When omitted, `checkoutCart` generates a
   * fresh one via `newIdempotencyKey()`. If you plan to retry the same
   * logical submission, generate the key ONCE at the call site and pass
   * it in — a new key on every retry defeats the protection.
   */
  idempotencyKey?: string;
  /**
   * Apply the customer's loyalty points. Defaults to false server-side
   * if omitted.
   */
  applyLoyaltyPoints?: boolean;
  /** Manual discount applied on top of any cart-level discount. */
  discount?: number;
  /** Override the business unit for this checkout. */
  businessUnitId?: string;
  // NOTE: `tipAmount` is intentionally NOT accepted here. The backend
  // `checkoutSchema` does not declare it, and no downstream service
  // reads it. Passing it would be stripped by Zod with no effect —
  // better to fail the type check than mislead the caller.
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'json' | 'pdf';
  /**
   * Only meaningful for `/cart/analytics/export`. The
   * `/cart/history/export` and `/cart/abandoned/export` endpoints do
   * not consume `metrics`; omit it (or pass `[]`) for those.
   */
  metrics?: string[];
  dateRange: string;
  startDate?: string;
  endDate?: string;
  includeCharts: boolean;
  includeSummary: boolean;
  includeDetailedData: boolean;
}

export interface ExportHistoryOptions {
  format: 'csv' | 'excel' | 'json' | 'pdf';
  dateRange: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  includeItems?: boolean;
}

export interface ExportAbandonedOptions {
  format: 'csv' | 'excel' | 'json' | 'pdf';
  hours: number;
  minValue?: number;
  status?: string;
  includeCustomerDetails?: boolean;
}

// ============================================
// IDEMPOTENCY HELPER
// ============================================

/**
 * Generate a UUID v4 for idempotency. Callers should generate ONE key
 * per checkout attempt and reuse it if the request is retried. Do NOT
 * generate a new key on every retry — that defeats the protection.
 */
export function newIdempotencyKey(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof (crypto as any).randomUUID === 'function'
  ) {
    return (crypto as any).randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================
// ERROR HELPERS
// ============================================

function logCartError(context: string, error: any): void {
  console.error(context, {
    message: error?.response?.data?.message || error?.message,
    status: error?.response?.status,
    url: error?.config?.url,
    method: error?.config?.method,
    params: error?.config?.params,
  });
}

function extractErrorMessage(error: any): string | null {
  if (error?.response?.data?.message) {
    return String(error.response.data.message);
  }
  if (Array.isArray(error?.response?.data?.errors)) {
    return error.response.data.errors
      .map((e: any) => `${e.field || 'field'}: ${e.message}`)
      .join(', ');
  }
  return null;
}

/**
 * Normalize an axios-shaped response. Handles three cases:
 *
 *   1. The `api` wrapper already unwrapped `response.data` → return as-is.
 *   2. The caller received the raw axios envelope → return `.data`.
 *   3. Fallback → return the value unchanged.
 *
 * Used for both JSON and blob responses so callers get a consistent
 * shape regardless of how the underlying wrapper evolves.
 */
function unwrapResponse<T>(response: any): T {
  if (response == null) return response as T;
  if (typeof response === 'object' && 'data' in response) {
    // Heuristic: an axios response has `status`, `headers`, and `config`.
    // A domain object with a `data` field would not.
    const looksLikeAxiosEnvelope =
      'status' in response && 'headers' in response;
    if (looksLikeAxiosEnvelope) {
      return (response as any).data as T;
    }
  }
  return response as T;
}

/**
 * Coerce the result of a blob-typed request into an actual `Blob`.
 * Falls back to wrapping the payload so callers always receive a
 * `Blob` (even a diagnostic one) instead of `undefined`.
 */
function ensureBlob(response: any): Blob {
  if (response instanceof Blob) return response;
  const unwrapped = unwrapResponse<any>(response);
  if (unwrapped instanceof Blob) return unwrapped;
  return new Blob([unwrapped as any]);
}

/**
 * When a blob-typed response fails, axios stores the server's JSON
 * error body as a `Blob`. Read it, parse it, and return the message
 * so callers see a useful error instead of `[object Blob]`.
 */
async function extractBlobErrorMessage(
  error: any,
): Promise<string | null> {
  const direct = extractErrorMessage(error);
  if (direct) return direct;

  const data = error?.response?.data;
  if (data && typeof data.text === 'function') {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed?.message) return String(parsed.message);
    } catch {
      // Body was not JSON — fall through.
    }
  }
  return null;
}

// ============================================
// CART SERVICE
// ============================================

export const cartService = {
  // ============================================
  // CORE CART OPERATIONS
  // ============================================

  /** GET /cart */
  async getCart(): Promise<Cart> {
    try {
      return await api.get<Cart>('/cart');
    } catch (error: any) {
      logCartError('❌ Failed to fetch cart:', error);
      throw error;
    }
  },

  /** GET /cart/:id */
  async getCartById(id: string): Promise<Cart> {
    if (!id) throw new Error('Cart ID is required');
    try {
      return await api.get<Cart>(`/cart/${id}`);
    } catch (error: any) {
      logCartError(`❌ Failed to fetch cart ${id}:`, error);
      throw error;
    }
  },

  /**
   * GET /cart/count
   *
   * Non-fatal: returns `{ count: 0 }` on failure so a broken count
   * request never breaks the header. Logged at `warn` level to avoid
   * spamming `console.error` when the network is flaky.
   */
  async getCartCount(): Promise<CartCountResponse> {
    try {
      return await api.get<CartCountResponse>('/cart/count');
    } catch (error: any) {
      console.warn('⚠️ Failed to fetch cart count:', {
        message: error?.response?.data?.message || error?.message,
        status: error?.response?.status,
      });
      return { count: 0 };
    }
  },

  /**
   * POST /cart/items
   *
   * No `unitPrice` is sent — the server looks it up.
   */
  async addItem(data: CartItemInput): Promise<Cart> {
    if (!data.productId) throw new Error('Product ID is required');

    const payload = {
      productId: data.productId,
      variantId: data.variantId ?? undefined,
      quantity: data.quantity ?? 1,
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    };

    try {
      return await api.post<Cart>('/cart/items', payload);
    } catch (error: any) {
      logCartError('❌ CartService.addItem - Error:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /** POST /cart/items/bulk */
  async addMultipleItems(items: CartItemInput[]): Promise<Cart> {
    if (!items || items.length === 0) {
      throw new Error('At least one item is required');
    }
    for (const item of items) {
      if (!item.productId) {
        throw new Error('All items must have a product ID');
      }
    }

    const normalizedItems = items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? undefined,
      quantity: item.quantity ?? 1,
      ...(item.notes !== undefined ? { notes: item.notes } : {}),
    }));

    try {
      return await api.post<Cart>('/cart/items/bulk', {
        items: normalizedItems,
      });
    } catch (error: any) {
      logCartError('❌ CartService.addMultipleItems - Error:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /** PUT /cart/items/:itemId */
  async updateItemQuantity(itemId: string, quantity: number): Promise<Cart> {
    if (!itemId) throw new Error('Item ID is required');
    if (quantity < 0) throw new Error('Quantity cannot be negative');

    try {
      return await api.put<Cart>(`/cart/items/${itemId}`, { quantity });
    } catch (error: any) {
      logCartError(`❌ Failed to update item ${itemId}:`, error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /** DELETE /cart/items/:itemId */
  async removeItem(itemId: string): Promise<Cart> {
    if (!itemId) throw new Error('Item ID is required');

    try {
      return await api.delete<Cart>(`/cart/items/${itemId}`);
    } catch (error: any) {
      logCartError(`❌ Failed to remove item ${itemId}:`, error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /** DELETE /cart */
  async clearCart(): Promise<Cart> {
    try {
      return await api.delete<Cart>('/cart');
    } catch (error: any) {
      logCartError('❌ Failed to clear cart:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  // ============================================
  // DISCOUNTS & PROMOTIONS
  // ============================================

  /** POST /cart/discount */
  async applyDiscount(
    discount: number,
    discountType?: 'PERCENTAGE' | 'FIXED',
  ): Promise<Cart> {
    if (discount < 0) throw new Error('Discount cannot be negative');

    try {
      return await api.post<Cart>('/cart/discount', {
        discount,
        discountType: discountType ?? 'FIXED',
      });
    } catch (error: any) {
      logCartError('❌ Failed to apply discount:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /** POST /cart/promotion */
  async applyPromotion(promotionCode: string): Promise<Cart> {
    if (!promotionCode) throw new Error('Promotion code is required');

    try {
      return await api.post<Cart>('/cart/promotion', { promotionCode });
    } catch (error: any) {
      logCartError('❌ Failed to apply promotion:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /** POST /cart/loyalty */
  async applyLoyaltyPoints(customerId: string, points: number): Promise<Cart> {
    if (!customerId) throw new Error('Customer ID is required');
    if (points <= 0) throw new Error('Points must be positive');

    try {
      return await api.post<Cart>('/cart/loyalty', { customerId, points });
    } catch (error: any) {
      logCartError('❌ Failed to apply loyalty points:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  // ============================================
  // CUSTOMER ASSOCIATION
  // ============================================

  /** POST /cart/customer */
  async associateCustomer(customerId: string): Promise<Cart> {
    if (!customerId) throw new Error('Customer ID is required');

    try {
      return await api.post<Cart>('/cart/customer', { customerId });
    } catch (error: any) {
      logCartError('❌ Failed to associate customer:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * PATCH /cart/notes
   *
   * The backend stores `notes || ''`, so an empty string and
   * `undefined` are equivalent server-side. We send `''` explicitly to
   * keep the JSON payload stable across retries.
   */
  async updateCartNotes(notes?: string): Promise<Cart> {
    const payload = { notes: notes ?? '' };

    try {
      return await api.patch<Cart>('/cart/notes', payload);
    } catch (error: any) {
      logCartError('❌ Failed to update cart notes:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  // ============================================
  // SUMMARY & HISTORY
  // ============================================

  /** GET /cart/summary */
  async getCartSummary(): Promise<CartSummary> {
    try {
      return await api.get<CartSummary>('/cart/summary');
    } catch (error: any) {
      logCartError('❌ Failed to fetch cart summary:', error);
      throw error;
    }
  },

  /** GET /cart/history */
  async getCartHistory(params?: {
    page?: number;
    limit?: number;
  }): Promise<CartHistoryResponse> {
    try {
      return await api.get<CartHistoryResponse>('/cart/history', { params });
    } catch (error: any) {
      logCartError('❌ Failed to fetch cart history:', error);
      throw error;
    }
  },

  // ============================================
  // SYNC & SAVE
  // ============================================

  /** POST /cart/sync */
  async syncCart(): Promise<SyncResult> {
    try {
      return await api.post<SyncResult>('/cart/sync');
    } catch (error: any) {
      logCartError('❌ Failed to sync cart:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /** POST /cart/save-for-later */
  async saveCartForLater(): Promise<Cart> {
    try {
      return await api.post<Cart>('/cart/save-for-later');
    } catch (error: any) {
      logCartError('❌ Failed to save cart for later:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /** POST /cart/restore */
  async restoreSavedCart(savedCartId: string): Promise<Cart> {
    if (!savedCartId) throw new Error('Saved cart ID is required');

    try {
      return await api.post<Cart>('/cart/restore', { savedCartId });
    } catch (error: any) {
      logCartError('❌ Failed to restore saved cart:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /** POST /cart/transfer */
  async transferCart(fromUserId: string, toUserId: string): Promise<Cart> {
    if (!fromUserId) throw new Error('Source user ID is required');
    if (!toUserId) throw new Error('Target user ID is required');

    try {
      return await api.post<Cart>('/cart/transfer', {
        fromUserId,
        toUserId,
      });
    } catch (error: any) {
      logCartError('❌ Failed to transfer cart:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /** POST /cart/split */
  async splitCart(
    items: Array<{
      cartItemId: string;
      quantity: number;
      targetUserId: string;
    }>,
  ): Promise<SplitCartResult> {
    if (!items || items.length === 0) {
      throw new Error('At least one item split is required');
    }

    try {
      return await api.post<SplitCartResult>('/cart/split', { items });
    } catch (error: any) {
      logCartError('❌ Failed to split cart:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  // ============================================
  // CHECKOUT
  // ============================================

  /**
   * Checkout cart.
   *
   * Delegates to the canonical `POST /checkout` endpoint. Kept here
   * for backward compatibility with callers that already use
   * `cartService.checkoutCart`.
   *
   * Because it goes through the same endpoint as
   * `checkoutService.processCheckout`, there is exactly one server-side
   * implementation of the money math and inventory mutation.
   *
   * An `idempotencyKey` is generated automatically when the caller
   * does not supply one. If you plan to retry the same logical
   * submission, generate the key ONCE at the call site with
   * `newIdempotencyKey()` and pass it in — a new key on every retry
   * defeats the protection.
   */
  async checkoutCart(options: CheckoutOptions): Promise<any> {
    if (!options.paymentMethod) {
      throw new Error('Payment method is required');
    }
    if (options.paidAmount < 0) {
      throw new Error('Paid amount cannot be negative');
    }

    // Resolve the active cart. The backend requires an explicit
    // `cartId`; it does not accept a bare "checkout the current cart".
    let cartId: string;
    try {
      const cart = await this.getCart();
      cartId = cart.id;
    } catch (error: any) {
      logCartError(
        '❌ checkoutCart - failed to resolve active cart:',
        error,
      );
      throw new Error('No active cart to checkout');
    }

    const idempotencyKey =
      options.idempotencyKey ?? newIdempotencyKey();

    const payload = {
      cartId,
      customerId: options.customerId,
      paymentMethod: options.paymentMethod,
      paidAmount: options.paidAmount,
      cashRegisterId: options.cashRegisterId,
      cashRegisterSessionId: options.cashRegisterSessionId,
      notes: options.notes,
      discount: options.discount,
      applyLoyaltyPoints: options.applyLoyaltyPoints ?? false,
      businessUnitId: options.businessUnitId,
      idempotencyKey,
    };

    try {
      return await api.post<any>('/checkout', payload);
    } catch (error: any) {
      logCartError('❌ Failed to checkout:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  // ============================================
  // ANALYTICS & EXPORT
  // ============================================

  /** GET /cart/analytics */
  async getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    period?: string;
  }): Promise<any> {
    try {
      return await api.get('/cart/analytics', { params });
    } catch (error: any) {
      logCartError('❌ Failed to fetch cart analytics:', error);
      throw error;
    }
  },

  /** POST /cart/analytics/export */
  async exportAnalytics(options: ExportOptions): Promise<Blob> {
    if (!options.format) throw new Error('Export format is required');
    if (!options.metrics || options.metrics.length === 0) {
      throw new Error('At least one metric is required');
    }

    try {
      const response = await api.post(
        '/cart/analytics/export',
        options,
        { responseType: 'blob' },
      );
      return ensureBlob(response);
    } catch (error: any) {
      logCartError('❌ Failed to export analytics:', error);
      const message = await extractBlobErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /** POST /cart/history/export */
  async exportHistory(options: ExportHistoryOptions): Promise<Blob> {
    if (!options.format) throw new Error('Export format is required');

    try {
      const response = await api.post(
        '/cart/history/export',
        options,
        { responseType: 'blob' },
      );
      return ensureBlob(response);
    } catch (error: any) {
      logCartError('❌ Failed to export cart history:', error);
      const message = await extractBlobErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /** POST /cart/abandoned/export */
  async exportAbandonedCarts(
    options: ExportAbandonedOptions,
  ): Promise<Blob> {
    if (!options.format) throw new Error('Export format is required');

    try {
      const response = await api.post(
        '/cart/abandoned/export',
        options,
        { responseType: 'blob' },
      );
      return ensureBlob(response);
    } catch (error: any) {
      logCartError('❌ Failed to export abandoned carts:', error);
      const message = await extractBlobErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  // ============================================
  // ABANDONED CART MANAGEMENT
  // ============================================

  /** GET /cart/abandoned */
  async getAbandonedCarts(params?: {
    hours?: number;
    minValue?: number;
    page?: number;
    limit?: number;
  }): Promise<any> {
    try {
      return await api.get('/cart/abandoned', { params });
    } catch (error: any) {
      logCartError('❌ Failed to fetch abandoned carts:', error);
      throw error;
    }
  },

  // NOTE: `recoverCart()` and `sendReminder()` were removed.
  //
  // The backend route file (`packages/backend/src/routes/cart.ts`)
  // does NOT register `/cart/recover` or `/cart/send-reminder`. Any
  // call to those paths returned a 404. Exposing them from the client
  // service encouraged callers to depend on a nonexistent endpoint.
  //
  // When the backend adds these routes, re-add the methods here using
  // the same error-handling shape as `getAbandonedCarts`.

  // ============================================
  // POS / ORDER FORM ALIASES
  // ============================================
  //
  // Convenience wrappers used by OrderForm.tsx. They delegate to the
  // canonical methods above so behaviour stays identical and there is
  // a single source of truth.
  //
  // @deprecated Prefer the canonical method names in new code.

  /**
   * Alias for `getCart()`.
   *
   * @deprecated Use `getCart()` directly.
   *
   * NOTE: `businessUnitId` is accepted for call-site compatibility but
   * is not sent as a request parameter. The backend derives the
   * effective unit from the `x-business-unit-id` header (populated by
   * the request interceptor in `api.ts`) or from the user record.
   */
  async getActiveCart(_businessUnitId?: string): Promise<Cart> {
    return this.getCart();
  },

  /**
   * Attach a customer to the active cart.
   *
   * Clearing is unsupported: the backend `associateCustomerSchema`
   * requires a non-empty `customerId` and there is no dedicated
   * "unset customer" endpoint. Rather than fire a request that is
   * guaranteed to 400, this method throws a descriptive error when
   * `customerId` is falsy.
   *
   * If the product needs to genuinely detach a customer, the correct
   * user-facing action is "Clear Cart" (`clearCart()`) followed by
   * re-adding items — or a new backend endpoint
   * (`DELETE /cart/customer`).
   *
   * @deprecated Use `associateCustomer(customerId)` for the
   *   supported path. Do not call with `null` expecting a clear.
   */
  async setCustomer(customerId: string | null): Promise<Cart> {
    if (!customerId) {
      throw new Error(
        'Clearing a cart customer is not supported by the backend. ' +
          'Call clearCart() to reset the cart, or associate a different customer.',
      );
    }
    return this.associateCustomer(customerId);
  },

  /**
   * Alias for `updateItemQuantity`. Used by OrderForm's +/- buttons.
   *
   * @deprecated Use `updateItemQuantity(itemId, quantity)` directly.
   *
   * `discount` is accepted for signature compatibility but is not
   * forwarded — per-line discounts are computed server-side from
   * cart-level discount / promotion state. If you need to change a
   * cart-wide discount, use `applyDiscount()`.
   */
  async updateItem(
    itemId: string,
    data: { quantity?: number; discount?: number },
  ): Promise<Cart> {
    if (data.quantity === undefined) {
      return this.getCart();
    }
    return this.updateItemQuantity(itemId, data.quantity);
  },
};

export default cartService;
