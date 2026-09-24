import { z } from "zod";
import { businessUnitIdSchema } from "../helpers";

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  role: z
    .enum([
      'SUPER_ADMIN',
      'ADMIN',
      'MANAGER',
      'EDITOR',
      'VIEWER',
      'EMPLOYEE',
      'CASHIER',
      'USER',
    ])
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const verify2FASchema = z.object({
  code: z.string().min(6, '2FA code must be at least 6 characters'),
});

export const authSchemas = {
  register: registerSchema,
  login: loginSchema,
  forgotPassword: forgotPasswordSchema,
  resetPassword: resetPasswordSchema,
  verifyEmail: verifyEmailSchema,
  resendVerification: resendVerificationSchema,
  verify2FA: verify2FASchema,
};

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
