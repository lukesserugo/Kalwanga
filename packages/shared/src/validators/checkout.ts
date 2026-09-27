// packages/shared/src/validators/checkout.ts

import {
  addCheckoutItemSchema,
  applyDiscountSchema,
  cancelCheckoutSchema,
  createCheckoutSchema,
  onlineCheckoutSchema,          // ← new
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
  type OnlineCheckoutInput,      // ← new
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
  // ── Convenience re-exports ────────────────────────────
  MOBILE_MONEY_PROVIDERS,        // ← new
  DISCOUNT_TYPE_VALUES,          // ← new
  mobileMoneyProviderSchema,     // ← new
  type MobileMoneyProvider,      // ← new
  type DiscountType,             // ← new
} from "../../../shared/src/schemas/checkout";

export class CheckoutValidation {
  static validateCreateCheckout(data: unknown): CreateCheckoutInput {
    return createCheckoutSchema.parse(data);
  }

  // ── NEW: online checkout validator ─────────────────────
  //
  // The backend `/checkout/online` route must validate against
  // `onlineCheckoutSchema` (createCheckoutSchema minus
  // `paidAmount`). Without this method, the controller is forced
  // to re-declare its own schema locally — which is exactly the
  // drift that let `mobileMoneyProvider` get stripped before it
  // reached the service.
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

// ── Re-exports ───────────────────────────────────────────
// Consumers that want to avoid importing from the schemas file
// directly can pull the provider/discount unions from the
// validator barrel instead. Keeps the public surface of the
// `validators/checkout` module a superset of what it was before.
export {
  MOBILE_MONEY_PROVIDERS,
  DISCOUNT_TYPE_VALUES,
  mobileMoneyProviderSchema,
};
export type { MobileMoneyProvider, DiscountType };
