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
// `../controllers/checkoutController.ts` and `../utils/validators.ts`.
// Kept local to the route file to avoid a circular import; the three
// must stay in sync. Any change to the backend-wide set should be
// applied here too.
//
// The route-level schema accepts the full canonical set. The service
// normalizes aliases (CARD → CREDIT_CARD, MPESA → MOBILE_MONEY, …)
// before writing to the Prisma `PaymentMethod` enum.

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
// VALIDATION SCHEMAS
// ============================================

/**
 * Create-checkout body schema.
 *
 * ⚠ This schema MUST stay in lock-step with `checkoutSchema` in
 * `../controllers/checkoutController.ts`. The controller parses
 * `req.body` a second time with its own copy of this schema, and the
 * two previously drifted:
 *
 *   • the controller accepted `idempotencyKey`, this one did not
 *   • the controller accepted the full canonical payment-method set,
 *     this one only accepted a narrow enum
 *   • the controller accepted `paidAmount: 0` (loyalty-only and
 *     fully-discounted checkouts), this one required `.positive()`
 *
 * Because `validateRequest(...)` runs FIRST, the stricter route-level
 * schema was rejecting valid payloads before the controller ever saw
 * them. Keeping the two identical removes the drift and the source of
 * the "Required (undefined)" 400s.
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
  // Idempotency guard for double-submit. Same key = same sale returned.
  idempotencyKey: z.string().uuid().optional(),
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
 * the authoritative price from `Product.unitPrice` /
 * `ProductVariant.price`. Accepting it from the client was a fraud
 * vector. Kept identical to the controller's `addItemSchema`.
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
// literal-prefix route (`/summary/...`, `/stats/...`, `/history`,
// `/payment-methods`, `/settings`, `/export`, `/customer/...`,
// `/receipt/...`) MUST be registered BEFORE the `/:id` wildcard,
// otherwise `/:id` will swallow the literal segment as if it were
// an ID and the more specific handler will never run.
//
// The previous version of this file registered `/:id` before
// `/summary/:cartId`, so `GET /checkout/summary/<cartId>` was
// matched by the `/:id` handler with `id = 'summary'`, which then
// failed to find a sale and returned a 404. The summary route has
// now been moved above `/:id` and given its own handler shape.

/**
 * POST /checkout
 * Create a new checkout from cart.
 *
 * Body is validated here AND again in the controller. The two schemas
 * are identical, so a payload that passes this middleware is
 * guaranteed to pass the controller's re-parse. The controller's
 * parse remains the authoritative gate (it also runs when the route
 * is invoked from internal callers that bypass this router).
 *
 * @auth Required
 */
router.post(
  '/',
  requireAuth,
  validateRequest(createCheckoutSchema),
  checkoutController.createCheckout,
);

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
 * The controller's `getCheckoutSummary` handler reads `req.params.id`
 * OR `req.params.cartId` — the fallback lets the same handler serve
 * both `GET /checkout/:id/summary` (id-first) and
 * `GET /checkout/summary/:cartId` (cart-first) without duplication.
 *
 * @auth Required
 */
router.get(
  '/summary/:cartId',
  requireAuth,
  checkoutController.getCheckoutSummary,
);

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
 * Process payment for checkout.
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
