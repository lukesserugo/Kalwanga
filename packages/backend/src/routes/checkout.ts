// D:\Projects\Kalwanga\packages\backend\src\routes\checkout.ts

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';
import checkoutController from '../controllers/checkoutController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';

const router = Router();

// ============================================
// CANONICAL PAYMENT METHODS
// ============================================
//
// Mirrors `CANONICAL_PAYMENT_METHODS` in
// `../controllers/checkoutController.ts` and
// `../services/checkoutService.ts`. The three must stay in sync.

const CANONICAL_PAYMENT_METHODS = [
  'CASH',
  'CARD',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'MOBILE_MONEY',
  'MOBILE',
  'MPESA',
  'BANK_TRANSFER',
  'BANK',
  'GIFT_CARD',
  'GIFT',
  'LOYALTY_POINTS',
  'LOYALTY',
  'WALLET',
  'SPLIT',
  'MIXED',
  'OTHER',
  'PAYPAL',
  'FLUTTERWAVE',
  'PAYSTACK',
  'SQUARE',
  'CHECK',
] as const;

const CANONICAL_PAYMENT_METHODS_SET = new Set<string>(
  CANONICAL_PAYMENT_METHODS,
);

const paymentMethodSchema = z
  .string()
  .min(1, 'Payment method is required')
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => CANONICAL_PAYMENT_METHODS_SET.has(v), {
    message: `Unsupported payment method. Accepted: ${CANONICAL_PAYMENT_METHODS.join(
      ', ',
    )}`,
  });

// ============================================
// DISCOUNT TYPE
// ============================================

const DISCOUNT_TYPE_VALUES = [
  'PERCENTAGE',
  'FIXED',
  'LOYALTY',
  'MANUAL',
  'BUY_X_GET_Y',
  'FREE_SHIPPING',
  'BOGO',
  'BUNDLE',
  'TIERED',
] as const;

// ============================================
// VALIDATION SCHEMAS
// ============================================
//
// ⚠ Each of these schemas MUST stay in lock-step with its counterpart
// in `../controllers/checkoutController.ts` and
// `../services/checkoutService.ts`.

/**
 * Create-checkout body schema (offline / POS).
 *
 * ⚠ The route-level schema is deliberately NOT applied by
 * `validateRequest` on the two create endpoints. The controller runs
 * its own `.parse()` and the two schemas must match exactly. Running
 * `validateRequest` here would double-parse and produce a transformed
 * body that the controller then fails to recognize.
 *
 * Kept here so the schema lives next to the route for reference and
 * so a future contributor can see the canonical shape.
 */
const createCheckoutSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  customerId: z.string().optional(),
  paymentMethod: paymentMethodSchema,
  paidAmount: z
    .number()
    .nonnegative('Paid amount must be zero or greater'),
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  notes: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  applyLoyaltyPoints: z.boolean().default(false),
  businessUnitId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),

  // Gateway-specific (used by the online path, harmless on the
  // offline path — the service ignores what it doesn't need).
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  cardNonce: z.string().optional(),
  paymentMethodId: z.string().optional(),

  // Gift-card specific. The frontend sends the code under both
  // `giftCardCode` (natural name) and `gatewayId` (backend-compatible
  // name); the service reads either.
  giftCardCode: z.string().optional(),
  gatewayId: z.string().optional(),

  // Promotion / loyalty passthrough
  discountType: z.enum(DISCOUNT_TYPE_VALUES).nullable().optional(),
  promotionCode: z.string().nullable().optional(),
  promotionDiscount: z.number().min(0).optional(),
});

/**
 * Online-checkout body schema (gateway-backed).
 *
 * Same canonical fields as `createCheckoutSchema` MINUS `paidAmount`
 * (the server computes it), PLUS the gateway-specific passthroughs:
 *   - returnUrl / cancelUrl   for redirect-based providers
 *   - cardNonce               for Square
 *   - paymentMethodId         for server-side Stripe confirmation
 *   - giftCardCode / gatewayId for Gift Card redemption
 *
 * The controller's `onlineCheckoutSchema` is the authoritative gate;
 * this copy exists to keep the two schemas side-by-side and to catch
 * drift in code review.
 */
const onlineCheckoutSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  customerId: z.string().optional(),
  paymentMethod: paymentMethodSchema,
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  notes: z.string().optional(),
  applyLoyaltyPoints: z.boolean().default(false),
  businessUnitId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),

  // Gateway-specific
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  cardNonce: z.string().optional(),
  paymentMethodId: z.string().optional(),

  // Gift-card specific. The frontend sends the code under both
  // `giftCardCode` (natural name) and `gatewayId` (backend-compatible
  // name); the service reads either.
  giftCardCode: z.string().optional(),
  gatewayId: z.string().optional(),

  // Promotion / loyalty passthrough
  discountType: z.enum(DISCOUNT_TYPE_VALUES).nullable().optional(),
  promotionCode: z.string().nullable().optional(),
  promotionDiscount: z.number().min(0).optional(),
});

const getCheckoutsSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('saleDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const updateCheckoutSchema = z.object({
  status: z
    .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'VOIDED'])
    .optional(),
  paymentStatus: z
    .enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL'])
    .optional(),
  notes: z.string().optional(),
});

const processPaymentSchema = z.object({
  paymentMethod: paymentMethodSchema,
  amount: z.number().nonnegative('Amount must be zero or greater'),
  paymentDetails: z.record(z.string(), z.any()).optional(),
});

const cancelCheckoutSchema = z.object({
  reason: z.string().optional(),
});

const voidCheckoutSchema = z.object({
  reason: z.string().optional(),
});

/**
 * Add-item body schema.
 *
 * ⚠ `unitPrice` is intentionally NOT accepted. The server looks up
 * the authoritative price from `Product.unitPrice` / `ProductVariant.price`.
 * Accepting it from the client was a fraud vector. Kept identical to
 * the controller's `addItemSchema`.
 */
const addItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
});

const updateItemSchema = z.object({
  quantity: z.number().int().positive(),
});

const discountSchema = z.object({
  code: z.string().min(1, 'Discount code is required'),
});

const emailReceiptSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
});

const exportCheckoutsSchema = z.object({
  format: z.enum(['csv', 'json']).optional().default('csv'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  businessUnitId: z.string().optional(),
});

// ============================================
// CHECKOUT ROUTES
// ============================================
//
// ⚠ ROUTE ORDER MATTERS.
//
// Express matches routes in the order they are registered. Any
// literal-prefix route (`/online`, `/summary/...`, `/stats/...`,
// `/history`, `/payment-methods`, `/settings`, `/export`,
// `/customer/...`, `/receipt/...`) MUST be registered BEFORE the
// `/:id` wildcard, otherwise `/:id` will swallow the literal segment
// as if it were an ID and the more specific handler will never run.

// ============================================
// CREATE
// ============================================

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
 *   that transformed shape with the raw schema — a double-parse that
 *   has been the source of the "Required (undefined)" 400s.
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
 * ⚠ Validation is performed by the controller's own `checkoutSchema`
 *   parse. We deliberately do NOT run `validateRequest` here — see
 *   the note on the `/online` route above.
 *
 * @auth Required
 */
router.post(
  '/',
  requireAuth,
  checkoutController.createCheckout,
);

// ============================================
// LIST / READ
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
 * Export checkout data.
 * @auth Required
 */
router.get(
  '/export',
  requireAuth,
  checkoutController.exportCheckoutData,
);

/**
 * GET /checkout/export/all
 * Export checkouts.
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
 * @auth Required
 */
router.get(
  '/customer/:customerId/history',
  requireAuth,
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
 * This route MUST appear before the `/:id` wildcard. Express matches
 * in registration order, and `/:id` would happily accept the literal
 * segment `summary` as an ID, breaking this endpoint.
 *
 * @auth Required
 */
router.get(
  '/summary/:cartId',
  requireAuth,
  checkoutController.getCheckoutSummary,
);

// ============================================
// PARAMETERIZED ROUTES
// ============================================
//
// ⚠ Everything below this line uses a `/:id` or `/:saleId` wildcard.
//   Never register a literal-prefix route after this point.

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
 * PUT /checkout/:id/items/:itemId
 * Update checkout item quantity.
 * @auth Required
 */
router.put(
  '/:id/items/:itemId',
  requireAuth,
  validateRequest(updateItemSchema),
  checkoutController.updateCheckoutItem,
);

/**
 * POST /checkout/:id/pay
 * Process an ADDITIONAL payment for a checkout (split / partial).
 *
 * ⚠ This is NOT the gateway-call entry point. The initial card /
 *   PayPal / Flutterwave / Paystack / Mobile Money charge happens on
 *   `POST /checkout/online`. Use this route only to record a second
 *   tender against the same sale.
 *
 * @auth Required
 */
router.post(
  '/:id/pay',
  requireAuth,
  validateRequest(processPaymentSchema),
  checkoutController.processPayment,
);

/**
 * POST /checkout/:id/complete
 * Complete checkout.
 * @auth Required
 */
router.post(
  '/:id/complete',
  requireAuth,
  checkoutController.completeCheckout,
);

/**
 * POST /checkout/:id/cancel
 * Cancel checkout.
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
 * ⚠ `unitPrice` is NOT accepted from the client. The service looks up
 * the authoritative price from the database.
 *
 * @auth Required
 */
router.post(
  '/:id/items',
  requireAuth,
  validateRequest(addItemSchema),
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
  validateRequest(discountSchema),
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
 * POST /checkout/:saleId/void
 * Void checkout (reverse sale).
 * @auth Required (Admin/SuperAdmin only)
 */
router.post(
  '/:saleId/void',
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
