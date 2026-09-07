// D:\Projects\Kalwanga\packages\backend\src\routes\orders.ts

import { Router } from 'express';
import { orderController } from '../controllers/orderController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All order routes require authentication
router.use(requireAuth);

// ============================================
// IMPORTANT: Route ordering matters in Express!
// More specific routes must come BEFORE generic routes
// ============================================

// ============================================
// GET ENDPOINTS - Basic Order Operations
// ============================================

/**
 * Get all orders with pagination and filters
 * GET /api/orders
 * Query params: page, limit, search, customerId, userId, status, priority, startDate, endDate, sortBy, sortOrder, minTotal, maxTotal, includeDeleted
 */
router.get(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER, UserRole.EMPLOYEE]),
  orderController.getAllOrders
);

// ============================================
// GET ENDPOINTS - Analytics & Dashboard
// ============================================

/**
 * Get order statistics
 * GET /api/orders/stats
 */
router.get(
  '/stats',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.getOrderStats
);

/**
 * Get dashboard order data
 * GET /api/orders/dashboard
 */
router.get(
  '/dashboard',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]),
  orderController.getDashboardOrderData
);

/**
 * Get order analytics
 * GET /api/orders/analytics
 * Query params: startDate, endDate, groupBy (day|week|month)
 */
router.get(
  '/analytics',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.getOrderAnalytics
);

/**
 * Get order fulfillment status
 * GET /api/orders/fulfillment
 */
router.get(
  '/fulfillment',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.getOrderFulfillmentStatus
);

// ============================================
// GET ENDPOINTS - Reports & Exports
// ============================================

/**
 * Export orders
 * GET /api/orders/export
 * Query params: startDate, endDate, format (json|csv|excel|pdf)
 */
router.get(
  '/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.exportOrders
);

/**
 * Export orders to CSV
 * GET /api/orders/export/csv
 * Query params: startDate, endDate
 */
router.get(
  '/export/csv',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.exportOrdersCsv
);

/**
 * Export orders to Excel
 * GET /api/orders/export/excel
 * Query params: startDate, endDate
 */
router.get(
  '/export/excel',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.exportOrdersExcel
);

/**
 * Export orders to PDF
 * GET /api/orders/export/pdf
 * Query params: startDate, endDate
 */
router.get(
  '/export/pdf',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.exportOrdersPdf
);

// ============================================
// GET ENDPOINTS - Filter by Status
// ============================================

/**
 * Get orders by status
 * GET /api/orders/status/:status
 * Query params: page, limit
 */
router.get(
  '/status/:status',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]),
  orderController.getOrdersByStatus
);

// ============================================
// GET ENDPOINTS - Filter by Customer
// ============================================

/**
 * Get orders by customer
 * GET /api/orders/customer/:customerId
 * Query params: page, limit
 */
router.get(
  '/customer/:customerId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]),
  orderController.getOrdersByCustomer
);

// ============================================
// GET ENDPOINTS - Date Range
// ============================================

/**
 * Get orders by date range
 * GET /api/orders/date-range
 * Query params: startDate, endDate (required)
 */
router.get(
  '/date-range',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]),
  orderController.getOrdersByDateRange
);

// ============================================
// GET ENDPOINTS - Order History & Timeline
// ============================================

/**
 * Get order history
 * GET /api/orders/:orderId/history
 */
router.get(
  '/:orderId/history',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]),
  orderController.getOrderHistory
);

/**
 * Get order timeline
 * GET /api/orders/:orderId/timeline
 */
router.get(
  '/:orderId/timeline',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]),
  orderController.getOrderTimeline
);

// ============================================
// GET ENDPOINTS - By Identifier (must come BEFORE generic /:id)
// ============================================

/**
 * Get order by order number
 * GET /api/orders/number/:orderNumber
 */
router.get(
  '/number/:orderNumber',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]),
  orderController.getOrderByNumber
);

// ============================================
// GET ENDPOINTS - Generic ID (must come LAST)
// ============================================

/**
 * Get order by ID
 * GET /api/orders/:id
 */
router.get(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]),
  orderController.getOrderById
);

// ============================================
// POST ENDPOINTS - Create Operations
// ============================================

/**
 * Create order
 * POST /api/orders
 * Body: items[], customerId, discount, tax, notes, businessUnitId, expectedDeliveryDate, shippingAddress, paymentMethod, paymentTerms, priority
 */
router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.EMPLOYEE]),
  orderController.createOrder
);

// ============================================
// POST ENDPOINTS - Item Management (must come before /:id routes)
// ============================================

/**
 * Add item to order
 * POST /api/orders/:orderId/items
 * Body: productId, variantId, quantity, unitPrice, discount, notes
 */
router.post(
  '/:orderId/items',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  orderController.addItemToOrder
);

// ============================================
// POST ENDPOINTS - Order Actions (must come before /:id routes)
// ============================================

/**
 * Cancel order
 * POST /api/orders/:id/cancel
 * Body: reason
 */
router.post(
  '/:id/cancel',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.cancelOrder
);

/**
 * Convert order to sale
 * POST /api/orders/:orderId/convert-to-sale
 */
router.post(
  '/:orderId/convert-to-sale',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.convertOrderToSale
);

// ============================================
// PUT ENDPOINTS - Updates
// ============================================

/**
 * Update order
 * PUT /api/orders/:id
 * Body: status, notes, priority, shippingAddress, expectedDeliveryDate
 */
router.put(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.updateOrder
);

/**
 * Update order item
 * PUT /api/orders/:orderId/items/:itemId
 * Body: quantity, unitPrice, discount, notes
 */
router.put(
  '/:orderId/items/:itemId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  orderController.updateOrderItem
);

// ============================================
// PATCH ENDPOINTS - Partial Updates
// ============================================

/**
 * Update order status
 * PATCH /api/orders/:id/status
 * Body: status, notes
 */
router.patch(
  '/:id/status',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.updateOrderStatus
);

/**
 * Bulk update order status
 * PATCH /api/orders/bulk-status
 * Body: orderIds[], status, notes
 */
router.patch(
  '/bulk-status',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.bulkUpdateStatus
);

// ============================================
// DELETE ENDPOINTS
// ============================================

/**
 * Remove item from order
 * DELETE /api/orders/:orderId/items/:itemId
 */
router.delete(
  '/:orderId/items/:itemId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  orderController.removeOrderItem
);

/**
 * Delete order (soft delete)
 * DELETE /api/orders/:id
 */
router.delete(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  orderController.deleteOrder
);

/**
 * Bulk delete orders
 * DELETE /api/orders/bulk
 * Body: orderIds[]
 */
router.delete(
  '/bulk',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  orderController.bulkDeleteOrders
);

export default router;
