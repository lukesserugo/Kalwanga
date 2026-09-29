// packages/shared/src/schemas/checkout.ts

import { z } from "zod";
import {
  cartIdSchema,
  customerIdSchema,
  paymentMethodSchema,
  userIdSchema,
} from "../helpers.js";

// ============================================
// RE-EXPORTS
// ============================================
//
// `paymentMethodSchema` is defined in `../helpers.js` and imported
// here for use by the schemas below. It is re-exported so downstream
// consumers (`routes/checkout.ts`, `validators/checkout.ts`) can
// import it from this module rather than reaching into `helpers.js`.
//
// ⚠ Phase 2/3: this re-export is what `routes/checkout.ts:46`
//   currently expects. Removing it re-breaks that file.
export { paymentMethodSchema };

// ============================================
// CONSTANTS
// ============================================

/**
 * Mobile-money network identifiers.
 *
 * ⚠ Kept in sync with the concrete `ProviderHandler` keys registered
 *   in `paymentService.initializeHandlers()`:
 *
 *     MPESA  — real handler, routes through `mpesaService`
 *     MTN    — real handler, routes through `mobileMoneyService`
 *     AIRTEL — real handler, routes through `mobileMoneyService`
 *
 *   `TIGO` and `VODAFONE` are NOT in this list. They have no real
 *   integration yet and are handled by the simulator
 *   (`MobileMoneyProviderHandler` in `paymentService.ts`). Exposing
 *   them here would let a caller type-check a `MOBILE_MONEY` request
 *   that never reaches a real gateway.
 *
 * ⚠ This array is the single source of truth. Both the Zod enum below
 *   and the `MobileMoneyProvider` type derive from it.
 */
export const MOBILE_MONEY_PROVIDERS = [
  'MPESA',
  'MTN',
  'AIRTEL',
] as const;

/**
 * Union type of supported mobile-money networks.
 *
 * Derived from `MOBILE_MONEY_PROVIDERS` so adding a value to that
 * array extends this type automatically.
 */
export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];

/**
 * Mobile-money network selector schema.
 *
 * Accepts a lowercase input by uppercasing before validation, so a
 * client sending `'mtn'` still validates to `'MTN'`.
 */
export const mobileMoneyProviderSchema = z
  .string()
  .transform((v) => v.trim().toUpperCase())
  .pipe(z.enum(MOBILE_MONEY_PROVIDERS));

/**
 * Discount type values.
 *
 * ⚠ Mirrors the Prisma `DiscountType` enum:
 *
 *     enum DiscountType {
 *       PERCENTAGE
 *       FIXED
 *       LOYALTY
 *       MANUAL
 *     }
 *
 *   Keep these in sync. Adding a value to the Prisma enum requires
 *   updating this list and the `DiscountType` type below.
 *
 * The `Sale.discountType` column is written from this union by
 * `SaleService.createSale` / `createSaleFromCart` (via
 * `inferDiscountType`) and `CheckoutService.processCheckout`. A
 * value not in this list would be rejected by the Postgres enum
 * at write time.
 */
export const DISCOUNT_TYPE_VALUES = [
  'PERCENTAGE',
  'FIXED',
  'LOYALTY',
  'MANUAL',
] as const;

/**
 * Union type of supported discount types.
 *
 * Derived from `DISCOUNT_TYPE_VALUES`.
 *
 * ⚠ This is the shared-package definition of `DiscountType`. The
 *   backend imports a Prisma-generated version with the same members
 *   from `../generated/prisma/index.js`. Both are structurally
 *   equivalent; controllers that narrow an incoming string to this
 *   union can safely forward the result to a service expecting the
 *   Prisma one.
 */
export type DiscountType = (typeof DISCOUNT_TYPE_VALUES)[number];

// ============================================
// CREATE — OFFLINE (POS / CASH)
// ============================================
//
// Body accepted by `POST /checkout`.
//
// ⚠ No currency field is declared. Phase 1 removed the schema default
//   on `Payment.currency`; Phase 2 made every `payment.create` call
//   site resolve the currency from the cart's business unit before
//   writing the row. A caller-supplied currency on this body would be
//   ignored by the controller (`businessUnitId: undefined` forces the
//   cart's own BU) and is therefore not part of the wire contract.
//
// ⚠ `tipAmount` and `cardNonce` are intentionally NOT declared here.
//   The offline path ignores both — `cardNonce` is only consumed by
//   `POST /checkout/online`, and `tipAmount` isn't read by
//   `CheckoutService.processCheckout` at all.

export const createCheckoutSchema = z.object({
  cartId: cartIdSchema,
  customerId: customerIdSchema.optional().nullable(),
  paymentMethod: paymentMethodSchema,
  paidAmount: z
    .number()
    .finite()
    .nonnegative('Paid amount must be zero or greater'),
  discount: z.number().finite().nonnegative().optional(),
  notes: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  applyLoyaltyPoints: z.boolean().optional().default(false),
  /**
   * Caller-supplied BU is accepted for backward compatibility, but
   * `checkoutController.createCheckout` drops it before calling the
   * service — the cart's own BU is authoritative for currency and
   * stock.
   */
  businessUnitId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),

  // Discount / promotion passthrough. The service infers the final
  // DiscountType from which of these are present when `discountType`
  // itself is omitted.
  discountType: z.enum(DISCOUNT_TYPE_VALUES).optional().nullable(),
  promotionCode: z.string().optional().nullable(),
  promotionDiscount: z.number().finite().nonnegative().optional(),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

// ============================================
// CREATE — ONLINE (GATEWAY-BACKED)
// ============================================
//
// Body accepted by `POST /checkout/online`.
//
// ⚠ `paidAmount` is deliberately NOT part of this schema. The total is
//   entirely server-computed from the cart's items, product prices,
//   discounts, and loyalty redemption. Accepting it from the wire
//   would invite a caller to under-pay a card charge.

export const onlineCheckoutSchema = z.object({
  cartId: cartIdSchema,
  customerId: customerIdSchema.optional().nullable(),
  paymentMethod: paymentMethodSchema,
  discount: z.number().finite().nonnegative().optional(),
  notes: z.string().optional(),
  applyLoyaltyPoints: z.boolean().optional().default(false),
  businessUnitId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),

  // ── Gateway-specific passthrough ──────────────────────────
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  cardNonce: z.string().optional(),
  paymentMethodId: z.string().optional(),

  // Gift-card code, forwarded under both names so the service's
  // `data.giftCardCode ?? data.gatewayId` lookup resolves.
  giftCardCode: z.string().optional(),
  gatewayId: z.string().optional(),

  // Mobile-money network selector. Consumed by the service when
  // `paymentMethod === 'MOBILE_MONEY'` to route to the concrete
  // provider instead of the simulator.
  mobileMoneyProvider: mobileMoneyProviderSchema.optional(),

  // Discount / promotion passthrough.
  discountType: z.enum(DISCOUNT_TYPE_VALUES).optional().nullable(),
  promotionCode: z.string().optional().nullable(),
  promotionDiscount: z.number().finite().nonnegative().optional(),
});

export type OnlineCheckoutInput = z.infer<typeof onlineCheckoutSchema>;

// ============================================
// UPDATE
// ============================================
//
// Body accepted by `PATCH /checkout/:id` (partial update of a
// PENDING sale).

export const updateCheckoutSchema = z.object({
  customerId: customerIdSchema.optional().nullable(),
  notes: z.string().optional(),
  discount: z.number().finite().nonnegative().optional(),
  discountType: z.enum(DISCOUNT_TYPE_VALUES).optional().nullable(),
  promotionCode: z.string().optional().nullable(),
  promotionDiscount: z.number().finite().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
});

export type UpdateCheckoutInput = z.infer<typeof updateCheckoutSchema>;

// ============================================
// CANCEL
// ============================================
//
// Body accepted by `POST /checkout/:id/cancel`.

export const cancelCheckoutSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CancelCheckoutInput = z.infer<typeof cancelCheckoutSchema>;

// ============================================
// VOID
// ============================================
//
// Body accepted by `POST /checkout/:saleId/void`.

export const voidCheckoutSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type VoidCheckoutInput = z.infer<typeof voidCheckoutSchema>;

// ============================================
// COMPLETE
// ============================================
//
// Body accepted by `POST /checkout/:id/complete`. Currently empty —
// completion is a server-side operation. Declared here so consumers
// can `.parse(req.body ?? {})` uniformly.

export const completeCheckoutSchema = z.object({}).passthrough();

export type CompleteCheckoutInput = z.infer<typeof completeCheckoutSchema>;

// ============================================
// PROCESS PAYMENT (POST-CHECKOUT)
// ============================================
//
// Body accepted by `POST /checkout/:id/payments` — a SPLIT or PARTIAL
// payment added AFTER the initial checkout. NOT the gateway entry
// point; that is `onlineCheckoutSchema` / `createOnlineCheckout`.

export const processPaymentSchema = z.object({
  paymentMethod: paymentMethodSchema,
  amount: z.number().finite().positive('Amount must be positive'),
  paymentDetails: z.unknown().optional(),
});

export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;

// ============================================
// EMAIL RECEIPT
// ============================================
//
// Body accepted by `POST /checkout/:id/email-receipt`. The email is
// optional — the service falls back to the sale's customer email, or
// the sale's user email, when omitted.

export const emailReceiptSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
});

export type EmailReceiptInput = z.infer<typeof emailReceiptSchema>;

// ============================================
// LIST / QUERY
// ============================================
//
// Query string accepted by `GET /checkout`.
//
// ⚠ `businessUnitId` is a scope filter, not a currency selector. The
//   Phase 2 contract routes currency resolution through the BU of
//   each Sale row that is returned — the filter just narrows which
//   rows are visible.

export const getCheckoutsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z
    .enum([
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'CANCELLED',
      'REFUNDED',
      'ON_HOLD',
      'VOID',
      'DELETED',
    ])
    .optional(),
  paymentStatus: z
    .enum([
      'UNPAID',
      'PENDING',
      'PAID',
      'FAILED',
      'REFUNDED',
      'PARTIAL',
      'PROCESSING',
      'AUTHORIZED',
      'DECLINED',
    ])
    .optional(),
  customerId: z.string().optional(),
  businessUnitId: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z
    .enum(['saleDate', 'createdAt', 'total', 'status'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type GetCheckoutsInput = z.infer<typeof getCheckoutsSchema>;

// ============================================
// HISTORY / QUERY
// ============================================
//
// Query string accepted by `GET /checkout/history`. Same shape as
// `getCheckoutsSchema` but with an explicit date range under the
// `startDate` / `endDate` names (the history view uses those, the
// list view uses `dateFrom` / `dateTo`).
//
// ⚠ Both aliases are still accepted by the controller — this schema
//   documents the canonical names for the history endpoint.

export const getCheckoutHistorySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z
    .enum([
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'CANCELLED',
      'REFUNDED',
      'ON_HOLD',
      'VOID',
      'DELETED',
    ])
    .optional(),
  paymentStatus: z
    .enum([
      'UNPAID',
      'PENDING',
      'PAID',
      'FAILED',
      'REFUNDED',
      'PARTIAL',
      'PROCESSING',
      'AUTHORIZED',
      'DECLINED',
    ])
    .optional(),
  customerId: z.string().optional(),
  businessUnitId: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type GetCheckoutHistoryInput = z.infer<
  typeof getCheckoutHistorySchema
>;

// ============================================
// STATS / QUERY
// ============================================
//
// Query string accepted by `GET /checkout/stats`.

export const getCheckoutStatsSchema = z.object({
  businessUnitId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type GetCheckoutStatsInput = z.infer<
  typeof getCheckoutStatsSchema
>;

// ============================================
// ITEM MUTATIONS
// ============================================

export const addCheckoutItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().finite().nonnegative().optional(),
});

export type AddCheckoutItemInput = z.infer<typeof addCheckoutItemSchema>;

export const updateCheckoutItemSchema = z.object({
  quantity: z.number().int().nonnegative(),
});

export type UpdateCheckoutItemInput = z.infer<
  typeof updateCheckoutItemSchema
>;

// ============================================
// DISCOUNTS
// ============================================

export const applyDiscountSchema = z.object({
  code: z.string().min(1, 'Discount code is required'),
});

export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>;

// ============================================
// SETTINGS
// ============================================
//
// Settings patch accepted by `PUT /checkout/settings`.
//
// ⚠ Phase 1 removed the persisted `currencySymbol` column from
//   `CartSettings`, `CheckoutSettings`, and `SalesSettings`. Only
//   `currencyCode` is settable. The symbol is derived from the code
//   via `lib/currencies.ts` on the read path.
//
// ⚠ `.strict()` means a client that still sends `currencySymbol`
//   gets a 400 here, not a silent drop. That surfaces the Phase 4 /
//   Phase 5 client-side cleanup as a real error during rollout.
//
// ⚠ `currencyCode` is normalized to uppercase so the stored value is
//   canonical (`'ugx'` → `'UGX'`).
//
// ⚠ `paymentMethodSchema` is the shared helper — it's stricter than
//   the controller-local `paymentMethodSchema` used by
//   `saleController` and `checkoutController`. That is intentional:
//   the controller-local one accepts aliases (`CARD`, `MOBILE`, …)
//   for legacy clients; the shared one only accepts the canonical set
//   that the backend service actually dispatches on.

export const updateCheckoutSettingsSchema = z
  .object({
    allowPartialPayment: z.boolean().optional(),
    requireCustomer: z.boolean().optional(),
    requireSignature: z.boolean().optional(),
    maxDiscount: z.number().min(0).max(100).optional(),
    taxInclusive: z.boolean().optional(),
    defaultPaymentMethod: paymentMethodSchema.optional(),
    receiptFooter: z.string().max(500).optional(),
    loyaltyPointsEnabled: z.boolean().optional(),
    pointsPerDollar: z.number().int().nonnegative().optional(),
    allowGuestCheckout: z.boolean().optional(),
    maxCartItems: z.number().int().positive().optional(),
    cartExpiryHours: z.number().int().positive().optional(),
    discountEnabled: z.boolean().optional(),
    maxDiscountPercentage: z.number().min(0).max(100).optional(),
    autoApplyPromotions: z.boolean().optional(),
    reserveStockOnAdd: z.boolean().optional(),
    reserveStockMinutes: z.number().int().positive().optional(),
    lowStockThreshold: z.number().int().nonnegative().optional(),
    freeShippingThreshold: z.number().nonnegative().optional(),
    shippingCost: z.number().nonnegative().optional(),
    taxRate: z.number().min(0).max(100).optional(),
    notifyOnAbandonedCart: z.boolean().optional(),
    abandonedCartHours: z.number().int().positive().optional(),
    // ── Currency surface ──────────────────────────────────────
    // `currencyCode` is the only persisted currency field.
    // Normalized to uppercase at the boundary.
    currencyCode: z
      .string()
      .length(3, 'Currency code must be exactly 3 characters')
      .transform((v) => v.toUpperCase())
      .optional(),
    // ⚠ `currencySymbol` intentionally absent — see JSDoc above.
    showStockBadge: z.boolean().optional(),
    showVariantImages: z.boolean().optional(),
  })
  .strict();

export type UpdateCheckoutSettingsInput = z.infer<
  typeof updateCheckoutSettingsSchema
>;

// ============================================
// EXPORTS
// ============================================
//
// A single export format union shared by every checkout-adjacent
// export endpoint. CSV and JSON only — see the note below.
//
// ⚠ The backend has no Excel or PDF generator. Every export endpoint
//   currently emits CSV (`Content-Type: text/csv`), regardless of the
//   requested format. Accepting `'excel'` or `'pdf'` here would let a
//   caller receive a CSV body with an `.xlsx` / `.pdf` filename,
//   which the target application then refuses to open — worse than a
//   schema rejection.
//
//   When a real Excel or PDF generator lands, re-add the value here
//   and implement the corresponding branch in the controller.

export const exportFormatSchema = z.enum(['csv', 'json']);

export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const exportCheckoutsSchema = z.object({
  format: exportFormatSchema.default('csv'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  businessUnitId: z.string().optional(),
});

export type ExportCheckoutsInput = z.infer<typeof exportCheckoutsSchema>;

export const exportCheckoutDataSchema = z.object({
  format: exportFormatSchema.default('csv'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
});

export type ExportCheckoutDataInput = z.infer<
  typeof exportCheckoutDataSchema
>;

// ============================================
// USER ID RE-EXPORTS
// ============================================
//
// `userIdSchema` is imported above to keep the shared helper import
// list stable across schema files. Nothing in this file uses it
// directly. If your tree-shaker complains about the unused import,
// delete both this re-export and the import — but check that no
// consumer is importing `userIdSchema` from this module first.

export { userIdSchema };
