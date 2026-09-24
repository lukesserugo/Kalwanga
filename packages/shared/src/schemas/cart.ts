import { z } from "zod";
import {
  cartIdSchema,
  customerIdSchema,
  paymentMethodSchema,
  userIdSchema,
} from "../helpers";

export const addCartItemSchema = z.object({
  productId: z
    .string()
    .min(1, 'Product ID is required')
    .max(255, 'Product ID is too long')
    .refine(
      (val) => {
        const trimmed = val.trim();
        return trimmed.length > 0 && !trimmed.includes(' ');
      },
      { message: 'Invalid product ID format' },
    ),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive').default(1),
  notes: z.string().optional(),
});

export const addMultipleCartItemsSchema = z.object({
  items: z.array(addCartItemSchema).min(1),
});

export const updateCartItemQuantitySchema = z.object({
  quantity: z.number().int().min(0),
});

export const updateCartSettingsSchema = z.object({
  allowGuestCheckout: z.boolean().optional(),
  requireCustomerForReturn: z.boolean().optional(),
  maxCartItems: z.number().int().min(1).max(1000).optional(),
  cartExpiryHours: z.number().int().min(1).max(720).optional(),
  discountEnabled: z.boolean().optional(),
  maxDiscountPercentage: z.number().min(0).max(100).optional(),
  maxDiscountAmount: z.number().min(0).optional(),
  autoApplyPromotions: z.boolean().optional(),
  loyaltyPointsEnabled: z.boolean().optional(),
  pointsPerDollar: z.number().int().min(0).max(1000).optional(),
  minPointsForRedeem: z.number().int().min(0).optional(),
  maxPointsPerOrder: z.number().int().min(0).optional(),
  reserveStockOnAdd: z.boolean().optional(),
  reserveStockMinutes: z.number().int().min(0).max(1440).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  defaultPaymentMethod: paymentMethodSchema.optional(),
  allowPartialPayment: z.boolean().optional(),
  requireSignature: z.boolean().optional(),
  taxInclusive: z.boolean().optional(),
  freeShippingThreshold: z.number().min(0).optional(),
  shippingCost: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notifyOnAbandonedCart: z.boolean().optional(),
  abandonedCartHours: z.number().int().min(1).max(720).optional(),
  notifyOnLowStock: z.boolean().optional(),
  currencyCode: z.string().optional(),
  currencySymbol: z.string().optional(),
  showStockBadge: z.boolean().optional(),
  showVariantImages: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const applyCartDiscountSchema = z.object({
  discount: z.number().min(0),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().default('FIXED'),
});

export const applyCartPromotionSchema = z.object({
  promotionCode: z.string().min(1),
});

export const applyLoyaltyPointsSchema = z.object({
  customerId: customerIdSchema,
  points: z.number().int().positive(),
});

export const associateCustomerSchema = z.object({
  customerId: customerIdSchema,
});

export const updateCartNotesSchema = z.object({
  notes: z.string().optional(),
});

export const cartCheckoutSchema = z.object({
  cartId: cartIdSchema,
  customerId: z.string().optional().nullable(),
  paymentMethod: paymentMethodSchema,
  paidAmount: z.number().nonnegative('Paid amount must be zero or greater'),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  notes: z.string().optional(),
  tipAmount: z.number().min(0).optional(),
  cardNonce: z.string().optional(),
  discount: z.number().nonnegative().optional(),
  applyLoyaltyPoints: z.boolean().optional(),
});

export const transferCartSchema = z.object({
  fromUserId: userIdSchema,
  toUserId: userIdSchema,
});

export const splitCartSchema = z.object({
  items: z
    .array(
      z.object({
        cartItemId: z.string().min(1),
        quantity: z.number().int().positive(),
        targetUserId: userIdSchema,
      }),
    )
    .min(1),
});

export const exportAnalyticsSchema = z.object({
  format: z.enum(['csv', 'excel', 'json', 'pdf']).default('csv'),
  metrics: z.array(z.string()).default([]),
  dateRange: z
    .enum(['today', 'yesterday', 'week', 'month', 'quarter', 'year', 'custom'])
    .default('week'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeCharts: z.boolean().default(false),
  includeSummary: z.boolean().default(true),
  includeDetailedData: z.boolean().default(true),
});

export const exportHistorySchema = z.object({
  format: z.enum(['csv', 'excel', 'json', 'pdf']).default('csv'),
  dateRange: z
    .enum([
      'today',
      'yesterday',
      'week',
      'month',
      'quarter',
      'year',
      'all',
    ])
    .default('week'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  includeItems: z.boolean().default(true),
});

export const exportAbandonedSchema = z.object({
  format: z.enum(['csv', 'excel', 'json', 'pdf']).default('csv'),
  hours: z.number().int().min(1).max(720).default(24),
  minValue: z.number().min(0).optional(),
  status: z.string().optional(),
  includeCustomerDetails: z.boolean().default(true),
});

export const abandonedCartsQuerySchema = z.object({
  hours: z.string().transform(Number).optional().default('24'),
  minValue: z.string().transform(Number).optional(),
  status: z.string().optional(),
  page: z.string().transform(Number).optional().default('1'),
  limit: z.string().transform(Number).optional().default('20'),
  search: z.string().optional(),
  dateRange: z.string().optional(),
});

export const recoverCartSchema = z.object({
  cartId: cartIdSchema,
  notifyUser: z.boolean().default(true),
  message: z.string().optional(),
});

export const sendReminderSchema = z.object({
  cartId: cartIdSchema,
  message: z.string().optional(),
  email: z.string().email().optional(),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type AddMultipleCartItemsInput = z.infer<typeof addMultipleCartItemsSchema>;
export type UpdateCartItemQuantityInput = z.infer<typeof updateCartItemQuantitySchema>;
export type ApplyCartDiscountInput = z.infer<typeof applyCartDiscountSchema>;
export type ApplyCartPromotionInput = z.infer<typeof applyCartPromotionSchema>;
export type ApplyLoyaltyPointsInput = z.infer<typeof applyLoyaltyPointsSchema>;
export type AssociateCustomerInput = z.infer<typeof associateCustomerSchema>;
export type UpdateCartNotesInput = z.infer<typeof updateCartNotesSchema>;
export type CartCheckoutInput = z.infer<typeof cartCheckoutSchema>;
export type TransferCartInput = z.infer<typeof transferCartSchema>;
export type SplitCartInput = z.infer<typeof splitCartSchema>;
export type ExportAnalyticsInput = z.infer<typeof exportAnalyticsSchema>;
export type ExportHistoryInput = z.infer<typeof exportHistorySchema>;
export type ExportAbandonedInput = z.infer<typeof exportAbandonedSchema>;
export type AbandonedCartsQueryInput = z.infer<typeof abandonedCartsQuerySchema>;
export type RecoverCartInput = z.infer<typeof recoverCartSchema>;
export type SendReminderInput = z.infer<typeof sendReminderSchema>;
