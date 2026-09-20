// D:\Projects\Kalwanga\packages\web\services\inventoryService.ts

import { api } from './api';

import type {
  Inventory,
  InventoryStats,
  InventoryTransaction,
  InventorySummary,
  InventoryValue,
  InventoryListResponse,
  InventoryItemResponse as CanonicalInventoryItemResponse,
  InventorySearchParams,
  InventoryTransactionType,
  InventoryStatus,
  InventoryIssueStatus,
  InventoryTransferStatus,
  CreateInventoryItemData,
  UpdateInventoryItemData,
  AdjustStockData,
  TransferStockData,
  IssueItemData as CanonicalIssueItemData,
  RestockItemData as CanonicalRestockItemData,
  ReturnItemData as CanonicalReturnItemData,
  BulkUpdateResult as CanonicalBulkUpdateResult,
  ExportFormat as CanonicalExportFormat,
} from '../types/inventory';

export type {
  Inventory,
  InventoryStats,
  InventoryTransaction,
  InventorySummary,
  InventoryValue,
  InventoryListResponse,
  InventorySearchParams,
  InventoryTransactionType,
  InventoryStatus,
  InventoryIssueStatus,
  InventoryTransferStatus,
};

export interface FlatInventory
  extends Omit<Inventory, 'reorderPoint' | 'reorderQuantity'> {
  name?: string;
  sku?: string;
  barcode?: string | null;
  unitPrice?: number;
  costPrice?: number;
  category?: string;
  categoryId?: string | null;
  supplier?: string | null;
  supplierId?: string | null;
  hasProduct?: boolean;
  images?: string[];
  description?: string | null;
  weight?: number;
  taxRate?: number;
  tags?: string[];
  maxStock?: number;
  minStock?: number;
  stock?: number;
  price?: number;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  reorderPoint?: number;
  reorderQuantity?: number;
  /** The Inventory row's own primary key (never rewritten). */
  inventoryId?: string;
}

export interface InventoryItemResponse extends FlatInventory {}

export interface InventoryItemsResponse {
  items: InventoryItemResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InventoryListResponseExtended {
  inventory: FlatInventory[];
  items?: FlatInventory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: InventoryStats;
  appliedFilters: {
    search: string | null;
    category: string | null;
    location: string | null;
    status: string | null;
    lowStock: boolean;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  stats?: InventoryStats;
}

export interface CreateItemData extends CreateInventoryItemData {
  category?: string;
  location?: string;
  supplier?: string;
  unit?: string;
  userId?: string;
  variantAttributes?: Record<string, any>;
  variants?: Array<{
    name: string;
    sku: string;
    price: number;
    costPrice?: number;
    stock?: number;
    attributes: Record<string, any>;
    images?: string[];
  }>;
}

export interface UpdateItemData extends UpdateInventoryItemData {
  category?: string;
  location?: string;
  supplier?: string;
  unit?: string;
  userId?: string;
  productType?:
    | 'SIMPLE'
    | 'VARIABLE'
    | 'GROUPED'
    | 'BUNDLE'
    | 'DIGITAL'
    | 'SERVICE';
}

export interface IssueItemData extends Omit<CanonicalIssueItemData, 'inventoryId'> {}
export interface ReturnItemData extends Omit<CanonicalReturnItemData, 'inventoryId'> {}
export interface RestockItemData extends Omit<CanonicalRestockItemData, 'inventoryId'> {}

export interface UpdateStockData {
  quantity: number;
  transactionType?: string;
  notes?: string;
  reference?: string;
}

export interface TransferStockInput {
  productId: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  notes?: string;
  businessUnitId: string;
  variantId?: string;
}

export interface BulkUpdateResult extends CanonicalBulkUpdateResult {}

export interface InventoryMovementParams {
  productId?: string;
  businessUnitId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface InventoryTransactionParams {
  page?: number;
  limit?: number;
  productId?: string;
  businessUnitId?: string;
  transactionType?: string;
  startDate?: string;
  endDate?: string;
}

export type ExportFormat = CanonicalExportFormat | 'pdf';

export interface InventorySearchFilters {
  search?: string;
  categoryId?: string;
  location?: string;
  supplier?: string;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  lowStock?: boolean;
  hasBarcode?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  businessUnitId?: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  productCount?: number;
  childrenCount?: number;
  hasChildren?: boolean;
  parentId?: string | null;
}

export interface SupplierOption {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface GetInventoryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  category?: string;
  location?: string;
  status?: string;
  lowStock?: boolean;
  businessUnitId?: string;
  sortByProductName?: string;
}

export interface GetAllInventoryResponse {
  items: FlatInventory[];
  stats: InventoryStats;
}

// ============================================
// BUSINESS UNIT RESOLUTION
// ============================================
//
// The backend resolves the business unit for every inventory
// request in `inventoryController.getBusinessUnitId`. The frontend
// must NOT invent a rule that disagrees with it.
//
// Backend priority (in order):
//   1. `x-business-unit-id` header
//   2. `req.body.businessUnitId`
//   3. `req.query.businessUnitId`     ← the only one we can set
//   4. `req.user.businessUnitId`      ← used when (3) is absent
//   5. `req.user.businessUnits[0]`    ← used when (4) is absent
//   6. First active BU in DB          ← backend-only fallback
//
// The frontend can only influence (3). So the frontend should:
//
//   • Prefer an EXPLICIT caller-provided BU (the caller knows).
//   • Otherwise send NOTHING and let the backend use (4), (5), (6).
//
// ⚠️ The frontend MUST NOT read `localStorage.user.businessUnitId`
//    to make this decision. That value is a UI cache populated
//    during a previous `/auth/sync`; it can be stale, and when it
//    is, the frontend ends up querying BU B while the list page
//    queried BU A. Letting the backend use `req.user.businessUnitId`
//    guarantees both pages resolve to the same BU on every request.

const SENTINEL_BUSINESS_UNIT_IDS = new Set([
  'default',
  'default-business-unit',
  'undefined',
  'null',
  '',
]);

function isSentinelId(id: string | null | undefined): boolean {
  if (!id) return true;
  return SENTINEL_BUSINESS_UNIT_IDS.has(id);
}

function sanitizeBusinessUnitId(id?: string | null): string | undefined {
  if (!id) return undefined;
  if (isSentinelId(id)) return undefined;
  return id;
}

/**
 * Resolve the BU to send to the backend.
 *
 * Priority:
 *   1. Explicit caller argument — the caller knows what it wants.
 *   2. `undefined` — send nothing; the backend resolves it from
 *      `req.user.businessUnitId`, which is the same value it would
 *      use if the frontend sent nothing at all.
 *
 * This function deliberately does NOT consult `localStorage`.
 * See the block comment above for why.
 */
function resolveBusinessUnitId(explicit?: string): string | undefined {
  return sanitizeBusinessUnitId(explicit);
}

/**
 * Public helper for pages that need to pass a BU explicitly.
 *
 * Returns `null` when the frontend genuinely can't determine one —
 * callers should then omit the param entirely and let the backend
 * decide.
 */
export function getCurrentBusinessUnitId(): string | null {
  return resolveBusinessUnitId() ?? null;
}

// ============================================
// GENERIC HELPERS
// ============================================

function cleanObject<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

function errorShape(error: any) {
  return {
    message: error?.response?.data?.message || error?.message || 'Unknown error',
    status: error?.response?.status,
    url: error?.config?.url,
    params: error?.config?.params,
  };
}

/**
 * Distinguish "route not registered on the backend" from "record not
 * found". Both come back as HTTP 404, but they mean very different
 * things:
 *
 *   { error: 'Route not found' }             → route missing (bug)
 *   { message: 'Inventory item not found' }  → record missing (normal)
 */
function isRouteNotFound(error: any): boolean {
  const body = error?.response?.data;
  return (
    error?.response?.status === 404 &&
    typeof body === 'object' &&
    body !== null &&
    (body as any).error === 'Route not found'
  );
}

function seg(value: string): string {
  return encodeURIComponent(value);
}

function toImageUrls(input: unknown): string[] {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && typeof (v as any).url === 'string') {
        return (v as any).url as string;
      }
      return null;
    })
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

// ============================================
// UNWRAPPING
// ============================================
//
// Every backend controller method responds with `{ success, data }`.
// This single helper enforces that contract so the rest of the
// service doesn't need to guess which key holds the payload.

function unwrapData<T = any>(response: any): T | undefined {
  if (response === null || response === undefined) return undefined;
  if (typeof response !== 'object') return response as T;
  if ('data' in response) return (response as any).data as T;
  return response as T;
}

// ============================================
// NORMALIZATION
// ============================================
//
// ⚠️ CRITICAL: `normalizeInventoryItem` must NEVER overwrite `id`
//    with `product.id`. The Inventory row's primary key is the only
//    value the backend's `/inventory/items/:id` endpoint accepts.
//    Rewriting it here is what caused every detail-page fetch to
//    404: the list page rendered rows whose `id` was the *product*
//    ID, the detail page routed on that ID, and the backend looked
//    up `Inventory.id === productId` — which never matched.
//
//    The product ID is preserved separately on `productId`, and the
//    inventory row's own ID is preserved on `inventoryId` (when it
//    differs), so any caller that needs the product ID can still
//    find it.

function normalizeInventoryItem(item: any): FlatInventory | null {
  if (!item) return null;

  if (item.product && item.product.id) {
    const reorder =
      item.reorderPoint ??
      item.product.reorderPoint ??
      item.reorderQuantity ??
      item.product.reorderQuantity;

    // Preserve the inventory row's own ID. If the payload carries
    // it under `inventoryId`, use that; otherwise use `item.id`.
    // Whatever we do, we do NOT substitute `product.id`.
    const inventoryRowId = item.id || item.inventoryId || null;

    return {
      ...item,
      // ⚠️ Keep the inventory row's ID. It is the identifier the
      //    detail endpoint requires. Do not replace it with
      //    `item.product.id`.
      id: inventoryRowId,
      // Keep the product ID available under a dedicated key so
      // callers that need it (productService, cart, etc.) still
      // have it.
      productId: item.product.id,
      // If the raw payload had a distinct `inventoryId`, keep it.
      inventoryId: item.inventoryId || inventoryRowId || undefined,
      name: item.name || item.product.name,
      unitPrice: item.unitPrice || item.product.unitPrice,
      images:
        item.images && item.images.length > 0
          ? toImageUrls(item.images)
          : toImageUrls(item.product.images),
      description: item.description || item.product.description,
      weight: item.weight !== undefined ? item.weight : item.product.weight,
      taxRate:
        item.taxRate !== undefined ? item.taxRate : item.product.taxRate,
      tags:
        item.tags && item.tags.length > 0
          ? item.tags
          : item.product.tags || [],
      isActive:
        item.isActive !== undefined ? item.isActive : item.product?.isActive,
      sku: item.sku || item.product.sku,
      category: item.category || item.product.category,
      categoryId: item.categoryId || item.product.categoryId,
      supplier: item.supplier || item.product.supplier,
      supplierId: item.supplierId || item.product.supplierId,
      minStock: item.minStock || item.product.minStock,
      maxStock: item.maxStock || item.product.maxStock,
      featured: item.featured || item.product.featured,
      isDigital: item.isDigital || item.product.isDigital,
      attributes: item.attributes || item.product.attributes || {},
      notes: item.notes || item.product.notes,
      costPrice: item.costPrice || item.product.costPrice,
      _product: item.product,
      inventory: item.inventory || [
        {
          quantity: item.quantity || item.product?.stock || 0,
          reserved: item.reserved || 0,
        },
      ],
      stock: item.quantity || item.stock || 0,
      price: item.price || item.unitPrice || item.product?.unitPrice || 0,
      available:
        item.available !== undefined
          ? item.available
          : (item.quantity || 0) - (item.reserved || 0),
      status: item.status || item.product?.status || 'ACTIVE',
      businessUnitId: item.businessUnitId || item.product?.businessUnitId,
      createdAt: item.createdAt || item.product?.createdAt,
      updatedAt: item.updatedAt || item.product?.updatedAt,
      reorderPoint: reorder ?? 10,
      reorderQuantity: reorder ?? 10,
    } as FlatInventory;
  }

  if (!item.id && item.inventoryId) {
    return { ...item, id: item.inventoryId } as FlatInventory;
  }

  if (!item.id && item.productId) {
    // No id at all — fall back to productId. This branch is only
    // reached for legacy payloads that genuinely have no inventory
    // ID; it is not the normal path.
    return { ...item, id: item.productId } as FlatInventory;
  }

  if (item && item.images) item.images = toImageUrls(item.images);

  if (item && !item.inventory) {
    item.inventory = [
      {
        quantity: item.quantity || item.stock || 0,
        reserved: item.reserved || 0,
      },
    ];
  }

  if (item && item.quantity !== undefined && item.stock === undefined) {
    item.stock = item.quantity;
  }

  if (item && item.available === undefined) {
    item.available = (item.quantity || 0) - (item.reserved || 0);
  }

  if (item && !item.images) item.images = [];
  if (item && !item.tags) item.tags = [];
  if (item && item.price === undefined) item.price = item.unitPrice || 0;

  if (
    item &&
    item.reorderPoint === undefined &&
    item.reorderQuantity === undefined
  ) {
    item.reorderPoint = item.maxStock || 10;
    item.reorderQuantity = item.maxStock || 10;
  } else {
    const resolved = item.reorderPoint ?? item.reorderQuantity;
    item.reorderPoint = resolved;
    item.reorderQuantity = resolved;
  }

  if (item && item.maxStock === undefined) item.maxStock = 100;
  if (item && item.minStock === undefined) {
    item.minStock = item.reorderPoint || 5;
  }
  if (item && item.isActive === undefined) item.isActive = true;
  if (item && item.isDigital === undefined) item.isDigital = false;
  if (item && item.featured === undefined) item.featured = false;

  if (item && item.status === undefined) {
    item.status =
      item.quantity === 0
        ? 'out_of_stock'
        : item.quantity <= (item.reorderPoint || 5)
        ? 'low_stock'
        : 'ACTIVE';
  }

  // Preserve the inventory row ID on `inventoryId` for callers that
  // need to distinguish it from a product ID.
  if (item && !item.inventoryId && item.id) {
    item.inventoryId = item.id;
  }

  return item as FlatInventory;
}

function normalizeInventoryItems(items: any[]): FlatInventory[] {
  if (!items || !Array.isArray(items)) return [];
  return items
    .map(normalizeInventoryItem)
    .filter((item): item is FlatInventory => item !== null);
}

/**
 * Given a `pagination` object the backend nests under the response
 * envelope, apply those values to a top-level pagination shape.
 * The controller puts `total/page/limit/totalPages` under
 * `pagination`; this helper normalizes both shapes.
 */
function applyPagination(
  target: any,
  pagination: any,
  fallbackPage: number,
  fallbackLimit: number
): void {
  if (pagination && typeof pagination === 'object') {
    if (typeof target.total !== 'number')
      target.total = pagination.total;
    if (typeof target.page !== 'number')
      target.page = pagination.page;
    if (typeof target.limit !== 'number')
      target.limit = pagination.limit;
    if (typeof target.totalPages !== 'number')
      target.totalPages = pagination.totalPages;
  }

  if (typeof target.total !== 'number')
    target.total = Array.isArray(target.data)
      ? target.data.length
      : Array.isArray(target.items)
      ? target.items.length
      : Array.isArray(target.inventory)
      ? target.inventory.length
      : 0;
  if (typeof target.page !== 'number') target.page = fallbackPage;
  if (typeof target.limit !== 'number') target.limit = fallbackLimit;
  if (typeof target.totalPages !== 'number') {
    target.totalPages = Math.max(
      1,
      Math.ceil((target.total || 0) / (target.limit || 1))
    );
  }
}

// ============================================
// SERVICE
// ============================================

export const inventoryService = {
  // ── REFERENCE DATA ─────────────────────────

  async getCategories(businessUnitId?: string): Promise<CategoryOption[]> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = { limit: 100, isActive: true };
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>('/categories', { params });
      const data = unwrapData<any[]>(response);

      if (!Array.isArray(data)) return [];

      return data.map((cat: any) => ({
        id: cat.id || cat.categoryId || cat.category,
        name: cat.name || cat.category || 'Uncategorized',
        productCount: cat.productCount || cat._count?.products || 0,
        childrenCount: cat.childrenCount || cat._count?.children || 0,
        hasChildren: (cat.childrenCount || cat._count?.children || 0) > 0,
        parentId: cat.parentId || null,
      }));
    } catch (error: any) {
      console.error('❌ Failed to get categories:', errorShape(error));
      return [];
    }
  },

  async getCategorySummary(businessUnitId?: string): Promise<
    Array<{
      id: string;
      name: string;
      categoryId?: string;
      count: number;
      value: number;
    }>
  > {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = { limit: 100, isActive: true };
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>('/inventory/category-summary', {
        params,
      });
      const data = unwrapData<any[]>(response);

      if (!Array.isArray(data)) return [];

      return data.map((cat: any) => ({
        id: cat.id || cat.categoryId || cat.category,
        name: cat.name || cat.category || 'Uncategorized',
        categoryId: cat.id || cat.categoryId || null,
        count: cat.count || 0,
        value: cat.value || 0,
      }));
    } catch (error: any) {
      console.error('❌ Failed to get category summary:', errorShape(error));
      return [];
    }
  },

  async getSuppliers(businessUnitId?: string): Promise<SupplierOption[]> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>('/inventory/suppliers', { params });
      const data = unwrapData<any[]>(response);
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      console.error('❌ Failed to get suppliers:', errorShape(error));
      return [];
    }
  },

  // ── LISTS ──────────────────────────────────

  async getInventory(
    params?: GetInventoryParams
  ): Promise<InventoryListResponseExtended> {
    try {
      const cleanParams: any = { ...params };

      if (cleanParams.sortBy === 'name' || cleanParams.sortBy === 'productName') {
        cleanParams.sortByProductName = 'true';
      }

      const resolvedBU = resolveBusinessUnitId(cleanParams.businessUnitId);
      if (resolvedBU) cleanParams.businessUnitId = resolvedBU;
      else delete cleanParams.businessUnitId;

      const cleanedParams = cleanObject(cleanParams);

      const response = await api.get<any>('/inventory/items', {
        params: cleanedParams,
      });

      if (Array.isArray(response)) {
        const normalized = normalizeInventoryItems(response);
        return {
          inventory: normalized,
          items: normalized,
          total: normalized.length,
          page: 1,
          limit: normalized.length || 10,
          totalPages: 1,
          stats: {} as InventoryStats,
          appliedFilters: {
            search: null,
            category: null,
            location: null,
            status: null,
            lowStock: false,
          },
        };
      }

      const data = unwrapData<any[]>(response);
      const normalized = normalizeInventoryItems(
        Array.isArray(data) ? data : []
      );

      const result: any = {
        inventory: normalized,
        items: normalized,
        stats: (response as any)?.stats || ({} as InventoryStats),
        appliedFilters: (response as any)?.filters ||
          (response as any)?.appliedFilters || {
            search: cleanParams.search ?? null,
            category: cleanParams.category ?? null,
            location: cleanParams.location ?? null,
            status: cleanParams.status ?? null,
            lowStock: !!cleanParams.lowStock,
          },
      };

      applyPagination(
        result,
        (response as any)?.pagination,
        cleanParams.page ?? 1,
        cleanParams.limit ?? 10
      );

      return result as InventoryListResponseExtended;
    } catch (error: any) {
      console.error('❌ Failed to get inventory:', errorShape(error));
      throw error;
    }
  },

  async getInventoryItems(params?: {
    page?: number;
    limit?: number;
    search?: string;
    businessUnitId?: string;
    withoutProduct?: boolean;
  }): Promise<InventoryItemsResponse> {
    try {
      const cleanParams: any = { ...params };

      const resolvedBU = resolveBusinessUnitId(cleanParams.businessUnitId);
      if (resolvedBU) cleanParams.businessUnitId = resolvedBU;
      else delete cleanParams.businessUnitId;

      const cleanedParams = cleanObject(cleanParams);

      const response = await api.get<any>('/inventory/items', {
        params: cleanedParams,
      });

      if (Array.isArray(response)) {
        const normalized = normalizeInventoryItems(response);
        return {
          items: normalized,
          total: normalized.length,
          page: 1,
          limit: normalized.length || cleanParams.limit || 20,
          totalPages: 1,
        };
      }

      const data = unwrapData<any[]>(response);
      const normalized = normalizeInventoryItems(
        Array.isArray(data) ? data : []
      );

      const result: any = { items: normalized };
      applyPagination(
        result,
        (response as any)?.pagination,
        cleanParams.page ?? 1,
        cleanParams.limit ?? 20
      );

      return result as InventoryItemsResponse;
    } catch (error: any) {
      console.error('❌ Failed to get inventory items:', errorShape(error));
      throw error;
    }
  },

  /**
   * Fetch all inventory under the resolved BU (no pagination).
   *
   * `businessUnitId` is optional. When omitted, the query param is
   * not sent and the backend resolves the BU from
   * `req.user.businessUnitId` — the same value the detail endpoint
   * uses, so both pages agree on the BU.
   */
  async getAllInventory(
    businessUnitId?: string
  ): Promise<GetAllInventoryResponse> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      console.log('📤 getAllInventory - businessUnitId:', clean ?? '(auto)');

      const response = await api.get<any>('/inventory/all', { params });
      const data = unwrapData<any[]>(response);
      const items = Array.isArray(data) ? data : [];

      const normalizedItems = items
        .map((item: any) => normalizeInventoryItem(item))
        .filter((item): item is FlatInventory => item !== null);

      console.log(
        `✅ getAllInventory returning ${normalizedItems.length} items`
      );

      return {
        items: normalizedItems,
        stats: (response as any)?.stats || ({} as InventoryStats),
      };
    } catch (error: any) {
      console.error('❌ Failed to get all inventory:', errorShape(error));
      return { items: [], stats: {} as InventoryStats };
    }
  },

  // ── DETAIL ─────────────────────────────────

  /**
   * Fetch a single inventory item by ID.
   *
   * `businessUnitId` is optional. When omitted, no BU query param
   * is sent and the backend uses `req.user.businessUnitId` — the
   * same value `getAllInventory` would use. This guarantees the
   * detail request targets the same BU as the list request.
   *
   * 404 handling:
   *   • `{ error: 'Route not found' }` → rethrow. The backend
   *      route is missing — this is a deployment/config bug that
   *      must not be silently converted to `null`.
   *   • `{ message: 'Inventory item not found' }` → return null.
   *      The record genuinely doesn't exist for the resolved BU.
   */
  async getInventoryItemById(
    id: string,
    businessUnitId?: string
  ): Promise<FlatInventory | null> {
    try {
      if (!id) throw new Error('Inventory ID is required');

      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>(`/inventory/items/${seg(id)}`, {
        params,
      });

      const result = unwrapData<any>(response);
      return result ? normalizeInventoryItem(result) : null;
    } catch (error: any) {
      if (isRouteNotFound(error)) {
        console.error(
          `❌ Backend route missing: GET /inventory/items/:id ` +
            `(requested id="${id}"). Register this route in ` +
            `packages/backend/src/routes/inventory.ts.`
        );
        throw error;
      }

      if (error?.response?.status === 404) {
        console.warn(`⚠️ Inventory item ${id} not found`);
        return null;
      }

      console.error(
        '❌ Failed to get inventory item by ID:',
        errorShape(error)
      );
      throw error;
    }
  },

  /**
   * Legacy alias. Delegates so both paths share the same BU
   * resolution and the same 404 classification.
   */
  async getInventoryItem(id: string): Promise<FlatInventory | null> {
    return this.getInventoryItemById(id);
  },

  async getInventoryByProduct(
    productId: string,
    businessUnitId?: string,
    variantId?: string
  ): Promise<FlatInventory | null> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;
      if (variantId) params.variantId = variantId;

      const response = await api.get<any>(
        `/inventory/product/${seg(productId)}`,
        { params }
      );
      const result = unwrapData<any>(response);
      return result ? normalizeInventoryItem(result) : null;
    } catch (error: any) {
      if (isRouteNotFound(error)) throw error;
      if (error?.response?.status === 404) return null;
      console.error('❌ Failed to get inventory by product:', errorShape(error));
      throw error;
    }
  },

  async getInventoryByBarcode(
    barcode: string,
    businessUnitId?: string
  ): Promise<FlatInventory | null> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>(
        `/inventory/barcode/${seg(barcode)}`,
        { params }
      );
      const result = unwrapData<any>(response);
      return result ? normalizeInventoryItem(result) : null;
    } catch (error: any) {
      if (isRouteNotFound(error)) throw error;
      if (error?.response?.status === 404) return null;
      console.error(
        `❌ Failed to get inventory by barcode ${barcode}:`,
        errorShape(error)
      );
      throw error;
    }
  },

  async getInventoryBySku(
    sku: string,
    businessUnitId?: string
  ): Promise<FlatInventory | null> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>(`/inventory/sku/${seg(sku)}`, {
        params,
      });
      const result = unwrapData<any>(response);
      return result ? normalizeInventoryItem(result) : null;
    } catch (error: any) {
      if (isRouteNotFound(error)) throw error;
      if (error?.response?.status === 404) return null;
      console.error(
        `❌ Failed to get inventory by SKU ${sku}:`,
        errorShape(error)
      );
      throw error;
    }
  },

  async getInventoryByLocation(
    location: string,
    businessUnitId?: string
  ): Promise<FlatInventory[]> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>(
        `/inventory/location/${seg(location)}`,
        { params }
      );
      const data = unwrapData<any[]>(response);
      return Array.isArray(data) ? normalizeInventoryItems(data) : [];
    } catch (error: any) {
      console.error(
        '❌ Failed to get inventory by location:',
        errorShape(error)
      );
      throw error;
    }
  },

  async getInventoryByCategory(
    category: string,
    businessUnitId?: string
  ): Promise<FlatInventory[]> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>(
        `/inventory/category/${seg(category)}`,
        { params }
      );
      const data = unwrapData<any[]>(response);
      return Array.isArray(data) ? normalizeInventoryItems(data) : [];
    } catch (error: any) {
      console.error(
        '❌ Failed to get inventory by category:',
        errorShape(error)
      );
      throw error;
    }
  },

  // ── TRANSACTIONS / MOVEMENTS ───────────────

  async getInventoryTransactions(
    params?: InventoryTransactionParams
  ): Promise<PaginatedResponse<InventoryTransaction>> {
    try {
      const cleanParams: any = { ...params };
      const resolvedBU = resolveBusinessUnitId(cleanParams.businessUnitId);
      if (resolvedBU) cleanParams.businessUnitId = resolvedBU;
      else delete cleanParams.businessUnitId;

      const cleanedParams = cleanObject(cleanParams);

      const response = await api.get<any>('/inventory/transactions', {
        params: cleanedParams,
      });

      const data = unwrapData<any[]>(response);
      const result: any = {
        data: Array.isArray(data) ? data : [],
        stats: (response as any)?.stats,
      };

      applyPagination(
        result,
        (response as any)?.pagination,
        cleanParams.page ?? 1,
        cleanParams.limit ?? 20
      );

      return result as PaginatedResponse<InventoryTransaction>;
    } catch (error: any) {
      console.error(
        '❌ Failed to get inventory transactions:',
        errorShape(error)
      );
      throw error;
    }
  },

  async getStockMovements(
    params: InventoryMovementParams
  ): Promise<InventoryTransaction[]> {
    try {
      const cleanParams: any = { ...params };
      const resolvedBU = resolveBusinessUnitId(cleanParams.businessUnitId);
      if (resolvedBU) cleanParams.businessUnitId = resolvedBU;
      else delete cleanParams.businessUnitId;

      const response = await api.get<any>('/inventory/movements', {
        params: cleanObject(cleanParams),
      });
      const data = unwrapData<any[]>(response);
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      console.error('❌ Failed to get stock movements:', errorShape(error));
      throw error;
    }
  },

  // ── AGGREGATES ─────────────────────────────

  async getInventorySummary(
    businessUnitId?: string
  ): Promise<InventorySummary> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>('/inventory/summary', { params });
      return unwrapData<any>(response) ?? ({} as InventorySummary);
    } catch (error: any) {
      console.error('❌ Failed to get inventory summary:', errorShape(error));
      throw error;
    }
  },

  async getInventoryValue(businessUnitId?: string): Promise<InventoryValue> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>('/inventory/value', { params });
      return unwrapData<any>(response) ?? ({} as InventoryValue);
    } catch (error: any) {
      console.error('❌ Failed to get inventory value:', errorShape(error));
      throw error;
    }
  },

  async getInventoryStats(businessUnitId?: string): Promise<InventoryStats> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>('/inventory/stats', { params });
      return unwrapData<any>(response) ?? ({} as InventoryStats);
    } catch (error: any) {
      console.error('❌ Failed to get inventory stats:', errorShape(error));
      throw error;
    }
  },

  async getTotalItems(businessUnitId?: string): Promise<number> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>('/inventory/total', { params });
      const data = unwrapData<any>(response);
      return typeof data === 'number' ? data : 0;
    } catch (error: any) {
      console.error('❌ Failed to get total items:', errorShape(error));
      throw error;
    }
  },

  async getLowStockItems(
    businessUnitId?: string
  ): Promise<FlatInventory[]> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>('/inventory/low-stock', { params });
      const data = unwrapData<any[]>(response);
      return Array.isArray(data) ? normalizeInventoryItems(data) : [];
    } catch (error: any) {
      console.error('❌ Failed to get low stock items:', errorShape(error));
      throw error;
    }
  },

  async getOutOfStockItems(
    businessUnitId?: string
  ): Promise<FlatInventory[]> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>('/inventory/out-of-stock', {
        params,
      });
      const data = unwrapData<any[]>(response);
      return Array.isArray(data) ? normalizeInventoryItems(data) : [];
    } catch (error: any) {
      console.error('❌ Failed to get out of stock items:', errorShape(error));
      throw error;
    }
  },

  // ── SEARCH ─────────────────────────────────

  async searchInventory(
    query: string,
    businessUnitId?: string,
    filters?: InventorySearchFilters
  ): Promise<FlatInventory[]> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = { query };
      if (clean) params.businessUnitId = clean;
      if (filters) Object.assign(params, filters);

      const response = await api.get<any>('/inventory/search', {
        params: cleanObject(params),
      });
      const data = unwrapData<any[]>(response);
      return Array.isArray(data) ? normalizeInventoryItems(data) : [];
    } catch (error: any) {
      console.error('❌ Failed to search inventory:', errorShape(error));
      throw error;
    }
  },

  async searchProducts(params: {
    query: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    businessUnitId?: string;
  }): Promise<FlatInventory[]> {
    try {
      const clean = resolveBusinessUnitId(params.businessUnitId);
      const cleanParams: any = { ...params };
      if (clean) cleanParams.businessUnitId = clean;
      else delete cleanParams.businessUnitId;

      const response = await api.get<any>('/inventory/search', {
        params: cleanObject(cleanParams),
      });
      const data = unwrapData<any[]>(response);
      return Array.isArray(data) ? normalizeInventoryItems(data) : [];
    } catch (error: any) {
      console.error('❌ Failed to search products:', errorShape(error));
      return [];
    }
  },

  // ── WRITES ─────────────────────────────────

  async createItem(data: CreateItemData): Promise<any> {
    try {
      if (!data.name) throw new Error('Item name is required');

      const clean = resolveBusinessUnitId(data.businessUnitId);

      const payload = cleanObject({
        name: data.name.trim(),
        sku: data.sku?.trim() || undefined,
        unitPrice: typeof data.unitPrice === 'number' ? data.unitPrice : 0,
        costPrice:
          typeof data.costPrice === 'number' ? data.costPrice : undefined,
        quantity: typeof data.quantity === 'number' ? data.quantity : 0,
        minStock: typeof data.minStock === 'number' ? data.minStock : 5,
        maxStock: typeof data.maxStock === 'number' ? data.maxStock : 100,
        category: data.category?.trim() || undefined,
        categoryId: data.categoryId || undefined,
        location: data.location || 'Warehouse',
        supplier: data.supplier?.trim() || undefined,
        supplierId: data.supplierId || undefined,
        notes: data.notes?.trim() || undefined,
        description: data.description?.trim() || undefined,
        barcode: data.barcode?.trim() || undefined,
        unit: data.unit || 'each',
        weight: typeof data.weight === 'number' ? data.weight : undefined,
        taxRate: typeof data.taxRate === 'number' ? data.taxRate : undefined,
        tags: data.tags || [],
        images: data.images || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
        featured: data.featured || false,
        isDigital: data.isDigital || false,
        businessUnitId: clean || undefined,
        userId: data.userId,
      });

      return api.post<any>('/inventory/items', payload);
    } catch (error: any) {
      console.error('❌ Failed to create inventory item:', errorShape(error));
      throw error;
    }
  },

  async createInventory(data: any): Promise<any> {
    try {
      const cleanData: any = { ...data };
      const clean = resolveBusinessUnitId(cleanData.businessUnitId);
      if (clean) cleanData.businessUnitId = clean;
      else delete cleanData.businessUnitId;

      return api.post('/inventory', cleanObject(cleanData));
    } catch (error: any) {
      console.error('❌ Failed to create inventory:', errorShape(error));
      throw error;
    }
  },

  async createProductWithInventory(data: CreateItemData): Promise<any> {
    try {
      const clean = resolveBusinessUnitId(data.businessUnitId);

      const payload = cleanObject({
        name: data.name.trim(),
        sku: data.sku?.trim() || undefined,
        unitPrice: typeof data.unitPrice === 'number' ? data.unitPrice : 0,
        costPrice:
          typeof data.costPrice === 'number' ? data.costPrice : undefined,
        stock: typeof data.quantity === 'number' ? data.quantity : 0,
        reorderPoint: typeof data.minStock === 'number' ? data.minStock : 5,
        category: data.category?.trim() || undefined,
        categoryId: data.categoryId || undefined,
        location: data.location || 'Warehouse',
        supplier: data.supplier?.trim() || undefined,
        supplierId: data.supplierId || undefined,
        description: data.description?.trim() || undefined,
        barcode: data.barcode?.trim() || undefined,
        images: data.images || [],
        weight: typeof data.weight === 'number' ? data.weight : undefined,
        taxRate: typeof data.taxRate === 'number' ? data.taxRate : undefined,
        tags: data.tags || [],
        businessUnitId: clean || undefined,
        userId: data.userId,
      });

      return api.post<any>('/inventory/products', payload);
    } catch (error: any) {
      console.error(
        '❌ Failed to create product with inventory:',
        errorShape(error)
      );
      throw error;
    }
  },

  async updateItem(id: string, data: UpdateItemData): Promise<any> {
    try {
      const clean = resolveBusinessUnitId(data.businessUnitId);

      const payload: any = {};
      if (data.name !== undefined) payload.name = data.name.trim();
      if (data.sku !== undefined) payload.sku = data.sku.trim();
      if (data.unitPrice !== undefined) payload.unitPrice = data.unitPrice;
      if (data.costPrice !== undefined) payload.costPrice = data.costPrice;
      if (data.quantity !== undefined) payload.quantity = data.quantity;
      if (data.minStock !== undefined) payload.minStock = data.minStock;
      if (data.maxStock !== undefined) payload.maxStock = data.maxStock;
      if (data.category !== undefined) payload.category = data.category.trim();
      if (data.categoryId !== undefined) payload.categoryId = data.categoryId;
      if (data.location !== undefined) payload.location = data.location;
      if (data.supplier !== undefined) payload.supplier = data.supplier.trim();
      if (data.supplierId !== undefined) payload.supplierId = data.supplierId;
      if (data.notes !== undefined) payload.notes = data.notes.trim();
      if (data.description !== undefined)
        payload.description = data.description.trim();
      if (data.barcode !== undefined) payload.barcode = data.barcode.trim();
      if (data.unit !== undefined) payload.unit = data.unit;
      if (data.weight !== undefined) payload.weight = data.weight;
      if (data.taxRate !== undefined) payload.taxRate = data.taxRate;
      if (data.tags !== undefined) payload.tags = data.tags;
      if (data.images !== undefined) payload.images = data.images;
      if (data.isActive !== undefined) payload.isActive = data.isActive;
      if (data.featured !== undefined) payload.featured = data.featured;
      if (data.isDigital !== undefined) payload.isDigital = data.isDigital;
      if (data.productType !== undefined)
        payload.productType = data.productType;
      if (clean) payload.businessUnitId = clean;

      return api.put<any>(`/inventory/items/${seg(id)}`, cleanObject(payload));
    } catch (error: any) {
      console.error(
        `❌ Failed to update inventory item ${id}:`,
        errorShape(error)
      );
      throw error;
    }
  },

  async updateInventory(id: string, data: any): Promise<any> {
    try {
      const cleanData: any = { ...data };
      const clean = resolveBusinessUnitId(cleanData.businessUnitId);
      if (clean) cleanData.businessUnitId = clean;
      else delete cleanData.businessUnitId;

      return api.put(`/inventory/${seg(id)}`, cleanObject(cleanData));
    } catch (error: any) {
      console.error(`❌ Failed to update inventory ${id}:`, errorShape(error));
      throw error;
    }
  },

  async updateProduct(id: string, data: any): Promise<any> {
    return this.updateInventory(id, data);
  },

  async updateStock(id: string, data: UpdateStockData): Promise<any> {
    try {
      const payload = cleanObject({
        quantity: data.quantity,
        transactionType: data.transactionType || 'ADJUSTMENT',
        notes: data.notes,
        reference: data.reference,
      });

      return api.patch<any>(`/inventory/items/${seg(id)}/stock`, payload);
    } catch (error: any) {
      console.error(
        `❌ Failed to update stock for item ${id}:`,
        errorShape(error)
      );
      throw error;
    }
  },

  // ── BULK ───────────────────────────────────

  async bulkUpdateStock(
    updates: Array<{
      id: string;
      quantity: number;
      transactionType?: string;
      notes?: string;
    }>
  ): Promise<BulkUpdateResult> {
    try {
      const cleanedUpdates = updates.map((update) => cleanObject(update));
      return api.patch<BulkUpdateResult>('/inventory/bulk/stock', {
        updates: cleanedUpdates,
      });
    } catch (error: any) {
      console.error('❌ Failed to bulk update stock:', errorShape(error));
      throw error;
    }
  },

  async bulkDeleteItems(ids: string[]): Promise<BulkUpdateResult> {
    try {
      return api.delete<BulkUpdateResult>('/inventory/bulk/items', {
        data: { ids },
      });
    } catch (error: any) {
      console.error(
        '❌ Failed to bulk delete inventory items:',
        errorShape(error)
      );
      throw error;
    }
  },

  async bulkCreateItems(items: CreateItemData[]): Promise<BulkUpdateResult> {
    try {
      const cleanedItems = items.map((item) => {
        const clean = resolveBusinessUnitId(item.businessUnitId);
        return cleanObject({
          ...item,
          businessUnitId: clean,
        });
      });

      return api.post<BulkUpdateResult>('/inventory/bulk/items', {
        items: cleanedItems,
      });
    } catch (error: any) {
      console.error(
        '❌ Failed to bulk create inventory items:',
        errorShape(error)
      );
      throw error;
    }
  },

  // ── DELETE ─────────────────────────────────

  async deleteInventoryItem(
    id: string,
    businessUnitId?: string
  ): Promise<{ message: string }> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = {};
      if (clean) params.businessUnitId = clean;

      return api.delete<{ message: string }>(
        `/inventory/items/${seg(id)}`,
        { params }
      );
    } catch (error: any) {
      console.error(
        `❌ Failed to delete inventory item ${id}:`,
        errorShape(error)
      );
      throw error;
    }
  },

  async deleteProduct(
    id: string,
    businessUnitId?: string,
    _userId?: string
  ): Promise<{ message: string }> {
    return this.deleteInventoryItem(id, businessUnitId);
  },

  async deleteInventory(id: string): Promise<any> {
    try {
      return api.delete(`/inventory/${seg(id)}`);
    } catch (error: any) {
      console.error(`❌ Failed to delete inventory ${id}:`, errorShape(error));
      throw error;
    }
  },

  // ── ISSUE / RETURN / RESTOCK ───────────────

  async issueItem(id: string, data: IssueItemData): Promise<any> {
    try {
      return api.post<any>(
        `/inventory/items/${seg(id)}/issue`,
        cleanObject(data)
      );
    } catch (error: any) {
      console.error(`❌ Failed to issue item ${id}:`, errorShape(error));
      throw error;
    }
  },

  async returnItem(id: string, data: ReturnItemData): Promise<any> {
    try {
      return api.post<any>(
        `/inventory/items/${seg(id)}/return`,
        cleanObject(data)
      );
    } catch (error: any) {
      console.error(`❌ Failed to return item ${id}:`, errorShape(error));
      throw error;
    }
  },

  async restockItem(id: string, data: RestockItemData): Promise<any> {
    try {
      return api.post<any>(
        `/inventory/items/${seg(id)}/restock`,
        cleanObject(data)
      );
    } catch (error: any) {
      console.error(`❌ Failed to restock item ${id}:`, errorShape(error));
      throw error;
    }
  },

  // ── BARCODE / QR ───────────────────────────

  async generateInventoryBarcode(
    inventoryId: string,
    businessUnitId?: string
  ): Promise<{ barcode: string; barcodeUrl: string; qrCodeUrl: string }> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const payload = clean ? { businessUnitId: clean } : {};

      const response = await api.post<any>(
        `/inventory/${seg(inventoryId)}/generate-barcode`,
        payload
      );
      return unwrapData<any>(response) ?? response;
    } catch (error: any) {
      console.error(
        `❌ Failed to generate barcode for inventory item ${inventoryId}:`,
        errorShape(error)
      );
      throw error;
    }
  },

  async generateInventoryQRCode(
    inventoryId: string,
    businessUnitId?: string
  ): Promise<{ qrCodeUrl: string; qrData: any }> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const payload = clean ? { businessUnitId: clean } : {};

      const response = await api.post<any>(
        `/inventory/${seg(inventoryId)}/generate-qr`,
        payload
      );
      return unwrapData<any>(response) ?? response;
    } catch (error: any) {
      console.error(
        `❌ Failed to generate QR code for inventory item ${inventoryId}:`,
        errorShape(error)
      );
      throw error;
    }
  },

  async bulkGenerateInventoryBarcodes(
    ids: string[],
    businessUnitId?: string
  ): Promise<{ results: any[]; errors: any[] }> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const payload: any = { ids };
      if (clean) payload.businessUnitId = clean;

      const response = await api.post<any>(
        '/inventory/bulk/generate-barcodes',
        payload
      );
      return unwrapData<any>(response) ?? { results: [], errors: [] };
    } catch (error: any) {
      console.error(
        '❌ Failed to bulk generate inventory barcodes:',
        errorShape(error)
      );
      throw error;
    }
  },

  async scanInventory(
    barcode: string,
    businessUnitId?: string
  ): Promise<any> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const payload: any = { barcode };
      if (clean) payload.businessUnitId = clean;

      const response = await api.post<any>('/inventory/scan', payload);
      return unwrapData<any>(response) ?? response;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      console.error('❌ Failed to scan inventory item:', errorShape(error));
      throw error;
    }
  },

  // ── RESERVE / RELEASE / TRANSFER ───────────

  async reserveStock(
    productId: string,
    quantity: number,
    businessUnitId?: string,
    variantId?: string
  ): Promise<any> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const payload = cleanObject({
        productId,
        quantity,
        businessUnitId: clean,
        variantId,
      });

      return api.post<any>('/inventory/reserve', payload);
    } catch (error: any) {
      console.error(
        `❌ Failed to reserve stock for product ${productId}:`,
        errorShape(error)
      );
      throw error;
    }
  },

  async releaseReservedStock(
    productId: string,
    quantity: number,
    businessUnitId?: string,
    variantId?: string
  ): Promise<any> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const payload = cleanObject({
        productId,
        quantity,
        businessUnitId: clean,
        variantId,
      });

      return api.post<any>('/inventory/release', payload);
    } catch (error: any) {
      console.error(
        `❌ Failed to release reserved stock for product ${productId}:`,
        errorShape(error)
      );
      throw error;
    }
  },

  async transferStock(data: TransferStockInput): Promise<any> {
    try {
      const clean = resolveBusinessUnitId(data.businessUnitId);
      const payload = cleanObject({
        ...data,
        businessUnitId: clean,
      });
      return api.post<any>('/inventory/transfer', payload);
    } catch (error: any) {
      console.error('❌ Failed to transfer stock:', errorShape(error));
      throw error;
    }
  },

  // ── EXPORT ─────────────────────────────────

  async exportInventory(
    businessUnitId: string | undefined,
    format: ExportFormat = 'csv',
    filters?: InventorySearchFilters
  ): Promise<Blob> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = { format };
      if (clean) params.businessUnitId = clean;
      if (filters) Object.assign(params, filters);

      const queryString = new URLSearchParams(
        cleanObject(params) as any
      ).toString();
      return api.download(`/inventory/export?${queryString}`);
    } catch (error: any) {
      console.error(
        `❌ Failed to export inventory as ${format}:`,
        errorShape(error)
      );
      throw error;
    }
  },

  async exportInventoryToFile(
    businessUnitId?: string,
    format: ExportFormat = 'json'
  ): Promise<{
    filePath: string;
    fileName: string;
    format: string;
    totalRecords: number;
  }> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      const params: any = { format };
      if (clean) params.businessUnitId = clean;

      const response = await api.get<any>('/inventory/export/file', {
        params,
      });
      return unwrapData<any>(response) ?? response;
    } catch (error: any) {
      console.error(
        '❌ Failed to export inventory to file:',
        errorShape(error)
      );
      throw error;
    }
  },

  // ── SYNC ───────────────────────────────────

  async syncInventoryFromProduct(
    productId: string,
    businessUnitId?: string
  ): Promise<any> {
    try {
      const clean = resolveBusinessUnitId(businessUnitId);
      return api.post<any>(
        '/inventory/sync/product',
        cleanObject({ productId, businessUnitId: clean })
      );
    } catch (error: any) {
      console.error(
        '❌ Error syncing inventory from product:',
        errorShape(error)
      );
      throw error;
    }
  },

  async syncProductFromInventory(inventoryId: string): Promise<any> {
    try {
      return api.post<any>(`/inventory/${seg(inventoryId)}/sync/product`);
    } catch (error: any) {
      console.error(
        '❌ Error syncing product from inventory:',
        errorShape(error)
      );
      throw error;
    }
  },

  // ── LEGACY ALIASES ─────────────────────────

  async getSummary(businessUnitId?: string): Promise<InventorySummary> {
    return this.getInventorySummary(businessUnitId);
  },

  async getValue(businessUnitId?: string): Promise<InventoryValue> {
    return this.getInventoryValue(businessUnitId);
  },

  async getLowStock(businessUnitId?: string): Promise<FlatInventory[]> {
    return this.getLowStockItems(businessUnitId);
  },

  async getOutOfStock(businessUnitId?: string): Promise<FlatInventory[]> {
    return this.getOutOfStockItems(businessUnitId);
  },

  // ── UTILITY ────────────────────────────────

  getStockStatus(item: FlatInventory): string {
    if (!item) return 'unknown';
    const available = item.available || 0;
    const reorderPoint = item.reorderPoint ?? item.reorderQuantity ?? 5;

    if (available <= 0) return 'out_of_stock';
    if (available <= reorderPoint) return 'low_stock';
    return 'in_stock';
  },

  getStockBadgeColor(status: string): string {
    switch (status) {
      case 'out_of_stock':
        return 'danger';
      case 'low_stock':
        return 'warning';
      case 'in_stock':
        return 'success';
      default:
        return 'secondary';
    }
  },

  isLowStock(item: FlatInventory): boolean {
    if (!item) return false;
    const available = item.available || 0;
    const reorderPoint = item.reorderPoint ?? item.reorderQuantity ?? 5;
    return available > 0 && available <= reorderPoint;
  },

  isOutOfStock(item: FlatInventory): boolean {
    if (!item) return false;
    return (item.available || 0) <= 0;
  },

  getStockPercentage(item: FlatInventory): number {
    if (!item) return 0;
    const maxStock = typeof item.maxStock === 'number' ? item.maxStock : 100;
    const available = typeof item.available === 'number' ? item.available : 0;
    return Math.min(100, (available / maxStock) * 100);
  },
};

export default inventoryService;
