import { z } from "zod";
import { businessUnitIdSchema, providerIdSchema } from "../helpers";

export const createPaymentProviderSchema = z.object({
  provider: z.enum([
    'STRIPE',
    'CASH',
    'MOBILE_MONEY',
    'BANK_TRANSFER',
    'GIFT_CARD',
    'LOYALTY_POINTS',
    'PAYPAL',
    'FLUTTERWAVE',
    'PAYSTACK',
    'SQUARE',
  ]),
  name: z.string().min(1, 'Provider name is required'),
  code: z.string().min(1, 'Provider code is required').max(50),
  type: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']),
  isActive: z.boolean().default(true),
  isHealthy: z.boolean().default(true),
  configured: z.boolean().default(false),
  config: z.record(z.any()).optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  currencies: z.array(z.string().min(1)).default([]),
  settings: z.record(z.any()).optional(),
  order: z.number().int().min(0).default(0),
  paymentMethods: z
    .array(
      z.object({
        name: z.string().min(1),
        code: z.string().min(1).max(50),
        description: z.string().optional(),
        icon: z.string().optional(),
        isActive: z.boolean().default(true),
        requiresRedirect: z.boolean().default(false),
        isInstant: z.boolean().default(true),
        minAmount: z.number().min(0).optional(),
        maxAmount: z.number().min(0).optional(),
        feePercentage: z.number().min(0).max(100).optional(),
        feeFixed: z.number().min(0).optional(),
        order: z.number().int().min(0).default(0),
      }),
    )
    .default([]),
});

export const updatePaymentProviderSchema = createPaymentProviderSchema.partial();

export const getPaymentProvidersQuerySchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  search: z.string().optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  isActive: z.boolean().optional(),
  type: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).optional(),
});

export const toggleProviderSchema = z.object({
  isActive: z.boolean(),
});

export const configureProviderSchema = z.object({
  config: z.record(z.any()),
  settings: z.record(z.any()).optional(),
});

export const updateProviderHealthSchema = z.object({
  isHealthy: z.boolean(),
});

export const createProviderCurrencySchema = z.object({
  currency: z.string().min(1),
  isActive: z.boolean().default(true),
  conversionRate: z.number().min(0).optional(),
});

export const createPaymentMethodConfigSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().default(true),
  requiresRedirect: z.boolean().default(false),
  isInstant: z.boolean().default(true),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  feePercentage: z.number().min(0).max(100).optional(),
  feeFixed: z.number().min(0).optional(),
  order: z.number().int().min(0).default(0),
  businessUnitId: businessUnitIdSchema.optional(),
  providerId: providerIdSchema,
});

export const updatePaymentMethodConfigSchema =
  createPaymentMethodConfigSchema.partial();

export type CreatePaymentProviderInput = z.infer<
  typeof createPaymentProviderSchema
>;
export type UpdatePaymentProviderInput = z.infer<
  typeof updatePaymentProviderSchema
>;
export type GetPaymentProvidersQueryInput = z.infer<
  typeof getPaymentProvidersQuerySchema
>;
export type ToggleProviderInput = z.infer<typeof toggleProviderSchema>;
export type ConfigureProviderInput = z.infer<typeof configureProviderSchema>;
export type UpdateProviderHealthInput = z.infer<
  typeof updateProviderHealthSchema
>;
export type CreateProviderCurrencyInput = z.infer<
  typeof createProviderCurrencySchema
>;
export type CreatePaymentMethodConfigInput = z.infer<
  typeof createPaymentMethodConfigSchema
>;
export type UpdatePaymentMethodConfigInput = z.infer<
  typeof updatePaymentMethodConfigSchema
>;
