// D:\Projects\Kalwanga\packages\backend\src\routes\sales.ts

import { Router } from 'express';
import { saleController } from '../controllers/saleController.js';
import { posController } from '../controllers/posController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// ⚠️ ORDERING RULES FOR THIS FILE:
//   1. All static GET routes BEFORE parameterized GET routes.
//   2. All static POST/PUT/PATCH/DELETE routes BEFORE `/:id` variants.
//   3. Sub-router mounts (`/pos/*`) grouped together for readability.
// Violating these will cause `/recent` to match `/:id`, `/receipts` to
// match `/:id`, etc.
//
// ─────────────────────────────────────────────────────────────────
//  IDEMPOTENCY CONTRACT
// ─────────────────────────────────────────────────────────────────
//  The following routes honor an `Idempotency-Key` HTTP header
//  (or an `idempotencyKey` body field as a fallback):
//
//      POST /api/sales
//      POST /api/sales/checkout
//      POST /api/sales/pos/checkout
//
//  Sending the same key twice within any time window returns the
//  original sale — no duplicate row, no double inventory decrement,
//  no double loyalty award. See:
//      • SaleController.getIdempotencyKey
//      • PosController.getIdempotencyKey
//      • SaleService.findSaleByIdempotencyKey / withIdempotency
//      • sales.idempotencyKey (nullable, unique index)
//
//  Routes that do NOT support idempotency (by design):
//      POST   /api/sales/:id/refund
//      POST   /api/sales/:id/return
//      POST   /api/sales/:id/cancel
//      POST   /api/sales/:id/void
//      POST   /api/sales/:id/hold
//      POST   /api/sales/:id/resume
//      POST   /api/sales/:id/email-receipt
//      POST   /api/sales/:id/resend-receipt
//      PATCH  /api/sales/bulk-status
//      PUT    /api/sales/:id
//      PATCH  /api/sales/:id/status
//      PATCH  /api/sales/:id/notes
//      DELETE /api/sales/:id
//      DELETE /api/sales/bulk
//
//  Those operate on existing sales (state transitions), not on
//  creation. If you later want retry-safety there, wire them to a
//  keyed lookup before the write.
// ─────────────────────────────────────────────────────────────────

// All sale routes require authentication
router.use(requireAuth);

// ============================================
// GET — Static routes (NO parameters)
// ============================================

/**
 * Get all sales with pagination and filters
 * GET /api/sales
 */
router.get('/', saleController.getAllSales);

/**
 * Get recent sales
 * GET /api/sales/recent
 */
router.get('/recent', saleController.getRecentSales);

/**
 * Get sales statistics
 * GET /api/sales/stats
 */
router.get('/stats', saleController.getSalesStats);

/**
 * Get sales by date range
 * GET /api/sales/date-range
 */
router.get('/date-range', saleController.getSalesByDateRange);

/**
 * Get daily sales summary
 * GET /api/sales/daily-summary
 */
router.get('/daily-summary', saleController.getDailySalesSummary);

/**
 * Get today's sales summary
 * GET /api/sales/today
 */
router.get('/today', saleController.getTodaySalesSummary);

/**
 * Get dashboard sales data
 * GET /api/sales/dashboard
 */
router.get('/dashboard', saleController.getDashboardSalesData);

/**
 * Get sales analytics
 * GET /api/sales/analytics
 */
router.get('/analytics', saleController.getSalesAnalytics);

/**
 * Get sales forecast
 * GET /api/sales/forecast
 */
router.get('/forecast', saleController.getSalesForecast);

/**
 * Get sales comparison
 * GET /api/sales/compare
 */
router.get('/compare', saleController.getSalesComparison);

/**
 * Get sales summary by period
 * GET /api/sales/summary
 */
router.get('/summary', saleController.getSalesSummary);

/**
 * Get sales by payment method
 * GET /api/sales/payment-methods
 */
router.get('/payment-methods', saleController.getSalesByPaymentMethod);

/**
 * Get sales with aggregation
 * GET /api/sales/aggregate
 */
router.get('/aggregate', saleController.getAggregatedSales);

/**
 * Get sales settings
 * GET /api/sales/settings
 */
router.get('/settings', saleController.getSalesSettings);

/**
 * Get abandoned carts
 * GET /api/sales/abandoned-carts
 */
router.get('/abandoned-carts', saleController.getAbandonedCarts);

/**
 * Get sales receipts
 * GET /api/sales/receipts
 */
router.get('/receipts', saleController.getReceipts);

/**
 * Get sales invoices
 * GET /api/sales/invoices
 */
router.get('/invoices', saleController.getInvoices);

/**
 * Get sales returns
 * GET /api/sales/returns
 */
router.get('/returns', saleController.getReturns);

/**
 * Get sales refunds
 * GET /api/sales/refunds
 */
router.get('/refunds', saleController.getRefunds);

/**
 * Export sales
 * GET /api/sales/export
 */
router.get(
  '/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.exportSales
);

/**
 * Export sales to CSV
 * GET /api/sales/export/csv
 */
router.get(
  '/export/csv',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.exportSalesCsv
);

/**
 * Export sales to Excel
 * GET /api/sales/export/excel
 */
router.get(
  '/export/excel',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.exportSalesExcel
);

/**
 * Export sales to PDF
 * GET /api/sales/export/pdf
 */
router.get(
  '/export/pdf',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.exportSalesPdf
);

/**
 * Get sales report by period
 * GET /api/sales/reports/period
 */
router.get(
  '/reports/period',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.getSalesReportByPeriod
);

// ============================================
// GET — POS static routes
// ============================================

/**
 * Get cart for POS
 * GET /api/sales/pos/cart
 */
router.get('/pos/cart', posController.getCart);

/**
 * Get cart details
 * GET /api/sales/pos/cart/details
 */
router.get('/pos/cart/details', posController.getCartDetails);

/**
 * Get POS summary
 * GET /api/sales/pos/summary
 */
router.get('/pos/summary', posController.getSummary);

/**
 * Get POS statistics (today's revenue, cart count, low stock, etc.)
 * GET /api/sales/pos/stats
 */
router.get('/pos/stats', posController.getStats);

/**
 * Get POS transaction history
 * GET /api/sales/pos/transactions
 */
router.get('/pos/transactions', posController.getTransactions);

/**
 * Get register status
 * GET /api/sales/pos/register/status
 */
router.get('/pos/register/status', posController.getRegisterStatus);

/**
 * Search POS customers
 * GET /api/sales/pos/customers/search
 */
router.get('/pos/customers/search', posController.searchCustomers);

/**
 * Search POS products
 * GET /api/sales/pos/products/search
 */
router.get('/pos/products/search', posController.searchProducts);

/**
 * Get popular products (top sellers over the last 30 days)
 * GET /api/sales/pos/products/popular
 */
router.get('/pos/products/popular', posController.getPopularProducts);

// ============================================
// GET — Sub-path routes (have their own params)
// ============================================

/**
 * Get sale by receipt number
 * GET /api/sales/receipt/:receiptNumber
 */
router.get('/receipt/:receiptNumber', saleController.getSaleByReceiptNumber);

/**
 * Get sales by customer
 * GET /api/sales/customer/:customerId
 */
router.get('/customer/:customerId', saleController.getSalesByCustomer);

/**
 * Get sales by status
 * GET /api/sales/status/:status
 */
router.get('/status/:status', saleController.getSalesByStatus);

/**
 * Get sales by product
 * GET /api/sales/product/:productId
 */
router.get('/product/:productId', saleController.getSalesByProduct);

/**
 * Get customer sales stats
 * GET /api/sales/customer-stats/:customerId
 */
router.get('/customer-stats/:customerId', saleController.getCustomerSalesStats);

/**
 * Get POS customer by ID
 * GET /api/sales/pos/customers/:id
 */
router.get('/pos/customers/:id', posController.getCustomer);

/**
 * Get product by barcode
 * GET /api/sales/pos/products/barcode/:barcode
 */
router.get('/pos/products/barcode/:barcode', posController.getProductByBarcode);

/**
 * Get product by SKU
 * GET /api/sales/pos/products/sku/:sku
 */
router.get('/pos/products/sku/:sku', posController.getProductBySku);

// ============================================
// POST — Create operations
// ============================================

/**
 * Create a new sale (legacy direct sale)
 * POST /api/sales
 *
 * Idempotent via `Idempotency-Key` header (or `idempotencyKey` body field).
 */
router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  saleController.createSale
);

/**
 * Create sale from cart checkout
 * POST /api/sales/checkout
 *
 * Idempotent via `Idempotency-Key` header (or `idempotencyKey` body field).
 */
router.post(
  '/checkout',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  saleController.createSaleFromCart
);

/**
 * Create sale from POS
 * POST /api/sales/pos/checkout
 *
 * Idempotent via `Idempotency-Key` header (or `idempotencyKey` body field).
 */
router.post(
  '/pos/checkout',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.checkout
);

/**
 * Add item to POS cart
 * POST /api/sales/pos/items
 */
router.post(
  '/pos/items',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.addItem
);

/**
 * Add multiple items to POS cart
 * POST /api/sales/pos/items/bulk
 */
router.post(
  '/pos/items/bulk',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.addMultipleItems
);

/**
 * Apply discount to POS cart
 * POST /api/sales/pos/cart/discount
 */
router.post(
  '/pos/cart/discount',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.applyDiscount
);

/**
 * Apply loyalty points to POS cart
 * POST /api/sales/pos/cart/loyalty-points
 */
router.post(
  '/pos/cart/loyalty-points',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.applyLoyaltyPoints
);

/**
 * Associate customer with POS cart
 * POST /api/sales/pos/cart/customer
 */
router.post(
  '/pos/cart/customer',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.associateCustomer
);

/**
 * Create POS customer
 * POST /api/sales/pos/customers
 */
router.post(
  '/pos/customers',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.createCustomer
);

// ============================================
// POST — Sale actions (parameterized)
// ============================================

/**
 * Process refund
 * POST /api/sales/:id/refund
 */
router.post(
  '/:id/refund',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.refundSale
);

/**
 * Process return
 * POST /api/sales/:id/return
 */
router.post(
  '/:id/return',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.processReturn
);

/**
 * Cancel sale
 * POST /api/sales/:id/cancel
 */
router.post(
  '/:id/cancel',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.cancelSale
);

/**
 * Void sale
 * POST /api/sales/:id/void
 */
router.post(
  '/:id/void',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.voidSale
);

/**
 * Hold sale
 * POST /api/sales/:id/hold
 */
router.post(
  '/:id/hold',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  saleController.holdSale
);

/**
 * Resume held sale
 * POST /api/sales/:id/resume
 */
router.post(
  '/:id/resume',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  saleController.resumeSale
);

/**
 * Send receipt email
 * POST /api/sales/:id/email-receipt
 */
router.post(
  '/:id/email-receipt',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  saleController.sendReceiptEmail
);

/**
 * Resend receipt email
 * POST /api/sales/:id/resend-receipt
 */
router.post(
  '/:id/resend-receipt',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  saleController.resendReceiptEmail
);

// ============================================
// PUT — Update operations
// ============================================

/**
 * Update sales settings
 * PUT /api/sales/settings
 */
router.put(
  '/settings',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.updateSalesSettings
);

/**
 * Update POS cart item
 * PUT /api/sales/pos/items/:itemId
 */
router.put(
  '/pos/items/:itemId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.updateItem
);

/**
 * Update sale
 * PUT /api/sales/:id
 */
router.put(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.updateSale
);

// ============================================
// PATCH — Partial updates
// ============================================

/**
 * Bulk update sales status
 * PATCH /api/sales/bulk-status
 */
router.patch(
  '/bulk-status',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.bulkUpdateStatus
);

/**
 * Update sale status
 * PATCH /api/sales/:id/status
 */
router.patch(
  '/:id/status',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.updateSaleStatus
);

/**
 * Update sale notes
 * PATCH /api/sales/:id/notes
 */
router.patch(
  '/:id/notes',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  saleController.updateSaleNotes
);

// ============================================
// DELETE — Remove operations
// ============================================

/**
 * Clear POS cart
 * DELETE /api/sales/pos/cart
 */
router.delete(
  '/pos/cart',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.clearCart
);

/**
 * Remove POS cart item
 * DELETE /api/sales/pos/items/:itemId
 */
router.delete(
  '/pos/items/:itemId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.removeItem
);

/**
 * Bulk delete sales
 * DELETE /api/sales/bulk
 */
router.delete(
  '/bulk',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  saleController.bulkDeleteSales
);

/**
 * Delete sale (soft delete)
 * DELETE /api/sales/:id
 */
router.delete(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  saleController.deleteSale
);

export default router;
