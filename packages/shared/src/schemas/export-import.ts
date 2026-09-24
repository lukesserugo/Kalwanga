import { z } from "zod";
import { businessUnitIdSchema, companyIdSchema } from "../helpers";

export const exportSalesSchema = z.object({
  businessUnitId: businessUnitIdSchema.optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  format: z.enum(['csv', 'excel', 'json', 'pdf', 'html']).default('csv'),
});

export const exportInventorySchema = z.object({
  businessUnitId: businessUnitIdSchema.optional(),
  format: z.enum(['csv', 'excel', 'json', 'pdf', 'html']).default('csv'),
});

export const importOptionsSchema = z.object({
  businessUnitId: businessUnitIdSchema.optional(),
  companyId: companyIdSchema.optional(),
  skipDuplicates: z.boolean().default(true),
  updateExisting: z.boolean().default(false),
});
