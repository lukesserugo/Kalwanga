import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { guestCartService } from '../services/guestCartService.js';

function requireGuestSession(req: Request): string {
  const id = (req as any).guestSessionId as string | undefined;
  if (!id) throw new AppError('Guest session required', 400);
  return id;
}

function respond(res: Response, err: any, fallback: string) {
  res.status(err.status || 500).json({
    success: false,
    message: err.message || fallback,
  });
}

export const guestCartController = {
  async getCart(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      const cart = await guestCartService.getCart(sessionId);
      res.json({ success: true, data: cart });
    } catch (err: any) {
      respond(res, err, 'Failed to load guest cart');
    }
  },

  async getCount(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      const count = await guestCartService.getCartCount(sessionId);
      res.json({ success: true, data: { count } });
    } catch (err: any) {
      respond(res, err, 'Failed to load guest cart count');
    }
  },

  async addItem(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      const { productId, variantId, quantity } = req.body;
      const cart = await guestCartService.addItem(sessionId, {
        productId,
        variantId,
        quantity,
      });
      res.json({ success: true, data: cart });
    } catch (err: any) {
      respond(res, err, 'Failed to add item to guest cart');
    }
  },

  async updateItem(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      const { itemId } = req.params;
      const { quantity } = req.body;
      const cart = await guestCartService.updateItem(sessionId, itemId, quantity);
      res.json({ success: true, data: cart });
    } catch (err: any) {
      respond(res, err, 'Failed to update guest cart item');
    }
  },

  async removeItem(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      const { itemId } = req.params;
      const cart = await guestCartService.removeItem(sessionId, itemId);
      res.json({ success: true, data: cart });
    } catch (err: any) {
      respond(res, err, 'Failed to remove guest cart item');
    }
  },

  async clearCart(req: Request, res: Response, _next: NextFunction) {
    try {
      const sessionId = requireGuestSession(req);
      await guestCartService.clearCart(sessionId);
      res.json({ success: true });
    } catch (err: any) {
      respond(res, err, 'Failed to clear guest cart');
    }
  },
};
