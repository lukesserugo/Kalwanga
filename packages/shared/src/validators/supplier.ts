import {
  createSupplierSchema,
  updateSupplierSchema,
  type CreateSupplierInput,
} from "../schemas/supplier";

export class SupplierValidation {
  static validateCreateSupplier(data: unknown): CreateSupplierInput {
    return createSupplierSchema.parse(data);
  }
  static validateUpdateSupplier(data: unknown) {
    return updateSupplierSchema.parse(data);
  }
}
