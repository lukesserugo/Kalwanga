import { z } from "zod";
import { companyIdSchema } from "../helpers";

export const createCustomerSchema = z.object({
  email: z.string().email(),
  phoneNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  companyId: companyIdSchema,
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
