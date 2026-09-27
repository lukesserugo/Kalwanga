// packages/shared/src/schemas/checkout.ts

import { z } from "zod";
import { paymentMethodSchema } from "../helpers.js";

// ============================================
// MOBILE MONEY PROVIDERS
// ============================================
//
// `MOBILE_MONEY` is a *category* covering three distinct providers.
// The frontend sends one of these strings to tell the backend which
// one the user picked. Kept in lock-step with:
//
//   • `MobileMoneyProvider` in
//     packages/backend/src/services/checkoutService.ts
//   • `MOBILE_MONEY_PROVIDERS` in
//     packages/backend/src/controllers/checkoutController.ts
//
// When omitted, the backend defaults to `'MPESA'` (the historical
// behaviour before the selector existed).

export const MOBILE_MONEY_PROVIDERS = ['MPESA', 'MTN', 'AIRTEL'] as const;

export const mobileMoneyProviderSchema = z
  .enum(MOBILE_MONEY_PROVIDERS)
  .optional();

// ============================================
// DISCOUNT TYPES
// ============================================
//
// Must stay in lock-step with the `DiscountType` union in the
// backend service and `DISCOUNT_TYPE_VALUES` in the backend
// controller. Any drift produces TS2322 at every callsite that
// forwards a schema-validated `discountType` into the service.

export const DISCOUNT_TYPE_VALUES = [
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
// CREATE CHECKOUT (OFFLINE + ONLINE)
// ============================================
//
// One schema serves both `/checkout` (offline) and `/checkout/online`.
//
//   • `/checkout` (offline) uses this schema directly and requires
//     `paidAmount`.
//   • `/checkout/online` uses `onlineCheckoutSchema` below, which
//     is this schema minus `paidAmount` — the total is entirely
//     server-computed from the cart.
//
// The gateway fields (`returnUrl`, `cancelUrl`, `cardNonce`,
// `paymentMethodId`, `giftCardCode`, `gatewayId`) are declared on
// the base schema so both paths can carry them. On the offline
// path the service simply ignores what it doesn't need; on the
// online path they flow straight through to `invokeGateway`.

export const createCheckoutSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  customerId: z.string().optional(),
  paymentMethod: paymentMethodSchema,
  paidAmount: z.number().nonnegative('Paid amount must be zero or greater'),
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  notes: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  applyLoyaltyPoints: z.boolean().default(false),
  businessUnitId: z.string().optional(),
  customerEmail: z.string().email('Invalid email format').optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),

  // ── Gateway-specific ─────────────────────────────────────
  // Harmless on the offline path; forwarded to the gateway on
  // the online path. `returnUrl` / `cancelUrl` are used by the
  // redirect-based providers (PayPal, Flutterwave); `cardNonce`
  // by Square; `paymentMethodId` by server-side Stripe confirms.
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  cardNonce: z.string().optional(),
  paymentMethodId: z.string().optional(),

  // Gift-card specific. The frontend sends the code under both
  // `giftCardCode` (natural name) and `gatewayId` (backend-
  // compatible name); the service reads either.
  giftCardCode: z.string().optional(),
  gatewayId: z.string().optional(),

  // Mobile-money provider selector. Only meaningful when
  // `paymentMethod === 'MOBILE_MONEY'`. Routes to the matching
  // provider handler (MPESA / MTN / AIRTEL).
  mobileMoneyProvider: mobileMoneyProviderSchema,

  // Promotion / loyalty passthrough.
  discountType: z.enum(DISCOUNT_TYPE_VALUES).nullable().optional(),
  promotionCode: z.string().nullable().optional(),
  promotionDiscount: z.number().min(0).optional(),
});

// ============================================
// ONLINE CHECKOUT
// ============================================
//
// Identical to `createCheckoutSchema` minus `paidAmount`. The
// online route server-computes the total from the cart, product
// prices, and any loyalty redemption — a client-supplied
// `paidAmount` is meaningless and would only confuse the audit
// trail. Omitting it from the schema makes that contract explicit.
//
// The controller imports this as the canonical online body schema;
// the backend service still receives `paidAmount: 0` because its
// `OnlineCheckoutData` type extends `CheckoutData` which declares
// it. The controller supplies the `0` explicitly.

export const onlineCheckoutSchema = createCheckoutSchema.omit({
  paidAmount: true,
});

// ============================================
// LIST / READ
// ============================================

export const getCheckoutsSchema = z.object({
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

export const getCheckoutHistorySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

export const updateCheckoutSchema = z.object({
  status: z
    .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'VOIDED'])
    .optional(),
  paymentStatus: z
    .enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL'])
    .optional(),
  notes: z.string().optional(),
});

// ============================================
// PAYMENTS
// ============================================

export const processPaymentSchema = z.object({
  paymentMethod: paymentMethodSchema,
  amount: z.number().nonnegative('Amount must be zero or greater'),
  paymentDetails: z.record(z.string(), z.any()).optional(),
});

// ============================================
// CANCEL / VOID
// ============================================

export const cancelCheckoutSchema = z.object({
  reason: z.string().optional(),
});

export const voidCheckoutSchema = z.object({
  reason: z.string().optional(),
});

// ============================================
// ITEMS
// ============================================

export const addCheckoutItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
});

export const updateCheckoutItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be positive'),
});

// ============================================
// DISCOUNTS / EMAIL
// ============================================

export const applyDiscountSchema = z.object({
  code: z.string().min(1, 'Discount code is required'),
});

export const emailReceiptSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
});

// ============================================
// EXPORT / STATS / SETTINGS
// ============================================

export const exportCheckoutsSchema = z.object({
  format: z.enum(['csv', 'json', 'excel', 'pdf']).optional().default('csv'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  businessUnitId: z.string().optional(),
  status: z.string().optional(),
});

export const getCheckoutStatsSchema = z.object({
  range: z
    .enum(['today', 'week', 'month', 'quarter', 'year', 'custom'])
    .optional()
    .default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  businessUnitId: z.string().optional(),
});

export const updateCheckoutSettingsSchema = z.object({
  allowPartialPayment: z.boolean().optional(),
  requireCustomer: z.boolean().optional(),
  requireSignature: z.boolean().optional(),
  maxDiscount: z.number().min(0).optional(),
  taxInclusive: z.boolean().optional(),
  defaultPaymentMethod: paymentMethodSchema.optional(),
  receiptFooter: z.string().optional(),
  loyaltyPointsEnabled: z.boolean().optional(),
  pointsPerDollar: z.number().min(0).optional(),
  allowGuestCheckout: z.boolean().optional(),
  maxCartItems: z.number().int().min(1).optional(),
  cartExpiryHours: z.number().int().min(1).optional(),
  discountEnabled: z.boolean().optional(),
  maxDiscountPercentage: z.number().min(0).max(100).optional(),
  autoApplyPromotions: z.boolean().optional(),
  reserveStockOnAdd: z.boolean().optional(),
  reserveStockMinutes: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  freeShippingThreshold: z.number().min(0).optional(),
  shippingCost: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notifyOnAbandonedCart: z.boolean().optional(),
  abandonedCartHours: z.number().int().min(1).optional(),
  currencyCode: z.string().optional(),
  currencySymbol: z.string().optional(),
  showStockBadge: z.boolean().optional(),
  showVariantImages: z.boolean().optional(),
});

// ============================================
// TYPES
// ============================================

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type OnlineCheckoutInput = z.infer<typeof onlineCheckoutSchema>;

export type GetCheckoutsInput = z.infer<typeof getCheckoutsSchema>;
export type GetCheckoutHistoryInput = z.infer<typeof getCheckoutHistorySchema>;
export type UpdateCheckoutInput = z.infer<typeof updateCheckoutSchema>;
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
export type CancelCheckoutInput = z.infer<typeof cancelCheckoutSchema>;
export type VoidCheckoutInput = z.infer<typeof voidCheckoutSchema>;
export type AddCheckoutItemInput = z.infer<typeof addCheckoutItemSchema>;
export type UpdateCheckoutItemInput = z.infer<typeof updateCheckoutItemSchema>;
export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>;
export type EmailReceiptInput = z.infer<typeof emailReceiptSchema>;
export type ExportCheckoutsInput = z.infer<typeof exportCheckoutsSchema>;
export type GetCheckoutStatsInput = z.infer<typeof getCheckoutStatsSchema>;
export type UpdateCheckoutSettingsInput = z.infer<typeof updateCheckoutSettingsSchema>;

// ── Convenience re-exports ─────────────────────────────────
// Consumers that need the mobile-money provider union or the
// discount-type union in their own signatures can import them
// from here instead of redeclaring them.
export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];
export type DiscountType = (typeof DISCOUNT_TYPE_VALUES)[number];
