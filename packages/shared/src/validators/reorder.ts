import {
  createReorderSchema,
  type CreateReorderInput,
} from "../../../shared/src/schemas/reorder";

export class ReorderValidation {
  static validateCreateReorder(data: unknown): CreateReorderInput {
    return createReorderSchema.parse(data);
  }
}
