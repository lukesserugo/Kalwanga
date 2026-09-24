// D:\Projects\Kalwanga\packages\backend\src\routes\payment.ts

import { Router } from 'express';
import express from 'express';
import { paymentController } from '../controllers/paymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// ============================================
// WEBHOOK ROUTES — NO AUTH, RAW BODY
// ============================================
//
// Stripe, PayPal, Paystack, and Square sign the RAW request body.
// `express.json()` consumes the stream and replaces `req.body`
// with a parsed object, which makes signature verification
// impossible. Each signed webhook route below applies
// `express.raw({ type: 'application/json' })` on itself so the
// raw bytes are preserved no matter what the caller does with
// `express.json()` elsewhere.
//
// ⚠ Mount-order requirement: in `index.ts`, this router MUST be
//   registered BEFORE `app.use(express.json())`. Route-level
//   middleware cannot override a body parser that has already run
//   on the request stream. See the note at the bottom of this file.
//
// M-Pesa and Flutterwave do NOT need the raw body:
//   • M-Pesa posts JSON and validates via a shared callback URL,
//     not a body HMAC.
//   • Flutterwave uses the `verif-hash` header, not a body HMAC.
//
// Every route in this block returns 200 to the caller regardless of
// internal outcome, because payment gateways retry aggressively on
// non-2xx and a retry storm is worse than a dropped event. Failures
// are logged and, where applicable, reconciled by out-of-band jobs.

/**
 * POST /payments/webhook
 * Canonical Stripe webhook endpoint.
 *
 * ⚠ Raw body — signature verification requires the raw bytes.
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook,
);

/**
 * POST /payments/webhook/stripe
 * Explicit alias for the Stripe webhook.
 *
 * ⚠ Raw body — signature verification requires the raw bytes.
 */
router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook,
);

/**
 * POST /payments/webhook/mpesa
 * Canonical M-Pesa STK push callback.
 *
 * M-Pesa sends JSON; no raw body required.
 */
router.post('/webhook/mpesa', paymentController.handleMpesaCallback);

/**
 * POST /payments/mpesa-callback
 * Legacy M-Pesa STK push callback URL.
 *
 * Routes to the same handler as `/webhook/mpesa` so the two paths
 * can never drift.
 */
router.post('/mpesa-callback', paymentController.handleMpesaCallback);

/**
 * POST /payments/webhook/paypal
 *
 * PayPal signs the raw request body and sends the signature in
 * the `paypal-transmission-*` headers. Verification calls back to
 * PayPal from inside `PayPalService.handleWebhook`.
 *
 * ⚠ Raw body — signature verification requires the raw bytes.
 */
router.post(
  '/webhook/paypal',
  express.raw({ type: 'application/json' }),
  paymentController.handlePayPalWebhook,
);

/**
 * POST /payments/webhook/flutterwave
 *
 * Flutterwave's signature is the `verif-hash` header (a plain
 * string equality check against `FLUTTERWAVE_SECRET_HASH`), not a
 * body HMAC. The body may be parsed normally.
 */
router.post(
  '/webhook/flutterwave',
  paymentController.handleFlutterwaveWebhook,
);


/**
 * POST /payments/webhook/square
 *
 * Square's signature is `x-square-hmacsha256-signature`, an
 * HMAC-SHA256 hash of `(notificationUrl + rawBody)`.
 *
 * ⚠ Raw body — signature verification requires the raw bytes.
 */
router.post(
  '/webhook/square',
  express.raw({ type: 'application/json' }),
  paymentController.handleSquareWebhook,
);

// ============================================
// PROTECTED ROUTES — LITERAL PREFIXES FIRST
// ============================================
//
// Everything below this line requires authentication. Within this
// block, every literal-prefix route MUST be registered before the
// generic `/:id` route at the bottom of the file.

// --------------------------------------------
// Reads — specific paths before `/:id`
// --------------------------------------------

/**
 * GET /payments/summary
 * Aggregated payment statistics for dashboards.
 *
 * MUST be registered before `GET /payments/:id`.
 * @auth Required — Manager+
 */
router.get(
  '/summary',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.getPaymentSummary,
);

/**
 * GET /payments
 * Paginated list of payments with filters.
 *
 * @auth Required — Manager+
 */
router.get(
  '/',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.getAllPayments,
);

// --------------------------------------------
// Stripe customer & payment-method management
// --------------------------------------------

/**
 * POST /payments/checkout-session
 * Create a Stripe Checkout Session (hosted payment page).
 * @auth Required
 */
router.post(
  '/checkout-session',
  requireAuth,
  paymentController.createCheckoutSession,
);

/**
 * POST /payments/customer
 * Create (or fetch) the authenticated user's Stripe customer.
 * @auth Required
 */
router.post(
  '/customer',
  requireAuth,
  paymentController.createStripeCustomer,
);

/**
 * GET /payments/payment-methods
 * List saved cards for the authenticated user.
 * @auth Required
 */
router.get(
  '/payment-methods',
  requireAuth,
  paymentController.getPaymentMethods,
);

/**
 * POST /payments/payment-methods/attach
 * Attach a Stripe PaymentMethod (pm_xxx) to the user's customer.
 * @auth Required
 */
router.post(
  '/payment-methods/attach',
  requireAuth,
  paymentController.attachPaymentMethod,
);

/**
 * DELETE /payments/payment-methods/:id
 * Detach a saved card.
 * @auth Required
 */
router.delete(
  '/payment-methods/:id',
  requireAuth,
  paymentController.detachPaymentMethod,
);

// --------------------------------------------
// M-Pesa — specific paths
// --------------------------------------------

/**
 * POST /payments/mpesa-stk-push
 * Initiate an M-Pesa STK push against a POS sale or an online cart.
 *
 * @auth Required — Cashier+
 *
 * ⚠ Legacy alias. The canonical M-Pesa STK push endpoint lives at
 *   `POST /api/mpesa/stk-push` (see `routes/mpesa.ts`).
 */
router.post(
  '/mpesa-stk-push',
  requireAuth,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.CASHIER,
  ]),
  paymentController.initiateMpesaSTKPush,
);

/**
 * GET /payments/mpesa-status/:transactionId
 * Query the current status of an M-Pesa transaction.
 * @auth Required — Cashier+
 */
router.get(
  '/mpesa-status/:transactionId',
  requireAuth,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.CASHIER,
  ]),
  paymentController.queryMpesaStatus,
);

/**
 * POST /payments/mpesa-b2c
 * Initiate an M-Pesa B2C (business-to-customer) payout.
 * @auth Required — Manager+
 */
router.post(
  '/mpesa-b2c',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.processMpesaB2C,
);

// --------------------------------------------
// Stripe — PaymentIntent creation
// --------------------------------------------

/**
 * POST /payments/create-payment-intent
 * Create a Stripe PaymentIntent for the checkout page.
 * @auth Required
 */
router.post(
  '/create-payment-intent',
  requireAuth,
  paymentController.createPaymentIntent,
);

// --------------------------------------------
// PayPal
// --------------------------------------------

/**
 * POST /payments/paypal/capture
 * Capture a PayPal order after the user approves it.
 * @auth Required — Cashier+
 */
router.post(
  '/paypal/capture',
  requireAuth,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.CASHIER,
  ]),
  paymentController.capturePayPalOrder,
);

// --------------------------------------------
// Flutterwave
// --------------------------------------------

/**
 * POST /payments/flutterwave/virtual-account
 * Create a Flutterwave virtual account for a customer.
 * @auth Required — Cashier+
 */
router.post(
  '/flutterwave/virtual-account',
  requireAuth,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.CASHIER,
  ]),
  paymentController.createFlutterwaveVirtualAccount,
);

// --------------------------------------------
// Square
// --------------------------------------------

/**
 * POST /payments/square/payment
 * Process a Square card payment using a card nonce from the
 * Square Web SDK.
 * @auth Required — Cashier+
 */
router.post(
  '/square/payment',
  requireAuth,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.CASHIER,
  ]),
  paymentController.processSquarePayment,
);

/**
 * POST /payments/square/customer
 * Create a Square customer.
 * @auth Required — Manager+
 */
router.post(
  '/square/customer',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.createSquareCustomer,
);

// ============================================
// PAYMENT PROVIDER MANAGEMENT
// ============================================
//
// All literal-prefix routes (`/payment-providers/...`). They MUST
// be registered before `/:id` at the bottom.

/**
 * GET /payments/payment-providers
 * List all configured payment providers with stats.
 * @auth Required — Manager+
 */
router.get(
  '/payment-providers',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.getPaymentProviders,
);

/**
 * GET /payments/payment-providers/:provider/status
 * Health-check a single provider by its enum name.
 *
 * MUST be registered before `/payment-providers/:id`.
 * @auth Required — Manager+
 */
router.get(
  '/payment-providers/:provider/status',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.getProviderStatus,
);

/**
 * POST /payments/payment-providers
 * Create a new payment provider row.
 * @auth Required — Admin+
 */
router.post(
  '/payment-providers',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  paymentController.createProvider,
);

/**
 * PATCH /payments/payment-providers/:id
 * Update a provider's mutable fields.
 * @auth Required — Manager+
 */
router.patch(
  '/payment-providers/:id',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.updateProvider,
);

/**
 * DELETE /payments/payment-providers/:id
 * Soft-delete a provider.
 * @auth Required — Admin+
 */
router.delete(
  '/payment-providers/:id',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  paymentController.deleteProvider,
);

/**
 * PATCH /payments/payment-providers/:id/health
 * Manually flip a provider's health flag.
 * @auth Required — Admin+
 */
router.patch(
  '/payment-providers/:id/health',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  paymentController.updateProviderHealth,
);

/**
 * POST /payments/payment-providers/:id/configure
 * Persist credentials / settings for a provider.
 * @auth Required — Manager+
 */
router.post(
  '/payment-providers/:id/configure',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.configureProvider,
);

/**
 * POST /payments/payment-providers/:id/currencies
 * Add a currency to a provider.
 * @auth Required — Manager+
 */
router.post(
  '/payment-providers/:id/currencies',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.addProviderCurrency,
);

/**
 * DELETE /payments/payment-providers/:id/currencies/:currency
 * Remove a currency from a provider.
 * @auth Required — Manager+
 */
router.delete(
  '/payment-providers/:id/currencies/:currency',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.removeProviderCurrency,
);

// ============================================
// CHECKOUT ALIASES
// ============================================
//
// The canonical gateway-backed checkout endpoint lives at
// `POST /checkout/online` (see `routes/checkout.ts`). The alias
// below lets tooling that only knows the payments surface create
// the same flow without a second router mount.
//
// ⚠ The canonical route is still `POST /checkout/online`. Do not
//   remove it. This is an additive alias.
//
// ⚠ Role check: this alias currently permits any authenticated
//   caller. If `routes/checkout.ts` restricts `POST /checkout/online`
//   to a narrower set of roles, replicate that set here — otherwise
//   this alias is a privilege-escalation bypass. I did NOT change
//   the role check in this rewrite because I don't know what the
//   canonical route uses. Change it yourself once you've checked
//   `routes/checkout.ts`.

/**
 * POST /payments/checkout/online
 * Alias for `POST /checkout/online`.
 * @auth Required
 */
router.post(
  '/checkout/online',
  requireAuth,
  async (req, res, next) => {
    try {
      const { checkoutController } = await import(
        '../controllers/checkoutController.js'
      );
      return checkoutController.createOnlineCheckout(req, res, next);
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// GENERIC WILDCARD ROUTES — MUST COME LAST
// ============================================
//
// ⚠ `/:id` is a catch-all. Any route registered after this one
//   that starts with a literal segment will never be matched.
//   Do not add new routes below this line.

/**
 * POST /payments
 * Process a payment directly (POS / admin split tender).
 * @auth Required — Cashier+
 */
router.post(
  '/',
  requireAuth,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.CASHIER,
  ]),
  paymentController.processPayment,
);

/**
 * POST /payments/:id/refund
 * Refund a payment (full or partial).
 * @auth Required — Manager+
 */
router.post(
  '/:id/refund',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.refundPayment,
);

/**
 * GET /payments/:id
 * Get a single payment's full detail.
 *
 * @auth Required — Cashier+
 */
router.get(
  '/:id',
  requireAuth,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.CASHIER,
  ]),
  paymentController.getPaymentStatus,
);

export default router;
