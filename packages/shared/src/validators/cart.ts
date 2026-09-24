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
  recoverCartSchema,
  sendReminderSchema,
  splitCartSchema,
  transferCartSchema,
  updateCartItemQuantitySchema,
  updateCartNotesSchema,
  type AddCartItemInput,
  type AddMultipleCartItemsInput,
  type ApplyCartDiscountInput,
  type ApplyCartPromotionInput,
  type ApplyLoyaltyPointsInput,
  type AssociateCustomerInput,
  type CartCheckoutInput,
  type SplitCartInput,
  type TransferCartInput,
  type UpdateCartItemQuantityInput,
  type UpdateCartNotesInput,
} from "../schemas/cart";

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

  static validateExportAnalytics(data: unknown) {
    return exportAnalyticsSchema.parse(data);
  }

  static validateExportHistory(data: unknown) {
    return exportHistorySchema.parse(data);
  }

  static validateExportAbandoned(data: unknown) {
    return exportAbandonedSchema.parse(data);
  }

  static validateAbandonedCartsQuery(data: unknown) {
    return abandonedCartsQuerySchema.parse(data);
  }

  static validateRecoverCart(data: unknown) {
    return recoverCartSchema.parse(data);
  }

  static validateSendReminder(data: unknown) {
    return sendReminderSchema.parse(data);
  }
}
