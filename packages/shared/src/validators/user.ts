import {
  bulkActionSchema,
  createUserSchema,
  updatePermissionsSchema,
  updateUserRoleSchema,
  updateUserSchema,
  userSearchSchema,
  type CreateUserInput,
  type UpdatePermissionsInput,
  type UpdateUserInput,
} from "../schemas/user";

export class UserValidation {
  static validateCreateUser(data: unknown): CreateUserInput {
    return createUserSchema.parse(data);
  }
  static validateUpdateUser(data: unknown): UpdateUserInput {
    return updateUserSchema.parse(data);
  }
  static validateUpdateUserRole(data: unknown) {
    return updateUserRoleSchema.parse(data);
  }
  static validateUpdatePermissions(data: unknown): UpdatePermissionsInput {
    return updatePermissionsSchema.parse(data);
  }
  static validateBulkAction(data: unknown) {
    return bulkActionSchema.parse(data);
  }
  static validateUserSearch(data: unknown) {
    return userSearchSchema.parse(data);
  }
}
