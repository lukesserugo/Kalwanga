import {
  bulkCreateVariantsSchema,
  createVariantSchema,
  updateVariantSchema,
  updateVariantStockSchema,
  variantQuerySchema,
  type BulkCreateVariantsInput,
  type CreateVariantInput,
  type UpdateVariantInput,
  type UpdateVariantStockInput,
  type VariantQueryInput,
} from "../schemas/product";

export class VariantValidation {
  static validateCreateVariant(data: unknown): CreateVariantInput {
    return createVariantSchema.parse(data);
  }
  static validateUpdateVariant(data: unknown): UpdateVariantInput {
    return updateVariantSchema.parse(data);
  }
  static validateBulkCreateVariants(data: unknown): BulkCreateVariantsInput {
    return bulkCreateVariantsSchema.parse(data);
  }
  static validateUpdateVariantStock(data: unknown): UpdateVariantStockInput {
    return updateVariantStockSchema.parse(data);
  }
  static validateVariantQuery(data: unknown): VariantQueryInput {
    return variantQuerySchema.parse(data);
  }
}
