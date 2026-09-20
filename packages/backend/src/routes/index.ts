// D:\Projects\Kalwanga\packages\backend\src\routes\index.ts

import { Router } from 'express';
import productRoutes from './products.js';
import saleRoutes from './sale.js';           // ← was './sale.ts'
import inventoryRoutes from './inventory.js';
import locationRoutes from './locations.js';
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
import providerRoutes from './providers.js';
import reportRoutes from './reports.js';
import supplierRoutes from './suppliers.js';
import purchaseOrderRoutes from './purchaseOrders.js';
import shiftRoutes from './shift.js';         // ← was './shift.ts'
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

// ✅ Guest session middleware + guest routers
import { guestSessionMiddleware } from '../middleware/guestSession.js';
import guestCartRoutes from './guestCart.js';
import guestWishlistRoutes from './guestWishlist.js';
import guestRecentlyViewedRoutes from './guestRecentlyViewed.js';

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

// Public invitation routes.
//
// ⚠️ Mounted at a SPECIFIC path (`/users/invitations`) rather than the
// bare `/users` prefix. Mounting two routers on the same prefix and
// letting one run a catch-all 404 would swallow every subsequent
// `/users/*` request.
router.use('/users/invitations', userInvitationRoutes);

// ============================================
// GUEST SESSION MIDDLEWARE
// ============================================
//
// Attaches `req.guestSessionId`, minting a new signed cookie when
// none exists. It never blocks the request — falls through on error —
// so mounting it globally is safe for authenticated traffic too.
//
// Mounted AFTER public routes (webhooks, realtime, invitations) so
// those don't needlessly mint a guest session cookie, and BEFORE the
// guest routers that consume `req.guestSessionId`.

router.use(guestSessionMiddleware);

// ============================================
// GUEST ROUTES (anonymous storefront visitors)
// ============================================
//
// These read `req.guestSessionId` set by `guestSessionMiddleware`.
// Deliberately outside the audit wrapper so anonymous traffic doesn't
// spam the audit log.

router.use('/cart/guest', guestCartRoutes);
router.use('/wishlist/guest', guestWishlistRoutes);
router.use('/recently-viewed/guest', guestRecentlyViewedRoutes);

// ============================================
// AUDIT ROUTES
// ============================================

router.use('/audit', auditRoutes);

// ============================================
// USER-RELATED ROUTES (with audit logging)
// ============================================

router.use('/users', auditMiddleware('USER_OPERATION', 'USER'), userRoutes);

router.use(
  '/users',
  auditMiddleware('USER_ACTIVITY_OPERATION', 'USER_ACTIVITY'),
  userActivityRoutes,
);

router.use(
  '/users',
  auditMiddleware('USER_IMPORT_OPERATION', 'USER_IMPORT'),
  userImportRoutes,
);

router.use(
  '/user-groups',
  auditMiddleware('USER_GROUP_OPERATION', 'USER_GROUP'),
  userGroupRoutes,
);

// ============================================
// ROUTES WITH AUDIT LOGGING
// ============================================

router.use(
  '/products',
  auditMiddleware('PRODUCT_OPERATION', 'PRODUCT'),
  productRoutes,
);
router.use(
  '/sales',
  auditMiddleware('SALE_OPERATION', 'SALE'),
  saleRoutes,
);
router.use(
  '/inventory',
  auditMiddleware('INVENTORY_OPERATION', 'INVENTORY'),
  inventoryRoutes,
);

router.use(
  '/locations',
  auditMiddleware('LOCATION_OPERATION', 'LOCATION'),
  locationRoutes,
);

router.use(
  '/customers',
  auditMiddleware('CUSTOMER_OPERATION', 'CUSTOMER'),
  customerRoutes,
);
router.use(
  '/business-units',
  auditMiddleware('BUSINESS_UNIT_OPERATION', 'BUSINESS_UNIT'),
  businessUnitRoutes,
);
router.use(
  '/categories',
  auditMiddleware('CATEGORY_OPERATION', 'CATEGORY'),
  categoryRoutes,
);
router.use('/orders', auditMiddleware('ORDER_OPERATION', 'ORDER'), orderRoutes);
router.use(
  '/payments',
  auditMiddleware('PAYMENT_OPERATION', 'PAYMENT'),
  paymentRoutes,
);
router.use(
  '/payment-providers',
  auditMiddleware('PAYMENT_OPERATION', 'PAYMENT_PROVIDER'),
  providerRoutes,
);
router.use(
  '/reports',
  auditMiddleware('REPORT_OPERATION', 'REPORT'),
  reportRoutes,
);
router.use(
  '/suppliers',
  auditMiddleware('SUPPLIER_OPERATION', 'SUPPLIER'),
  supplierRoutes,
);
router.use(
  '/purchase-orders',
  auditMiddleware('PURCHASE_ORDER_OPERATION', 'PURCHASE_ORDER'),
  purchaseOrderRoutes,
);
router.use(
  '/shifts',
  auditMiddleware('SHIFT_OPERATION', 'SHIFT'),
  shiftRoutes,
);
router.use(
  '/bookkeeping',
  auditMiddleware('BOOKKEEPING_OPERATION', 'BOOKKEEPING'),
  bookkeepingRoutes,
);
router.use('/tax', auditMiddleware('TAX_OPERATION', 'TAX'), taxRoutes);
router.use(
  '/companies',
  auditMiddleware('COMPANY_OPERATION', 'COMPANY'),
  companyRoutes,
);
router.use(
  '/reorder',
  auditMiddleware('REORDER_OPERATION', 'REORDER'),
  reorderRoutes,
);
router.use(
  '/documents',
  auditMiddleware('DOCUMENT_OPERATION', 'DOCUMENT'),
  documentRoutes,
);
router.use(
  '/export',
  auditMiddleware('EXPORT_OPERATION', 'EXPORT'),
  exportRoutes,
);
router.use(
  '/import',
  auditMiddleware('IMPORT_OPERATION', 'IMPORT'),
  importRoutes,
);

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
//
// Only reached when NO route above has matched. The app-level 404 in
// `index.ts` handles paths that never reach this router (e.g. requests
// to `/` or to an unmounted prefix).

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
// GLOBAL ERROR HANDLER (router-level)
// ============================================
//
// Delegates to the SAME shape used by `errorHandler` in `index.ts`.
// Kept for cases where an error is thrown inside this router's
// middleware (auditMiddleware, guestSessionMiddleware, etc.) before
// the app-level error handler is reached.

router.use((err: any, req: any, res: any, next: any) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  console.error('Route error:', err);

  res.status(status).json({
    success: false,
    error: message,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

export default router;
