// D:\Projects\Kalwanga\packages\backend\src\routes\sales.ts

import { Router } from 'express';
import { saleController } from '../controllers/saleController.js';
import { posController } from '../controllers/posController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All sale routes require authentication
router.use(requireAuth);

// ============================================
// GET endpoints - Basic Sales Operations
// ============================================

/**
 * Get all sales with pagination and filters
 * GET /api/sales
 * Query params: page, limit, search, customerId, userId, startDate, endDate, status, paymentMethod, sortBy, sortOrder, minAmount, maxAmount, includeDeleted
 */
router.get('/', saleController.getAllSales);

/**
 * Get sale by ID
 * GET /api/sales/:id
 */
router.get('/:id', saleController.getSaleById);

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
 * Get recent sales
 * GET /api/sales/recent
 * Query params: limit (default: 10)
 */
router.get('/recent', saleController.getRecentSales);

// ============================================
// GET endpoints - Sales Analytics & Dashboard
// ============================================

/**
 * Get sales statistics
 * GET /api/sales/stats
 * Query params: startDate, endDate
 */
router.get('/stats', saleController.getSalesStats);

/**
 * Get sales by date range
 * GET /api/sales/date-range
 * Query params: startDate, endDate (required)
 */
router.get('/date-range', saleController.getSalesByDateRange);

/**
 * Get daily sales summary
 * GET /api/sales/daily-summary
 * Query params: date (required)
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
 * Query params: startDate, endDate, view (daily|weekly|monthly|hourly)
 */
router.get('/analytics', saleController.getSalesAnalytics);

/**
 * Get sales forecast
 * GET /api/sales/forecast
 * Query params: days (default: 7)
 */
router.get('/forecast', saleController.getSalesForecast);

/**
 * Get sales comparison
 * GET /api/sales/compare
 * Query params: period1Start, period1End, period2Start, period2End (all required)
 */
router.get('/compare', saleController.getSalesComparison);

/**
 * Get sales summary by period
 * GET /api/sales/summary
 * Query params: period (day|week|month|quarter|year), date
 */
router.get('/summary', saleController.getSalesSummary);

/**
 * Get sales by payment method
 * GET /api/sales/payment-methods
 * Query params: startDate, endDate
 */
router.get('/payment-methods', saleController.getSalesByPaymentMethod);

/**
 * Get sales by status
 * GET /api/sales/status/:status
 * Query params: page, limit
 */
router.get('/status/:status', saleController.getSalesByStatus);

/**
 * Get sales with aggregation
 * GET /api/sales/aggregate
 * Query params: startDate, endDate (required), groupBy (hour|day|week|month)
 */
router.get('/aggregate', saleController.getAggregatedSales);

// ============================================
// GET endpoints - Sales Management Features
// ============================================

/**
 * Get sales settings
 * GET /api/sales/settings
 * Query params: companyId
 */
router.get('/settings', saleController.getSalesSettings);

/**
 * Get abandoned carts
 * GET /api/sales/abandoned-carts
 * Query params: startDate, endDate, minValue
 */
router.get('/abandoned-carts', saleController.getAbandonedCarts);

/**
 * Get sales by product
 * GET /api/sales/product/:productId
 * Query params: variantId, startDate, endDate, limit
 */
router.get('/product/:productId', saleController.getSalesByProduct);

/**
 * Get customer sales stats
 * GET /api/sales/customer-stats/:customerId
 */
router.get('/customer-stats/:customerId', saleController.getCustomerSalesStats);

/**
 * Get sales receipts
 * GET /api/sales/receipts
 * Query params: page, limit
 */
router.get('/receipts', saleController.getReceipts);

/**
 * Get sales invoices
 * GET /api/sales/invoices
 * Query params: page, limit
 */
router.get('/invoices', saleController.getInvoices);

/**
 * Get sales returns
 * GET /api/sales/returns
 * Query params: page, limit
 */
router.get('/returns', saleController.getReturns);

/**
 * Get sales refunds
 * GET /api/sales/refunds
 * Query params: page, limit
 */
router.get('/refunds', saleController.getRefunds);

/**
 * Export sales
 * GET /api/sales/export
 * Query params: startDate, endDate (required), format (json|csv|excel|pdf)
 */
router.get(
  '/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.exportSales
);

// ============================================
// GET endpoints - Reports & Exports
// ============================================

/**
 * Get sales report by period
 * GET /api/sales/reports/period
 * Query params: period (daily|weekly|monthly|quarterly|yearly), date
 */
router.get(
  '/reports/period',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.getSalesReportByPeriod
);

/**
 * Export sales to CSV
 * GET /api/sales/export/csv
 * Query params: startDate, endDate
 */
router.get(
  '/export/csv',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.exportSalesCsv
);

/**
 * Export sales to Excel
 * GET /api/sales/export/excel
 * Query params: startDate, endDate
 */
router.get(
  '/export/excel',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.exportSalesExcel
);

/**
 * Export sales to PDF
 * GET /api/sales/export/pdf
 * Query params: startDate, endDate
 */
router.get(
  '/export/pdf',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.exportSalesPdf
);

// ============================================
// GET endpoints - POS Routes (Quick Actions)
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
 * Get register status
 * GET /api/sales/pos/register/status
 */
router.get('/pos/register/status', posController.getRegisterStatus);

// ============================================
// POST endpoints - Create Operations
// ============================================

/**
 * Create a new sale (legacy direct sale)
 * POST /api/sales
 * Body: items[], customerId, paymentMethod, paidAmount, discount, taxRate, notes, businessUnitId, cashRegisterId, cashRegisterSessionId, tipAmount, loyaltyPointsUsed
 */
router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  saleController.createSale
);

/**
 * Create sale from cart checkout
 * POST /api/sales/checkout
 * Body: cartId, paymentMethod, paidAmount, cashRegisterId, cashRegisterSessionId
 */
router.post(
  '/checkout',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  saleController.createSaleFromCart
);

/**
 * Create sale from POS
 * POST /api/sales/pos/checkout
 * Body: cartId, paymentMethod, paidAmount, cashRegisterId, cashRegisterSessionId
 */
router.post(
  '/pos/checkout',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.checkout
);

// ============================================
// POST endpoints - POS Item Management
// ============================================

/**
 * Add item to POS cart
 * POST /api/sales/pos/items
 * Body: productId, variantId, quantity, unitPrice, notes
 */
router.post(
  '/pos/items',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.addItem
);

/**
 * Add multiple items to POS cart
 * POST /api/sales/pos/items/bulk
 * Body: items[]
 */
router.post(
  '/pos/items/bulk',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.addMultipleItems
);

// ============================================
// PUT endpoints - POS Item Management
// ============================================

/**
 * Update POS cart item
 * PUT /api/sales/pos/items/:itemId
 * Body: quantity, unitPrice, notes
 */
router.put(
  '/pos/items/:itemId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.updateItem
);

// ============================================
// DELETE endpoints - POS Item Management
// ============================================

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
 * Clear POS cart
 * DELETE /api/sales/pos/cart
 */
router.delete(
  '/pos/cart',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.clearCart
);

// ============================================
// GET endpoints - POS Customer Management
// ============================================

/**
 * Search POS customers
 * GET /api/sales/pos/customers/search
 * Query params: query, limit
 */
router.get('/pos/customers/search', posController.searchCustomers);

/**
 * Get POS customer by ID
 * GET /api/sales/pos/customers/:id
 */
router.get('/pos/customers/:id', posController.getCustomer);

/**
 * Create POS customer
 * POST /api/sales/pos/customers
 * Body: firstName, lastName, email, phoneNumber, address, city, state, zipCode, country
 */
router.post('/pos/customers', posController.createCustomer);

// ============================================
// GET endpoints - POS Product Management
// ============================================

/**
 * Search POS products
 * GET /api/sales/pos/products/search
 * Query params: query, categoryId, limit
 */
router.get('/pos/products/search', posController.searchProducts);

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
// PUT endpoints - Settings & Updates
// ============================================

/**
 * Update sales settings
 * PUT /api/sales/settings
 * Body: taxRate, discountEnabled, maxDiscount, loyaltyPointsEnabled, pointsPerDollar, autoPrintReceipt, emailReceipts, receiptFooter, defaultPaymentMethod, currencySymbol, currencyCode, invoicePrefix, receiptPrefix
 * Query params: companyId
 */
router.put(
  '/settings',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.updateSalesSettings
);

// ============================================
// PATCH endpoints - Bulk Operations
// ============================================

/**
 * Bulk update sales status
 * PATCH /api/sales/bulk-status
 * Body: saleIds[], status
 */
router.patch(
  '/bulk-status',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.bulkUpdateStatus
);

// ============================================
// POST endpoints - Sale Actions
// ============================================

/**
 * Process refund
 * POST /api/sales/:id/refund
 * Body: reason, amount, items[]
 */
router.post(
  '/:id/refund',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.refundSale
);

/**
 * Process return
 * POST /api/sales/:id/return
 * Body: reason, items[]
 */
router.post(
  '/:id/return',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.processReturn
);

/**
 * Cancel sale
 * POST /api/sales/:id/cancel
 * Body: reason
 */
router.post(
  '/:id/cancel',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.cancelSale
);

/**
 * Void sale
 * POST /api/sales/:id/void
 * Body: reason
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

// ============================================
// POST endpoints - Receipt & Email
// ============================================

/**
 * Send receipt email
 * POST /api/sales/:id/email-receipt
 * Body: email
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
// PUT endpoints - Update Sale
// ============================================

/**
 * Update sale
 * PUT /api/sales/:id
 * Body: any sale fields
 */
router.put(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.updateSale
);

// ============================================
// PATCH endpoints - Update Sale
// ============================================

/**
 * Update sale status
 * PATCH /api/sales/:id/status
 * Body: status
 */
router.patch(
  '/:id/status',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  saleController.updateSaleStatus
);

/**
 * Update sale notes
 * PATCH /api/sales/:id/notes
 * Body: notes
 */
router.patch(
  '/:id/notes',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  saleController.updateSaleNotes
);

// ============================================
// DELETE endpoints - Delete Sales
// ============================================

/**
 * Delete sale (soft delete)
 * DELETE /api/sales/:id
 */
router.delete(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  saleController.deleteSale
);

/**
 * Bulk delete sales
 * DELETE /api/sales/bulk
 * Body: saleIds[]
 */
router.delete(
  '/bulk',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  saleController.bulkDeleteSales
);

export default router;
