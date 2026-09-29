import { z } from "zod";
import {
  cartIdSchema,
  customerIdSchema,
  paymentMethodSchema,
  userIdSchema,
} from "../helpers.js";

export const addCartItemSchema = z.object({
  productId: z
    .string()
    .min(1, 'Product ID is required')
    .max(255, 'Product ID is too long')
    .refine(
      (val) => {
        const trimmed = val.trim();
        return trimmed.length > 0 && !trimmed.includes(' ');
      },
      { message: 'Invalid product ID format' },
    ),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive').default(1),
  notes: z.string().optional(),
});

export const addMultipleCartItemsSchema = z.object({
  items: z.array(addCartItemSchema).min(1),
});

export const updateCartItemQuantitySchema = z.object({
  quantity: z.number().int().min(0),
});

/**
 * Settings patch accepted by `PUT /cart/settings`.
 *
 * ⚠ `currencySymbol` was removed. The symbol is derived from
 *   `currencyCode` via `lib/currencies.ts`; storing it alongside the
 *   code allowed the two to drift (a code change to UGX with a stale
 *   `$` symbol). Only `currencyCode` is settable.
 *
 * ⚠ The backend validates this against a strict allow-list in
 *   `cartController.ts` (`CART_SETTINGS_ALLOWED_KEYS`). Both files
 *   must be updated together when a field is added or removed. A
 *   field present in one but not the other either 400s at this
 *   schema layer or 400s at the controller whitelist — either way
 *   it's a bug.
 *
 * ⚠ `currencySymbol` intentionally absent — see Phase 1 (schema
 *   migration that removed the column) and Phase 2 (this change plus
 *   the matching whitelist removal in `cartController.ts`).
 */
export const updateCartSettingsSchema = z.object({
  allowGuestCheckout: z.boolean().optional(),
  requireCustomerForReturn: z.boolean().optional(),
  maxCartItems: z.number().int().min(1).max(1000).optional(),
  cartExpiryHours: z.number().int().min(1).max(720).optional(),
  discountEnabled: z.boolean().optional(),
  maxDiscountPercentage: z.number().min(0).max(100).optional(),
  maxDiscountAmount: z.number().min(0).optional(),
  autoApplyPromotions: z.boolean().optional(),
  loyaltyPointsEnabled: z.boolean().optional(),
  pointsPerDollar: z.number().int().min(0).max(1000).optional(),
  minPointsForRedeem: z.number().int().min(0).optional(),
  maxPointsPerOrder: z.number().int().min(0).optional(),
  reserveStockOnAdd: z.boolean().optional(),
  reserveStockMinutes: z.number().int().min(0).max(1440).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  defaultPaymentMethod: paymentMethodSchema.optional(),
  allowPartialPayment: z.boolean().optional(),
  requireSignature: z.boolean().optional(),
  taxInclusive: z.boolean().optional(),
  freeShippingThreshold: z.number().min(0).optional(),
  shippingCost: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notifyOnAbandonedCart: z.boolean().optional(),
  abandonedCartHours: z.number().int().min(1).max(720).optional(),
  notifyOnLowStock: z.boolean().optional(),
  currencyCode: z.string().optional(),
  // ⚠ `currencySymbol` intentionally absent — see JSDoc above.
  showStockBadge: z.boolean().optional(),
  showVariantImages: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const applyCartDiscountSchema = z.object({
  discount: z.number().min(0),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().default('FIXED'),
});

export const applyCartPromotionSchema = z.object({
  promotionCode: z.string().min(1),
});

export const applyLoyaltyPointsSchema = z.object({
  customerId: customerIdSchema,
  points: z.number().int().positive(),
});

export const associateCustomerSchema = z.object({
  customerId: customerIdSchema,
});

export const updateCartNotesSchema = z.object({
  notes: z.string().optional(),
});

/**
 * Body accepted by `POST /cart/checkout` (and its canonical alias
 * `POST /checkout`).
 *
 * ⚠ `tipAmount` and `cardNonce` are intentionally NOT declared here.
 *   The offline checkout path ignores both — `cardNonce` is only
 *   consumed by `POST /checkout/online`, and `tipAmount` isn't read
 *   by `CheckoutService.processCheckout` at all. Declaring them here
 *   would let a caller think they did something.
 *
 * `idempotencyKey` mirrors the controller's `checkoutSchema` and is
 * forwarded to `CheckoutService.processCheckout` for its
 * short-circuit. `Sale.idempotencyKey` is `@unique`; a retry with
 * the same key returns the original Sale instead of creating a
 * duplicate.
 */
export const cartCheckoutSchema = z.object({
  cartId: cartIdSchema,
  customerId: z.string().optional().nullable(),
  paymentMethod: paymentMethodSchema,
  paidAmount: z.number().nonnegative('Paid amount must be zero or greater'),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  notes: z.string().optional(),
  discount: z.number().nonnegative().optional(),
  applyLoyaltyPoints: z.boolean().optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
});

export const transferCartSchema = z.object({
  fromUserId: userIdSchema,
  toUserId: userIdSchema,
});

export const splitCartSchema = z.object({
  items: z
    .array(
      z.object({
        cartItemId: z.string().min(1),
        quantity: z.number().int().positive(),
        targetUserId: userIdSchema,
      }),
    )
    .min(1),
});

/**
 * Export format union is `csv` or `json`.
 *
 * ⚠ The backend has no Excel or PDF generator. The cart export
 *   endpoints in `cartController.ts` currently emit CSV only. A
 *   caller requesting `'excel'` would receive a CSV body with an
 *   `.xlsx` filename, which Excel refuses to open. A caller
 *   requesting `'pdf'` would receive the same CSV mislabelled.
 *   Both are worse than a schema rejection.
 *
 *   When a real Excel or PDF generator lands, re-add the value here
 *   and implement the corresponding branch in the controller.
 */
export const exportAnalyticsSchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  metrics: z.array(z.string()).default([]),
  dateRange: z
    .enum(['today', 'yesterday', 'week', 'month', 'quarter', 'year', 'custom'])
    .default('week'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeCharts: z.boolean().default(false),
  includeSummary: z.boolean().default(true),
  includeDetailedData: z.boolean().default(true),
});

export const exportHistorySchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  dateRange: z
    .enum([
      'today',
      'yesterday',
      'week',
      'month',
      'quarter',
      'year',
      'all',
    ])
    .default('week'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  includeItems: z.boolean().default(true),
});

export const exportAbandonedSchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  hours: z.number().int().min(1).max(720).default(24),
  minValue: z.number().min(0).optional(),
  status: z.string().optional(),
  includeCustomerDetails: z.boolean().default(true),
});

export const abandonedCartsQuerySchema = z.object({
  hours: z.string().transform(Number).optional().default('24'),
  minValue: z.string().transform(Number).optional(),
  status: z.string().optional(),
  page: z.string().transform(Number).optional().default('1'),
  limit: z.string().transform(Number).optional().default('20'),
  search: z.string().optional(),
  dateRange: z.string().optional(),
});

// NOTE: `recoverCartSchema` and `sendReminderSchema` were removed.
//
// The backend routes file (`packages/backend/src/routes/cart.ts`)
// does not register `/cart/recover` or `/cart/send-reminder`. Any
// request to those paths returned a 404, and the schemas here only
// encouraged callers to write to a nonexistent endpoint.
//
// When the backend adds the routes, re-add the schemas here and the
// matching validator methods in `validators/cartValidation.ts`.

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type AddMultipleCartItemsInput = z.infer<typeof addMultipleCartItemsSchema>;
export type UpdateCartItemQuantityInput = z.infer<typeof updateCartItemQuantitySchema>;
export type ApplyCartDiscountInput = z.infer<typeof applyCartDiscountSchema>;
export type ApplyCartPromotionInput = z.infer<typeof applyCartPromotionSchema>;
export type ApplyLoyaltyPointsInput = z.infer<typeof applyLoyaltyPointsSchema>;
export type AssociateCustomerInput = z.infer<typeof associateCustomerSchema>;
export type UpdateCartNotesInput = z.infer<typeof updateCartNotesSchema>;
export type CartCheckoutInput = z.infer<typeof cartCheckoutSchema>;
export type TransferCartInput = z.infer<typeof transferCartSchema>;
export type SplitCartInput = z.infer<typeof splitCartSchema>;
export type ExportAnalyticsInput = z.infer<typeof exportAnalyticsSchema>;
export type ExportHistoryInput = z.infer<typeof exportHistorySchema>;
export type ExportAbandonedInput = z.infer<typeof exportAbandonedSchema>;
export type AbandonedCartsQueryInput = z.infer<typeof abandonedCartsQuerySchema>;
