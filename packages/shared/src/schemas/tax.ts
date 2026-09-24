import { z } from "zod";
import { businessUnitIdSchema } from "../helpers";

export const taxSummarySchema = z.object({
  businessUnitId: businessUnitIdSchema.optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
});
