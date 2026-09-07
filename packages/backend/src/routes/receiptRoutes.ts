// src/routes/receiptRoutes.ts
import { Router } from 'express';
import { receiptController } from '../controllers/receiptController.js';

const router = Router();

// Receipt generation and retrieval
router.post('/generate/:saleId', receiptController.generateReceipt);
router.get('/:id', receiptController.getReceiptById);
router.get('/number/:receiptNumber', receiptController.getReceiptByNumber);

// Receipt actions
router.post('/:id/print', receiptController.recordPrint);
router.post('/:id/email', receiptController.sendReceiptEmail);

// Receipt history
router.get('/:id/history', receiptController.getReceiptHistory);

// Stats and export
router.get('/stats', receiptController.getReceiptStats);
router.get('/export', receiptController.exportReceipts);

// List all receipts
router.get('/', receiptController.getAllReceipts);

export default router;