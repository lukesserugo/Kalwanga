import {
  createLocationSchema,
  listLocationsQuerySchema,
  updateLocationSchema,
  type CreateLocationInput,
  type ListLocationsQueryInput,
  type UpdateLocationInput,
} from "../schemas/location";

export class LocationValidation {
  static validateCreateLocation(data: unknown): CreateLocationInput {
    return createLocationSchema.parse(data);
  }
  static validateUpdateLocation(data: unknown): UpdateLocationInput {
    return updateLocationSchema.parse(data);
  }
  static validateListLocations(data: unknown): ListLocationsQueryInput {
    return listLocationsQuerySchema.parse(data);
  }
}
