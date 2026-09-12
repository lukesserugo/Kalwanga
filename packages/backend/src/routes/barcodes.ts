// D:\Projects\Kalwanga\packages\backend\src\routes\barcodeRoutes.ts

import { Router } from 'express';
import { barcodeController } from '../controllers/barcodeController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All barcode routes require authentication
router.use(requireAuth);

// ============================================
// PRODUCT BARCODE ROUTES
// ============================================

// Get product barcode
router.get('/product/:productId', barcodeController.getProductBarcode);

// Get product barcode info (full details with images)
router.get('/product/:productId/info', barcodeController.getProductBarcodeInfo);

// Get product QR code
router.get('/product/:productId/qr', barcodeController.getProductQRCode);

// Get barcode image for product
router.get('/product/:productId/image', barcodeController.getBarcodeImage);

// Get SVG barcode for product
router.get('/product/:productId/svg', barcodeController.getSVGBarcode);

// Get all QR codes for a product
router.get('/product/:productId/qr-codes', barcodeController.getProductQRCodes);

// ============================================
// VARIANT BARCODE ROUTES
// ============================================

// Generate barcode for variant
router.post('/variant/:variantId', barcodeController.generateVariantBarcode);

// Get variant barcode info
router.get('/variant/:variantId/info', barcodeController.getVariantBarcodeInfo);

// ============================================
// BARCODE GENERATION ROUTES
// ============================================

// Generate barcode for a product
router.post('/generate', barcodeController.generateBarcode);

// Generate unique barcode
router.post('/generate-unique', barcodeController.generateUniqueBarcode);

// Bulk generate barcodes for products without barcodes
router.post('/bulk-generate', barcodeController.bulkGenerateBarcodes);

// ============================================
// BARCODE IMAGE ROUTES
// ============================================

// Generate barcode image from barcode string
router.post('/image', barcodeController.generateBarcodeImageFromString);

// Get barcode image by barcode
router.get('/image/:barcode', barcodeController.getBarcodeImageByCode);

// ============================================
// QR CODE ROUTES
// ============================================

// Generate QR code from data
router.post('/qr', barcodeController.generateQRCode);

// Get QR code by code
router.get('/qr/:code', barcodeController.getQRCodeByCode);

// Deactivate QR code
router.patch('/qr/:code/deactivate', barcodeController.deactivateQRCode);

// Get receipt QR code
router.get('/receipt/:receiptNumber/qr', barcodeController.getReceiptQRCode);

// ============================================
// BARCODE LOOKUP & VALIDATION ROUTES
// ============================================

// Lookup product by barcode
router.get('/lookup/:barcode', barcodeController.getProductByBarcode);

// Validate barcode format (GET)
router.get('/validate/:barcode', barcodeController.validateBarcodeFormat);

// Validate barcode with uniqueness check (POST)
router.post('/validate', barcodeController.validateBarcode);

// ============================================
// BARCODE ASSOCIATION ROUTES
// ============================================

// Associate barcode with product
router.post('/associate', barcodeController.associateBarcode);

// ============================================
// BARCODE SCAN ROUTES
// ============================================

// Scan barcode and get product info
router.post('/scan', barcodeController.scanBarcode);

export default router;
