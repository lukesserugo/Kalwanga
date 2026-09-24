import { z } from "zod";

export const startShiftSchema = z.object({
  cashRegisterId: z.string().min(1),
  startingBalance: z.number().min(0),
  notes: z.string().optional(),
});

export const endShiftSchema = z.object({
  endingBalance: z.number().min(0),
  notes: z.string().optional(),
});
