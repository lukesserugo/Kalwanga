import { Router } from 'express';
import { guestTrackingController } from '../controllers/guestTrackingController.js';

const router = Router();

// Wishlist (mounted at /wishlist/guest)
router.get('/', guestTrackingController.getWishlist);
router.get('/:productId/check', guestTrackingController.checkWishlist);
router.post('/:productId', guestTrackingController.toggleWishlist);
router.delete('/', guestTrackingController.clearWishlist);

export default router;
