import { z } from "zod";

export const payPalCaptureSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

export const flutterwaveVirtualAccountSchema = z.object({
  email: z.string().email('Valid email is required'),
  amount: z.number().positive('Amount must be positive').optional(),
  currency: z.string().optional(),
  customerName: z.string().optional(),
});

export const paystackVerifySchema = z.object({
  reference: z.string().min(1, 'Reference is required'),
});

export const squarePaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  cardNonce: z.string().min(1, 'Card nonce is required'),
  currency: z.string().optional(),
  customerId: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const squareCustomerSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
});

export type PayPalCaptureInput = z.infer<typeof payPalCaptureSchema>;
export type FlutterwaveVirtualAccountInput = z.infer<
  typeof flutterwaveVirtualAccountSchema
>;
export type PaystackVerifyInput = z.infer<typeof paystackVerifySchema>;
export type SquarePaymentInput = z.infer<typeof squarePaymentSchema>;
export type SquareCustomerInput = z.infer<typeof squareCustomerSchema>;
