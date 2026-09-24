import { z } from "zod";

export const createBusinessUnitSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  companyId: z.string().min(1),
  isActive: z.boolean().optional(),
  type: z.enum(['HEADQUARTERS', 'BRANCH', 'WAREHOUSE', 'STORE']).optional(),
});

export const updateBusinessUnitSchema = createBusinessUnitSchema.partial();
