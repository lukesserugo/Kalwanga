import {
  bulkCreateProductsSchema,
  bulkDeleteProductsSchema,
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "../schemas/product";

export class ProductValidation {
  static validateCreateProduct(data: unknown): CreateProductInput {
    return createProductSchema.parse(data);
  }
  static validateUpdateProduct(data: unknown): UpdateProductInput {
    return updateProductSchema.parse(data);
  }
  static validateBulkCreateProducts(data: unknown) {
    return bulkCreateProductsSchema.parse(data);
  }
  static validateBulkDeleteProducts(data: unknown) {
    return bulkDeleteProductsSchema.parse(data);
  }
}
