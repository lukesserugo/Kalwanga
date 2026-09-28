// packages/backend/src/routes/payment.ts

import { Router } from 'express';
import express from 'express';
import { paymentController } from '../controllers/paymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ============================================
// MEMOIZED DYNAMIC IMPORT — CHECKOUT CONTROLLER
// ============================================
//
// The `/checkout/online` alias forwards to `checkoutController`.
// A top-level static import would create a circular dependency:
//
//   paymentRoutes → checkoutController → checkoutService
//     → paymentService → provider services → other controllers
//
// To break the cycle cleanly we load `checkoutController`
// dynamically on first use and memoize the promise. Node caches
// the resolved module, so every request after the first gets the
// already-loaded controller with no per-request loader overhead.
//
// Do NOT replace this with `await import(...)` inside the handler
// — that re-enters the ESM loader on every request even though the
// module is cached, and produces a fresh promise allocation per
// call.

let checkoutControllerPromise:
  | Promise<typeof import('../controllers/checkoutController.js')>
  | null = null;

function loadCheckoutController() {
  if (!checkoutControllerPromise) {
    checkoutControllerPromise = import(
      '../controllers/checkoutController.js'
    );
  }
  return checkoutControllerPromise;
}

// ============================================
// WEBHOOK SAFETY WRAPPER
// ============================================
//
// Payment gateways retry aggressively on non-2xx responses.
// Stripe retries for up to 72 hours, PayPal for 3 days, Square for
// 24 hours. A transient bug in our handler must not produce a
// retry storm.
//
// The wrapper guarantees a 200 response even if the underlying
// handler throws. Errors are logged. Reconciliation for any
// dropped event is out-of-band.
//
// ⚠ Applied ONLY to the routes whose contracts promise a 200 ACK
//   on failure (PayPal, Flutterwave, Square). The Stripe route
//   deliberately propagates 4xx (missing signature) so the caller
//   gets a real error — wrapping it here would hide the
//   misconfiguration.
//
// M-Pesa's callback manages its own response shape (Safaricom's
// `{ ResultCode, ResultDesc }`) and is not wrapped here.

function ackAlways(
  provider: string,
  handler: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => any,
) {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<void> => {
    try {
      await handler(req, res, next);
    } catch (err) {
      logger.error(`[webhook:${provider}] swallowed error:`, err);
      if (!res.headersSent) {
        res.status(200).json({ success: true, received: true });
      }
    }
  };
}

// ============================================
// WEBHOOK ROUTES — NO AUTH, RAW BODY
// ============================================
//
// Stripe, PayPal, and Square sign the RAW request body.
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
//   on the request stream.
//
// M-Pesa and Flutterwave do NOT need the raw body:
//   • M-Pesa posts JSON and validates via a shared callback URL,
//     not a body HMAC.
//   • Flutterwave uses the `verif-hash` header, not a body HMAC.
//
// PayPal, Flutterwave, and Square routes are wrapped with
// `ackAlways` so an internal throw still returns 200. The Stripe
// route is NOT wrapped — its controller deliberately propagates
// 4xx (missing signature) so the caller sees a real error.

/**
 * POST /payments/webhook
 * Canonical Stripe webhook endpoint.
 *
 * ⚠ Raw body — signature verification requires the raw bytes.
 * ⚠ NOT wrapped by `ackAlways` — the controller propagates 4xx.
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
 * ⚠ NOT wrapped by `ackAlways` — the controller propagates 4xx.
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
 * M-Pesa sends JSON; no raw body required. The controller always
 * returns a Safaricom-shaped 200 with a `ResultCode`, so no
 * `ackAlways` wrapper is needed.
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
 * ⚠ Wrapped by `ackAlways` — a throw returns 200 so PayPal does
 *   not retry indefinitely.
 */
router.post(
  '/webhook/paypal',
  express.raw({ type: 'application/json' }),
  ackAlways('PAYPAL', paymentController.handlePayPalWebhook),
);

/**
 * POST /payments/webhook/flutterwave
 *
 * Flutterwave's signature is the `verif-hash` header (a plain
 * string equality check against `FLUTTERWAVE_SECRET_HASH`), not a
 * body HMAC. The body may be parsed normally.
 *
 * ⚠ Wrapped by `ackAlways` — a throw returns 200.
 */
router.post(
  '/webhook/flutterwave',
  ackAlways('FLUTTERWAVE', paymentController.handleFlutterwaveWebhook),
);

/**
 * POST /payments/webhook/square
 *
 * Square's signature is `x-square-hmacsha256-signature`, an
 * HMAC-SHA256 hash of `(notificationUrl + rawBody)`.
 *
 * ⚠ Raw body — signature verification requires the raw bytes.
 * ⚠ Wrapped by `ackAlways` — a throw returns 200.
 */
router.post(
  '/webhook/square',
  express.raw({ type: 'application/json' }),
  ackAlways('SQUARE', paymentController.handleSquareWebhook),
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
// All routes live under `/payment-providers`. The block is ordered
// specific-to-general so a future `/:id/subpath` addition can't be
// shadowed by the bare `/:id` route below.

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
 * PATCH /payments/payment-providers/:id/health
 * Manually flip a provider's health flag.
 *
 * MUST be registered before `PATCH /payment-providers/:id` so a
 * future shadowing regression is impossible.
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

// --------------------------------------------
// Provider payment-method sub-resource
// --------------------------------------------
//
// ⚠ BLOCKED — the four routes below reference controller methods
//   that do NOT exist on `paymentController` yet:
//
//     getProviderPaymentMethods
//     createProviderPaymentMethod
//     updateProviderPaymentMethod
//     deleteProviderPaymentMethod
//
//   Registering them produces TypeScript 2551 / 2339 errors and
//   blocks the whole file from compiling.
//
//   The web `paymentService` calls all four — the provider-config
//   UI's "add / edit / delete payment method" flows will 404 until
//   the controller methods are added.
//
//   ── To unblock ──
//   1. Add the four methods to
//      `packages/backend/src/controllers/paymentController.ts`.
//      Each should follow the pattern of `addProviderCurrency` /
//      `removeProviderCurrency` (parse the body, call into
//      `paymentService`, send the response).
//   2. Delete the `/*` line below and the `*/` line at the end of
//      this block.
//   3. Uncomment the four `router.*` registrations.
//
//   The routes are kept commented rather than deleted so the
//   intent is recorded next to the surrounding code. Do not
//   delete this block — if the four controller methods are
//   intentionally not wanted, remove the corresponding methods
//   from `packages/web/services/paymentService.ts` first.

/*
router.get(
  '/payment-providers/:providerId/methods',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.getProviderPaymentMethods,
);

router.post(
  '/payment-providers/:providerId/methods',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.createProviderPaymentMethod,
);

router.patch(
  '/payment-providers/:providerId/methods/:methodId',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.updateProviderPaymentMethod,
);

router.delete(
  '/payment-providers/:providerId/methods/:methodId',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  paymentController.deleteProviderPaymentMethod,
);
*/

/**
 * PATCH /payments/payment-providers/:id
 * Update a provider's mutable fields.
 *
 * MUST be registered AFTER every `/payment-providers/:id/<subpath>`
 * route above, so the more specific paths match first.
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

// ============================================
// CHECKOUT ALIASES
// ============================================
//
// The canonical gateway-backed checkout endpoint lives at
// `POST /checkout/online` (see `routes/checkout.ts`). That route is
// gated with `requireAuth` only — any authenticated user can create
// an online checkout. The alias below replicates that role set
// exactly.
//
// ⚠ Confirmed by inspection of `routes/checkout.ts`: the canonical
//   route uses `requireAuth` with no `requireRole`. If that changes,
//   update the alias to match — otherwise this alias becomes a
//   privilege-escalation path (or, in the other direction, a lockout
//   for legitimate callers).
//
// ⚠ The canonical route is still `POST /checkout/online`. Do not
//   remove it. This is an additive alias.

/**
 * POST /payments/checkout/online
 * Alias for `POST /checkout/online`.
 * @auth Required
 */
router.post('/checkout/online', requireAuth, async (req, res, next) => {
  try {
    const { checkoutController } = await loadCheckoutController();
    return checkoutController.createOnlineCheckout(req, res, next);
  } catch (error) {
    next(error);
  }
});

// ============================================
// GENERIC WILDCARD ROUTES — MUST COME LAST
// ============================================
//
// ⚠ `/:id` is a catch-all. Any route registered after these that
//   starts with a literal segment will never be matched. Do not add
//   new routes below this line.

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
