import { z } from "zod";
import { paymentMethodSchema } from "../helpers";

export const createCheckoutSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  customerId: z.string().optional(),
  paymentMethod: paymentMethodSchema,
  paidAmount: z.number().nonnegative('Paid amount must be zero or greater'),
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  notes: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  applyLoyaltyPoints: z.boolean().default(false),
  businessUnitId: z.string().optional(),
  customerEmail: z.string().email('Invalid email format').optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),
});

export const getCheckoutsSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('saleDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const getCheckoutHistorySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

export const updateCheckoutSchema = z.object({
  status: z
    .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'VOIDED'])
    .optional(),
  paymentStatus: z
    .enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL'])
    .optional(),
  notes: z.string().optional(),
});

export const processPaymentSchema = z.object({
  paymentMethod: paymentMethodSchema,
  amount: z.number().nonnegative('Amount must be zero or greater'),
  paymentDetails: z.record(z.string(), z.any()).optional(),
});

export const cancelCheckoutSchema = z.object({
  reason: z.string().optional(),
});

export const voidCheckoutSchema = z.object({
  reason: z.string().optional(),
});

export const addCheckoutItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
});

export const updateCheckoutItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be positive'),
});

export const applyDiscountSchema = z.object({
  code: z.string().min(1, 'Discount code is required'),
});

export const emailReceiptSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
});

export const exportCheckoutsSchema = z.object({
  format: z.enum(['csv', 'json', 'excel', 'pdf']).optional().default('csv'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  businessUnitId: z.string().optional(),
  status: z.string().optional(),
});

export const getCheckoutStatsSchema = z.object({
  range: z
    .enum(['today', 'week', 'month', 'quarter', 'year', 'custom'])
    .optional()
    .default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  businessUnitId: z.string().optional(),
});

export const updateCheckoutSettingsSchema = z.object({
  allowPartialPayment: z.boolean().optional(),
  requireCustomer: z.boolean().optional(),
  requireSignature: z.boolean().optional(),
  maxDiscount: z.number().min(0).optional(),
  taxInclusive: z.boolean().optional(),
  defaultPaymentMethod: paymentMethodSchema.optional(),
  receiptFooter: z.string().optional(),
  loyaltyPointsEnabled: z.boolean().optional(),
  pointsPerDollar: z.number().min(0).optional(),
  allowGuestCheckout: z.boolean().optional(),
  maxCartItems: z.number().int().min(1).optional(),
  cartExpiryHours: z.number().int().min(1).optional(),
  discountEnabled: z.boolean().optional(),
  maxDiscountPercentage: z.number().min(0).max(100).optional(),
  autoApplyPromotions: z.boolean().optional(),
  reserveStockOnAdd: z.boolean().optional(),
  reserveStockMinutes: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  freeShippingThreshold: z.number().min(0).optional(),
  shippingCost: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notifyOnAbandonedCart: z.boolean().optional(),
  abandonedCartHours: z.number().int().min(1).optional(),
  currencyCode: z.string().optional(),
  currencySymbol: z.string().optional(),
  showStockBadge: z.boolean().optional(),
  showVariantImages: z.boolean().optional(),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type GetCheckoutsInput = z.infer<typeof getCheckoutsSchema>;
export type GetCheckoutHistoryInput = z.infer<typeof getCheckoutHistorySchema>;
export type UpdateCheckoutInput = z.infer<typeof updateCheckoutSchema>;
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
export type CancelCheckoutInput = z.infer<typeof cancelCheckoutSchema>;
export type VoidCheckoutInput = z.infer<typeof voidCheckoutSchema>;
export type AddCheckoutItemInput = z.infer<typeof addCheckoutItemSchema>;
export type UpdateCheckoutItemInput = z.infer<typeof updateCheckoutItemSchema>;
export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>;
export type EmailReceiptInput = z.infer<typeof emailReceiptSchema>;
export type ExportCheckoutsInput = z.infer<typeof exportCheckoutsSchema>;
export type GetCheckoutStatsInput = z.infer<typeof getCheckoutStatsSchema>;
export type UpdateCheckoutSettingsInput = z.infer<typeof updateCheckoutSettingsSchema>;
