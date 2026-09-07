// D:\Projects\Kalwanga\packages\backend\src\routes\payment.ts

import { Router } from 'express';
import { paymentController } from '../controllers/paymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// ============================================
// PUBLIC ROUTES (Webhooks - No Auth Required)
// ============================================

/**
 * Stripe webhook endpoint - public access
 * POST /payments/webhook
 */
router.post('/webhook', paymentController.handleWebhook);

/**
 * M-Pesa callback endpoint - public access
 * POST /payments/mpesa-callback
 */
router.post('/mpesa-callback', paymentController.handleMpesaCallback);

/**
 * PayPal webhook endpoint - public access
 * POST /payments/webhook/paypal
 */
router.post('/webhook/paypal', paymentController.handlePayPalWebhook);

/**
 * Flutterwave webhook endpoint - public access
 * POST /payments/webhook/flutterwave
 */
router.post('/webhook/flutterwave', paymentController.handleFlutterwaveWebhook);

/**
 * Paystack webhook endpoint - public access
 * POST /payments/webhook/paystack
 */
router.post('/webhook/paystack', paymentController.handlePaystackWebhook);

/**
 * Square webhook endpoint - public access
 * POST /payments/webhook/square
 */
router.post('/webhook/square', paymentController.handleSquareWebhook);

// ============================================
// PROTECTED ROUTES - Payments
// ============================================

/**
 * Get payment status
 * GET /payments/:id
 */
router.get('/:id', requireAuth, paymentController.getPaymentStatus);

/**
 * Get payment summary
 * GET /payments/summary
 */
router.get('/summary', requireAuth, paymentController.getPaymentSummary);

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

/**
 * Initiate M-Pesa STK Push payment
 * POST /payments/mpesa-stk-push
 */
router.post(
  '/mpesa-stk-push',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  paymentController.initiateMpesaSTKPush
);

/**
 * Query M-Pesa transaction status
 * GET /payments/mpesa-status/:transactionId
 */
router.get(
  '/mpesa-status/:transactionId',
  requireAuth,
  paymentController.queryMpesaStatus
);

/**
 * Process M-Pesa B2C payment (Business to Customer)
 * POST /payments/mpesa-b2c
 */
router.post(
  '/mpesa-b2c',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.processMpesaB2C
);

// ============================================
// PROTECTED ROUTES - PayPal
// ============================================

/**
 * Create Stripe payment intent
 * POST /payments/create-payment-intent
 */
router.post(
  '/create-payment-intent',
  requireAuth,
  paymentController.createPaymentIntent
);

/**
 * Capture PayPal order (after user approval)
 * POST /payments/paypal/capture
 */
router.post(
  '/paypal/capture',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  paymentController.capturePayPalOrder
);

// ============================================
// PROTECTED ROUTES - Flutterwave
// ============================================

/**
 * Create Flutterwave virtual account (for bank transfer payments)
 * POST /payments/flutterwave/virtual-account
 */
router.post(
  '/flutterwave/virtual-account',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  paymentController.createFlutterwaveVirtualAccount
);

// ============================================
// PROTECTED ROUTES - Paystack
// ============================================

/**
 * Verify Paystack payment
 * POST /payments/paystack/verify
 */
router.post(
  '/paystack/verify',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  paymentController.verifyPaystackPayment
);

/**
 * Alternative: Verify Paystack payment with reference in params
 * GET /payments/paystack/verify/:reference
 */
router.get(
  '/paystack/verify/:reference',
  requireAuth,
  paymentController.verifyPaystackPayment
);

// ============================================
// PROTECTED ROUTES - Square
// ============================================

/**
 * Process Square payment using card nonce
 * POST /payments/square/payment
 */
router.post(
  '/square/payment',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  paymentController.processSquarePayment
);

/**
 * Create Square customer
 * POST /payments/square/customer
 */
router.post(
  '/square/customer',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.createSquareCustomer
);

export default router;
