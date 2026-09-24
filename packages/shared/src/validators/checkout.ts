import {
  addCheckoutItemSchema,
  applyDiscountSchema,
  cancelCheckoutSchema,
  createCheckoutSchema,
  emailReceiptSchema,
  exportCheckoutsSchema,
  getCheckoutHistorySchema,
  getCheckoutStatsSchema,
  getCheckoutsSchema,
  processPaymentSchema,
  updateCheckoutItemSchema,
  updateCheckoutSchema,
  updateCheckoutSettingsSchema,
  voidCheckoutSchema,
  type AddCheckoutItemInput,
  type ApplyDiscountInput,
  type CancelCheckoutInput,
  type CreateCheckoutInput,
  type EmailReceiptInput,
  type ExportCheckoutsInput,
  type GetCheckoutHistoryInput,
  type GetCheckoutStatsInput,
  type GetCheckoutsInput,
  type ProcessPaymentInput,
  type UpdateCheckoutInput,
  type UpdateCheckoutItemInput,
  type UpdateCheckoutSettingsInput,
  type VoidCheckoutInput,
} from "../schemas/checkout";

export class CheckoutValidation {
  static validateCreateCheckout(data: unknown): CreateCheckoutInput {
    return createCheckoutSchema.parse(data);
  }

  static validateGetCheckouts(data: unknown): GetCheckoutsInput {
    return getCheckoutsSchema.parse(data);
  }

  static validateGetCheckoutHistory(
    data: unknown,
  ): GetCheckoutHistoryInput {
    return getCheckoutHistorySchema.parse(data);
  }

  static validateUpdateCheckout(data: unknown): UpdateCheckoutInput {
    return updateCheckoutSchema.parse(data);
  }

  static validateProcessPayment(data: unknown): ProcessPaymentInput {
    return processPaymentSchema.parse(data);
  }

  static validateCancelCheckout(data: unknown): CancelCheckoutInput {
    return cancelCheckoutSchema.parse(data);
  }

  static validateVoidCheckout(data: unknown): VoidCheckoutInput {
    return voidCheckoutSchema.parse(data);
  }

  static validateAddCheckoutItem(data: unknown): AddCheckoutItemInput {
    return addCheckoutItemSchema.parse(data);
  }

  static validateUpdateCheckoutItem(
    data: unknown,
  ): UpdateCheckoutItemInput {
    return updateCheckoutItemSchema.parse(data);
  }

  static validateApplyDiscount(data: unknown): ApplyDiscountInput {
    return applyDiscountSchema.parse(data);
  }

  static validateEmailReceipt(data: unknown): EmailReceiptInput {
    return emailReceiptSchema.parse(data);
  }

  static validateExportCheckouts(data: unknown): ExportCheckoutsInput {
    return exportCheckoutsSchema.parse(data);
  }

  static validateGetCheckoutStats(data: unknown): GetCheckoutStatsInput {
    return getCheckoutStatsSchema.parse(data);
  }

  static validateUpdateCheckoutSettings(
    data: unknown,
  ): UpdateCheckoutSettingsInput {
    return updateCheckoutSettingsSchema.parse(data);
  }
}
