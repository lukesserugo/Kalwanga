import { Router } from 'express';
import { guestCartController } from '../controllers/guestCartController.js';

const router = Router();

router.get('/', guestCartController.getCart);
router.get('/count', guestCartController.getCount);
router.post('/items', guestCartController.addItem);
router.patch('/items/:itemId', guestCartController.updateItem);
router.delete('/items/:itemId', guestCartController.removeItem);
router.delete('/', guestCartController.clearCart);

export default router;
