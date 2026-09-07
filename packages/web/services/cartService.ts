// D:\Projects\Kalwanga\packages\web\services\cartService.ts

import { api } from './api';

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

// ✅ Export options interfaces
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

export const cartService = {
  /**
   * Get current user's cart - calls GET /cart
   */
  async getCart(): Promise<Cart> {
    try {
      console.log('🛒 Fetching cart...');
      const response = await api.get<Cart>('/cart');
      console.log('✅ Cart fetched successfully');
      return response;
    } catch (error) {
      console.error('❌ Failed to fetch cart:', error);
      throw error;
    }
  },

  /**
   * Get cart by ID - calls GET /cart/:id
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
    } catch (error) {
      console.error('❌ Failed to fetch cart:', error);
      throw error;
    }
  },

  /**
   * Get cart count - calls GET /cart/count
   */
  async getCartCount(): Promise<CartCountResponse> {
    try {
      console.log('🛒 Fetching cart count...');
      const response = await api.get<CartCountResponse>('/cart/count');
      console.log('✅ Cart count fetched:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to fetch cart count:', error);
      return { count: 0 };
    }
  },

  /**
   * Add item to cart - calls POST /cart/items
   */
  async addItem(data: { productId: string; variantId?: string; quantity?: number }): Promise<Cart> {
    if (!data.productId) {
      console.error('❌ CartService.addItem: productId is required but was:', data);
      throw new Error('Product ID is required');
    }

    const payload = {
      productId: data.productId,
      variantId: data.variantId || undefined,
      quantity: data.quantity || 1,
    };

    console.log('🛒 CartService.addItem - Sending payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await api.post<Cart>('/cart/items', payload);
      console.log('✅ CartService.addItem - Success:', response);
      return response;
    } catch (error: any) {
      console.error('❌ CartService.addItem - Error:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      if (error?.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ');
        throw new Error(`Validation error: ${errorMessages}`);
      }
      throw error;
    }
  },

  /**
   * Add multiple items - calls POST /cart/items/bulk
   */
  async addMultipleItems(items: Array<{ productId: string; variantId?: string; quantity?: number }>): Promise<Cart> {
    if (!items || items.length === 0) {
      throw new Error('At least one item is required');
    }

    for (const item of items) {
      if (!item.productId) {
        throw new Error('All items must have a product ID');
      }
    }

    const payload = { items };
    console.log('🛒 CartService.addMultipleItems - Sending payload:', JSON.stringify(payload, null, 2));
    
    try {
      const response = await api.post<Cart>('/cart/items/bulk', payload);
      console.log('✅ CartService.addMultipleItems - Success:', response);
      return response;
    } catch (error: any) {
      console.error('❌ CartService.addMultipleItems - Error:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Update cart item quantity - calls PUT /cart/items/:itemId
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
      const response = await api.put<Cart>(`/cart/items/${itemId}`, { quantity });
      console.log('✅ Item quantity updated:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to update item quantity:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Remove item from cart - calls DELETE /cart/items/:itemId
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
      console.error('❌ Failed to remove item:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Clear cart - calls DELETE /cart
   */
  async clearCart(): Promise<Cart> {
    console.log('🛒 Clearing cart');
    
    try {
      const response = await api.delete<Cart>('/cart');
      console.log('✅ Cart cleared:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to clear cart:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Apply discount - calls POST /cart/discount
   */
  async applyDiscount(discount: number, discountType?: 'PERCENTAGE' | 'FIXED'): Promise<Cart> {
    if (discount < 0) {
      throw new Error('Discount cannot be negative');
    }

    const payload = {
      discount,
      discountType: discountType || 'FIXED',
    };

    console.log(`🛒 Applying ${discountType || 'FIXED'} discount: ${discount}`);
    
    try {
      const response = await api.post<Cart>('/cart/discount', payload);
      console.log('✅ Discount applied:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to apply discount:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Apply promotion - calls POST /cart/promotion
   */
  async applyPromotion(promotionCode: string): Promise<Cart> {
    if (!promotionCode) {
      throw new Error('Promotion code is required');
    }

    console.log(`🛒 Applying promotion: ${promotionCode}`);
    
    try {
      const response = await api.post<Cart>('/cart/promotion', { promotionCode });
      console.log('✅ Promotion applied:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to apply promotion:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Apply loyalty points - calls POST /cart/loyalty
   */
  async applyLoyaltyPoints(customerId: string, points: number): Promise<Cart> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }
    if (points <= 0) {
      throw new Error('Points must be positive');
    }

    console.log(`🛒 Applying ${points} loyalty points for customer ${customerId}`);
    
    try {
      const response = await api.post<Cart>('/cart/loyalty', { customerId, points });
      console.log('✅ Loyalty points applied:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to apply loyalty points:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Associate customer - calls POST /cart/customer
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
      console.error('❌ Failed to associate customer:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Update cart notes - calls PATCH /cart/notes
   */
  async updateCartNotes(notes: string): Promise<Cart> {
    console.log(`🛒 Updating cart notes: ${notes}`);
    
    try {
      const response = await api.patch<Cart>('/cart/notes', { notes });
      console.log('✅ Cart notes updated:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to update cart notes:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Get cart summary - calls GET /cart/summary
   */
  async getCartSummary(): Promise<CartSummary> {
    try {
      console.log('🛒 Fetching cart summary...');
      const response = await api.get<CartSummary>('/cart/summary');
      console.log('✅ Cart summary fetched:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to fetch cart summary:', error);
      throw error;
    }
  },

  /**
   * Get cart history - calls GET /cart/history
   */
  async getCartHistory(params?: { page?: number; limit?: number }): Promise<CartHistoryResponse> {
    try {
      console.log('🛒 Fetching cart history...');
      const response = await api.get<CartHistoryResponse>('/cart/history', { params });
      console.log('✅ Cart history fetched:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to fetch cart history:', error);
      throw error;
    }
  },

  /**
   * Sync cart with inventory - calls POST /cart/sync
   */
  async syncCart(): Promise<SyncResult> {
    console.log('🛒 Syncing cart with inventory...');
    
    try {
      const response = await api.post<SyncResult>('/cart/sync');
      console.log('✅ Cart synced:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to sync cart:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Save cart for later - calls POST /cart/save-for-later
   */
  async saveCartForLater(): Promise<Cart> {
    console.log('🛒 Saving cart for later...');
    
    try {
      const response = await api.post<Cart>('/cart/save-for-later');
      console.log('✅ Cart saved for later:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to save cart for later:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Restore saved cart - calls POST /cart/restore
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
      console.error('❌ Failed to restore saved cart:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Transfer cart - calls POST /cart/transfer
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
      const response = await api.post<Cart>('/cart/transfer', { fromUserId, toUserId });
      console.log('✅ Cart transferred:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to transfer cart:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Split cart - calls POST /cart/split
   */
  async splitCart(items: Array<{ cartItemId: string; quantity: number; targetUserId: string }>): Promise<any> {
    if (!items || items.length === 0) {
      throw new Error('At least one item split is required');
    }

    console.log(`🛒 Splitting cart with ${items.length} items`);
    
    try {
      const response = await api.post<{ sourceCart: Cart; targetCarts: Cart[] }>('/cart/split', { items });
      console.log('✅ Cart split:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to split cart:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Checkout cart - calls POST /cart/checkout
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
      console.error('❌ Failed to checkout:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  // ============================================
  // ✅ ANALYTICS & EXPORT METHODS
  // ============================================

  /**
   * Get cart analytics - calls GET /cart/analytics
   */
  async getAnalytics(params?: { startDate?: string; endDate?: string; period?: string }): Promise<any> {
    try {
      console.log('📊 Fetching cart analytics...');
      const response = await api.get('/cart/analytics', { params });
      console.log('✅ Cart analytics fetched:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to fetch cart analytics:', error);
      throw error;
    }
  },

  /**
   * Export cart analytics - calls POST /cart/analytics/export
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
      const response = await api.post('/cart/analytics/export', options, {
        responseType: 'blob',
      }) as Blob;
      
      console.log('✅ Analytics exported successfully');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to export analytics:', error);
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
   * Export cart history - calls POST /cart/history/export
   * ✅ NEW METHOD
   */
  async exportHistory(options: ExportHistoryOptions): Promise<Blob> {
    if (!options.format) {
      throw new Error('Export format is required');
    }

    console.log('📤 Exporting cart history with options:', options);

    try {
      const response = await api.post('/cart/history/export', options, {
        responseType: 'blob',
      }) as Blob;
      
      console.log('✅ Cart history exported successfully');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to export cart history:', error);
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
   * Export abandoned carts - calls POST /cart/abandoned/export
   * ✅ NEW METHOD
   */
  async exportAbandonedCarts(options: ExportAbandonedOptions): Promise<Blob> {
    if (!options.format) {
      throw new Error('Export format is required');
    }

    console.log('📤 Exporting abandoned carts with options:', options);

    try {
      const response = await api.post('/cart/abandoned/export', options, {
        responseType: 'blob',
      }) as Blob;
      
      console.log('✅ Abandoned carts exported successfully');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to export abandoned carts:', error);
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
   * Get abandoned carts - calls GET /cart/abandoned
   */
  async getAbandonedCarts(params?: { hours?: number; minValue?: number; page?: number; limit?: number }): Promise<any> {
    try {
      console.log('🛒 Fetching abandoned carts...');
      const response = await api.get('/cart/abandoned', { params });
      console.log('✅ Abandoned carts fetched:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to fetch abandoned carts:', error);
      throw error;
    }
  },

  /**
   * Recover a cart - calls POST /cart/recover
   * ✅ NEW METHOD
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
      console.error('❌ Failed to recover cart:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Send reminder for abandoned cart - calls POST /cart/send-reminder
   * ✅ NEW METHOD
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
      console.error('❌ Failed to send reminder:', error);
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },
};

export default cartService;
