import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { guestTrackingService } from '../services/guestTrackingService.js';

function requireGuestSession(req: Request): string {
  const id = (req as any).guestSessionId as string | undefined;
  if (!id) throw new AppError('Guest session required', 400);
  return id;
}

function respond(res: Response, err: any, fallback: string, data?: unknown) {
  res.status(err.status || 500).json({
    success: false,
    message: err.message || fallback,
    ...(data !== undefined ? { data } : {}),
  });
}

export const guestTrackingController = {
  // ─── Wishlist ─────────────────────────────────────────────

  async getWishlist(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      const list = await guestTrackingService.getWishlist(sessionId);
      res.json({ success: true, data: list });
    } catch (err: any) {
      respond(res, err, 'Failed to load guest wishlist', []);
    }
  },

  async checkWishlist(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      const { productId } = req.params;
      const inList = await guestTrackingService.checkWishlist(
        sessionId,
        productId,
      );
      res.json({ success: true, data: inList });
    } catch (err: any) {
      respond(res, err, 'Failed to check guest wishlist', false);
    }
  },

  async toggleWishlist(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      const { productId } = req.params;
      const result = await guestTrackingService.toggleWishlist(
        sessionId,
        productId,
      );
      res.json({ success: true, data: result });
    } catch (err: any) {
      respond(res, err, 'Failed to toggle guest wishlist');
    }
  },

  async clearWishlist(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      await guestTrackingService.clearWishlist(sessionId);
      res.json({ success: true });
    } catch (err: any) {
      respond(res, err, 'Failed to clear guest wishlist');
    }
  },

  // ─── Recently viewed ──────────────────────────────────────

  async getRecentlyViewed(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      const limit = parseInt(String(req.query.limit ?? '10'), 10) || 10;
      const products = await guestTrackingService.getRecentlyViewed(
        sessionId,
        limit,
      );
      res.json({ success: true, data: products });
    } catch (err: any) {
      respond(res, err, 'Failed to load recently viewed', []);
    }
  },

  async addRecentlyViewed(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      const { productId } = req.params;
      await guestTrackingService.addRecentlyViewed(sessionId, productId);
      res.json({ success: true });
    } catch (err: any) {
      respond(res, err, 'Failed to add recently viewed');
    }
  },

  async clearRecentlyViewed(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      await guestTrackingService.clearRecentlyViewed(sessionId);
      res.json({ success: true });
    } catch (err: any) {
      respond(res, err, 'Failed to clear recently viewed');
    }
  },
};
