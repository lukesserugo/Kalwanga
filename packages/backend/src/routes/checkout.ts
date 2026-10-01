// packages/backend/src/routes/checkout.ts

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  UserRole,
  SaleStatus,
  PaymentStatus,
} from '../generated/prisma/index.js';
import checkoutController from '../controllers/checkoutController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';

// ============================================
// SHARED SCHEMAS
// ============================================
//
// Every request schema lives in the shared package so the web app,
// the mobile app, and this router validate against the exact same
// shape. The route file no longer re-declares any of them — the
// previous local copies drifted (e.g. a `z.string().uuid()` on
// `idempotencyKey` that would have rejected the web service's
// `pos_<cuid>` keys, and a `'VOIDED'` enum value that doesn't
// exist in Prisma).
//
// Imported here:
//   createCheckoutSchema       offline create body
//   onlineCheckoutSchema       online create body
//   getCheckoutsSchema         list query params
//   addCheckoutItemSchema      add-item body
//   updateCheckoutItemSchema   update-quantity body
//   applyDiscountSchema        discount-code body
//   mobileMoneyProviderSchema  MPESA | MTN | AIRTEL | undefined
//   DISCOUNT_TYPE_VALUES       9-value discount enum
//   paymentMethodSchema        canonical method string

import {
  createCheckoutSchema,
  onlineCheckoutSchema,
  getCheckoutsSchema,
  addCheckoutItemSchema,
  updateCheckoutItemSchema,
  applyDiscountSchema,
  mobileMoneyProviderSchema,
  DISCOUNT_TYPE_VALUES,
  paymentMethodSchema,
} from '../../../shared/src/schemas/checkout.js';

const router = Router();

// ============================================
// LOCAL SCHEMAS
// ============================================
//
// Only schemas that are genuinely route-local (i.e. not shared with
// another consumer) live here. They build on the shared
// `paymentMethodSchema` and `DISCOUNT_TYPE_VALUES` so the canonical
// value lists stay in one place.

/**
 * Body for `PUT /checkout/:id`.
 *
 * ⚠ The status enums use `z.nativeEnum` against the Prisma
 *   `SaleStatus` / `PaymentStatus` enums. Hand-written string
 *   unions drift — the previous version allowed `'VOIDED'`, which
 *   does not exist in `SaleStatus`, and rejected legitimate values
 *   like `'VOID'` and `'REFUNDED'`, so an admin couldn't reach
 *   those statuses via this endpoint at all.
 */
const updateCheckoutSchema = z
  .object({
    status: z.nativeEnum(SaleStatus).optional(),
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

/**
 * Body for `POST /checkout/:id/pay`.
 *
 * `paymentMethod` uses the same canonical list as every other
 * create-payment path. `amount` must be strictly positive (a 0-amount
 * split payment makes no sense and would flip the Sale's status
 * without moving money). `paymentDetails` is intentionally opaque.
 */
const processPaymentSchema = z
  .object({
    paymentMethod: paymentMethodSchema,
    amount: z.number().finite().positive(),
    paymentDetails: z.record(z.string(), z.any()).optional(),
  })
  .strict();

const cancelCheckoutSchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();

const voidCheckoutSchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();

const emailReceiptSchema = z
  .object({
    email: z.string().email('Invalid email address').max(320).optional(),
  })
  .strict();

const exportCheckoutsSchema = z
  .object({
    format: z.enum(['csv', 'json', 'excel']).optional().default('csv'),
    // Accept both date-param naming conventions; the controller
    // reads either from the query string, so the schema is a
    // passthrough for either shape.
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    businessUnitId: z.string().optional(),
  })
  .strict();

/**
 * Body for `POST /checkout/charge-preview`.
 *
 * ⚠ Phase D1 — the pre-payment charge preview. Called by the
 *   frontend when the payer picks a payment method, to resolve
 *   the exact amount the gateway will bill in the gateway's own
 *   currency before the payer confirms.
 *
 * Mirrors `chargePreviewSchema` in `checkoutController.ts`. Kept
 * as a route-local schema because it's only used by this single
 * route and the controller re-parses the body anyway — running
 * `validateRequest` first would produce a transformed object the
 * controller then re-parses, which has historically produced
 * "Required (undefined)" 400s on the sibling checkout routes.
 *
 * `mobileMoneyProvider` is required when `paymentMethod` is
 * `MOBILE_MONEY` — the resolver routes to MTN or Airtel based on
 * the provider's country config, and needs to know which one the
 * payer picked. The controller's `superRefine` doesn't currently
 * enforce this at the controller boundary (it validates provider
 * names elsewhere), so the route does not either — the resolver
 * falls back to MTN when the field is absent, matching the
 * service's default.
 */
const chargePreviewSchema = z
  .object({
    cartId: z.string().min(1, 'Cart ID is required'),
    paymentMethod: paymentMethodSchema,
    mobileMoneyProvider: mobileMoneyProviderSchema.optional(),
  })
  .strict();

// ============================================
// CHECKOUT ROUTES
// ============================================
//
// ⚠ ROUTE ORDER MATTERS.
//
// Express matches routes in the order they are registered. Any
// literal-prefix route (`/online`, `/charge-preview`,
// `/summary/...`, `/stats/...`, `/history`, `/payment-methods`,
// `/settings`, `/export`, `/customer/...`, `/receipt/...`) MUST be
// registered BEFORE the `/:id` wildcard, otherwise `/:id` will
// swallow the literal segment as if it were an ID and the more
// specific handler will never run.
//
// This file follows a stricter convention than Express requires:
//   • All literal-prefix routes first.
//   • Then all `/:id/<subpath>` routes (more specific).
//   • Then the bare `/:id` routes (least specific).
//
// The `/:id/<subpath>` group is registered before `/:id` even though
// Express would match them correctly in either order, because any
// future `/:id/<newsubpath>` addition must not be shadowed by `/:id`.

// ============================================
// CREATE
// ============================================

/**
 * POST /checkout/charge-preview
 * Resolve the charge-currency preview for a cart + payment method.
 *
 * Phase D1 — the pre-payment charge preview. Called by the frontend
 * when the payer selects a payment method, to show them the exact
 * amount the gateway will bill, in the gateway's own currency,
 * before they confirm.
 *
 * Returns a `ChargePreviewResponse`:
 *
 *   { available: true,  ledger: {...}, charge: {...},
 *     rate: {...}, disclosure: "...",
 *     requiresPayerConfirmation: boolean }
 *
 * or, when no FX rate is resolvable for the pair:
 *
 *   { available: false, reason: "...", ledger: {...} }
 *
 * ⚠ `available: false` is NOT a 5xx. The controller returns it
 *   with a 200 so the frontend can render the reason and disable
 *   the payment method. A missing rate must not abort the payer's
 *   flow with a server error.
 *
 * ⚠ Read-only. Nothing is written server-side. Repeated calls are
 *   free and safe.
 *
 * ⚠ MUST be registered before `/:id` so Express doesn't match
 *   `charge-preview` as a sale ID.
 *
 * ⚠ Validation is performed by the controller's own
 *   `chargePreviewSchema` parse — same reasoning as `/online`
 *   above. Do NOT add `validateRequest(chargePreviewSchema)` here.
 *
 * @auth Required (any authenticated user — this is the payer's
 *       pre-payment screen)
 */
router.post(
  '/charge-preview',
  requireAuth,
  checkoutController.chargePreview,
);

/**
 * POST /checkout/online
 * Create a gateway-backed checkout.
 *
 * Creates a PENDING Sale + PENDING Payment, calls the payment
 * gateway, and returns a `nextAction` telling the frontend what to do
 * next:
 *
 *   CONFIRM_STRIPE   → confirm the PaymentIntent with Stripe.js
 *   REDIRECT         → window.location.href = url
 *   AWAIT_STK_PUSH   → poll GET /checkout/:saleId until COMPLETED
 *   OFFLINE          → show the "awaiting confirmation" screen
 *   NONE             → sale already completed (idempotent replay)
 *
 * ⚠ This route MUST be registered before `/:id` so Express doesn't
 *   match `online` as a sale ID.
 *
 * ⚠ Validation is performed by the controller's own
 *   `onlineCheckoutSchema` parse. We deliberately do NOT run
 *   `validateRequest` here because the middleware's Zod parse
 *   produces a transformed object (paymentMethod uppercased,
 *   applyLoyaltyPoints defaulted) and the controller then re-parses
 *   that transformed shape — a double-parse that has historically
 *   produced "Required (undefined)" 400s.
 *
 * ⚠ Phase D1: When the resolved charge currency differs from the
 *   ledger currency, the controller requires
 *   `chargeContextAcknowledged: true` on the body and rejects the
 *   checkout with a 409 `CHARGE_CONTEXT_REQUIRED` otherwise. The
 *   frontend gets the acknowledgement from the
 *   `POST /checkout/charge-preview` response.
 *
 * @auth Required (any authenticated user — this is the public web
 *       checkout)
 */
router.post(
  '/online',
  requireAuth,
  checkoutController.createOnlineCheckout,
);

/**
 * POST /checkout
 * Create a new checkout from cart (offline / POS / cash).
 *
 * ⚠ Validation is performed by the controller's own
 *   `createCheckoutSchema` parse. We deliberately do NOT run
 *   `validateRequest` here — see the note on `/online` above.
 *
 * @auth Required
 */
router.post('/', requireAuth, checkoutController.createCheckout);

// ============================================
// LIST / READ — LITERAL PREFIXES
// ============================================

/**
 * GET /checkout
 * Get all checkouts with pagination.
 * @auth Required (Admin/SuperAdmin only)
 */
router.get(
  '/',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  validateRequest(getCheckoutsSchema),
  checkoutController.getCheckouts,
);

/**
 * GET /checkout/stats/summary
 * Get checkout statistics.
 * @auth Required (Admin/SuperAdmin only)
 */
router.get(
  '/stats/summary',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  checkoutController.getCheckoutStats,
);

/**
 * GET /checkout/history
 * Get checkout history with filters.
 *
 * ⚠ Not role-gated at the router. The controller forwards the
 *   `businessUnitId` query param to the service (which scopes the
 *   where-clause) — callers that omit it get every BU they can see.
 *   If your `req.user` carries a `companyId`, the service-level
 *   scope is sufficient. If it doesn't, add `requireRole([...])`
 *   here to prevent cross-tenant reads.
 *
 * @auth Required
 */
router.get(
  '/history',
  requireAuth,
  checkoutController.getCheckoutHistory,
);

/**
 * GET /checkout/payment-methods
 * Get all payment methods.
 * @auth Required
 */
router.get(
  '/payment-methods',
  requireAuth,
  checkoutController.getPaymentMethods,
);

/**
 * GET /checkout/settings
 * Get checkout settings.
 * @auth Required
 */
router.get(
  '/settings',
  requireAuth,
  checkoutController.getCheckoutSettings,
);

/**
 * PUT /checkout/settings
 * Update checkout settings.
 * @auth Required
 */
router.put(
  '/settings',
  requireAuth,
  checkoutController.updateCheckoutSettings,
);

/**
 * GET /checkout/export
 * Export checkout data (self-scoped by the controller).
 *
 * ⚠ Validated against the same schema as `/export/all` so the two
 *   export endpoints don't drift. Previously this route had no
 *   validation at all while `/export/all` did, which meant
 *   `/export?format=excel` got through while `/export/all?format=excel`
 *   was a 400.
 *
 * @auth Required
 */
router.get(
  '/export',
  requireAuth,
  validateRequest(exportCheckoutsSchema),
  checkoutController.exportCheckoutData,
);

/**
 * GET /checkout/export/all
 * Export checkouts.
 *
 * ⚠ Registered AFTER `/export` so Express doesn't shadow `/export`
 *   with this more specific route. Express matches literal segments
 *   before wildcards, but the ordering also documents intent.
 *
 * @auth Required (Admin/SuperAdmin only)
 */
router.get(
  '/export/all',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  validateRequest(exportCheckoutsSchema),
  checkoutController.exportCheckouts,
);

/**
 * GET /checkout/customer/:customerId/history
 * Get customer checkout history.
 *
 * ⚠ Role-gated at the router (Manager+) so a Viewer or Employee
 *   can't enumerate customerIds and read purchase history. The
 *   controller also performs a company-scope check when
 *   `req.user.companyId` is populated.
 *
 * @auth Required — Manager+
 */
router.get(
  '/customer/:customerId/history',
  requireAuth,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
  ]),
  checkoutController.getCustomerCheckoutHistory,
);

/**
 * GET /checkout/receipt/:receiptNumber
 * Get checkout by receipt number.
 * @auth Required
 */
router.get(
  '/receipt/:receiptNumber',
  requireAuth,
  checkoutController.getCheckoutByReceiptNumber,
);

/**
 * GET /checkout/summary/:cartId
 * Get a cart-scoped checkout summary (subtotal, tax, discount,
 * total, loyalty info) for the given cart.
 *
 * This route MUST appear before the `/:id` wildcard.
 *
 * @auth Required
 */
router.get(
  '/summary/:cartId',
  requireAuth,
  checkoutController.getCheckoutSummary,
);

// ============================================
// `/:id/<subpath>` ROUTES
// ============================================
//
// Every route in this block has at least one path segment after the
// `:id`. Registered before the bare `/:id` routes so a future
// subpath addition can't be shadowed.

/**
 * GET /checkout/:id/summary
 * Get checkout summary by sale ID.
 *
 * Kept for backward compatibility with callers that hold a sale ID
 * rather than a cart ID. The controller resolves either shape.
 *
 * @auth Required
 */
router.get(
  '/:id/summary',
  requireAuth,
  checkoutController.getCheckoutSummary,
);

/**
 * GET /checkout/:id/receipt
 * Get checkout receipt.
 * @auth Required
 */
router.get(
  '/:id/receipt',
  requireAuth,
  checkoutController.getCheckoutReceipt,
);

/**
 * GET /checkout/:id/items
 * Get checkout items.
 * @auth Required
 */
router.get(
  '/:id/items',
  requireAuth,
  checkoutController.getCheckoutItems,
);

/**
 * PUT /checkout/:id/items/:itemId
 * Update checkout item quantity.
 * @auth Required
 */
router.put(
  '/:id/items/:itemId',
  requireAuth,
  validateRequest(updateCheckoutItemSchema),
  checkoutController.updateCheckoutItem,
);

/**
 * POST /checkout/:id/pay
 * Process an ADDITIONAL payment for a checkout (split / partial).
 *
 * ⚠ This is NOT the gateway-call entry point. The initial card /
 *   PayPal / Flutterwave / Mobile Money charge happens on
 *   `POST /checkout/online`. Use this route only to record a second
 *   tender against the same sale.
 *
 * ⚠ Role-gated to Cashier+ — this writes a `Payment` row and can
 *   flip the Sale to `COMPLETED`, so it must not be reachable by
 *   any authenticated caller.
 *
 * @auth Required — Cashier+
 */
router.post(
  '/:id/pay',
  requireAuth,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.CASHIER,
  ]),
  validateRequest(processPaymentSchema),
  checkoutController.processPayment,
);

/**
 * POST /checkout/:id/complete
 * Complete checkout.
 *
 * ⚠ Role-gated to Manager+ — this force-completes a sale regardless
 *   of whether the payment is settled.
 *
 * @auth Required — Manager+
 */
router.post(
  '/:id/complete',
  requireAuth,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
  ]),
  checkoutController.completeCheckout,
);

/**
 * POST /checkout/:id/cancel
 * Cancel checkout.
 *
 * Unlike `POST /:id/void`, cancelling does NOT reverse inventory,
 * loyalty, or payments — it only marks the Sale `CANCELLED`. Use
 * `void` when the sale had already been fulfilled.
 *
 * @auth Required
 */
router.post(
  '/:id/cancel',
  requireAuth,
  validateRequest(cancelCheckoutSchema),
  checkoutController.cancelCheckout,
);

/**
 * POST /checkout/:id/items
 * Add item to checkout.
 *
 * ⚠ `unitPrice` is NOT accepted from the client. The service looks
 *   up the authoritative price from the database. Accepting it was
 *   a fraud vector.
 *
 * @auth Required
 */
router.post(
  '/:id/items',
  requireAuth,
  validateRequest(addCheckoutItemSchema),
  checkoutController.addCheckoutItem,
);

/**
 * POST /checkout/:id/discount
 * Apply discount to checkout.
 * @auth Required
 */
router.post(
  '/:id/discount',
  requireAuth,
  validateRequest(applyDiscountSchema),
  checkoutController.applyDiscount,
);

/**
 * POST /checkout/:id/email-receipt
 * Send checkout receipt via email.
 * @auth Required
 */
router.post(
  '/:id/email-receipt',
  requireAuth,
  validateRequest(emailReceiptSchema),
  checkoutController.sendReceiptEmail,
);

/**
 * POST /checkout/:id/void
 * Void checkout (reverse sale).
 *
 * Reverses inventory, loyalty, and payments. Distinct from
 * `POST /:id/cancel`, which only marks the Sale `CANCELLED`.
 *
 * ⚠ The controller reads `req.params.id`. If you must keep
 *   `:saleId` for backwards compatibility with an external caller,
 *   rename this segment and update `checkoutController.voidCheckout`
 *   to read `req.params.saleId` — do not change both partially.
 *
 * @auth Required (Admin/SuperAdmin only)
 */
router.post(
  '/:id/void',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  validateRequest(voidCheckoutSchema),
  checkoutController.voidCheckout,
);

/**
 * DELETE /checkout/:id/items/:itemId
 * Remove item from checkout.
 * @auth Required
 */
router.delete(
  '/:id/items/:itemId',
  requireAuth,
  checkoutController.removeCheckoutItem,
);

/**
 * DELETE /checkout/:id/discount
 * Remove discount from checkout.
 * @auth Required
 */
router.delete(
  '/:id/discount',
  requireAuth,
  checkoutController.removeDiscount,
);

// ============================================
// BARE `/:id` ROUTES
// ============================================
//
// ⚠ These are the least specific routes. Nothing below this line
//   may have a literal-prefix first segment (e.g. `/foo/:id`) or a
//   `/:id/<subpath>` shape — anything that does must be registered
//   above, or `/:id` will shadow it.

/**
 * GET /checkout/:id
 * Get checkout by ID.
 * @auth Required
 */
router.get(
  '/:id',
  requireAuth,
  checkoutController.getCheckoutById,
);

/**
 * PUT /checkout/:id
 * Update checkout.
 * @auth Required (Admin/SuperAdmin only)
 */
router.put(
  '/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  validateRequest(updateCheckoutSchema),
  checkoutController.updateCheckout,
);

/**
 * DELETE /checkout/:id
 * Delete checkout.
 * @auth Required (Admin/SuperAdmin only)
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  checkoutController.deleteCheckout,
);

export default router;
