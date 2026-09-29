import {
  abandonedCartsQuerySchema,
  addCartItemSchema,
  addMultipleCartItemsSchema,
  applyCartDiscountSchema,
  applyCartPromotionSchema,
  applyLoyaltyPointsSchema,
  associateCustomerSchema,
  cartCheckoutSchema,
  exportAbandonedSchema,
  exportAnalyticsSchema,
  exportHistorySchema,
  splitCartSchema,
  transferCartSchema,
  updateCartItemQuantitySchema,
  updateCartNotesSchema,
  type AbandonedCartsQueryInput,
  type AddCartItemInput,
  type AddMultipleCartItemsInput,
  type ApplyCartDiscountInput,
  type ApplyCartPromotionInput,
  type ApplyLoyaltyPointsInput,
  type AssociateCustomerInput,
  type CartCheckoutInput,
  type ExportAbandonedInput,
  type ExportAnalyticsInput,
  type ExportHistoryInput,
  type SplitCartInput,
  type TransferCartInput,
  type UpdateCartItemQuantityInput,
  type UpdateCartNotesInput,
} from "../schemas/cart.js";

/**
 * Thin wrapper around the shared cart Zod schemas.
 *
 * Every method is a one-liner that calls `.parse()` on the
 * corresponding schema. The value this class adds over calling the
 * schemas directly is:
 *
 *   1. A single import surface for controllers that already have a
 *      `CartValidation` reference.
 *   2. Explicit return-type annotations, so a caller gets the
 *      inferred Zod type at the call site without importing the
 *      schema module itself.
 *
 * ⚠ When you add or remove a schema in `../schemas/cart.ts`, update
 *   this file too. The two must stay in lockstep or the validator
 *   class will drift from the schemas it claims to wrap.
 */
export class CartValidation {
  static validateAddItem(data: unknown): AddCartItemInput {
    return addCartItemSchema.parse(data);
  }

  static validateAddMultipleItems(data: unknown): AddMultipleCartItemsInput {
    return addMultipleCartItemsSchema.parse(data);
  }

  static validateUpdateItemQuantity(
    data: unknown,
  ): UpdateCartItemQuantityInput {
    return updateCartItemQuantitySchema.parse(data);
  }

  static validateApplyDiscount(data: unknown): ApplyCartDiscountInput {
    return applyCartDiscountSchema.parse(data);
  }

  static validateApplyPromotion(data: unknown): ApplyCartPromotionInput {
    return applyCartPromotionSchema.parse(data);
  }

  static validateApplyLoyaltyPoints(data: unknown): ApplyLoyaltyPointsInput {
    return applyLoyaltyPointsSchema.parse(data);
  }

  static validateAssociateCustomer(data: unknown): AssociateCustomerInput {
    return associateCustomerSchema.parse(data);
  }

  static validateUpdateCartNotes(data: unknown): UpdateCartNotesInput {
    return updateCartNotesSchema.parse(data);
  }

  static validateCheckout(data: unknown): CartCheckoutInput {
    return cartCheckoutSchema.parse(data);
  }

  static validateTransferCart(data: unknown): TransferCartInput {
    return transferCartSchema.parse(data);
  }

  static validateSplitCart(data: unknown): SplitCartInput {
    return splitCartSchema.parse(data);
  }

  static validateExportAnalytics(data: unknown): ExportAnalyticsInput {
    return exportAnalyticsSchema.parse(data);
  }

  static validateExportHistory(data: unknown): ExportHistoryInput {
    return exportHistorySchema.parse(data);
  }

  static validateExportAbandoned(data: unknown): ExportAbandonedInput {
    return exportAbandonedSchema.parse(data);
  }

  static validateAbandonedCartsQuery(
    data: unknown,
  ): AbandonedCartsQueryInput {
    return abandonedCartsQuerySchema.parse(data);
  }

  // NOTE: `validateRecoverCart` and `validateSendReminder` were
  // removed alongside their schemas. See the note in
  // `../schemas/cart.ts` for the reasoning.
}
