import {
  createReorderSchema,
  type CreateReorderInput,
} from "../schemas/reorder";

export class ReorderValidation {
  static validateCreateReorder(data: unknown): CreateReorderInput {
    return createReorderSchema.parse(data);
  }
}
