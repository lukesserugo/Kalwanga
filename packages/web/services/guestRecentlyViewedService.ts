// D:\Projects\Kalwanga\packages\web\services\guestRecentlyViewedService.ts

import { api } from './api';
import type { Product } from '../types/product';

// ============================================
// GUEST RECENTLY VIEWED
// ============================================
//
// Backed by `GuestSession.recentlyView` (a JSON array of product ids)
// and the `guest_session_id` cookie set by `guestSessionMiddleware`.
//
// The backend hydrates the ids into full product objects before
// returning, so the response shape matches the authenticated
// `productService.getRecentlyViewed`.
//
// All methods swallow errors — tracking is best-effort and a guest
// without a session should see an empty list, not an error toast.

export const guestRecentlyViewedService = {
  /**
   * Get the guest's recently-viewed products.
   * GET /recently-viewed/guest?limit=N
   */
  async getRecentlyViewed(limit: number = 10): Promise<Product[]> {
    try {
      const res = await api.get<any>('/recently-viewed/guest', {
        params: { limit },
      });

      // Handle all response shapes (raw array, `{ data: [] }`, wrapped).
      const raw = res?.data ?? res;
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.data)) return raw.data;
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Record a product view.
   * POST /recently-viewed/guest/:productId
   */
  async add(productId: string): Promise<void> {
    if (!productId) return;
    try {
      await api.post(`/recently-viewed/guest/${productId}`);
    } catch {
      // Tracking is best-effort.
    }
  },

  /**
   * Clear the guest's recently-viewed list.
   * DELETE /recently-viewed/guest
   */
  async clear(): Promise<void> {
    try {
      await api.delete('/recently-viewed/guest');
    } catch {
      /* ignore */
    }
  },
};

export default guestRecentlyViewedService;

