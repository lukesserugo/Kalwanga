import { z } from "zod";
import { businessUnitIdSchema, orderIdSchema, productIdSchema } from "../helpers";

const orderStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'ON_HOLD',
]);

const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: productIdSchema,
      variantId: z.string().optional(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      notes: z.string().optional(),
    }),
  ),
  customerId: z.string().optional(),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).optional(),
  notes: z.string().optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  expectedDeliveryDate: z.string().optional(),
  shippingAddress: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentTerms: z.string().optional(),
  priority: priorityEnum.optional(),
});

export const updateOrderSchema = z.object({
  status: orderStatusEnum.optional(),
  notes: z.string().optional(),
  priority: priorityEnum.optional(),
  shippingAddress: z.string().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
  notes: z.string().optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(1),
});

export const addOrderItemSchema = z.object({
  productId: productIdSchema,
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  notes: z.string().optional(),
});

export const updateOrderItemSchema = z.object({
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  notes: z.string().optional(),
});

export const bulkUpdateOrderStatusSchema = z.object({
  orderIds: z.array(orderIdSchema).min(1),
  status: orderStatusEnum,
  notes: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemSchema>;
export type BulkUpdateOrderStatusInput = z.infer<typeof bulkUpdateOrderStatusSchema>;
