import { z } from "zod";
import { businessUnitIdSchema, LOCATION_TYPES } from "../helpers";

const locationNameSchema = z
  .string()
  .min(1, 'Location name is required')
  .max(100, 'Location name must be less than 100 characters')
  .transform((v) => v.trim());

const locationCodeSchema = z
  .string()
  .max(50, 'Location code must be less than 50 characters')
  .transform((v) => v.trim());

const locationTypeSchema = z
  .string()
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => (LOCATION_TYPES as readonly string[]).includes(v), {
    message: `Invalid location type. Accepted: ${LOCATION_TYPES.join(', ')}`,
  });

export const createLocationSchema = z.object({
  name: locationNameSchema,
  code: locationCodeSchema.optional().nullable(),
  type: locationTypeSchema.optional().default('OTHER'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
  metadata: z.record(z.any()).optional().nullable(),
  businessUnitId: businessUnitIdSchema.optional(),
});

export const updateLocationSchema = createLocationSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listLocationsQuerySchema = z.object({
  businessUnitId: businessUnitIdSchema.optional(),
  includeInactive: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type ListLocationsQueryInput = z.infer<typeof listLocationsQuerySchema>;
