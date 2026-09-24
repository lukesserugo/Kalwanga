import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  contactPerson: z.string().optional().nullable(),
  email: z.string().email('Invalid email format').optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  website: z.string().url('Invalid URL format').optional().nullable(),
  notes: z.string().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  isActive: z.boolean().default(true),
  companyId: z.string().min(1, 'Company ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  paymentTerms: z.string().optional().nullable(),
  deliveryTerms: z.string().optional().nullable(),
  creditLimit: z.number().min(0).optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
