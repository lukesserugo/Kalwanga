// D:\Projects\Kalwanga\packages\backend\src\routes\pos.ts

import { Router } from 'express';
import { posController } from '../controllers/posController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All POS routes require authentication
router.use(requireAuth);

// ============================================
// CART ROUTES
// ============================================

router.get('/cart', posController.getCart);
router.get('/cart/details', posController.getCartDetails);
router.delete('/cart', posController.clearCart);

// ============================================
// CART MODIFIER ROUTES
// ============================================

router.post(
  '/cart/discount',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.applyDiscount
);

router.post(
  '/cart/loyalty',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.applyLoyaltyPoints
);

router.post(
  '/cart/customer',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.associateCustomer
);

router.delete(
  '/cart/discount',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.removeDiscount
);

// ============================================
// ITEM ROUTES
// ============================================

router.post(
  '/items',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.addItem
);

router.post(
  '/items/bulk',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.addMultipleItems
);

router.put(
  '/items/:itemId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.updateItem
);

router.delete(
  '/items/:itemId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.removeItem
);

// ============================================
// CHECKOUT ROUTES
// ============================================

router.post(
  '/checkout',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.checkout
);

router.get(
  '/checkout/summary',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.getCheckoutSummary
);

// ============================================
// PRODUCT ROUTES
// ============================================

router.get('/products/search', posController.searchProducts);
router.get('/products/barcode/:barcode', posController.getProductByBarcode);
router.get('/products/sku/:sku', posController.getProductBySku);

router.get(
  '/products/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.getProductById
);

// ============================================
// CUSTOMER ROUTES
// ============================================

router.get('/customers/search', posController.searchCustomers);
router.get('/customers/:id', posController.getCustomer);

router.post(
  '/customers',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.createCustomer
);

// ============================================
// SUMMARY & STATUS ROUTES
// ============================================

router.get('/summary', posController.getSummary);
router.get('/register/status', posController.getRegisterStatus);

router.get(
  '/stats',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  posController.getStats
);

router.get(
  '/transactions',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  posController.getTransactions
);

// ============================================
// RECEIPT ROUTES
// ============================================

router.get(
  '/receipt/:saleId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.getReceipt
);

router.get(
  '/receipt/number/:receiptNumber',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.getReceiptByNumber
);

export default router;
