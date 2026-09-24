import { z } from "zod";
import { businessUnitIdSchema, productIdSchema, supplierIdSchema } from "../helpers";

export const createPurchaseOrderSchema = z.object({
  supplierId: supplierIdSchema,
  items: z
    .array(
      z.object({
        productId: productIdSchema,
        variantId: z.string().optional(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
      }),
    )
    .min(1),
  notes: z.string().optional(),
  expectedDelivery: z.string().datetime().optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

export const receivePurchaseOrderSchema = z.object({
  receivedQuantities: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
