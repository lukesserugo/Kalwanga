// D:\Projects\Kalwanga\packages\web\services\cartService.ts

import { api } from './api';

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
  variantId?: string;
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
  paymentMethod: string;
  paidAmount: number;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  notes?: string;
  tipAmount?: number;
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
// ERROR LOGGING HELPER
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
      console.log('🛒 Fetching cart...');
      const response = await api.get<Cart>('/cart');
      console.log('✅ Cart fetched successfully');
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
      console.log(`🛒 Fetching cart by ID: ${id}`);
      const response = await api.get<Cart>(`/cart/${id}`);
      console.log('✅ Cart fetched successfully');
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
      console.log('🛒 Fetching cart count...');
      const response = await api.get<CartCountResponse>('/cart/count');
      console.log('✅ Cart count fetched:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to fetch cart count:', error);
      return { count: 0 };
    }
  },

  /**
   * Add item to cart
   * POST /cart/items
   */
  async addItem(data: {
    productId: string;
    variantId?: string;
    quantity?: number;
  }): Promise<Cart> {
    if (!data.productId) {
      console.error(
        '❌ CartService.addItem: productId is required but was:',
        data
      );
      throw new Error('Product ID is required');
    }

    const payload = {
      productId: data.productId,
      variantId: data.variantId || undefined,
      quantity: data.quantity || 1,
    };

    console.log(
      '🛒 CartService.addItem - Sending payload:',
      JSON.stringify(payload, null, 2)
    );

    try {
      const response = await api.post<Cart>('/cart/items', payload);
      console.log('✅ CartService.addItem - Success:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ CartService.addItem - Error:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
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
      variantId?: string;
      quantity?: number;
    }>
  ): Promise<Cart> {
    if (!items || items.length === 0) {
      throw new Error('At least one item is required');
    }

    for (const item of items) {
      if (!item.productId) {
        throw new Error('All items must have a product ID');
      }
    }

    const payload = { items };
    console.log(
      '🛒 CartService.addMultipleItems - Sending payload:',
      JSON.stringify(payload, null, 2)
    );

    try {
      const response = await api.post<Cart>('/cart/items/bulk', payload);
      console.log('✅ CartService.addMultipleItems - Success:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ CartService.addMultipleItems - Error:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
      throw error;
    }
  },

  /**
   * Update cart item quantity
   * PUT /cart/items/:itemId
   */
  async updateItemQuantity(itemId: string, quantity: number): Promise<Cart> {
    if (!itemId) {
      throw new Error('Item ID is required');
    }
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }

    console.log(`🛒 Updating item ${itemId} quantity to ${quantity}`);

    try {
      const response = await api.put<Cart>(`/cart/items/${itemId}`, {
        quantity,
      });
      console.log('✅ Item quantity updated:', response);
      return response;
    } catch (error: any) {
      logCartError(`❌ Failed to update item ${itemId}:`, error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
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

    console.log(`🛒 Removing item ${itemId} from cart`);

    try {
      const response = await api.delete<Cart>(`/cart/items/${itemId}`);
      console.log('✅ Item removed:', response);
      return response;
    } catch (error: any) {
      logCartError(`❌ Failed to remove item ${itemId}:`, error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
      throw error;
    }
  },

  /**
   * Clear cart
   * DELETE /cart
   */
  async clearCart(): Promise<Cart> {
    console.log('🛒 Clearing cart');

    try {
      const response = await api.delete<Cart>('/cart');
      console.log('✅ Cart cleared:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to clear cart:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
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
    discountType?: 'PERCENTAGE' | 'FIXED'
  ): Promise<Cart> {
    if (discount < 0) {
      throw new Error('Discount cannot be negative');
    }

    const payload = {
      discount,
      discountType: discountType || 'FIXED',
    };

    console.log(
      `🛒 Applying ${discountType || 'FIXED'} discount: ${discount}`
    );

    try {
      const response = await api.post<Cart>('/cart/discount', payload);
      console.log('✅ Discount applied:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to apply discount:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
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

    console.log(`🛒 Applying promotion: ${promotionCode}`);

    try {
      const response = await api.post<Cart>('/cart/promotion', {
        promotionCode,
      });
      console.log('✅ Promotion applied:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to apply promotion:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
      throw error;
    }
  },

  /**
   * Apply loyalty points to cart
   * POST /cart/loyalty
   */
  async applyLoyaltyPoints(
    customerId: string,
    points: number
  ): Promise<Cart> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }
    if (points <= 0) {
      throw new Error('Points must be positive');
    }

    console.log(
      `🛒 Applying ${points} loyalty points for customer ${customerId}`
    );

    try {
      const response = await api.post<Cart>('/cart/loyalty', {
        customerId,
        points,
      });
      console.log('✅ Loyalty points applied:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to apply loyalty points:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
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

    console.log(`🛒 Associating customer ${customerId} with cart`);

    try {
      const response = await api.post<Cart>('/cart/customer', { customerId });
      console.log('✅ Customer associated:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to associate customer:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
      throw error;
    }
  },

  /**
   * Update cart notes
   * PATCH /cart/notes
   */
  async updateCartNotes(notes: string): Promise<Cart> {
    console.log(`🛒 Updating cart notes: ${notes}`);

    try {
      const response = await api.patch<Cart>('/cart/notes', { notes });
      console.log('✅ Cart notes updated:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to update cart notes:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
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
      console.log('🛒 Fetching cart summary...');
      const response = await api.get<CartSummary>('/cart/summary');
      console.log('✅ Cart summary fetched:', response);
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
      console.log('🛒 Fetching cart history...');
      const response = await api.get<CartHistoryResponse>('/cart/history', {
        params,
      });
      console.log('✅ Cart history fetched:', response);
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
    console.log('🛒 Syncing cart with inventory...');

    try {
      const response = await api.post<SyncResult>('/cart/sync');
      console.log('✅ Cart synced:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to sync cart:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
      throw error;
    }
  },

  /**
   * Save cart for later
   * POST /cart/save-for-later
   */
  async saveCartForLater(): Promise<Cart> {
    console.log('🛒 Saving cart for later...');

    try {
      const response = await api.post<Cart>('/cart/save-for-later');
      console.log('✅ Cart saved for later:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to save cart for later:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
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

    console.log(`🛒 Restoring saved cart: ${savedCartId}`);

    try {
      const response = await api.post<Cart>('/cart/restore', { savedCartId });
      console.log('✅ Saved cart restored:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to restore saved cart:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
      throw error;
    }
  },

  /**
   * Transfer cart to another user
   * POST /cart/transfer
   */
  async transferCart(fromUserId: string, toUserId: string): Promise<Cart> {
    if (!fromUserId) {
      throw new Error('Source user ID is required');
    }
    if (!toUserId) {
      throw new Error('Target user ID is required');
    }

    console.log(`🛒 Transferring cart from ${fromUserId} to ${toUserId}`);

    try {
      const response = await api.post<Cart>('/cart/transfer', {
        fromUserId,
        toUserId,
      });
      console.log('✅ Cart transferred:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to transfer cart:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
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
    }>
  ): Promise<any> {
    if (!items || items.length === 0) {
      throw new Error('At least one item split is required');
    }

    console.log(`🛒 Splitting cart with ${items.length} items`);

    try {
      const response = await api.post<{
        sourceCart: Cart;
        targetCarts: Cart[];
      }>('/cart/split', { items });
      console.log('✅ Cart split:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to split cart:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
      throw error;
    }
  },

  // ============================================
  // CHECKOUT
  // ============================================

  /**
   * Checkout cart
   * POST /cart/checkout
   */
  async checkoutCart(options: CheckoutOptions): Promise<any> {
    if (!options.paymentMethod) {
      throw new Error('Payment method is required');
    }
    if (!options.paidAmount || options.paidAmount <= 0) {
      throw new Error('Paid amount must be positive');
    }

    console.log('🛒 Checking out cart with options:', options);

    try {
      const response = await api.post<any>('/cart/checkout', options);
      console.log('✅ Checkout completed:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to checkout:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
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
      console.log('📊 Fetching cart analytics...');
      const response = await api.get('/cart/analytics', { params });
      console.log('✅ Cart analytics fetched:', response);
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

    console.log('📤 Exporting analytics with options:', options);

    try {
      const response = (await api.post('/cart/analytics/export', options, {
        responseType: 'blob',
      })) as Blob;

      console.log('✅ Analytics exported successfully');
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

    console.log('📤 Exporting cart history with options:', options);

    try {
      const response = (await api.post('/cart/history/export', options, {
        responseType: 'blob',
      })) as Blob;

      console.log('✅ Cart history exported successfully');
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
  async exportAbandonedCarts(options: ExportAbandonedOptions): Promise<Blob> {
    if (!options.format) {
      throw new Error('Export format is required');
    }

    console.log('📤 Exporting abandoned carts with options:', options);

    try {
      const response = (await api.post('/cart/abandoned/export', options, {
        responseType: 'blob',
      })) as Blob;

      console.log('✅ Abandoned carts exported successfully');
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
      console.log('🛒 Fetching abandoned carts...');
      const response = await api.get('/cart/abandoned', { params });
      console.log('✅ Abandoned carts fetched:', response);
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

    console.log('🔄 Recovering cart:', options.cartId);

    try {
      const response = await api.post('/cart/recover', options);
      console.log('✅ Cart recovered:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to recover cart:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
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

    console.log('📧 Sending reminder for cart:', options.cartId);

    try {
      const response = await api.post('/cart/send-reminder', options);
      console.log('✅ Reminder sent:', response);
      return response;
    } catch (error: any) {
      logCartError('❌ Failed to send reminder:', error);
      const message = extractErrorMessage(error);
      if (message) {
        throw new Error(message);
      }
      throw error;
    }
  },

  // ============================================
  // POS / ORDER FORM ALIASES
  // ============================================
  //
  // These are convenience wrappers used by OrderForm.tsx.
  // They delegate to the methods above so behaviour stays
  // identical and there's a single source of truth.

  /**
   * Alias for getCart(). The active cart is the current user's
   * cart — the backend lazily creates one on first access.
   */
  async getActiveCart(_businessUnitId?: string): Promise<Cart> {
    return this.getCart();
  },

  /**
   * Attach or clear a customer on the active cart.
   * Delegates to associateCustomer when a customer is provided.
   * When customerId is null, it clears the association.
   */
  async setCustomer(customerId: string | null): Promise<Cart> {
    if (!customerId) {
      // Backend treats an empty payload as "clear the customer"
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
    data: { quantity?: number; discount?: number }
  ): Promise<Cart> {
    if (data.quantity === undefined) {
      // Nothing to update — re-fetch and return current state
      return this.getCart();
    }
    return this.updateItemQuantity(itemId, data.quantity);
  },
};

export default cartService;
