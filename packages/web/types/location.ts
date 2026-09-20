// packages/web/types/location.ts

// ============================================
// LOCATION ENUMS
// ============================================
//
// Mirrors the Prisma `LocationType` enum in
// `packages/backend/prisma/schema.prisma`. If the backend enum ever
// changes, update both in the same commit.

export const LOCATION_TYPES = [
  'WAREHOUSE',
  'STORE',
  'BACKROOM',
  'DISTRIBUTION_CENTER',
  'STORE_FRONT',
  'IN_TRANSIT',
  'SUPPLIER',
  'OTHER',
] as const;

export type LocationType = typeof LOCATION_TYPES[number];

/**
 * Human-readable labels for the location type enum. Used in dropdowns,
 * badges, and anywhere a raw enum value would look wrong.
 */
export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  WAREHOUSE: 'Warehouse',
  STORE: 'Store',
  BACKROOM: 'Backroom',
  DISTRIBUTION_CENTER: 'Distribution Center',
  STORE_FRONT: 'Storefront',
  IN_TRANSIT: 'In Transit',
  SUPPLIER: 'Supplier',
  OTHER: 'Other',
};

/**
 * Type guard. Accepts anything; returns true only for a value that
 * exactly matches one of the enum members.
 */
export function isLocationType(value: unknown): value is LocationType {
  return (
    typeof value === 'string' &&
    (LOCATION_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Normalize an arbitrary string to a valid `LocationType`, falling
 * back to `'OTHER'` when the input doesn't match. Trims and uppercases
 * so `"warehouse"` and `" Warehouse "` both resolve correctly.
 */
export function normalizeLocationType(value: unknown): LocationType {
  if (typeof value !== 'string') return 'OTHER';
  const cleaned = value.trim().toUpperCase();
  return isLocationType(cleaned) ? cleaned : 'OTHER';
}

// ============================================
// LOCATION MODEL
// ============================================

/**
 * The shape returned by `GET /locations` (and `GET /locations/:id`).
 *
 * Mirrors the Prisma `Location` row exactly — no derived fields, no
 * UI conveniences. If a value can be `null` in the database, it is
 * `null` here too. Optionality is deliberate: `code` and `description`
 * are nullable columns, not optional keys.
 */
export interface Location {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  type: LocationType;
  isActive: boolean;
  isDefault: boolean;
  businessUnitId: string;

  /**
   * Free-form JSON blob — map coordinates, opening hours, external
   * IDs, anything. The backend accepts `Record<string, unknown>`.
   */
  metadata: Record<string, unknown> | null;

  createdAt: string;
  updatedAt: string;

  /**
   * Soft-delete timestamp. `null` means the row is live. The list
   * endpoint excludes soft-deleted rows, so this is only non-null
   * if you fetch a specific deleted row directly.
   */
  deletedAt: string | null;
  deletedBy: string | null;
}

// ============================================
// INPUT TYPES
// ============================================

/**
 * Body for `POST /locations`.
 *
 * `businessUnitId` is technically optional here because the backend
 * resolves it from the request context (header, query, or user session).
 * Send it explicitly if you want to override the default resolution.
 */
export interface CreateLocationInput {
  name: string;
  code?: string;
  description?: string;
  address?: string;
  phone?: string;
  type?: LocationType | string;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
  businessUnitId?: string;
}

/**
 * Body for `PATCH /locations/:id`.
 *
 * All fields optional. `isActive` is only settable on update, not on
 * create — a freshly created location is always active.
 */
export interface UpdateLocationInput {
  name?: string;
  code?: string;
  description?: string;
  address?: string;
  phone?: string;
  type?: LocationType | string;
  isDefault?: boolean;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  businessUnitId?: string;
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Query parameters accepted by `GET /locations`.
 */
export interface ListLocationsQuery {
  businessUnitId?: string;
  includeInactive?: boolean;
}

// ============================================
// RESPONSE ENVELOPES
// ============================================

/**
 * Standard backend envelope. Every `/locations` endpoint responds
 * with `{ success: true, data, count? }` on success, or
 * `{ success: false, message }` on failure.
 */
export interface LocationsListResponse {
  success: boolean;
  data: Location[];
  count: number;
}

export interface LocationResponse {
  success: boolean;
  data: Location;
  message?: string;
}

export interface LocationDeleteResponse {
  success: boolean;
  message: string;
}

// ============================================
// UI HELPERS
// ============================================

/**
 * Option shape for dropdowns. A thin projection of `Location` that
 * keeps only the fields a `<select>` needs.
 */
export interface LocationOption {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  type: LocationType;
}

/**
 * Project a `Location` down to a `LocationOption`.
 */
export function toLocationOption(location: Location): LocationOption {
  return {
    id: location.id,
    name: location.name,
    isDefault: location.isDefault,
    isActive: location.isActive,
    type: location.type,
  };
}

/**
 * Human-readable label for a location, for use in selects and badges.
 * Prefers `code` when present: `"Main Warehouse (WH-01)"`.
 */
export function formatLocationLabel(location: Location): string {
  const code = location.code ? ` (${location.code})` : '';
  return `${location.name}${code}`;
}

/**
 * Human-readable label for a `LocationType` enum value.
 */
export function formatLocationType(type: LocationType | string): string {
  if (isLocationType(type)) return LOCATION_TYPE_LABELS[type];
  // Tolerate unknown strings — capitalize and de-underscore.
  return String(type).replace(/_/g, ' ').toLowerCase();
}

// ============================================
// FILTER TYPES
// ============================================

/**
 * Client-side filters used on the Locations admin page. Every field
 * is optional — combine them as needed. Used by the local filter
 * pipeline; not sent to the API as-is (see `ListLocationsQuery` for
 * the server-side filter shape).
 */
export interface LocationFilters {
  search: string;
  type: LocationType | 'all';
  isActive: 'all' | 'yes' | 'no';
  isDefault: 'all' | 'yes' | 'no';
}

export const DEFAULT_LOCATION_FILTERS: LocationFilters = {
  search: '',
  type: 'all',
  isActive: 'all',
  isDefault: 'all',
};

/**
 * Apply `LocationFilters` to a list of locations.
 */
export function filterLocations(
  locations: Location[],
  filters: LocationFilters
): Location[] {
  return locations.filter((loc) => {
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      const haystack = `${loc.name} ${loc.code || ''} ${
        loc.address || ''
      }`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.type !== 'all' && loc.type !== filters.type) return false;
    if (filters.isActive === 'yes' && !loc.isActive) return false;
    if (filters.isActive === 'no' && loc.isActive) return false;
    if (filters.isDefault === 'yes' && !loc.isDefault) return false;
    if (filters.isDefault === 'no' && loc.isDefault) return false;
    return true;
  });
}
