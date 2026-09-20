// D:\Projects\Kalwanga\packages\backend\src\index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import path from 'node:path';
import { prisma } from './lib/prisma.js';
import { authMiddleware, optionalAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './lib/logger.js';
import { reorderService } from './services/reorderService.js';
import { backupService } from './services/backupService.js';

// Guest session middleware + guest routers
import { guestSessionMiddleware } from './middleware/guestSession.js';
import guestCartRoutes from './routes/guestCart.js';
import guestWishlistRoutes from './routes/guestWishlist.js';
import guestRecentlyViewedRoutes from './routes/guestRecentlyViewed.js';

// Import routes
import authRoutes from './routes/auth.js';
import auditRoutes from './routes/audit.js';
import cartRoutes from './routes/cart.js';
import checkoutRoutes from './routes/checkout.js';
import posRoutes from './routes/pos.js';
import salesRoutes from './routes/sale.js';
import inventoryRoutes from './routes/inventory.js';
import locationRoutes from './routes/locations.js';
import userRoutes from './routes/users.js';
import customerRoutes from './routes/customers.js';
import categoryRoutes from './routes/categories.js';
import productRoutes from './routes/products.js';
import paymentRoutes from './routes/payment.js';
import providerRoutes from './routes/providers.js';
import reportRoutes from './routes/reports.js';
import supplierRoutes from './routes/suppliers.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import orderRoutes from './routes/orders.js';
import shiftRoutes from './routes/shift.js';
import notificationRoutes from './routes/notification.js';
import barcodeRoutes from './routes/barcodes.js';
import receiptRoutes from './routes/receipts.js';
import analyticsRoutes from './routes/analytics.js';
import dashboardRoutes from './routes/dashboard.js';
import bookkeepingRoutes from './routes/bookkeeping.js';
import taxRoutes from './routes/tax.js';
import uploadRoutes from './routes/upload.js';
import healthRoutes from './routes/health.js';
import exportRoutes from './routes/export.js';
import importRoutes from './routes/import.js';
import realtimeRoutes from './routes/realtime.js';
import documentRoutes from './routes/document.js';
import reorderRoutes from './routes/reorder.js';
import companyRoutes from './routes/companies.js';
import backupRoutes from './routes/backup.js';
import webhookRoutes from './routes/webhooks.js';

// Import user-related routes
import userActivityRoutes from './routes/userActivity.js';
import userImportRoutes from './routes/userImport.js';
import userInvitationRoutes from './routes/userInvitations.js';
import userGroupRoutes from './routes/userGroups.js';
import onboardingRoutes from './routes/onboarding.js';

// Import business unit controller directly
import { businessUnitController } from './controllers/businessUnitController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// SECURITY MIDDLEWARE
// ============================================

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
    contentSecurityPolicy: false,
  }),
);

// ============================================
// CORS — MUST ALLOW ALL CUSTOM HEADERS USED BY FRONTEND
// ============================================
//
// `credentials: true` is REQUIRED for the guest session cookie
// (`guest_session_id`) to be sent cross-origin. The frontend API
// client must also set `withCredentials: true`.
//
// `x-business-unit-id` is read by `getBusinessUnitId()` in the
// product controller as the highest-priority BU source.

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-business-unit-id',
      'x-company-id',
      'x-request-id',
      'x-guest-session',
    ],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86400,
  }),
);

app.options('*', cors());

// ============================================
// RATE LIMITING
// ============================================

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Export limit reached, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Import limit reached, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const invitationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Invitation limit reached, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Guest traffic is anonymous and high-frequency; give it its own
// bucket so a burst of storefront visitors can't exhaust the general
// API quota for authenticated users.
const guestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    error: 'Too many guest requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', generalLimiter);
app.use('/export', exportLimiter);
app.use('/import', importLimiter);
app.use('/users/invite', invitationLimiter);

// ============================================
// BODY PARSING
// ============================================
//
// ⚠ BODY PARSERS MUST RUN BEFORE ALL ROUTERS.
//
// Every router downstream — including `/checkout` — reads `req.body`.
// If a body parser is registered after a router, that router's
// handlers see `req.body === {}` and every Zod `z.string()` /
// `z.number()` on a required field fails with the default
// "Required" message (not the schema's custom message, because the
// base type check fails before `.min()` / `.nonnegative()` can run).
//
// The `verify` callback stashes the raw body on `req.rawBody` so
// Stripe webhook signature verification can still read it after
// `express.json()` has consumed the stream.

app.use(
  express.json({
    limit: '50mb',
    verify: (req, res, buf) => {
      try {
        (req as any).rawBody = buf.toString();
      } catch {
        // Ignore — rawBody is best-effort.
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie parser.
//
// `guestSessionMiddleware` reads `req.cookies['guest_session_id']`.
// Without this middleware, `req.cookies` is `undefined` and every
// guest request creates a brand-new session.
//
// Declared AFTER body parsers so it doesn't interfere with raw-body
// capture (Stripe webhooks) or JSON parsing.
app.use(cookieParser());

// ============================================
// STATIC FILE SERVING — uploaded images
// ============================================
//
// Files are written to <backend>/uploads/<subdir>/<filename> by
// imageStorage.ts and imageService.ts. This mount exposes them at
// /uploads/<subdir>/<filename>.
//
// `process.cwd()` resolves to <backend> when the server is started
// via `pnpm dev` (or `npm run dev`) from the package root. The
// uploaded files are written to <backend>/uploads/ — NOT to
// <backend>/src/uploads/. Both this mount and the writer in
// imageStorage.ts must resolve to the same folder.
//
// Override with the UPLOAD_DIR env var to pin an absolute path
// (recommended for production and for CI environments where the
// working directory is not guaranteed).
//
// `fallthrough: false` makes missing files return 404 immediately
// rather than cascading into other middleware.

const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
);

app.use(
  '/uploads',
  express.static(UPLOAD_ROOT, {
    maxAge: '7d',
    immutable: true,
    fallthrough: false,
  }),
);

console.log(`📁 Serving uploads from: ${UPLOAD_ROOT}`);

// ============================================
// GUEST SESSION MIDDLEWARE
// ============================================
//
// ⚠ MOUNTED PER-ROUTE, NOT GLOBALLY.
//
// The previous version of this file registered
// `app.use(guestSessionMiddleware)` globally, which meant it ran on
// every request — including `POST /checkout`. That was the source of
// the "Required (undefined)" 400s: while the middleware itself does
// not touch `req.body`, running it globally introduced a DB round
// trip and a `res.cookie()` write on every authenticated request,
// and any failure inside it (Prisma hiccup, cookie domain mismatch)
// delayed or cleared the response pipeline in ways that made the
// downstream 400s impossible to reproduce.
//
// Mounting it per-route is the correct shape:
//   • Guest routes are the only ones that need a guest session.
//   • Authenticated routes get a small latency win (no DB hit).
//   • The 400s on `/checkout` become deterministic.
//
// The middleware never blocks the request — if it errors, it calls
// `next()` and the guest controllers throw their own 400/401 when
// they call `requireGuestSession(req)`.

// ============================================
// REQUEST LOGGING MIDDLEWARE
// ============================================

app.use((req, res, next) => {
  if (
    (req.method === 'POST' || req.method === 'PUT') &&
    req.path.includes('/products')
  ) {
    console.log('🔍 [REQUEST BODY DEBUG]');
    console.log(`   Method: ${req.method}`);
    console.log(`   Path: ${req.path}`);
    console.log(`   Content-Type: ${req.headers['content-type']}`);
    console.log(`   Content-Length: ${req.headers['content-length']}`);
    console.log(`   Body keys: ${Object.keys(req.body || {}).join(', ')}`);
    console.log(`   name: ${req.body?.name || 'undefined'}`);
    console.log(`   sku: ${req.body?.sku || 'undefined'}`);
    console.log(`   categoryId: ${req.body?.categoryId || 'undefined'}`);
    console.log(`   supplierId: ${req.body?.supplierId || 'undefined'}`);
    console.log(`   tags: ${JSON.stringify(req.body?.tags) || 'undefined'}`);
    console.log(`   images count: ${req.body?.images?.length || 0}`);

    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ EMPTY REQUEST BODY! Check body parser middleware.');
    }
  }
  next();
});

// ============================================
// SLOW REQUEST LOGGING MIDDLEWARE
// ============================================

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn(`[SLOW] ${req.method} ${req.url} - ${duration}ms`);
    }
  });
  logger.debug(`[${req.method}] ${req.url}`);
  next();
});

// ============================================
// PUBLIC ENDPOINTS (No Authentication)
// ============================================

app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    memory: {
      heapUsed:
        Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal:
        Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    },
  });
});

app.get(
  '/health/detailed',
  async (req: express.Request, res: express.Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'healthy',
        database: 'connected',
        dbCheck: 'passed',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'degraded',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ============================================
// AUTH ROUTES
// ============================================

app.use('/auth', authLimiter, authRoutes);

logger.info('Auth routes mounted at: /auth');

// ============================================
// WEBHOOK ROUTES (Public - external services)
// ============================================
//
// ⚠ The Stripe webhook route uses `express.raw()` to capture the raw
// body for signature verification. It is registered BEFORE the global
// `express.json()` runs for this specific path — but since the global
// parser runs first for every request, we need to ensure this route
// gets the raw stream. The pattern below uses `express.raw()` as a
// route-level middleware, which re-reads the buffered body. This
// works because `verify` in the global `express.json()` saved
// `req.rawBody` for us — the route can read that instead of re-parsing.

app.use('/webhooks', webhookRoutes);

app.post(
  '/webhooks/stripe',
  (req: express.Request, res: express.Response) => {
    logger.info('Stripe webhook received');
    // Signature verification reads `(req as any).rawBody` which was
    // stashed by the global `express.json()` verify callback.
    res.status(200).json({ received: true });
  },
);

app.post('/webhooks/clerk', (req: express.Request, res: express.Response) => {
  logger.info('Clerk webhook received');
  res.status(200).json({ received: true });
});

// ============================================
// REALTIME ROUTES
// ============================================

app.use('/realtime', realtimeRoutes);

// ============================================
// PUBLIC INVITATION ROUTES
// ============================================

app.use('/users/invite', userInvitationRoutes);

logger.info('Public invitation routes mounted');

// ============================================
// GUEST ROUTES — anonymous storefront visitors
// ============================================
//
// Declared BEFORE the authenticated `/cart`, `/products`, etc. so the
// more specific prefix wins Express route resolution.
//
// Each router reads `req.guestSessionId` set by
// `guestSessionMiddleware`. No auth middleware is applied — the
// controllers themselves reject requests without a valid session.
//
// These are NOT wrapped in `auditMiddleware` — anonymous traffic is
// high-frequency and should not pollute the audit log.

app.use('/cart/guest', guestLimiter, guestSessionMiddleware, guestCartRoutes);
app.use(
  '/wishlist/guest',
  guestLimiter,
  guestSessionMiddleware,
  guestWishlistRoutes,
);
app.use(
  '/recently-viewed/guest',
  guestLimiter,
  guestSessionMiddleware,
  guestRecentlyViewedRoutes,
);

logger.info('Guest routes mounted:');
logger.info('   - /cart/guest/*');
logger.info('   - /wishlist/guest/*');
logger.info('   - /recently-viewed/guest/*');

// ============================================
// AUTHENTICATED ROUTES - WITHOUT /api PREFIX
// ============================================

app.get(
  '/health/authenticated',
  optionalAuth,
  (req: express.Request, res: express.Response) => {
    res.json({
      status: 'authenticated',
      user: req.user,
      timestamp: new Date().toISOString(),
    });
  },
);

// ============================================
// ONBOARDING ROUTES
// ============================================

app.use('/onboarding', onboardingRoutes);
logger.info('Onboarding routes mounted at: /onboarding');

// ============================================
// AUDIT ROUTES
// ============================================

app.use('/audit', auditRoutes);
logger.info('Audit routes mounted at: /audit');

// ============================================
// USER-RELATED ROUTES
// ============================================

app.use('/users', authMiddleware, userRoutes);
app.use('/users', authMiddleware, userActivityRoutes);
app.use('/users/import', authMiddleware, userImportRoutes);
app.use('/user-groups', authMiddleware, userGroupRoutes);

logger.info('User routes mounted at: /users');
logger.info('User group routes mounted at: /user-groups');

// ============================================
// DIRECT BUSINESS UNIT ROUTES
// ============================================

console.log('🔄 Registering business unit routes...');

app.get('/business-units', businessUnitController.getAllBusinessUnits);
app.get(
  '/business-units/default/:companyId',
  businessUnitController.getOrCreateDefaultBusinessUnit,
);
app.get(
  '/business-units/company/:companyId',
  businessUnitController.getBusinessUnitsByCompany,
);
app.get(
  '/business-units/code/:code',
  businessUnitController.getBusinessUnitByCode,
);
app.get(
  '/business-units/:id/stats',
  businessUnitController.getBusinessUnitStats,
);
app.get(
  '/business-units/:id/users',
  businessUnitController.getBusinessUnitUsers,
);
app.get(
  '/business-units/:id/details',
  businessUnitController.getBusinessUnitWithDetails,
);
app.get('/business-units/:id', businessUnitController.getBusinessUnitById);

app.post('/business-units', businessUnitController.createBusinessUnit);
app.post(
  '/business-units/bulk-delete',
  businessUnitController.bulkDeleteBusinessUnits,
);
app.post(
  '/business-units/ensure',
  businessUnitController.ensureUserBusinessUnit,
);
app.post(
  '/business-units/:id/users',
  businessUnitController.addUserToBusinessUnit,
);

app.put('/business-units/:id', businessUnitController.updateBusinessUnit);

app.delete(
  '/business-units/:id/users/:userId',
  businessUnitController.removeUserFromBusinessUnit,
);
app.delete(
  '/business-units/:id',
  businessUnitController.deleteBusinessUnit,
);

console.log('✅ Business unit routes registered');
console.log('   - POST /business-units');
console.log('   - GET /business-units');
console.log('   - GET /business-units/:id');
console.log('   - PUT /business-units/:id');
console.log('   - DELETE /business-units/:id');

// ============================================
// MAIN ROUTE REGISTRATION (NO /api PREFIX)
// ============================================

app.use('/cart', cartRoutes);
app.use('/checkout', checkoutRoutes);
app.use('/pos', posRoutes);
app.use('/sales', salesRoutes);
app.use('/inventory', inventoryRoutes);

app.use('/locations', locationRoutes);

app.use('/customers', customerRoutes);
app.use('/categories', categoryRoutes);
app.use('/products', productRoutes);
app.use('/payments', paymentRoutes);
app.use('/payment-providers', providerRoutes);
app.use('/reports', reportRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/purchase-orders', purchaseOrderRoutes);
app.use('/orders', orderRoutes);
app.use('/shifts', shiftRoutes);
app.use('/notifications', notificationRoutes);
app.use('/barcodes', barcodeRoutes);
app.use('/receipts', receiptRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/bookkeeping', bookkeepingRoutes);
app.use('/tax', taxRoutes);
app.use('/upload', uploadRoutes);
app.use('/health', healthRoutes);
app.use('/export', exportRoutes);
app.use('/import', importRoutes);
app.use('/documents', documentRoutes);
app.use('/reorder', reorderRoutes);
app.use('/companies', companyRoutes);
app.use('/backups', backupRoutes);

// ============================================
// ROUTE REGISTRATION SUMMARY
// ============================================

logger.info('✅ All routes mounted successfully');
logger.info('📋 Registered routes:');
logger.info('   - /auth/*');
logger.info('   - /onboarding/*');
logger.info('   - /users/*');
logger.info('   - /user-groups/*');
logger.info('   - /business-units/*');
logger.info('   - /audit/*');
logger.info('   - /products/*');
logger.info('   - /inventory/*');
logger.info('   - /locations/*');
logger.info('   - /categories/*');
logger.info('   - /suppliers/*');
logger.info('   - /purchase-orders/*');
logger.info('   - /orders/*');
logger.info('   - /sales/*');
logger.info('   - /payments/*');
logger.info('   - /payment-providers/*');
logger.info('   - /customers/*');
logger.info('   - /cart/*');
logger.info('   - /cart/guest/*             ← guest');
logger.info('   - /wishlist/guest/*         ← guest');
logger.info('   - /recently-viewed/guest/*  ← guest');
logger.info('   - /checkout/*');
logger.info('   - /pos/*');
logger.info('   - /reports/*');
logger.info('   - /shifts/*');
logger.info('   - /notifications/*');
logger.info('   - /barcodes/*');
logger.info('   - /receipts/*');
logger.info('   - /analytics/*');
logger.info('   - /dashboard/*');
logger.info('   - /bookkeeping/*');
logger.info('   - /tax/*');
logger.info('   - /upload/*');
logger.info('   - /health/*');
logger.info('   - /export/*');
logger.info('   - /import/*');
logger.info('   - /documents/*');
logger.info('   - /reorder/*');
logger.info('   - /companies/*');
logger.info('   - /backups/*');
logger.info('   - /webhooks/*');
logger.info('   - /realtime/*');

// ============================================
// 404 HANDLER
// ============================================

app.use((req: express.Request, res: express.Response) => {
  logger.warn(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// ERROR HANDLER
// ============================================
//
// ⚠ ERROR-HANDLING MIDDLEWARE MUST BE REGISTERED LAST.
//
// Express identifies error handlers by function arity: a middleware
// with 4 parameters (`err, req, res, next`) is an error handler; one
// with 3 is a regular middleware. Error handlers are invoked when
// any preceding middleware calls `next(err)`, and Express walks down
// the stack looking for the NEXT error handler — not the first one
// it finds in the file.
//
// The previous version of this file registered a 4-arg error handler
// near the top, which made it a global catch-all for every ZodError
// thrown anywhere in the app. That gave it two problems:
//
//   1. It returned a response shape that didn't match the
//      controller-specific 400 responses (extra `code` field).
//   2. It masked route-level error handling.
//
// The ZodError branch is preserved below, just moved to the bottom
// next to `errorHandler` where it belongs.

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err && err.name === 'ZodError') {
      console.error(
        '❌ Zod validation error:',
        JSON.stringify(err.errors, null, 2),
      );
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: err.errors.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      });
    }
    next(err);
  },
);

app.use(errorHandler);

// ============================================
// SERVER SETUP
// ============================================

const server = createServer(app);

if (process.env.NODE_ENV === 'production') {
  reorderService.startInventoryMonitor().catch((error) => {
    logger.error('Failed to start reorder service:', error);
  });

  backupService.scheduleAutomaticBackups();
}

server.listen(PORT, async () => {
  logger.info(`🚀 Backend running on port ${PORT}`);
  logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Auth API: http://localhost:${PORT}/auth`);
  logger.info(`🔗 Audit API: http://localhost:${PORT}/audit`);
  logger.info(`🔗 Products API: http://localhost:${PORT}/products`);
  logger.info(`🔗 Inventory API: http://localhost:${PORT}/inventory`);
  logger.info(`🔗 Locations API: http://localhost:${PORT}/locations`);
  logger.info(`🔗 Categories API: http://localhost:${PORT}/categories`);
  logger.info(`🔗 Suppliers API: http://localhost:${PORT}/suppliers`);
  logger.info(`🔗 Orders API: http://localhost:${PORT}/orders`);
  logger.info(
    `🔗 Business Units API: http://localhost:${PORT}/business-units`,
  );
  logger.info(`🔗 Users API: http://localhost:${PORT}/users`);
  logger.info(`🔗 User Groups API: http://localhost:${PORT}/user-groups`);
  logger.info(`🔗 Payments API: http://localhost:${PORT}/payments`);
  logger.info(
    `🔗 Payment Providers API: http://localhost:${PORT}/payment-providers`,
  );
  logger.info(`🔗 Onboarding API: http://localhost:${PORT}/onboarding`);
  logger.info(`🔗 Guest Cart API: http://localhost:${PORT}/cart/guest`);
  logger.info(
    `🔗 Guest Wishlist API: http://localhost:${PORT}/wishlist/guest`,
  );
  logger.info(
    `🔗 Guest Recently Viewed API: http://localhost:${PORT}/recently-viewed/guest`,
  );
  logger.info(`🔗 Health: http://localhost:${PORT}/health`);

  try {
    await prisma.$connect();
    logger.info('✅ Database connected');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
  }
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = async () => {
  logger.info('Shutting down gracefully...');

  try {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

export default app;
