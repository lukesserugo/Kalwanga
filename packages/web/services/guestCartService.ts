// D:\Projects\Kalwanga\packages\web\services\guestCartService.ts

import { api } from './api';

// ============================================
// TYPES
// ============================================

export interface GuestCartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string | null;
  product?: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    images?: Array<{ url: string; alt?: string | null }> | string[];
    [key: string]: any;
  } | null;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    images?: Array<{ url: string; alt?: string | null }> | string[];
    [key: string]: any;
  } | null;
}

export interface GuestCart {
  id: string;
  userId: string;
  businessUnitId: string;
  customerId?: string | null;
  items: GuestCartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// SERVICE
// ============================================
//
// Wraps the guest cart endpoints at `/cart/guest/*`, which are backed
// by the `guest_session_id` cookie set by `guestSessionMiddleware`.
//
// The `api` client MUST be configured with `withCredentials: true` or
// the browser won't send the cookie and every call will mint a new
// session.
//
// All read methods return `null` / `0` on failure so callers can
// render an empty state without try/catch. Mutation methods throw so
// callers can surface the error to the user.

export const guestCartService = {
  /**
   * Get the guest's cart.
   * GET /cart/guest
   */
  async getCart(): Promise<GuestCart | null> {
    try {
      const res = await api.get<any>('/cart/guest');
      return res?.data ?? res ?? null;
    } catch (err: any) {
      // 404 (no cart yet) is not an error condition for a fresh guest.
      if (err?.response?.status === 404) return null;
      console.warn('guestCartService.getCart failed:', err?.message);
      return null;
    }
  },

  /**
   * Item count only.
   * GET /cart/guest/count
   */
  async getCount(): Promise<number> {
    try {
      const res = await api.get<any>('/cart/guest/count');
      return Number(res?.data?.count ?? res?.count ?? 0) || 0;
    } catch {
      return 0;
    }
  },

  /**
   * Add an item (or merge into an existing line).
   * POST /cart/guest/items
   */
  async addItem(input: {
    productId: string;
    variantId?: string | null;
    quantity?: number;
  }): Promise<GuestCart | null> {
    if (!input.productId) {
      throw new Error('productId is required');
    }

    const res = await api.post<any>('/cart/guest/items', {
      productId: input.productId,
      variantId: input.variantId ?? null,
      quantity: input.quantity ?? 1,
    });

    return res?.data ?? res ?? null;
  },

  /**
   * Set an item's quantity.
   * PATCH /cart/guest/items/:itemId
   */
  async updateItem(
    itemId: string,
    quantity: number,
  ): Promise<GuestCart | null> {
    if (!itemId) throw new Error('itemId is required');
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error('quantity must be at least 1');
    }

    const res = await api.patch<any>(`/cart/guest/items/${itemId}`, {
      quantity,
    });
    return res?.data ?? res ?? null;
  },

  /**
   * Remove one item.
   * DELETE /cart/guest/items/:itemId
   */
  async removeItem(itemId: string): Promise<GuestCart | null> {
    if (!itemId) throw new Error('itemId is required');
    const res = await api.delete<any>(`/cart/guest/items/${itemId}`);
    return res?.data ?? res ?? null;
  },

  /**
   * Empty the cart.
   * DELETE /cart/guest
   */
  async clearCart(): Promise<void> {
    await api.delete('/cart/guest');
  },
};

export default guestCartService;
