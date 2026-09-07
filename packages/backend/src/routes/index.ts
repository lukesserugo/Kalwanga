// D:\Projects\Kalwanga\packages\backend\src\routes\index.ts

import { Router } from 'express';
import productRoutes from './products.js';
import saleRoutes from './sales.js';
import inventoryRoutes from './inventory.js';
import customerRoutes from './customers.js';
import userRoutes from './users.js';
import userActivityRoutes from './userActivity.js';
import userImportRoutes from './userImport.js';
import userInvitationRoutes from './userInvitations.js';
import userGroupRoutes from './userGroups.js';
import businessUnitRoutes from './businessUnits.js';
import categoryRoutes from './categories.js';
import orderRoutes from './orders.js';
import paymentRoutes from './payment.js';
import providerRoutes from './providers.js'; // ✅ ADD THIS IMPORT
import reportRoutes from './reports.js';
import supplierRoutes from './suppliers.js';
import purchaseOrderRoutes from './purchaseOrders.js';
import shiftRoutes from './shifts.js';
import notificationRoutes from './notification.js';
import barcodeRoutes from './barcodes.js';
import receiptRoutes from './receipts.js';
import analyticsRoutes from './analytics.js';
import dashboardRoutes from './dashboard.js';
import bookkeepingRoutes from './bookkeeping.js';
import taxRoutes from './tax.js';
import uploadRoutes from './upload.js';
import cartRoutes from './cart.js';
import checkoutRoutes from './checkout.js';
import posRoutes from './pos.js';
import backupRoutes from './backup.js';
import webhookRoutes from './webhooks.js';
import exportRoutes from './export.js';
import importRoutes from './import.js';
import realtimeRoutes from './realtime.js';
import documentRoutes from './document.js';
import reorderRoutes from './reorder.js';
import companyRoutes from './companies.js';
import healthRoutes from './health.js';
import auditRoutes from './audit.js';
import { auditMiddleware } from '../middleware/auditMiddleware.js';

const router = Router();

// ============================================
// HEALTH CHECK ROUTES (no audit, no auth)
// ============================================

router.use('/health', healthRoutes);

// ============================================
// PUBLIC ROUTES (no authentication required)
// ============================================

// Webhooks (external services call these)
router.use('/webhooks', webhookRoutes);

// Realtime SSE endpoint (token in query param)
router.use('/realtime', realtimeRoutes);

// Public invitation routes (accept/decline/view by token)
router.use('/users', userInvitationRoutes);

// ============================================
// AUDIT ROUTES
// ============================================

router.use('/audit', auditRoutes);

// ============================================
// AUTHENTICATED ROUTES (requires valid token)
// ============================================

//router.use(authMiddleware);

// ============================================
// USER-RELATED ROUTES (with audit logging)
// ============================================

// Core user routes (CRUD, permissions, business units, bulk operations)
router.use('/users', auditMiddleware('USER_OPERATION', 'USER'), userRoutes);

// User activity routes (activity logs, audit trail, statistics)
router.use('/users', auditMiddleware('USER_ACTIVITY_OPERATION', 'USER_ACTIVITY'), userActivityRoutes);

// User import routes (file upload, validation, history)
router.use('/users', auditMiddleware('USER_IMPORT_OPERATION', 'USER_IMPORT'), userImportRoutes);

// User group routes (group management, member assignment, permissions)
router.use('/user-groups', auditMiddleware('USER_GROUP_OPERATION', 'USER_GROUP'), userGroupRoutes);

// ============================================
// ROUTES WITH AUDIT LOGGING
// ============================================

router.use('/products', auditMiddleware('PRODUCT_OPERATION', 'PRODUCT'), productRoutes);
router.use('/sales', auditMiddleware('SALE_OPERATION', 'SALE'), saleRoutes);
router.use('/inventory', auditMiddleware('INVENTORY_OPERATION', 'INVENTORY'), inventoryRoutes);
router.use('/customers', auditMiddleware('CUSTOMER_OPERATION', 'CUSTOMER'), customerRoutes);
router.use('/business-units', auditMiddleware('BUSINESS_UNIT_OPERATION', 'BUSINESS_UNIT'), businessUnitRoutes);
router.use('/categories', auditMiddleware('CATEGORY_OPERATION', 'CATEGORY'), categoryRoutes);
router.use('/orders', auditMiddleware('ORDER_OPERATION', 'ORDER'), orderRoutes);
router.use('/payments', auditMiddleware('PAYMENT_OPERATION', 'PAYMENT'), paymentRoutes);
router.use('/payment-providers', auditMiddleware('PAYMENT_OPERATION', 'PAYMENT_PROVIDER'), providerRoutes); // ✅ ADD THIS - Mount provider routes with audit
router.use('/reports', auditMiddleware('REPORT_OPERATION', 'REPORT'), reportRoutes);
router.use('/suppliers', auditMiddleware('SUPPLIER_OPERATION', 'SUPPLIER'), supplierRoutes);
router.use('/purchase-orders', auditMiddleware('PURCHASE_ORDER_OPERATION', 'PURCHASE_ORDER'), purchaseOrderRoutes);
router.use('/shifts', auditMiddleware('SHIFT_OPERATION', 'SHIFT'), shiftRoutes);
router.use('/bookkeeping', auditMiddleware('BOOKKEEPING_OPERATION', 'BOOKKEEPING'), bookkeepingRoutes);
router.use('/tax', auditMiddleware('TAX_OPERATION', 'TAX'), taxRoutes);
router.use('/companies', auditMiddleware('COMPANY_OPERATION', 'COMPANY'), companyRoutes);
router.use('/reorder', auditMiddleware('REORDER_OPERATION', 'REORDER'), reorderRoutes);
router.use('/documents', auditMiddleware('DOCUMENT_OPERATION', 'DOCUMENT'), documentRoutes);
router.use('/export', auditMiddleware('EXPORT_OPERATION', 'EXPORT'), exportRoutes);
router.use('/import', auditMiddleware('IMPORT_OPERATION', 'IMPORT'), importRoutes);

// ============================================
// ROUTES WITHOUT AUDIT LOGGING (high-frequency operations)
// ============================================

router.use('/notifications', notificationRoutes);
router.use('/barcodes', barcodeRoutes);
router.use('/receipts', receiptRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/upload', uploadRoutes);
router.use('/cart', cartRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/pos', posRoutes);
router.use('/backups', backupRoutes);

// ============================================
// 404 HANDLER FOR API ROUTES
// ============================================

router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================

router.use((err: any, req: any, res: any, next: any) => {
  console.error('Route error:', err);
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  res.status(status).json({
    success: false,
    error: message,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

export default router;
