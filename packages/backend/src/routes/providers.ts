// D:\Projects\Kalwanga\packages\backend\src\routes\providers.ts

import { Router } from 'express';
import { paymentController } from '../controllers/paymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// ============================================
// PAYMENT PROVIDER ROUTES
// ============================================

/**
 * GET / - Get all payment providers
 */
router.get('/', requireAuth, paymentController.getPaymentProviders);

/**
 * GET /:provider/status - Get provider health status
 */
router.get('/:provider/status', requireAuth, paymentController.getProviderStatus);

/**
 * POST / - Create new provider
 */
router.post(
  '/',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  paymentController.createProvider
);

/**
 * PATCH /:id - Update provider
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.updateProvider
);

/**
 * DELETE /:id - Delete provider
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  paymentController.deleteProvider
);

/**
 * PATCH /:id/health - Update provider health
 */
router.patch(
  '/:id/health',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  paymentController.updateProviderHealth
);

/**
 * POST /:id/configure - Configure provider
 */
router.post(
  '/:id/configure',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  paymentController.configureProvider
);

/**
 * POST /:id/currencies - Add currency to provider
 */
router.post(
  '/:id/currencies',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  paymentController.addProviderCurrency
);

/**
 * DELETE /:id/currencies/:currency - Remove currency from provider
 */
router.delete(
  '/:id/currencies/:currency',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  paymentController.removeProviderCurrency
);

export default router;
