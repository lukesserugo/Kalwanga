import { z } from "zod";

export const stockCountSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  expectedItems: z.number().min(0).default(0),
});

export const updateStockCountSchema = stockCountSchema.partial();

export const completeStockCountSchema = z.object({
  countedItems: z.record(z.string(), z.number()),
  notes: z.string().optional(),
});
