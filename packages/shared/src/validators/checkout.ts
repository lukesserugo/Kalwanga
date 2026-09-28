// packages/shared/src/validators/checkout.ts

import {
  addCheckoutItemSchema,
  applyDiscountSchema,
  cancelCheckoutSchema,
  createCheckoutSchema,
  onlineCheckoutSchema,
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
  type OnlineCheckoutInput,
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
  MOBILE_MONEY_PROVIDERS,
  DISCOUNT_TYPE_VALUES,
  mobileMoneyProviderSchema,
  type MobileMoneyProvider,
  type DiscountType,
} from "../schemas/checkout.js";

export class CheckoutValidation {
  static validateCreateCheckout(data: unknown): CreateCheckoutInput {
    return createCheckoutSchema.parse(data);
  }

  // The backend `/checkout/online` route validates against
  // `onlineCheckoutSchema` (createCheckoutSchema minus
  // `paidAmount`). Keeping this method here is what prevents the
  // controller from re-declaring its own schema and drifting out
  // of sync — the failure mode that previously stripped
  // `mobileMoneyProvider` before it reached the service.
  static validateOnlineCheckout(data: unknown): OnlineCheckoutInput {
    return onlineCheckoutSchema.parse(data);
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

// Re-exports so consumers that prefer to import from the validator
// barrel do not have to reach into `schemas/checkout` directly.
export {
  MOBILE_MONEY_PROVIDERS,
  DISCOUNT_TYPE_VALUES,
  mobileMoneyProviderSchema,
};
export type { MobileMoneyProvider, DiscountType };
