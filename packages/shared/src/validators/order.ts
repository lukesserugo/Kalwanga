import {
  addOrderItemSchema,
  bulkUpdateOrderStatusSchema,
  cancelOrderSchema,
  createOrderSchema,
  updateOrderItemSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  type AddOrderItemInput,
  type BulkUpdateOrderStatusInput,
  type CancelOrderInput,
  type CreateOrderInput,
  type UpdateOrderInput,
  type UpdateOrderItemInput,
  type UpdateOrderStatusInput,
} from "../schemas/order";

export class OrderValidation {
  static validateCreateOrder(data: unknown): CreateOrderInput {
    return createOrderSchema.parse(data);
  }
  static validateUpdateOrder(data: unknown): UpdateOrderInput {
    return updateOrderSchema.parse(data);
  }
  static validateUpdateOrderStatus(data: unknown): UpdateOrderStatusInput {
    return updateOrderStatusSchema.parse(data);
  }
  static validateCancelOrder(data: unknown): CancelOrderInput {
    return cancelOrderSchema.parse(data);
  }
  static validateAddOrderItem(data: unknown): AddOrderItemInput {
    return addOrderItemSchema.parse(data);
  }
  static validateUpdateOrderItem(data: unknown): UpdateOrderItemInput {
    return updateOrderItemSchema.parse(data);
  }
  static validateBulkUpdateOrderStatus(
    data: unknown,
  ): BulkUpdateOrderStatusInput {
    return bulkUpdateOrderStatusSchema.parse(data);
  }
}
