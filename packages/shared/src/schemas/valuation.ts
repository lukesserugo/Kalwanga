import { z } from "zod";
import { categoryIdSchema } from "../helpers.js";

export const valuationQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  categoryId: categoryIdSchema.optional(),
  method: z
    .enum(['FIFO', 'LIFO', 'WEIGHTED_AVERAGE'])
    .default('WEIGHTED_AVERAGE'),
});
