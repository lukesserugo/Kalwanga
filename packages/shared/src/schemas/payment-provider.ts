// packages/shared/src/schemas/payment-provider.ts

import { z } from 'zod';

// ============================================
// PRIMITIVE ENUMS
// ============================================
//
// Mirrors the backend's `PAYMENT_PROVIDERS` and
// `PAYMENT_PROVIDER_TYPES` constants in
// `packages/backend/src/controllers/paymentController.ts`.
// Keep all three in sync — a value accepted here but rejected
// there produces a confusing client-passes / server-fails 400.

export const PAYMENT_PROVIDER_NAMES = [
  'STRIPE',
  'CASH',
  'MOBILE_MONEY',
  'BANK_TRANSFER',
  'GIFT_CARD',
  'LOYALTY_POINTS',
  'PAYPAL',
  'FLUTTERWAVE',
  'SQUARE',
  'MTN',
  'AIRTEL',
  'TIGO',
  'VODAFONE',
] as const;

export const PAYMENT_PROVIDER_TYPES = [
  'ONLINE',
  'OFFLINE',
  'HYBRID',
] as const;

export const paymentProviderNameSchema = z.enum(PAYMENT_PROVIDER_NAMES);
export const paymentProviderTypeSchema = z.enum(PAYMENT_PROVIDER_TYPES);

// ============================================
// PAYMENT METHOD CONFIG
// ============================================
//
// Declared before the provider schema that nests it — Zod
// evaluates `z.array(createPaymentMethodConfigSchema)` at
// module-init time.

/**
 * Shape of a single `PaymentMethodConfig` as supplied by a
 * client creating or updating a provider.
 *
 * The backend model also carries server-managed fields (`id`,
 * `providerId`, `createdAt`, `updatedAt`, `deletedAt`); those are
 * not validated here.
 */
export const createPaymentMethodConfigSchema = z
  .object({
    name: z.string().min(1).max(120),
    code: z.string().min(1).max(64),
    description: z.string().max(500).optional(),
    icon: z.string().max(64).optional(),
    isActive: z.boolean().optional().default(true),
    requiresRedirect: z.boolean().optional().default(false),
    isInstant: z.boolean().optional().default(true),
    minAmount: z.number().finite().min(0).optional(),
    maxAmount: z.number().finite().min(0).optional(),
    feePercentage: z.number().finite().min(0).max(100).optional(),
    feeFixed: z.number().finite().min(0).optional(),
    order: z.number().int().min(0).optional().default(0),
  })
  .strict();

export type CreatePaymentMethodConfigInput = z.infer<
  typeof createPaymentMethodConfigSchema
>;

/**
 * Update variant — every field optional. The backend merges the
 * patch with the existing row.
 */
export const updatePaymentMethodConfigSchema =
  createPaymentMethodConfigSchema.partial();

export type UpdatePaymentMethodConfigInput = z.infer<
  typeof updatePaymentMethodConfigSchema
>;

// ============================================
// PROVIDER CRUD
// ============================================

/**
 * Body accepted by `POST /payments/payment-providers`.
 *
 * ⚠ `config` is provider-specific. The shape varies (apiKey for
 *   Stripe, clientId/clientSecret for PayPal, accessToken/
 *   locationId for Square, …). Validated generically here; the
 *   backend controller refines it per provider after parsing.
 */
export const createPaymentProviderSchema = z
  .object({
    provider: paymentProviderNameSchema,
    name: z.string().min(1).max(120),
    code: z.string().min(1).max(64),
    type: paymentProviderTypeSchema,
    isActive: z.boolean().optional().default(true),
    isHealthy: z.boolean().optional().default(true),
    configured: z.boolean().optional().default(false),
    config: z.record(z.string(), z.any()).optional(),
    businessUnitId: z.string().max(64).optional(),
    currencies: z.array(z.string().max(8)).optional().default([]),
    settings: z.record(z.string(), z.any()).optional(),
    order: z.number().int().min(0).optional().default(0),
    paymentMethods: z
      .array(createPaymentMethodConfigSchema)
      .optional()
      .default([]),
  })
  .strict();

export type CreatePaymentProviderInput = z.infer<
  typeof createPaymentProviderSchema
>;

/**
 * Body accepted by `PATCH /payments/payment-providers/:id`.
 *
 * Every field optional; the backend merges the patch with the
 * existing row.
 */
export const updatePaymentProviderSchema =
  createPaymentProviderSchema.partial();

export type UpdatePaymentProviderInput = z.infer<
  typeof updatePaymentProviderSchema
>;

/**
 * Body accepted by `POST /payments/payment-providers/:id/configure`.
 *
 * Persists credentials and settings. The backend merges the patch
 * into the existing config, so a partial patch that only updates
 * `settings` does not wipe stored credentials.
 */
export const configureProviderSchema = z
  .object({
    config: z.record(z.string(), z.any()),
    settings: z.record(z.string(), z.any()).optional(),
  })
  .strict();

export type ConfigureProviderInput = z.infer<
  typeof configureProviderSchema
>;

/**
 * Body accepted by `PATCH /payments/payment-providers/:id/health`.
 */
export const updateProviderHealthSchema = z
  .object({
    isHealthy: z.boolean(),
  })
  .strict();

export type UpdateProviderHealthInput = z.infer<
  typeof updateProviderHealthSchema
>;

/**
 * Body accepted by the toggle endpoint (or by a UI switch that
 * PATCHes `isActive` on its own).
 *
 * Deliberately distinct from `updatePaymentProviderSchema` so the
 * toggle endpoint accepts exactly `{ isActive: boolean }` and
 * nothing else. `.strict()` rejects a caller that tries to sneak
 * `isHealthy` through the toggle path.
 */
export const toggleProviderSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export type ToggleProviderInput = z.infer<typeof toggleProviderSchema>;

// ============================================
// PROVIDER CURRENCY SUB-RESOURCE
// ============================================

/**
 * Body accepted by
 * `POST /payments/payment-providers/:id/currencies`.
 *
 * ⚠ `conversionRate` is `.positive()`, not `.nonnegative()`. A
 *   rate of 0 would produce a division-by-zero downstream when the
 *   display-conversion code runs.
 */
export const createProviderCurrencySchema = z
  .object({
    currency: z.string().min(3).max(8),
    conversionRate: z.number().finite().positive().optional(),
  })
  .strict();

export type CreateProviderCurrencyInput = z.infer<
  typeof createProviderCurrencySchema
>;

// ============================================
// QUERY PARAMETERS
// ============================================

/**
 * Query accepted by `GET /payments/payment-providers`.
 *
 * Query values arrive as strings. `isActive=true` in a URL is the
 * string `'true'`, not the boolean `true`. The union accepts both
 * so a caller that programmatically passes a boolean and a caller
 * that sends a URL both validate.
 */
export const getPaymentProvidersQuerySchema = z
  .object({
    businessUnitId: z.string().max(64).optional(),
    isActive: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
      .optional(),
    type: paymentProviderTypeSchema.optional(),
  })
  .strict();

export type GetPaymentProvidersQueryInput = z.infer<
  typeof getPaymentProvidersQuerySchema
>;
