// D:\Projects\Kalwanga\packages\backend\src\routes\cart.ts

import { Router } from 'express';
import { cartController } from '../controllers/cartController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  addCartItemSchema,
  addMultipleCartItemsSchema,
  updateCartItemQuantitySchema,
  applyCartDiscountSchema,
  applyCartPromotionSchema,
  applyLoyaltyPointsSchema,
  associateCustomerSchema,
  updateCartNotesSchema,
  cartCheckoutSchema,
  transferCartSchema,
  splitCartSchema,
  updateCartSettingsSchema,
} from '../utils/validators.js';

const router = Router();

// ============================================
// ALL CART ROUTES REQUIRE AUTHENTICATION
// ============================================

router.use(requireAuth);

// ============================================
// CART STATIC ROUTES (MUST COME BEFORE /:id)
// ============================================

/**
 * Get cart count
 * GET /cart/count
 */
router.get('/count', cartController.getCartCount);

/**
 * Get cart summary
 * GET /cart/summary
 */
router.get('/summary', cartController.getCartSummary);

/**
 * Get cart history
 * GET /cart/history
 */
router.get('/history', cartController.getCartHistory);

/**
 * Get abandoned carts (admin only)
 * GET /cart/abandoned
 */
router.get(
  '/abandoned',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.getAbandonedCarts
);

/**
 * Get cart analytics (admin only)
 * GET /cart/analytics
 * ✅ MUST BE BEFORE /:id
 */
router.get(
  '/analytics',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.getCartAnalytics
);

/**
 * Get cart settings
 * GET /cart/settings
 * ✅ MUST BE BEFORE /:id
 */
router.get(
  '/settings',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.getCartSettings
);

/**
 * Update cart settings
 * PUT /cart/settings
 * ✅ MUST BE BEFORE /:id
 */
router.put(
  '/settings',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(updateCartSettingsSchema),
  cartController.updateCartSettings
);

// ============================================
// CART DYNAMIC ROUTES (WITH :id PARAM)
// ============================================

/**
 * Get current user's cart
 * GET /cart
 */
router.get('/', cartController.getCart);

/**
 * Get cart by ID (admin only)
 * GET /cart/:id
 * ✅ MUST BE AFTER STATIC ROUTES
 */
router.get(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.getCartById
);

/**
 * Clear cart
 * DELETE /cart
 */
router.delete('/', cartController.clearCart);

// ============================================
// CART ITEM ENDPOINTS
// ============================================

/**
 * Add item to cart
 * POST /cart/items
 */
router.post(
  '/items',
  validateRequest(addCartItemSchema),
  cartController.addItem
);

/**
 * Add multiple items to cart
 * POST /cart/items/bulk
 */
router.post(
  '/items/bulk',
  validateRequest(addMultipleCartItemsSchema),
  cartController.addMultipleItems
);

/**
 * Update cart item quantity
 * PUT /cart/items/:itemId
 */
router.put(
  '/items/:itemId',
  validateRequest(updateCartItemQuantitySchema),
  cartController.updateItemQuantity
);

/**
 * Remove item from cart
 * DELETE /cart/items/:itemId
 */
router.delete('/items/:itemId', cartController.removeItem);

// ============================================
// CART MODIFICATION ENDPOINTS
// ============================================

/**
 * Apply discount to cart
 * POST /cart/discount
 */
router.post(
  '/discount',
  validateRequest(applyCartDiscountSchema),
  cartController.applyDiscount
);

/**
 * Apply promotion to cart
 * POST /cart/promotion
 */
router.post(
  '/promotion',
  validateRequest(applyCartPromotionSchema),
  cartController.applyPromotion
);

/**
 * Apply loyalty points to cart
 * POST /cart/loyalty
 */
router.post(
  '/loyalty',
  validateRequest(applyLoyaltyPointsSchema),
  cartController.applyLoyaltyPoints
);

/**
 * Associate customer with cart
 * POST /cart/customer
 */
router.post(
  '/customer',
  validateRequest(associateCustomerSchema),
  cartController.associateCustomer
);

/**
 * Update cart notes
 * PATCH /cart/notes
 */
router.patch(
  '/notes',
  validateRequest(updateCartNotesSchema),
  cartController.updateCartNotes
);

// ============================================
// CART ACTION ENDPOINTS
// ============================================

/**
 * Sync cart with inventory
 * POST /cart/sync
 */
router.post('/sync', cartController.syncCart);

/**
 * Checkout cart
 * POST /cart/checkout
 */
router.post(
  '/checkout',
  validateRequest(cartCheckoutSchema),
  cartController.checkout
);

/**
 * Transfer cart to another user (admin only)
 * POST /cart/transfer
 */
router.post(
  '/transfer',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(transferCartSchema),
  cartController.transferCart
);

/**
 * Split cart items (admin only)
 * POST /cart/split
 */
router.post(
  '/split',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(splitCartSchema),
  cartController.splitCart
);

/**
 * Save cart for later
 * POST /cart/save-for-later
 */
router.post('/save-for-later', cartController.saveCartForLater);

/**
 * Restore saved cart
 * POST /cart/restore
 */
router.post('/restore', cartController.restoreSavedCart);

// ============================================
// CART EXPORT ENDPOINTS
// ============================================

/**
 * Export cart analytics (admin only)
 * POST /cart/analytics/export
 */
router.post(
  '/analytics/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.exportAnalytics
);

/**
 * Export cart history (admin only)
 * POST /cart/history/export
 */
router.post(
  '/history/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.exportCartHistory
);

/**
 * Export abandoned carts (admin only)
 * POST /cart/abandoned/export
 */
router.post(
  '/abandoned/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.exportAbandonedCarts
);

// ============================================
// DEBUG ENDPOINT (Development only)
// ============================================

if (process.env.NODE_ENV !== 'production') {
  router.get('/debug', (req: any, res: any) => {
    const user = req.user || null;
    res.json({
      success: true,
      message: 'Cart route is working',
      user: user ? {
        id: user.id,
        email: user.email,
        role: user.role,
        businessUnitId: user.businessUnitId,
        companyId: user.companyId,
      } : null,
      timestamp: new Date().toISOString(),
      routes: [
        // Cart endpoints
        'GET /cart',
        'GET /cart/:id',
        'GET /cart/count',
        'GET /cart/summary',
        'GET /cart/history',
        'GET /cart/abandoned',
        'GET /cart/analytics',
        // Cart settings endpoints
        'GET /cart/settings',
        'PUT /cart/settings',
        // Cart item endpoints
        'POST /cart/items',
        'POST /cart/items/bulk',
        'PUT /cart/items/:itemId',
        'DELETE /cart/items/:itemId',
        // Cart modification endpoints
        'POST /cart/discount',
        'POST /cart/promotion',
        'POST /cart/loyalty',
        'POST /cart/customer',
        'PATCH /cart/notes',
        // Cart action endpoints
        'POST /cart/sync',
        'POST /cart/checkout',
        'POST /cart/transfer',
        'POST /cart/split',
        'POST /cart/save-for-later',
        'POST /cart/restore',
        'DELETE /cart',
        // Cart export endpoints
        'POST /cart/analytics/export',
        'POST /cart/history/export',
        'POST /cart/abandoned/export',
      ],
    });
  });
}

export default router;