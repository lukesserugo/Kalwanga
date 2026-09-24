import { z } from "zod";
import {
  businessUnitIdSchema,
  companyIdSchema,
  nullableUuidSchema,
  userIdSchema,
} from "../helpers";

const roleEnum = z.enum([
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'EDITOR',
  'VIEWER',
  'EMPLOYEE',
  'CASHIER',
  'USER',
]);

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().optional(),
  role: roleEnum,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessUnitId: nullableUuidSchema,
  clerkId: z.string().optional(),
  companyId: companyIdSchema.optional(),
  permissions: z.array(z.string()).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  businessUnitId: nullableUuidSchema,
  permissions: z.array(z.string()).optional(),
});

export const updateUserRoleSchema = z.object({
  role: roleEnum,
});

export const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

export const bulkActionSchema = z.object({
  ids: z.array(userIdSchema).min(1, 'At least one ID is required'),
});

export const userSearchSchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  search: z.string().optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  companyId: companyIdSchema.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;
