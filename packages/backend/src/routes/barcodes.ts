// D:\Projects\Kalwanga\packages\backend\src\routes\barcodeRoutes.ts

import { Router } from 'express';
import { barcodeController } from '../controllers/barcodeController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All barcode routes require authentication
router.use(requireAuth);

// Get product barcode
router.get('/product/:productId', barcodeController.getProductBarcode);

// Get product QR code
router.get('/product/:productId/qr', barcodeController.getProductQRCode);

// Get barcode image
router.get('/product/:productId/image', barcodeController.getBarcodeImage);

// Get SVG barcode
router.get('/product/:productId/svg', barcodeController.getSVGBarcode);

// Get receipt QR code
router.get('/receipt/:receiptNumber/qr', barcodeController.getReceiptQRCode);

// Generate barcode
router.post('/generate', barcodeController.generateBarcode);

// Validate barcode
router.get('/validate/:barcode', barcodeController.validateBarcode);

// Lookup product by barcode
router.get('/lookup/:barcode', barcodeController.getProductByBarcode);

// Bulk generate barcodes
router.post('/bulk-generate', barcodeController.bulkGenerateBarcodes);

export default router;
