// packages/backend/src/routes/cart.ts

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { cartController } from '../controllers/cartController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  transferCartSchema,
  splitCartSchema,
  updateCartSettingsSchema,
} from '../../../shared/src/schemas/cart.js';

const router = Router();

// ============================================
// ALL CART ROUTES REQUIRE AUTHENTICATION
// ============================================

router.use(requireAuth);

// ============================================
// ID-SHAPE GUARD
// ============================================
//
// Route-level guard for the `:id` param. Rejects obviously malformed
// ids (empty, containing whitespace, absurdly long) with a clean 400
// before the request reaches Prisma. The controller still validates
// ownership and existence; this is only a shape check.
//
// Kept as a local middleware rather than pulling in the shared
// validateRequest, because validateRequest expects a Zod schema for
// the whole request (body / query / params) and cart ids are a
// narrow, single-field concern.

function validateCartIdParam(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = req.params?.id;
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    id.length > 128 ||
    /\s/.test(id)
  ) {
    res.status(400).json({
      success: false,
      message: 'Invalid cart ID',
      errors: [{ field: 'id', message: 'Invalid cart ID' }],
    });
    return;
  }
  next();
}

// ============================================
// CART STATIC ROUTES (MUST COME BEFORE /:id)
// ============================================

router.get('/count', cartController.getCartCount);
router.get('/summary', cartController.getCartSummary);
router.get('/history', cartController.getCartHistory);

router.get(
  '/abandoned',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.getAbandonedCarts,
);

router.get(
  '/analytics',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.getCartAnalytics,
);

router.get(
  '/settings',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.getCartSettings,
);

router.put(
  '/settings',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(updateCartSettingsSchema),
  cartController.updateCartSettings,
);

// ============================================
// CART EXPORT ENDPOINTS (admin only)
// ============================================

router.post(
  '/analytics/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.exportAnalytics,
);

router.post(
  '/history/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.exportCartHistory,
);

router.post(
  '/abandoned/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.exportAbandonedCarts,
);

// ============================================
// CART ITEM ENDPOINTS
// ============================================

router.post('/items/bulk', cartController.addMultipleItems);
router.post('/items', cartController.addItem);
router.put('/items/:itemId', cartController.updateItemQuantity);
router.delete('/items/:itemId', cartController.removeItem);

// ============================================
// CART MODIFICATION ENDPOINTS
// ============================================

router.post('/discount', cartController.applyDiscount);
router.post('/promotion', cartController.applyPromotion);
router.post('/loyalty', cartController.applyLoyaltyPoints);
router.post('/customer', cartController.associateCustomer);
router.patch('/notes', cartController.updateCartNotes);

// ============================================
// CART ACTION ENDPOINTS
// ============================================

router.post('/sync', cartController.syncCart);
router.post('/checkout', cartController.checkout);
router.post('/merge-guest', cartController.mergeGuestCart);

router.post(
  '/transfer',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(transferCartSchema),
  cartController.transferCart,
);

router.post(
  '/split',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(splitCartSchema),
  cartController.splitCart,
);

router.post('/save-for-later', cartController.saveCartForLater);
router.post('/restore', cartController.restoreSavedCart);

// ============================================
// DEBUG ENDPOINT (Development only)
// ============================================
//
// ⚠ MUST BE REGISTERED BEFORE THE `/:id` WILDCARD.

if (process.env.NODE_ENV !== 'production') {
  router.get('/debug', (req: any, res: any) => {
    const user = req.user || null;
    res.json({
      success: true,
      message: 'Cart route is working',
      user: user
        ? {
            id: user.id,
            email: user.email,
            role: user.role,
            businessUnitId: user.businessUnitId,
            companyId: user.companyId,
          }
        : null,
      timestamp: new Date().toISOString(),
      routes: [
        'GET /cart',
        'GET /cart/count',
        'GET /cart/summary',
        'GET /cart/history',
        'GET /cart/abandoned',
        'GET /cart/analytics',
        'GET /cart/settings',
        'PUT /cart/settings',
        'POST /cart/items',
        'POST /cart/items/bulk',
        'PUT /cart/items/:itemId',
        'DELETE /cart/items/:itemId',
        'POST /cart/discount',
        'POST /cart/promotion',
        'POST /cart/loyalty',
        'POST /cart/customer',
        'PATCH /cart/notes',
        'POST /cart/sync',
        'POST /cart/checkout',
        'POST /cart/merge-guest',
        'POST /cart/transfer',
        'POST /cart/split',
        'POST /cart/save-for-later',
        'POST /cart/restore',
        'DELETE /cart',
        'POST /cart/analytics/export',
        'POST /cart/history/export',
        'POST /cart/abandoned/export',
        'GET /cart/:id',
        'GET /cart/debug',
      ],
    });
  });
}

// ============================================
// CANONICAL READ / WRITE
// ============================================
//
// `GET /cart` and `DELETE /cart` are registered here, before the
// dynamic `/:id` route, so the entire file follows the
// static-before-dynamic rule without exception.

router.get('/', cartController.getCart);
router.delete('/', cartController.clearCart);

// ============================================
// CART DYNAMIC ROUTES (WITH :id PARAM)
// ============================================

router.get(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateCartIdParam,
  cartController.getCartById,
);

export default router;
