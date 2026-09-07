// D:\Projects\Kalwanga\packages\backend\src\routes\checkout.ts

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';
import checkoutController from '../controllers/checkoutController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';

const router = Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createCheckoutSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  customerId: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD', 'LOYALTY_POINTS']),
  paidAmount: z.number().positive('Paid amount must be positive'),
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
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL']).optional(),
  notes: z.string().optional(),
});

const processPaymentSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD', 'LOYALTY_POINTS']),
  amount: z.number().positive('Amount must be positive'),
  paymentDetails: z.record(z.string(), z.any()).optional(),
});

const cancelCheckoutSchema = z.object({
  reason: z.string().optional(),
});

const addItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
});

const updateItemSchema = z.object({
  quantity: z.number().int().positive(),
});

const discountSchema = z.object({
  code: z.string(),
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

/**
 * POST /checkout
 * Create a new checkout from cart
 * @auth Required
 */
router.post(
  '/',
  requireAuth,
  validateRequest(createCheckoutSchema),
  checkoutController.createCheckout
);

/**
 * GET /checkout
 * Get all checkouts with pagination
 * @auth Required (Admin/SuperAdmin only)
 */
router.get(
  '/',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  validateRequest(getCheckoutsSchema),
  checkoutController.getCheckouts
);

/**
 * GET /checkout/stats/summary
 * Get checkout statistics
 * @auth Required (Admin/SuperAdmin only)
 */
router.get(
  '/stats/summary',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  checkoutController.getCheckoutStats
);

/**
 * GET /checkout/history
 * Get checkout history with filters
 * @auth Required
 */
router.get(
  '/history',
  requireAuth,
  checkoutController.getCheckoutHistory
);

/**
 * GET /checkout/payment-methods
 * Get all payment methods
 * @auth Required
 */
router.get(
  '/payment-methods',
  requireAuth,
  checkoutController.getPaymentMethods
);

/**
 * GET /checkout/settings
 * Get checkout settings
 * @auth Required
 */
router.get(
  '/settings',
  requireAuth,
  checkoutController.getCheckoutSettings
);

/**
 * PUT /checkout/settings
 * Update checkout settings
 * @auth Required
 */
router.put(
  '/settings',
  requireAuth,
  checkoutController.updateCheckoutSettings
);

/**
 * GET /checkout/export
 * Export checkout data
 * @auth Required
 */
router.get(
  '/export',
  requireAuth,
  checkoutController.exportCheckoutData
);

/**
 * GET /checkout/customer/:customerId/history
 * Get customer checkout history
 * @auth Required
 */
router.get(
  '/customer/:customerId/history',
  requireAuth,
  checkoutController.getCustomerCheckoutHistory
);

/**
 * GET /checkout/receipt/:receiptNumber
 * Get checkout by receipt number
 * @auth Required
 */
router.get(
  '/receipt/:receiptNumber',
  requireAuth,
  checkoutController.getCheckoutByReceiptNumber
);

/**
 * GET /checkout/export/all
 * Export checkouts
 * @auth Required (Admin/SuperAdmin only)
 */
router.get(
  '/export/all',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  validateRequest(exportCheckoutsSchema),
  checkoutController.exportCheckouts
);

/**
 * GET /checkout/:id
 * Get checkout by ID
 * @auth Required
 */
router.get(
  '/:id',
  requireAuth,
  checkoutController.getCheckoutById
);

/**
 * GET /checkout/:id/summary
 * Get checkout summary
 * @auth Required
 */
router.get(
  '/:id/summary',
  requireAuth,
  checkoutController.getCheckoutSummary
);

/**
 * GET /checkout/:id/receipt
 * Get checkout receipt
 * @auth Required
 */
router.get(
  '/:id/receipt',
  requireAuth,
  checkoutController.getCheckoutReceipt
);

/**
 * GET /checkout/:id/items
 * Get checkout items
 * @auth Required
 */
router.get(
  '/:id/items',
  requireAuth,
  checkoutController.getCheckoutItems
);

/**
 * PUT /checkout/:id
 * Update checkout
 * @auth Required (Admin/SuperAdmin only)
 */
router.put(
  '/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  validateRequest(updateCheckoutSchema),
  checkoutController.updateCheckout
);

/**
 * PUT /checkout/:id/items/:itemId
 * Update checkout item quantity
 * @auth Required
 */
router.put(
  '/:id/items/:itemId',
  requireAuth,
  validateRequest(updateItemSchema),
  checkoutController.updateCheckoutItem
);

/**
 * POST /checkout/:id/pay
 * Process payment for checkout
 * @auth Required
 */
router.post(
  '/:id/pay',
  requireAuth,
  validateRequest(processPaymentSchema),
  checkoutController.processPayment
);

/**
 * POST /checkout/:id/complete
 * Complete checkout
 * @auth Required
 */
router.post(
  '/:id/complete',
  requireAuth,
  checkoutController.completeCheckout
);

/**
 * POST /checkout/:id/cancel
 * Cancel checkout
 * @auth Required
 */
router.post(
  '/:id/cancel',
  requireAuth,
  validateRequest(cancelCheckoutSchema),
  checkoutController.cancelCheckout
);

/**
 * POST /checkout/:id/items
 * Add item to checkout
 * @auth Required
 */
router.post(
  '/:id/items',
  requireAuth,
  validateRequest(addItemSchema),
  checkoutController.addCheckoutItem
);

/**
 * POST /checkout/:id/discount
 * Apply discount to checkout
 * @auth Required
 */
router.post(
  '/:id/discount',
  requireAuth,
  validateRequest(discountSchema),
  checkoutController.applyDiscount
);

/**
 * POST /checkout/:id/email-receipt
 * Send checkout receipt via email
 * @auth Required
 */
router.post(
  '/:id/email-receipt',
  requireAuth,
  validateRequest(emailReceiptSchema),
  checkoutController.sendReceiptEmail
);

/**
 * POST /checkout/:saleId/void
 * Void checkout (reverse sale)
 * @auth Required (Admin/SuperAdmin only)
 */
router.post(
  '/:saleId/void',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  validateRequest(cancelCheckoutSchema),
  checkoutController.voidCheckout
);

/**
 * DELETE /checkout/:id/items/:itemId
 * Remove item from checkout
 * @auth Required
 */
router.delete(
  '/:id/items/:itemId',
  requireAuth,
  checkoutController.removeCheckoutItem
);

/**
 * DELETE /checkout/:id/discount
 * Remove discount from checkout
 * @auth Required
 */
router.delete(
  '/:id/discount',
  requireAuth,
  checkoutController.removeDiscount
);

/**
 * DELETE /checkout/:id
 * Delete checkout
 * @auth Required (Admin/SuperAdmin only)
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  checkoutController.deleteCheckout
);

export default router;
