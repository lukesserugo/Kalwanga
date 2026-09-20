// packages/web/services/guestWishlistService.ts

import { api } from './api';

export const guestWishlistService = {
  async getWishlist(): Promise<string[]> {
    const res = await api.get<any>('/wishlist/guest');
    return res?.data ?? res ?? [];
  },

  async check(productId: string): Promise<boolean> {
    const res = await api.get<any>(`/wishlist/guest/${productId}/check`);
    return res?.data === true;
  },

  async toggle(productId: string): Promise<{ added: boolean }> {
    const res = await api.post<any>(`/wishlist/guest/${productId}`);
    return res?.data ?? res ?? { added: false };
  },

  async clear(): Promise<void> {
    await api.delete('/wishlist/guest');
  },
};
