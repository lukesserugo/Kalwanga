import { z } from "zod";
import { productIdSchema, supplierIdSchema } from "../helpers";

export const createReorderSchema = z.object({
  productId: productIdSchema,
  quantity: z.number().int().positive().optional(),
  supplierId: supplierIdSchema.optional(),
  notes: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

export type CreateReorderInput = z.infer<typeof createReorderSchema>;
