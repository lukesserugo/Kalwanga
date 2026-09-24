import {
  bulkDeleteSchema,
  categoryQuerySchema,
  categoryWithProductsQuerySchema,
  createCategorySchema,
  updateCategorySchema,
  type BulkDeleteInput,
  type CategoryQueryInput,
  type CategoryWithProductsQueryInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "../schemas/category";

export class CategoryValidation {
  static validateCreateCategory(data: unknown): CreateCategoryInput {
    return createCategorySchema.parse(data);
  }
  static validateUpdateCategory(data: unknown): UpdateCategoryInput {
    return updateCategorySchema.parse(data);
  }
  static validateBulkDelete(data: unknown): BulkDeleteInput {
    return bulkDeleteSchema.parse(data);
  }
  static validateCategoryQuery(data: unknown): CategoryQueryInput {
    return categoryQuerySchema.parse(data);
  }
  static validateCategoryWithProductsQuery(
    data: unknown,
  ): CategoryWithProductsQueryInput {
    return categoryWithProductsQuerySchema.parse(data);
  }
}
