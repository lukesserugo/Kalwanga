import { z } from "zod";
import { paymentMethodSchema } from "../helpers";

export const createPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: paymentMethodSchema,
  saleId: z.string().optional(),
  orderId: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  gatewayId: z.string().optional(),
  customerId: z.string().optional(),
  source: z.string().optional(),
  currency: z.string().optional(),
  tipAmount: z.number().min(0).optional(),
  description: z.string().optional(),
  cardNonce: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
