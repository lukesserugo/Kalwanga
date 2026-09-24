import { z } from "zod";
import {
  businessUnitIdSchema,
  paymentMethodSchema,
  productIdSchema,
} from "../helpers";

export const createSaleSchema = z.object({
  items: z.array(
    z.object({
      productId: productIdSchema,
      variantId: z.string().optional(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      notes: z.string().optional(),
    }),
  ),
  customerId: z.string().optional(),
  paymentMethod: paymentMethodSchema,
  paidAmount: z.number().nonnegative('Paid amount must be zero or greater'),
  discount: z.number().min(0).default(0),
  taxRate: z.number().min(0).optional(),
  notes: z.string().optional(),
  businessUnitId: businessUnitIdSchema,
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  tipAmount: z.number().min(0).optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
