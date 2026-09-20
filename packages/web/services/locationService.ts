// packages/web/services/locationService.ts

import { api } from './api';
import {
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  isLocationType,
  normalizeLocationType,
  type Location,
  type LocationType,
  type LocationOption,
  type CreateLocationInput,
  type UpdateLocationInput,
  type ListLocationsQuery,
  type LocationsListResponse,
  type LocationResponse,
  type LocationDeleteResponse,
} from '../types/location';

// Re-export the canonical names so callers that imported them
// from this service keep compiling.
export {
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  isLocationType,
  normalizeLocationType,
};
export type {
  Location,
  LocationType,
  LocationOption,
  CreateLocationInput,
  UpdateLocationInput,
  ListLocationsQuery,
};

// ============================================
// BUSINESS UNIT RESOLUTION
// ============================================

/**
 * Sentinel values that the app occasionally stores in localStorage
 * when a real BU id hasn't been resolved yet. Treating these as
 * "no BU" prevents the backend from receiving `businessUnitId=default`.
 */
const SENTINEL_BU_IDS = new Set([
  'default',
  'default-business-unit',
  'undefined',
  'null',
  '',
]);

export function isValidBusinessUnitId(id?: string | null): id is string {
  return !!id && !SENTINEL_BU_IDS.has(id);
}

function readBusinessUnitIdFromStorage(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored =
      localStorage.getItem('selectedBusinessUnitId') ||
      localStorage.getItem('businessUnitId');
    if (isValidBusinessUnitId(stored)) return stored ?? undefined;
  } catch {
    /* ignore */
  }
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const fromUser =
        user?.businessUnitId || user?.businessUnits?.[0]?.businessUnitId;
      if (isValidBusinessUnitId(fromUser)) return fromUser;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Resolve the BU id for an API call. If the caller passed an explicit
 * value, use it (unless it's a sentinel). Otherwise fall back to
 * localStorage. Returns `undefined` when nothing valid is available —
 * callers should treat that as "no BU context" and either skip the
 * call or surface a user-facing error.
 *
 * Exported so pages can reuse this without duplicating the logic.
 */
export function resolveBusinessUnitId(explicit?: string): string | undefined {
  if (isValidBusinessUnitId(explicit)) return explicit;
  return readBusinessUnitIdFromStorage();
}

// ============================================
// RESPONSE UNWRAPPING
// ============================================
//
// The backend wraps every response in `{ success, data }`. The api
// client (`services/api.ts`) already unwraps the outermost envelope
// for most endpoints, but not always — treat it defensively so both
// shapes work.

function unwrapList(raw: any): Location[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  if (Array.isArray(raw.data)) return raw.data;
  if (raw.success && Array.isArray(raw.data)) return raw.data;
  if (raw.data?.items && Array.isArray(raw.data.items)) return raw.data.items;
  if (Array.isArray(raw.items)) return raw.items;

  return [];
}

function unwrapOne(raw: any): Location | null {
  if (!raw) return null;
  if (raw.data && typeof raw.data === 'object' && raw.data.id) return raw.data;
  if (typeof raw === 'object' && raw.id) return raw as Location;
  return null;
}

/**
 * Unwrap an arbitrary `{ data }` envelope. Used by the newer endpoints
 * (settings, reports, import) whose payloads aren't `Location`-shaped.
 */
function unwrapData<T>(raw: any): T | null {
  if (raw == null) return null;
  if (raw.data !== undefined) return raw.data as T;
  return raw as T;
}

// ============================================
// ERROR HANDLING
// ============================================

function logAndRethrow(scope: string, err: unknown): never {
  console.warn(`❌ locationService.${scope} failed:`, err);
  throw err;
}

// ============================================
// TYPES — settings, reports, import/export
// ============================================

export interface LocationSettings {
  defaultLocationId: string | null;
  enabledTypes: LocationType[];
  allowNegativeStock: boolean;
  reserveStockOnAdd: boolean;
  defaultReorderPoint: number;
  defaultReorderQuantity: number;
  requireTransferReference: boolean;
  autoReceiveTransfers: boolean;
  allowCrossBusinessUnitTransfers: boolean;
  showCodeOnCards: boolean;
  showInactiveInLists: boolean;
}

export interface LocationReportRow {
  locationId: string;
  locationName: string;
  type: LocationType;
  code?: string | null;
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface ImportLocationRow {
  name: string;
  code?: string;
  type?: string;
  description?: string;
  address?: string;
  phone?: string;
  isDefault?: boolean;
}

export interface ImportResult {
  created: number;
  failed: number;
  errors: string[];
}

export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  includeInactive?: boolean;
  includeInventory?: boolean;
}

// ============================================
// SERVICE
// ============================================

export const locationService = {
  // ─────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────

  /**
   * List locations for a business unit. Falls back to localStorage
   * for the BU id if none is passed.
   */
  async list(businessUnitId?: string): Promise<Location[]> {
    try {
      const bu = resolveBusinessUnitId(businessUnitId);
      const params: Record<string, string> = {};
      if (bu) params.businessUnitId = bu;

      const raw = await api.get<any>('/locations', { params });
      return unwrapList(raw);
    } catch (err) {
      // List failures are non-fatal for the UI — return empty so a
      // transient error doesn't blank an entire page. Callers that
      // care about the error should use `listStrict`.
      console.warn('❌ locationService.list failed:', err);
      return [];
    }
  },

  /**
   * Same as `list`, but propagates errors instead of swallowing them.
   * Use when you need to distinguish "no locations" from "request
   * failed" — e.g. to show an error state rather than an empty list.
   */
  async listStrict(businessUnitId?: string): Promise<Location[]> {
    const bu = resolveBusinessUnitId(businessUnitId);
    const params: Record<string, string> = {};
    if (bu) params.businessUnitId = bu;

    const raw = await api.get<any>('/locations', { params });
    return unwrapList(raw);
  },

  /**
   * Fetch a single location by id. Returns `null` when the backend
   * responds 404 (deleted or nonexistent).
   */
  async getById(
    id: string,
    businessUnitId?: string
  ): Promise<Location | null> {
    if (!id) return null;
    try {
      const bu = resolveBusinessUnitId(businessUnitId);
      const params: Record<string, string> = {};
      if (bu) params.businessUnitId = bu;

      const raw = await api.get<any>(`/locations/${id}`, { params });
      return unwrapOne(raw);
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      console.warn('❌ locationService.getById failed:', err);
      return null;
    }
  },

  async create(
    data: CreateLocationInput,
    businessUnitId?: string
  ): Promise<Location> {
    const bu = resolveBusinessUnitId(businessUnitId);
    const payload: CreateLocationInput = {
      ...data,
      ...(bu ? { businessUnitId: bu } : {}),
    };
    const raw = await api.post<any>('/locations', payload);
    const unwrapped = unwrapOne(raw);
    if (!unwrapped) {
      throw new Error('Location create returned an invalid response');
    }
    return unwrapped;
  },

  async update(
    id: string,
    data: UpdateLocationInput,
    businessUnitId?: string
  ): Promise<Location> {
    const bu = resolveBusinessUnitId(businessUnitId);
    const payload: UpdateLocationInput = {
      ...data,
      ...(bu ? { businessUnitId: bu } : {}),
    };
    const raw = await api.patch<any>(`/locations/${id}`, payload);
    const unwrapped = unwrapOne(raw);
    if (!unwrapped) {
      throw new Error('Location update returned an invalid response');
    }
    return unwrapped;
  },

  async remove(id: string, businessUnitId?: string): Promise<void> {
    const bu = resolveBusinessUnitId(businessUnitId);
    const params: Record<string, string> = {};
    if (bu) params.businessUnitId = bu;
    await api.delete(`/locations/${id}`, { params });
  },

  // ─────────────────────────────────────────
  // SETTINGS
  // ─────────────────────────────────────────

  /**
   * Fetch the settings for a business unit. Returns `null` when the
   * BU has no saved settings yet — the caller should apply defaults.
   */
  async getSettings(businessUnitId?: string): Promise<LocationSettings | null> {
    const bu = resolveBusinessUnitId(businessUnitId);
    if (!bu) return null;

    try {
      const raw = await api.get<any>('/locations/settings', {
        params: { businessUnitId: bu },
      });
      return unwrapData<LocationSettings>(raw);
    } catch (err: any) {
      // 404 = no settings row yet. That's not an error.
      if (err?.response?.status === 404) return null;
      return logAndRethrow('getSettings', err);
    }
  },

  async updateSettings(
    businessUnitId: string,
    data: Partial<LocationSettings>
  ): Promise<LocationSettings> {
    const bu = resolveBusinessUnitId(businessUnitId);
    if (!bu) throw new Error('A valid business unit is required');

    const raw = await api.put<any>('/locations/settings', {
      businessUnitId: bu,
      ...data,
    });
    const unwrapped = unwrapData<LocationSettings>(raw);
    if (!unwrapped) {
      throw new Error('Settings update returned an invalid response');
    }
    return unwrapped;
  },

  // ─────────────────────────────────────────
  // REPORTS
  // ─────────────────────────────────────────

  /**
   * Per-location aggregate: item counts, total quantity, total value,
   * low-stock count. Powers the Reports page.
   */
  async getReports(businessUnitId?: string): Promise<LocationReportRow[]> {
    const bu = resolveBusinessUnitId(businessUnitId);
    if (!bu) return [];

    try {
      const raw = await api.get<any>('/locations/reports', {
        params: { businessUnitId: bu },
      });
      const list = unwrapData<LocationReportRow[]>(raw);
      return Array.isArray(list) ? list : [];
    } catch (err) {
      console.warn('❌ locationService.getReports failed:', err);
      return [];
    }
  },

  // ─────────────────────────────────────────
  // IMPORT
  // ─────────────────────────────────────────

  /**
   * Bulk-create locations. The backend is responsible for per-row
   * validation and returns a summary so the wizard can render results.
   */
  async importMany(
    rows: ImportLocationRow[],
    businessUnitId?: string
  ): Promise<ImportResult> {
    const bu = resolveBusinessUnitId(businessUnitId);
    if (!bu) throw new Error('A valid business unit is required');
    if (!Array.isArray(rows) || rows.length === 0) {
      return { created: 0, failed: 0, errors: [] };
    }

    const raw = await api.post<any>('/locations/import', {
      businessUnitId: bu,
      rows,
    });
    const result = unwrapData<ImportResult>(raw);
    return (
      result ?? {
        created: 0,
        failed: rows.length,
        errors: ['Server returned an unrecognized response'],
      }
    );
  },

  // ─────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────

  /**
   * Download locations as a file. Returns the raw `Blob` so the caller
   * can choose how to trigger the download (anchor click, File System
   * Access API, etc.).
   */
  async exportAll(
    businessUnitId: string,
    options: ExportOptions
  ): Promise<Blob> {
    const bu = resolveBusinessUnitId(businessUnitId);
    if (!bu) throw new Error('A valid business unit is required');

    const params: Record<string, string> = {
      businessUnitId: bu,
      format: options.format,
      includeInactive: options.includeInactive ? 'true' : 'false',
      includeInventory: options.includeInventory ? 'true' : 'false',
    };

    const response = await api.get<any>('/locations/export', {
      params,
      responseType: 'blob',
    });

    // Depending on the api client's interceptor chain, `response` may
    // arrive as a Blob directly or wrapped in an envelope. Normalize.
    if (response instanceof Blob) return response;
    if (response?.data instanceof Blob) return response.data;
    return new Blob([JSON.stringify(response)], { type: 'application/json' });
  },

  // ─────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────

  /**
   * Convenience for pages that need both settings and locations — the
   * settings page and the LocationSelector-style components. Fires
   * both requests in parallel and tolerates partial failure.
   */
  async getSettingsAndLocations(businessUnitId?: string): Promise<{
    settings: LocationSettings | null;
    locations: Location[];
  }> {
    const [settings, locations] = await Promise.all([
      this.getSettings(businessUnitId),
      this.list(businessUnitId),
    ]);
    return { settings, locations };
  },
};

export default locationService;
