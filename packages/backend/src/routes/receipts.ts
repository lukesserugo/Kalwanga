import { Router } from 'express';
import { receiptController } from '../controllers/receiptController.ts';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/sale/:saleId', receiptController.generateReceipt);
router.get('/:id', receiptController.getReceiptById);
router.post('/:id/print', receiptController.recordPrint);
router.post('/:id/email', receiptController.sendReceiptEmail);

export default router;
