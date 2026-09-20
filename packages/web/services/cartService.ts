// D:\Projects\Kalwanga\packages\web\services\cartService.ts

import { api } from './api';
import type { PaymentMethod } from './saleService';

export type { PaymentMethod } from './saleService';

// ============================================
// TYPES
// ============================================

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerId?: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  businessUnitId: string;
  userId: string;
  notes?: string;
  status: 'ACTIVE' | 'SAVED' | 'CHECKED_OUT' | 'ABANDONED';
  itemCount: number;
  discountType?: 'PERCENTAGE' | 'FIXED';
  promotionCode?: string;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    images: string[];
  };
  /**
   * `null` is accepted at the client boundary because some callers
   * (e.g. the POS quick-add flow) send `variantId: null` explicitly.
   * The backend normalizes it to `undefined` before touching Prisma.
   */
  variantId?: string | null;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: any;
  };
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
  availableStock: number;
  isInStock: boolean;
}

export interface CartSummary {
  id: string;
  itemCount: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
    variantName?: string;
  }>;
}

export interface CartHistoryResponse {
  carts: any[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface SyncResult {
  valid: boolean;
  issues: string[];
}

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
  tipAmount?: number;
  /**
   * Optional idempotency key. When provided, the same value sent twice
   * results in the same sale being returned — no duplicate. Generate
   * with `newIdempotencyKey()` and reuse it across retries.
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
}

export interface CartCountResponse {
  count: number;
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'json' | 'pdf';
  metrics: string[];
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

export interface RecoverCartOptions {
  cartId: string;
  notifyUser?: boolean;
  message?: string;
}

export interface SendReminderOptions {
  cartId: string;
  message?: string;
  email?: string;
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
  // Fallback for older environments.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );
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

// ============================================
// CART SERVICE
// ============================================

export const cartService = {
  // ============================================
  // CORE CART OPERATIONS
  // ============================================

  /**
   * Get current user's cart
   * GET /cart
   */
  async getCart(): Promise<Cart> {
    try {
      const response = await api.get<Cart>('/cart');
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to fetch cart:', error);
      throw error;
    }
  },

  /**
   * Get cart by ID
   * GET /cart/:id
   */
  async getCartById(id: string): Promise<Cart> {
    if (!id) {
      throw new Error('Cart ID is required');
    }
    try {
      const response = await api.get<Cart>(`/cart/${id}`);
      return response;
    } catch (error: any) {
      logCartError(`❌ Failed to fetch cart ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get cart count
   * GET /cart/count
   */
  async getCartCount(): Promise<CartCountResponse> {
    try {
      const response = await api.get<CartCountResponse>('/cart/count');
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to fetch cart count:', error);
      return { count: 0 };
    }
  },

  /**
   * Add item to cart
   * POST /cart/items
   *
   * Note: no `unitPrice` is sent. The server looks it up.
   */
  async addItem(data: {
    productId: string;
    variantId?: string | null;
    quantity?: number;
  }): Promise<Cart> {
    if (!data.productId) {
      throw new Error('Product ID is required');
    }

    const payload = {
      productId: data.productId,
      variantId: data.variantId ?? undefined,
      quantity: data.quantity || 1,
    };

    try {
      const response = await api.post<Cart>('/cart/items', payload);
      return response;
    } catch (error: any) {
      logCartError('❌ CartService.addItem - Error:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * Add multiple items to cart
   * POST /cart/items/bulk
   */
  async addMultipleItems(
    items: Array<{
      productId: string;
      variantId?: string | null;
      quantity?: number;
    }>,
  ): Promise<Cart> {
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
      quantity: item.quantity || 1,
    }));

    const payload = { items: normalizedItems };

    try {
      const response = await api.post<Cart>('/cart/items/bulk', payload);
      return response;
    } catch (error: any) {
      logCartError('❌ CartService.addMultipleItems - Error:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * Update cart item quantity
   * PUT /cart/items/:itemId
   */
  async updateItemQuantity(
    itemId: string,
    quantity: number,
  ): Promise<Cart> {
    if (!itemId) {
      throw new Error('Item ID is required');
    }
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }

    try {
      const response = await api.put<Cart>(`/cart/items/${itemId}`, {
        quantity,
      });
      return response;
    } catch (error: any) {
      logCartError(`❌ Failed to update item ${itemId}:`, error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * Remove item from cart
   * DELETE /cart/items/:itemId
   */
  async removeItem(itemId: string): Promise<Cart> {
    if (!itemId) {
      throw new Error('Item ID is required');
    }

    try {
      const response = await api.delete<Cart>(
        `/cart/items/${itemId}`,
      );
      return response;
    } catch (error: any) {
      logCartError(`❌ Failed to remove item ${itemId}:`, error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * Clear cart
   * DELETE /cart
   */
  async clearCart(): Promise<Cart> {
    try {
      const response = await api.delete<Cart>('/cart');
      return response;
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

  /**
   * Apply discount to cart
   * POST /cart/discount
   */
  async applyDiscount(
    discount: number,
    discountType?: 'PERCENTAGE' | 'FIXED',
  ): Promise<Cart> {
    if (discount < 0) {
      throw new Error('Discount cannot be negative');
    }

    const payload = {
      discount,
      discountType: discountType || 'FIXED',
    };

    try {
      const response = await api.post<Cart>('/cart/discount', payload);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to apply discount:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * Apply promotion to cart
   * POST /cart/promotion
   */
  async applyPromotion(promotionCode: string): Promise<Cart> {
    if (!promotionCode) {
      throw new Error('Promotion code is required');
    }

    try {
      const response = await api.post<Cart>('/cart/promotion', {
        promotionCode,
      });
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to apply promotion:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * Apply loyalty points to cart
   * POST /cart/loyalty
   */
  async applyLoyaltyPoints(
    customerId: string,
    points: number,
  ): Promise<Cart> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }
    if (points <= 0) {
      throw new Error('Points must be positive');
    }

    try {
      const response = await api.post<Cart>('/cart/loyalty', {
        customerId,
        points,
      });
      return response;
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

  /**
   * Associate customer with cart
   * POST /cart/customer
   */
  async associateCustomer(customerId: string): Promise<Cart> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    try {
      const response = await api.post<Cart>('/cart/customer', {
        customerId,
      });
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to associate customer:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * Update cart notes
   * PATCH /cart/notes
   */
  async updateCartNotes(notes: string): Promise<Cart> {
    try {
      const response = await api.patch<Cart>('/cart/notes', { notes });
      return response;
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

  /**
   * Get cart summary
   * GET /cart/summary
   */
  async getCartSummary(): Promise<CartSummary> {
    try {
      const response = await api.get<CartSummary>('/cart/summary');
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to fetch cart summary:', error);
      throw error;
    }
  },

  /**
   * Get cart history
   * GET /cart/history
   */
  async getCartHistory(params?: {
    page?: number;
    limit?: number;
  }): Promise<CartHistoryResponse> {
    try {
      const response = await api.get<CartHistoryResponse>(
        '/cart/history',
        { params },
      );
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to fetch cart history:', error);
      throw error;
    }
  },

  // ============================================
  // SYNC & SAVE
  // ============================================

  /**
   * Sync cart with inventory
   * POST /cart/sync
   */
  async syncCart(): Promise<SyncResult> {
    try {
      const response = await api.post<SyncResult>('/cart/sync');
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to sync cart:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * Save cart for later
   * POST /cart/save-for-later
   */
  async saveCartForLater(): Promise<Cart> {
    try {
      const response = await api.post<Cart>('/cart/save-for-later');
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to save cart for later:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * Restore a saved cart
   * POST /cart/restore
   */
  async restoreSavedCart(savedCartId: string): Promise<Cart> {
    if (!savedCartId) {
      throw new Error('Saved cart ID is required');
    }

    try {
      const response = await api.post<Cart>('/cart/restore', {
        savedCartId,
      });
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to restore saved cart:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * Transfer cart to another user
   * POST /cart/transfer
   */
  async transferCart(
    fromUserId: string,
    toUserId: string,
  ): Promise<Cart> {
    if (!fromUserId) {
      throw new Error('Source user ID is required');
    }
    if (!toUserId) {
      throw new Error('Target user ID is required');
    }

    try {
      const response = await api.post<Cart>('/cart/transfer', {
        fromUserId,
        toUserId,
      });
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to transfer cart:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * Split cart
   * POST /cart/split
   */
  async splitCart(
    items: Array<{
      cartItemId: string;
      quantity: number;
      targetUserId: string;
    }>,
  ): Promise<any> {
    if (!items || items.length === 0) {
      throw new Error('At least one item split is required');
    }

    try {
      const response = await api.post<{
        sourceCart: Cart;
        targetCarts: Cart[];
      }>('/cart/split', { items });
      return response;
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
   * Delegates to the canonical `POST /checkout` endpoint via the
   * `checkoutService` module. Kept here for backward compatibility with
   * callers that already use `cartService.checkoutCart`.
   *
   * Because it goes through the same endpoint as
   * `checkoutService.processCheckout`, there is exactly one server-side
   * implementation of the money math and inventory mutation.
   *
   * Callers must supply `idempotencyKey` to guard against double-submit.
   * Use `newIdempotencyKey()` from this module.
   */
  async checkoutCart(options: CheckoutOptions): Promise<any> {
    if (!options.paymentMethod) {
      throw new Error('Payment method is required');
    }
    if (options.paidAmount < 0) {
      throw new Error('Paid amount cannot be negative');
    }

    // Fetch the active cart to obtain its ID. The backend does not
    // accept a bare "checkout the current user's cart" call — it wants
    // an explicit cartId.
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
      idempotencyKey: options.idempotencyKey,
    };

    try {
      const response = await api.post<any>('/checkout', payload);
      return response;
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

  /**
   * Get cart analytics
   * GET /cart/analytics
   */
  async getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    period?: string;
  }): Promise<any> {
    try {
      const response = await api.get('/cart/analytics', { params });
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to fetch cart analytics:', error);
      throw error;
    }
  },

  /**
   * Export cart analytics
   * POST /cart/analytics/export
   */
  async exportAnalytics(options: ExportOptions): Promise<Blob> {
    if (!options.format) {
      throw new Error('Export format is required');
    }
    if (!options.metrics || options.metrics.length === 0) {
      throw new Error('At least one metric is required');
    }

    try {
      const response = (await api.post(
        '/cart/analytics/export',
        options,
        { responseType: 'blob' },
      )) as Blob;
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to export analytics:', error);
      if (error?.response?.data) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          throw new Error(parsed?.message || 'Export failed');
        } catch {
          throw error;
        }
      }
      throw error;
    }
  },

  /**
   * Export cart history
   * POST /cart/history/export
   */
  async exportHistory(options: ExportHistoryOptions): Promise<Blob> {
    if (!options.format) {
      throw new Error('Export format is required');
    }

    try {
      const response = (await api.post(
        '/cart/history/export',
        options,
        { responseType: 'blob' },
      )) as Blob;
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to export cart history:', error);
      if (error?.response?.data) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          throw new Error(parsed?.message || 'Export failed');
        } catch {
          throw error;
        }
      }
      throw error;
    }
  },

  /**
   * Export abandoned carts
   * POST /cart/abandoned/export
   */
  async exportAbandonedCarts(
    options: ExportAbandonedOptions,
  ): Promise<Blob> {
    if (!options.format) {
      throw new Error('Export format is required');
    }

    try {
      const response = (await api.post(
        '/cart/abandoned/export',
        options,
        { responseType: 'blob' },
      )) as Blob;
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to export abandoned carts:', error);
      if (error?.response?.data) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          throw new Error(parsed?.message || 'Export failed');
        } catch {
          throw error;
        }
      }
      throw error;
    }
  },

  // ============================================
  // ABANDONED CART MANAGEMENT
  // ============================================

  /**
   * Get abandoned carts
   * GET /cart/abandoned
   */
  async getAbandonedCarts(params?: {
    hours?: number;
    minValue?: number;
    page?: number;
    limit?: number;
  }): Promise<any> {
    try {
      const response = await api.get('/cart/abandoned', { params });
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to fetch abandoned carts:', error);
      throw error;
    }
  },

  /**
   * Recover an abandoned cart
   * POST /cart/recover
   */
  async recoverCart(options: RecoverCartOptions): Promise<any> {
    if (!options.cartId) {
      throw new Error('Cart ID is required');
    }

    try {
      const response = await api.post('/cart/recover', options);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to recover cart:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  /**
   * Send a reminder for an abandoned cart
   * POST /cart/send-reminder
   */
  async sendReminder(options: SendReminderOptions): Promise<any> {
    if (!options.cartId) {
      throw new Error('Cart ID is required');
    }

    try {
      const response = await api.post('/cart/send-reminder', options);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to send reminder:', error);
      const message = extractErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }
  },

  // ============================================
  // POS / ORDER FORM ALIASES
  // ============================================
  //
  // Convenience wrappers used by OrderForm.tsx. They delegate to the
  // methods above so behaviour stays identical and there's a single
  // source of truth.

  /**
   * Alias for getCart(). The active cart is the current user's
   * cart — the backend lazily creates one on first access.
   */
  async getActiveCart(_businessUnitId?: string): Promise<Cart> {
    return this.getCart();
  },

  /**
   * Attach or clear a customer on the active cart. Delegates to
   * `associateCustomer` when a customer is provided; posts a null
   * customerId when the caller wants to clear.
   */
  async setCustomer(customerId: string | null): Promise<Cart> {
    if (!customerId) {
      try {
        const response = await api.post<Cart>('/cart/customer', {
          customerId: null,
        });
        return response;
      } catch (error: any) {
        logCartError('❌ Failed to clear cart customer:', error);
        throw error;
      }
    }
    return this.associateCustomer(customerId);
  },

  /**
   * Alias for updateItemQuantity. Used by OrderForm's +/- buttons.
   */
  async updateItem(
    itemId: string,
    data: { quantity?: number; discount?: number },
  ): Promise<Cart> {
    if (data.quantity === undefined) {
      // Nothing to update — re-fetch and return current state.
      return this.getCart();
    }
    return this.updateItemQuantity(itemId, data.quantity);
  },
};

export default cartService;
