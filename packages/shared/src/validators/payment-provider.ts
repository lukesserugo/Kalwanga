import {
  configureProviderSchema,
  createPaymentMethodConfigSchema,
  createPaymentProviderSchema,
  createProviderCurrencySchema,
  getPaymentProvidersQuerySchema,
  toggleProviderSchema,
  updatePaymentMethodConfigSchema,
  updatePaymentProviderSchema,
  updateProviderHealthSchema,
  type ConfigureProviderInput,
  type CreatePaymentMethodConfigInput,
  type CreatePaymentProviderInput,
  type CreateProviderCurrencyInput,
  type GetPaymentProvidersQueryInput,
  type ToggleProviderInput,
  type UpdatePaymentMethodConfigInput,
  type UpdatePaymentProviderInput,
  type UpdateProviderHealthInput,
} from "../schemas/payment-provider";

export class PaymentProviderValidation {
  static validateCreatePaymentProvider(
    data: unknown,
  ): CreatePaymentProviderInput {
    return createPaymentProviderSchema.parse(data);
  }

  static validateUpdatePaymentProvider(
    data: unknown,
  ): UpdatePaymentProviderInput {
    return updatePaymentProviderSchema.parse(data);
  }

  static validateGetPaymentProviders(
    data: unknown,
  ): GetPaymentProvidersQueryInput {
    return getPaymentProvidersQuerySchema.parse(data);
  }

  static validateToggleProvider(data: unknown): ToggleProviderInput {
    return toggleProviderSchema.parse(data);
  }

  static validateConfigureProvider(data: unknown): ConfigureProviderInput {
    return configureProviderSchema.parse(data);
  }

  static validateUpdateProviderHealth(
    data: unknown,
  ): UpdateProviderHealthInput {
    return updateProviderHealthSchema.parse(data);
  }

  static validateCreateProviderCurrency(
    data: unknown,
  ): CreateProviderCurrencyInput {
    return createProviderCurrencySchema.parse(data);
  }

  static validateCreatePaymentMethodConfig(
    data: unknown,
  ): CreatePaymentMethodConfigInput {
    return createPaymentMethodConfigSchema.parse(data);
  }

  static validateUpdatePaymentMethodConfig(
    data: unknown,
  ): UpdatePaymentMethodConfigInput {
    return updatePaymentMethodConfigSchema.parse(data);
  }
}
