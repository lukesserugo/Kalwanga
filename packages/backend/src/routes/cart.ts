// D:\Projects\Kalwanga\packages\backend\src\routes\cart.ts

import { Router } from 'express';
import { cartController } from '../controllers/cartController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
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
 *
 * Read-only. Returns a zeroed summary when there is no active cart
 * rather than materializing one.
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
  cartController.getAbandonedCarts,
);

/**
 * Get cart analytics (admin only)
 * GET /cart/analytics
 * ✅ MUST BE BEFORE /:id
 */
router.get(
  '/analytics',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.getCartAnalytics,
);

/**
 * Get cart settings
 * GET /cart/settings
 * ✅ MUST BE BEFORE /:id
 */
router.get(
  '/settings',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.getCartSettings,
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
  cartController.updateCartSettings,
);

// ============================================
// CART EXPORT ENDPOINTS (admin only)
// ============================================
//
// These are POSTs on `/cart/analytics/export` etc. and do NOT collide
// with the GETs above, but they are grouped here so the file reads as
// "exports near their related reads".

/**
 * Export cart analytics (admin only)
 * POST /cart/analytics/export
 */
router.post(
  '/analytics/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.exportAnalytics,
);

/**
 * Export cart history (admin only)
 * POST /cart/history/export
 */
router.post(
  '/history/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.exportCartHistory,
);

/**
 * Export abandoned carts (admin only)
 * POST /cart/abandoned/export
 */
router.post(
  '/abandoned/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.exportAbandonedCarts,
);

// ============================================
// CART ITEM ENDPOINTS
// ============================================
//
// `/items/bulk` is registered BEFORE `/items` for defensive clarity.
// Express matches on (method, path) so there is no real collision —
// `POST /cart/items/bulk` will not match `POST /cart/items`. The
// ordering only matters if a future wildcard segment is added.

/**
 * Add multiple items to cart
 * POST /cart/items/bulk
 *
 * Validation is performed inline in the controller via
 * `addMultipleItemsSchema`. Do NOT add a `validateRequest(...)`
 * middleware here — an earlier version had one and it rewrote
 * `req.body` in a way that broke the controller's own parse.
 */
router.post('/items/bulk', cartController.addMultipleItems);

/**
 * Add item to cart
 * POST /cart/items
 *
 * Validation is performed inline in the controller via
 * `addItemSchema`. Same rationale as above.
 */
router.post('/items', cartController.addItem);

/**
 * Update cart item quantity
 * PUT /cart/items/:itemId
 *
 * Controller validates inline with `updateQuantitySchema`.
 */
router.put('/items/:itemId', cartController.updateItemQuantity);

/**
 * Remove item from cart
 * DELETE /cart/items/:itemId
 */
router.delete('/items/:itemId', cartController.removeItem);

// ============================================
// CART MODIFICATION ENDPOINTS
// ============================================
//
// All of these validate their bodies inside the controller. No
// `validateRequest` middleware is attached — see the note on
// `POST /cart/items` for why.

/**
 * Apply discount to cart
 * POST /cart/discount
 */
router.post('/discount', cartController.applyDiscount);

/**
 * Apply promotion to cart
 * POST /cart/promotion
 */
router.post('/promotion', cartController.applyPromotion);

/**
 * Apply loyalty points to cart
 * POST /cart/loyalty
 */
router.post('/loyalty', cartController.applyLoyaltyPoints);

/**
 * Associate customer with cart
 * POST /cart/customer
 */
router.post('/customer', cartController.associateCustomer);

/**
 * Update cart notes
 * PATCH /cart/notes
 */
router.patch('/notes', cartController.updateCartNotes);

// ============================================
// CART ACTION ENDPOINTS
// ============================================

/**
 * Sync cart with inventory
 * POST /cart/sync
 *
 * Read-only when no cart exists — returns `{ valid: true, issues: [] }`
 * without materializing a row.
 */
router.post('/sync', cartController.syncCart);

/**
 * Checkout cart
 * POST /cart/checkout
 *
 * Controller validates inline with `checkoutSchema`. This is a
 * backward-compatibility shim; the canonical endpoint is
 * `POST /checkout` handled by `checkoutController.createCheckout`.
 */
router.post('/checkout', cartController.checkout);

/**
 * Merge a guest cart into the authenticated user's cart.
 * POST /cart/merge-guest
 *
 * Called by the frontend after login when it holds a guest cart id
 * in local storage. Idempotent — a second call for the same pair is
 * a no-op — so the client can fire it without worrying about retries.
 *
 * Auth is enforced by the `router.use(requireAuth)` at the top of the
 * file. No role gate: any authenticated user may merge their own
 * guest cart.
 */
router.post('/merge-guest', cartController.mergeGuestCart);

/**
 * Transfer cart to another user (admin only)
 * POST /cart/transfer
 *
 * Validated by `validateRequest(transferCartSchema)` — this route
 * has not been migrated to inline validation.
 */
router.post(
  '/transfer',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(transferCartSchema),
  cartController.transferCart,
);

/**
 * Split cart items (admin only)
 * POST /cart/split
 *
 * Validated by `validateRequest(splitCartSchema)`.
 */
router.post(
  '/split',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(splitCartSchema),
  cartController.splitCart,
);

/**
 * Save cart for later
 * POST /cart/save-for-later
 */
router.post('/save-for-later', cartController.saveCartForLater);

/**
 * Restore saved cart
 * POST /cart/restore
 *
 * Controller validates inline with `restoreSavedCartSchema`.
 */
router.post('/restore', cartController.restoreSavedCart);

// ============================================
// DEBUG ENDPOINT (Development only)
// ============================================
//
// ⚠ MUST BE REGISTERED BEFORE THE `/:id` WILDCARD. Express matches
//    routes in registration order. With `GET /cart/:id` above this
//    handler, a request to `/cart/debug` would be caught by the
//    wildcard with `id = 'debug'` and this handler would never run.

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
        // Cart reads
        'GET /cart',
        'GET /cart/count',
        'GET /cart/summary',
        'GET /cart/history',
        'GET /cart/abandoned',
        'GET /cart/analytics',
        'GET /cart/settings',
        'PUT /cart/settings',
        // Cart items
        'POST /cart/items',
        'POST /cart/items/bulk',
        'PUT /cart/items/:itemId',
        'DELETE /cart/items/:itemId',
        // Cart modification
        'POST /cart/discount',
        'POST /cart/promotion',
        'POST /cart/loyalty',
        'POST /cart/customer',
        'PATCH /cart/notes',
        // Cart actions
        'POST /cart/sync',
        'POST /cart/checkout',
        'POST /cart/merge-guest',
        'POST /cart/transfer',
        'POST /cart/split',
        'POST /cart/save-for-later',
        'POST /cart/restore',
        'DELETE /cart',
        // Cart exports
        'POST /cart/analytics/export',
        'POST /cart/history/export',
        'POST /cart/abandoned/export',
        // Dynamic
        'GET /cart/:id',
        // Debug
        'GET /cart/debug',
      ],
    });
  });
}

// ============================================
// CART DYNAMIC ROUTES (WITH :id PARAM)
// ============================================
//
// Registered LAST so that any static path above wins. `GET /cart/count`,
// `/cart/summary`, `/cart/debug`, etc. would otherwise be swallowed by
// `/:id`.

/**
 * Get current user's cart
 * GET /cart
 *
 * Read-only. Returns the user's active cart, or an empty synthetic
 * stub when none exists. Never creates a row — that behavior moved to
 * the mutation endpoints, which use `getOrCreateCart` internally.
 */
router.get('/', cartController.getCart);

/**
 * Get cart by ID (admin only)
 * GET /cart/:id
 * ✅ MUST BE AFTER ALL STATIC GET ROUTES
 */
router.get(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  cartController.getCartById,
);

/**
 * Clear cart
 * DELETE /cart
 */
router.delete('/', cartController.clearCart);

export default router;
