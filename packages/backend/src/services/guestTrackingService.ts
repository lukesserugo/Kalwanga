// src/services/guestTrackingService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';

// ============================================
// TYPES
// ============================================

export interface ToggleWishlistResult {
  added: boolean;
}

interface GuestSessionTracking {
  id: string;
  wishlist: string[];
  recentlyView: string[];
  expiresAt: Date;
}

// ============================================
// SERVICE
// ============================================

export class GuestTrackingService extends BaseService {
  /**
   * Read the session's tracking columns and confirm it hasn't
   * expired. Returns the raw arrays (Prisma hands back `Json`, which
   * we coerce to `string[]`).
   */
  private async readSession(sessionId: string): Promise<GuestSessionTracking> {
    const s = await this.prisma.guestSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        wishlist: true,
        recentlyView: true,
        expiresAt: true,
      },
    });

    if (!s) throw new AppError('Guest session not found', 404);
    if (s.expiresAt < new Date()) {
      throw new AppError('Guest session expired', 401);
    }

    return {
      id: s.id,
      wishlist: this.toStringArray(s.wishlist),
      recentlyView: this.toStringArray(s.recentlyView),
      expiresAt: s.expiresAt,
    };
  }

  /**
   * Coerce a Prisma `Json` column into a `string[]`. Defensive against
   * legacy rows that might hold `null`, a non-array, or an array of
   * non-strings.
   */
  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string');
  }

  // ─── Wishlist ─────────────────────────────────────────────

  async getWishlist(sessionId: string): Promise<string[]> {
    const s = await this.readSession(sessionId);
    return s.wishlist;
  }

  async checkWishlist(sessionId: string, productId: string): Promise<boolean> {
    const s = await this.readSession(sessionId);
    return s.wishlist.includes(productId);
  }

  async toggleWishlist(
    sessionId: string,
    productId: string,
  ): Promise<ToggleWishlistResult> {
    if (!productId) throw new AppError('productId is required', 400);

    // Confirm the product exists before recording it. Keeps the
    // wishlist from accumulating dangling ids.
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true, deletedAt: true },
    });

    if (!product) throw new AppError('Product not found', 404);
    if (!product.isActive || product.deletedAt) {
      throw new AppError('Product is not available', 400);
    }

    const s = await this.readSession(sessionId);
    const list = s.wishlist;

    const idx = list.indexOf(productId);
    let added: boolean;

    if (idx >= 0) {
      list.splice(idx, 1);
      added = false;
    } else {
      list.push(productId);
      added = true;
    }

    await this.prisma.guestSession.update({
      where: { id: sessionId },
      data: { wishlist: list },
    });

    return { added };
  }

  async clearWishlist(sessionId: string): Promise<void> {
    await this.prisma.guestSession.update({
      where: { id: sessionId },
      data: { wishlist: [] },
    });
  }

  // ─── Recently viewed ──────────────────────────────────────

  /**
   * Returns the products themselves, in the order the guest viewed
   * them. Ids with no matching active product are dropped.
   */
  async getRecentlyViewed(sessionId: string, limit: number = 10) {
    const s = await this.readSession(sessionId);
    const capped = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const ids = s.recentlyView.slice(0, capped);

    if (ids.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, isActive: true, deletedAt: null },
      include: {
        category: true,
        inventory: true,
        images: { orderBy: { order: 'asc' } },
        variants: { where: { isActive: true }, include: { images: true } },
        supplier: true,
      },
    });

    // Preserve the order recorded in `recentlyView`, not the order
    // Prisma returns rows in.
    const byId = new Map(products.map((p) => [p.id, p]));
    return ids
      .map((id) => byId.get(id))
      .filter((x): x is (typeof products)[number] => Boolean(x));
  }

  /**
   * Push a product to the front of the recently-viewed list.
   * Re-viewing an existing product moves it to the top rather than
   * duplicating it. Capped at 50 entries.
   */
  async addRecentlyViewed(sessionId: string, productId: string): Promise<void> {
    if (!productId) throw new AppError('productId is required', 400);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true, deletedAt: true },
    });

    if (!product) throw new AppError('Product not found', 404);
    if (!product.isActive || product.deletedAt) {
      throw new AppError('Product is not available', 400);
    }

    const s = await this.readSession(sessionId);
    const list = s.recentlyView;

    const next = [productId, ...list.filter((id) => id !== productId)].slice(
      0,
      50,
    );

    await this.prisma.guestSession.update({
      where: { id: sessionId },
      data: { recentlyView: next },
    });
  }

  async clearRecentlyViewed(sessionId: string): Promise<void> {
    await this.prisma.guestSession.update({
      where: { id: sessionId },
      data: { recentlyView: [] },
    });
  }
}

export const guestTrackingService = new GuestTrackingService();
