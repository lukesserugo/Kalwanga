// D:\Projects\Kalwanga\packages\backend\src\routes\guestWishlist.ts

import { Router } from 'express';
import { guestTrackingController } from '../controllers/guestTrackingController.js';

const router = Router();

// ============================================
// GUEST WISHLIST
// ============================================
//
// Mounted at `/wishlist/guest` in `routes/index.ts`, AFTER
// `guestSessionMiddleware` has run. Every handler reads
// `req.guestSessionId` — if the session is missing or expired, the
// controller throws a 400/401 and the request is rejected.
//
// The wishlist is stored as a JSON array of product ids on the
// `GuestSession` row (`wishlist String[] @default([])`), so no
// separate join table is required for anonymous visitors. When the
// guest later authenticates, the frontend is expected to merge this
// list into the user's `Wishlist` rows via `/products/wishlist/:id`.

/**
 * Get the guest's wishlist (array of product ids).
 * GET /wishlist/guest
 */
router.get('/', guestTrackingController.getWishlist);

/**
 * Is a product in the guest's wishlist?
 * GET /wishlist/guest/:productId/check
 *
 * ⚠️ Declared BEFORE `/:productId` so the two-segment `/check` path
 *    is never shadowed by the one-segment toggle route.
 */
router.get('/:productId/check', guestTrackingController.checkWishlist);

/**
 * Toggle a product in / out of the guest's wishlist.
 * POST /wishlist/guest/:productId
 */
router.post('/:productId', guestTrackingController.toggleWishlist);

/**
 * Clear the guest's wishlist.
 * DELETE /wishlist/guest
 */
router.delete('/', guestTrackingController.clearWishlist);

export default router;
