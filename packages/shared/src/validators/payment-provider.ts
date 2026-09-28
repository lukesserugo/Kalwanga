// packages/shared/src/validators/payment-provider.ts

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
} from '../schemas/payment-provider';

/**
 * Validation façade over the payment-provider schemas.
 *
 * Every method is a thin `schema.parse(data)` wrapper. The class
 * exists so:
 *
 *   1. Callers (routers, controllers, tests) have a single import
 *      site for validation rather than reaching into the schema
 *      module directly.
 *   2. A future migration off Zod (or from `.parse` to
 *      `.safeParse` + a custom throw) is a single-file change —
 *      see the private `parse` helper below.
 *   3. Shared behaviour (input sanitization, redacting secrets
 *      before logging, wrapping `ZodError` in an `AppError`) can
 *      be attached once here instead of at every call site.
 *
 * Errors thrown by `.parse()` are `ZodError` instances. The
 * codebase's standard `zodError` helper in the controllers turns
 * them into a `{ success: false, errors: [...] }` response body.
 */
export class PaymentProviderValidation {
  /**
   * Internal `.parse()` indirection.
   *
   * All nine methods funnel through here so a future change to
   * the validation strategy is one edit, not nine. The default
   * implementation throws on failure, which is what every caller
   * currently relies on.
   */
  private static parse<T>(
    schema: { parse: (data: unknown) => T },
    data: unknown,
  ): T {
    return schema.parse(data);
  }

  /**
   * `POST /payments/payment-providers`
   */
  static validateCreatePaymentProvider(
    data: unknown,
  ): CreatePaymentProviderInput {
    return this.parse(createPaymentProviderSchema, data);
  }

  /**
   * `PATCH /payments/payment-providers/:id`
   */
  static validateUpdatePaymentProvider(
    data: unknown,
  ): UpdatePaymentProviderInput {
    return this.parse(updatePaymentProviderSchema, data);
  }

  /**
   * `GET /payments/payment-providers`
   */
  static validateGetPaymentProviders(
    data: unknown,
  ): GetPaymentProvidersQueryInput {
    return this.parse(getPaymentProvidersQuerySchema, data);
  }

  /**
   * `PATCH /payments/payment-providers/:id/toggle`
   *
   * Distinct from `validateUpdatePaymentProvider` — the toggle
   * body is exactly `{ isActive: boolean }` and nothing else. The
   * shared `toggleProviderSchema` is `.strict()`, so a caller that
   * tries to slip another field through this method gets a 400.
   */
  static validateToggleProvider(data: unknown): ToggleProviderInput {
    return this.parse(toggleProviderSchema, data);
  }

  /**
   * `POST /payments/payment-providers/:id/configure`
   *
   * Persists credentials and/or settings. The backend merges the
   * patch with the existing config, so a partial patch that only
   * updates `settings` does not wipe stored credentials.
   */
  static validateConfigureProvider(data: unknown): ConfigureProviderInput {
    return this.parse(configureProviderSchema, data);
  }

  /**
   * `PATCH /payments/payment-providers/:id/health`
   */
  static validateUpdateProviderHealth(
    data: unknown,
  ): UpdateProviderHealthInput {
    return this.parse(updateProviderHealthSchema, data);
  }

  /**
   * `POST /payments/payment-providers/:id/currencies`
   */
  static validateCreateProviderCurrency(
    data: unknown,
  ): CreateProviderCurrencyInput {
    return this.parse(createProviderCurrencySchema, data);
  }

  /**
   * `POST /payments/payment-providers/:providerId/methods`
   */
  static validateCreatePaymentMethodConfig(
    data: unknown,
  ): CreatePaymentMethodConfigInput {
    return this.parse(createPaymentMethodConfigSchema, data);
  }

  /**
   * `PATCH /payments/payment-providers/:providerId/methods/:methodId`
   */
  static validateUpdatePaymentMethodConfig(
    data: unknown,
  ): UpdatePaymentMethodConfigInput {
    return this.parse(updatePaymentMethodConfigSchema, data);
  }
}
