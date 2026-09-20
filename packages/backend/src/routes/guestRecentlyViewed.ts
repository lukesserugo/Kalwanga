import { Router } from 'express';
import { guestTrackingController } from '../controllers/guestTrackingController.js';

const router = Router();

router.get('/', guestTrackingController.getRecentlyViewed);
router.post('/:productId', guestTrackingController.addRecentlyViewed);
router.delete('/', guestTrackingController.clearRecentlyViewed);

export default router;
