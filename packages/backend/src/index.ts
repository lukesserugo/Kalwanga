// D:\Projects\Kalwanga\packages\backend\src\index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { prisma } from './lib/prisma.js';
import { authMiddleware, optionalAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './lib/logger.js';
import { reorderService } from './services/reorderService.js';
import { backupService } from './services/backupService.js';

// Import routes
import authRoutes from './routes/auth.js';
import auditRoutes from './routes/audit.js';
import cartRoutes from './routes/cart.js';
import checkoutRoutes from './routes/checkout.js';
import posRoutes from './routes/pos.js';
import salesRoutes from './routes/sale.ts';
import inventoryRoutes from './routes/inventory.js';
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
import shiftRoutes from './routes/shift.ts';
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

// Import business unit controller directly
import { businessUnitController } from './controllers/businessUnitController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// SECURITY MIDDLEWARE
// ============================================

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  contentSecurityPolicy: false,
}));

// ============================================
// CORS — MUST ALLOW ALL CUSTOM HEADERS USED BY FRONTEND
// ============================================

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-business-unit-id',   // 👈 FIX: frontend sends this on many routes
    'x-company-id',
    'x-request-id',
  ],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 86400, // cache preflight for 24h — reduces OPTIONS traffic
}));

// Explicitly answer preflight for every route (belt-and-braces)
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

app.use('/api', generalLimiter);
app.use('/export', exportLimiter);
app.use('/import', importLimiter);
app.use('/users/invite', invitationLimiter);

// ============================================
// BODY PARSING - MUST COME FIRST
// ============================================

app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    try {
      (req as any).rawBody = buf.toString();
    } catch (e) {
      // Ignore
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// REQUEST LOGGING MIDDLEWARE (FOR DEBUGGING)
// ============================================

app.use((req, res, next) => {
  if ((req.method === 'POST' || req.method === 'PUT') && req.path.includes('/products')) {
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
// LOGGING MIDDLEWARE
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
// VALIDATION ERROR LOGGING MIDDLEWARE
// ============================================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && err.name === 'ZodError') {
    console.error('❌ Zod validation error:', JSON.stringify(err.errors, null, 2));
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
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    },
  });
});

app.get('/health/detailed', async (req: express.Request, res: express.Response) => {
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
});

// ============================================
// AUTH ROUTES
// ============================================

app.use('/auth', authLimiter, authRoutes);

logger.info('Auth routes mounted at: /auth');

// ============================================
// WEBHOOK ROUTES (Public - external services)
// ============================================

app.use('/webhooks', webhookRoutes);

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req: express.Request, res: express.Response) => {
  logger.info('Stripe webhook received');
  res.status(200).json({ received: true });
});

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
// AUTHENTICATED ROUTES - WITHOUT /api PREFIX
// ============================================

app.get('/health/authenticated', optionalAuth, (req: express.Request, res: express.Response) => {
  res.json({
    status: 'authenticated',
    user: req.user,
    timestamp: new Date().toISOString(),
  });
});

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
app.get('/business-units/default/:companyId', businessUnitController.getOrCreateDefaultBusinessUnit);
app.get('/business-units/company/:companyId', businessUnitController.getBusinessUnitsByCompany);
app.get('/business-units/code/:code', businessUnitController.getBusinessUnitByCode);
app.get('/business-units/:id/stats', businessUnitController.getBusinessUnitStats);
app.get('/business-units/:id/users', businessUnitController.getBusinessUnitUsers);
app.get('/business-units/:id/details', businessUnitController.getBusinessUnitWithDetails);
app.get('/business-units/:id', businessUnitController.getBusinessUnitById);

app.post('/business-units', businessUnitController.createBusinessUnit);
app.post('/business-units/bulk-delete', businessUnitController.bulkDeleteBusinessUnits);
app.post('/business-units/ensure', businessUnitController.ensureUserBusinessUnit);
app.post('/business-units/:id/users', businessUnitController.addUserToBusinessUnit);

app.put('/business-units/:id', businessUnitController.updateBusinessUnit);

app.delete('/business-units/:id/users/:userId', businessUnitController.removeUserFromBusinessUnit);
app.delete('/business-units/:id', businessUnitController.deleteBusinessUnit);

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
logger.info('   - /users/*');
logger.info('   - /user-groups/*');
logger.info('   - /business-units/*');
logger.info('   - /audit/*');
logger.info('   - /products/*');
logger.info('   - /inventory/*');
logger.info('   - /categories/*');
logger.info('   - /suppliers/*');
logger.info('   - /purchase-orders/*');
logger.info('   - /orders/*');
logger.info('   - /sales/*');
logger.info('   - /payments/*');
logger.info('   - /payment-providers/*');
logger.info('   - /customers/*');
logger.info('   - /cart/*');
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

app.use(errorHandler);

// ============================================
// SERVER SETUP
// ============================================

const server = createServer(app);

if (process.env.NODE_ENV === 'production') {
  reorderService.startInventoryMonitor().catch(error => {
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
  logger.info(`🔗 Categories API: http://localhost:${PORT}/categories`);
  logger.info(`🔗 Suppliers API: http://localhost:${PORT}/suppliers`);
  logger.info(`🔗 Orders API: http://localhost:${PORT}/orders`);
  logger.info(`🔗 Business Units API: http://localhost:${PORT}/business-units`);
  logger.info(`🔗 Users API: http://localhost:${PORT}/users`);
  logger.info(`🔗 User Groups API: http://localhost:${PORT}/user-groups`);
  logger.info(`🔗 Payments API: http://localhost:${PORT}/payments`);
  logger.info(`🔗 Payment Providers API: http://localhost:${PORT}/payment-providers`);
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
