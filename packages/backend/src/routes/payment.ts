// D:\Projects\Kalwanga\packages\backend\src\routes\payment.ts

import { Router } from 'express';
import { paymentController } from '../controllers/paymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// ============================================
// PUBLIC ROUTES (Webhooks - No Auth Required)
// ============================================

router.post('/webhook', paymentController.handleWebhook);
router.post('/mpesa-callback', paymentController.handleMpesaCallback);
router.post('/webhook/paypal', paymentController.handlePayPalWebhook);
router.post('/webhook/flutterwave', paymentController.handleFlutterwaveWebhook);
router.post('/webhook/paystack', paymentController.handlePaystackWebhook);
router.post('/webhook/square', paymentController.handleSquareWebhook);

// ============================================
// PROTECTED ROUTES - Payments
// ============================================

// ✅ FIXED: Order matters - more specific routes before generic ones

/**
 * Get payment summary - MUST BE BEFORE /:id
 * GET /payments/summary
 */
router.get('/summary', requireAuth, paymentController.getPaymentSummary);

/**
 * Get payment status
 * GET /payments/:id
 */
router.get('/:id', requireAuth, paymentController.getPaymentStatus);

/**
 * Get all payments with filters
 * GET /payments
 */
router.get('/', requireAuth, paymentController.getAllPayments);

/**
 * Process payment
 * POST /payments
 */
router.post(
  '/',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  paymentController.processPayment
);

/**
 * Refund payment
 * POST /payments/:id/refund
 */
router.post(
  '/:id/refund',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.refundPayment
);

/**
 * Create Stripe checkout session
 * POST /payments/checkout-session
 */
router.post(
  '/checkout-session',
  requireAuth,
  paymentController.createCheckoutSession
);

/**
 * Create Stripe customer
 * POST /payments/customer
 */
router.post(
  '/customer',
  requireAuth,
  paymentController.createStripeCustomer
);

/**
 * Get customer payment methods
 * GET /payments/payment-methods
 */
router.get(
  '/payment-methods',
  requireAuth,
  paymentController.getPaymentMethods
);

/**
 * Attach payment method
 * POST /payments/payment-methods/attach
 */
router.post(
  '/payment-methods/attach',
  requireAuth,
  paymentController.attachPaymentMethod
);

/**
 * Detach payment method
 * DELETE /payments/payment-methods/:id
 */
router.delete(
  '/payment-methods/:id',
  requireAuth,
  paymentController.detachPaymentMethod
);

// ============================================
// PROTECTED ROUTES - M-Pesa
// ============================================

router.post(
  '/mpesa-stk-push',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  paymentController.initiateMpesaSTKPush
);

router.get(
  '/mpesa-status/:transactionId',
  requireAuth,
  paymentController.queryMpesaStatus
);

router.post(
  '/mpesa-b2c',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.processMpesaB2C
);

// ============================================
// PROTECTED ROUTES - PayPal
// ============================================

router.post(
  '/create-payment-intent',
  requireAuth,
  paymentController.createPaymentIntent
);

router.post(
  '/paypal/capture',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  paymentController.capturePayPalOrder
);

// ============================================
// PROTECTED ROUTES - Flutterwave
// ============================================

router.post(
  '/flutterwave/virtual-account',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  paymentController.createFlutterwaveVirtualAccount
);

// ============================================
// PROTECTED ROUTES - Paystack
// ============================================

router.post(
  '/paystack/verify',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  paymentController.verifyPaystackPayment
);

router.get(
  '/paystack/verify/:reference',
  requireAuth,
  paymentController.verifyPaystackPayment
);

// ============================================
// PROTECTED ROUTES - Square
// ============================================

router.post(
  '/square/payment',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  paymentController.processSquarePayment
);

router.post(
  '/square/customer',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.createSquareCustomer
);

// ============================================
// PAYMENT PROVIDER MANAGEMENT ROUTES
// ============================================

/**
 * Get all payment providers
 * GET /payment-providers
 */
router.get(
  '/payment-providers',
  requireAuth,
  paymentController.getPaymentProviders
);

/**
 * Get provider health status
 * GET /payment-providers/:provider/status
 */
router.get(
  '/payment-providers/:provider/status',
  requireAuth,
  paymentController.getProviderStatus
);

/**
 * Create new provider
 * POST /payment-providers
 */
router.post(
  '/payment-providers',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  paymentController.createProvider
);

/**
 * Update provider
 * PATCH /payment-providers/:id
 */
router.patch(
  '/payment-providers/:id',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.updateProvider
);

/**
 * Delete provider
 * DELETE /payment-providers/:id
 */
router.delete(
  '/payment-providers/:id',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  paymentController.deleteProvider
);

/**
 * Update provider health
 * PATCH /payment-providers/:id/health
 */
router.patch(
  '/payment-providers/:id/health',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  paymentController.updateProviderHealth
);

/**
 * Configure provider
 * POST /payment-providers/:id/configure
 */
router.post(
  '/payment-providers/:id/configure',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.configureProvider
);

/**
 * Add currency to provider
 * POST /payment-providers/:id/currencies
 */
router.post(
  '/payment-providers/:id/currencies',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.addProviderCurrency
);

/**
 * Remove currency from provider
 * DELETE /payment-providers/:id/currencies/:currency
 */
router.delete(
  '/payment-providers/:id/currencies/:currency',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.removeProviderCurrency
);

export default router;
