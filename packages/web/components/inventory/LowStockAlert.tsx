// packages/web/components/inventory/LowStockAlert.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  Check,
  Loader2,
  RefreshCw,
  Building,
  Eye,
  Search,
  AlertCircle,
  CheckCircle,
  Lock,
} from 'lucide-react';

import { inventoryService } from '../../services/inventoryService';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { formatCurrency } from '../../utils/formatters';
import { PermissionResource } from '../../types/enums';

// ============================================
// COMPONENT-FACING TYPE
// ============================================
//
// `InventoryItem` is the shape this component renders. It is NOT
// the wire shape returned by `inventoryService.getLowStockItems`.
//
// The service returns `FlatInventory[]` — a denormalized shape with
// nullable FKs (`productId: string | null | undefined`) and product
// fields either flattened or semi-nested. Rows from the service are
// routed through `normalizeInventoryItem`, which drops orphans and
// fills in defaults, before they reach component state.

interface InventoryItem {
  id: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    images?: string[];
    unitPrice: number;
    costPrice?: number;
    category?: { id: string; name: string };
    supplier?: { id: string; name: string };
    description?: string;
    taxRate?: number;
    weight?: number;
  };
  variantId?: string;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: Record<string, unknown>;
  };
  businessUnitId: string;
  businessUnit?: { id: string; name: string; code: string };
  quantity: number;
  reserved: number;
  available?: number;
  reorderPoint: number;
  reorderQuantity: number;
  location?: string;
  shelfNumber?: string;
  /** Free-text supplier name; NOT the supplier id. */
  supplier?: string;
  /** The supplier FK, if the backend returned it. */
  supplierId?: string;
  notes?: string;
  status: string;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  unit?: string;
  weight?: number;
  taxRate?: number;
  tags?: string[];
  images?: string[];
  expiryDate?: string;
  batchNumber?: string;
  createdAt: string;
  updatedAt: string;
}

interface LowStockAlertProps {
  className?: string;
  maxItems?: number;
  showFilters?: boolean;
  showActions?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  compact?: boolean;
  onItemSelect?: (item: InventoryItem) => void;
  onGeneratePO?: (items: InventoryItem[]) => void;
}

type FilterKey = 'all' | 'low' | 'out';

// ============================================
// NORMALIZER
// ============================================

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Map a `FlatInventory` row (or semi-nested variant) into the
 * component's `InventoryItem` shape.
 *
 * Handles two wire variants:
 *
 *   1. Flat:        { productId, productName, sku, unitPrice,
 *                     currentQuantity, reorderPoint, ... }
 *   2. Semi-nested: { productId, quantity, reorderPoint,
 *                     product: { name, sku, images, ... } }
 *
 * Rows without a usable product id are dropped.
 */
function normalizeInventoryItem(raw: unknown): InventoryItem | null {
  if (!raw || typeof raw !== 'object') return null;

  const r = raw as Record<string, unknown>;

  const productIdRaw =
    typeof r.productId === 'string' ? r.productId : undefined;
  const idRaw = typeof r.id === 'string' ? r.id : undefined;
  const resolvedProductId = productIdRaw ?? idRaw;

  if (!resolvedProductId) return null;

  const inventoryId = idRaw ?? resolvedProductId;

  const nestedProduct =
    r.product && typeof r.product === 'object'
      ? (r.product as Record<string, unknown>)
      : null;

  const nestedCategory =
    nestedProduct?.category && typeof nestedProduct.category === 'object'
      ? (nestedProduct.category as Record<string, unknown>)
      : null;

  const nestedSupplier =
    nestedProduct?.supplier && typeof nestedProduct.supplier === 'object'
      ? (nestedProduct.supplier as Record<string, unknown>)
      : null;

  const productName =
    toOptionalString(nestedProduct?.name) ??
    toOptionalString(r.productName) ??
    toOptionalString(r.name) ??
    'Unknown Product';

  const productSku =
    toOptionalString(nestedProduct?.sku) ??
    toOptionalString(r.sku) ??
    'N/A';

  const unitPrice =
    toNumber(nestedProduct?.unitPrice) ||
    toNumber(r.unitPrice) ||
    toNumber(nestedProduct?.price) ||
    toNumber(r.price) ||
    0;

  const costPriceRaw =
    toNumber(nestedProduct?.costPrice) || toNumber(r.costPrice);
  const costPrice = costPriceRaw > 0 ? costPriceRaw : undefined;

  const images = Array.isArray(nestedProduct?.images)
    ? (nestedProduct.images as unknown[]).filter(
        (x): x is string => typeof x === 'string',
      )
    : Array.isArray(r.images)
    ? (r.images as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  const category = nestedCategory
    ? {
        id: String(nestedCategory.id ?? ''),
        name: String(nestedCategory.name ?? ''),
      }
    : toOptionalString(r.categoryName)
    ? { id: '', name: String(r.categoryName) }
    : undefined;

  const supplierRelation = nestedSupplier
    ? {
        id: String(nestedSupplier.id ?? ''),
        name: String(nestedSupplier.name ?? ''),
      }
    : undefined;

  const quantity = toNumber(r.quantity ?? r.currentQuantity ?? 0);
  const reserved = toNumber(r.reserved ?? 0);
  const available =
    typeof r.available === 'number'
      ? r.available
      : quantity - reserved;

  const reorderPoint = toNumber(r.reorderPoint ?? 5);
  const reorderQuantity = toNumber(r.reorderQuantity ?? 10);

  const supplierId =
    toOptionalString(r.supplierId) ?? supplierRelation?.id;

  const supplierName =
    toOptionalString(r.supplier) ?? supplierRelation?.name;

  const createdAt =
    toOptionalString(r.createdAt) ?? new Date().toISOString();
  const updatedAt =
    toOptionalString(r.updatedAt) ?? createdAt;

  const item: InventoryItem = {
    id: inventoryId,
    productId: resolvedProductId,
    product: {
      id: resolvedProductId,
      name: productName,
      sku: productSku,
      images,
      unitPrice,
      costPrice,
      category,
      supplier: supplierRelation,
      description:
        toOptionalString(nestedProduct?.description) ??
        toOptionalString(r.description),
      taxRate:
        typeof nestedProduct?.taxRate === 'number'
          ? nestedProduct.taxRate
          : typeof r.taxRate === 'number'
          ? r.taxRate
          : undefined,
      weight:
        typeof nestedProduct?.weight === 'number'
          ? nestedProduct.weight
          : typeof r.weight === 'number'
          ? r.weight
          : undefined,
    },
    variantId: toOptionalString(r.variantId),
    businessUnitId: toOptionalString(r.businessUnitId) ?? '',
    quantity,
    reserved,
    available,
    reorderPoint,
    reorderQuantity,
    location: toOptionalString(r.location),
    shelfNumber: toOptionalString(r.shelfNumber),
    supplier: supplierName,
    supplierId,
    notes: toOptionalString(r.notes),
    status: toOptionalString(r.status) ?? 'ACTIVE',
    isActive:
      typeof r.isActive === 'boolean' ? r.isActive : true,
    unit: toOptionalString(r.unit) ?? 'each',
    images,
    createdAt,
    updatedAt,
  };

  return item;
}

// ============================================
// ERROR EXTRACTION
// ============================================

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const anyErr = error as any;
  const data = anyErr?.response?.data;

  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: any) => `${e.field ?? 'field'}: ${e.message ?? 'invalid'}`)
        .join(', ');
    }
  }

  if (anyErr?.message) return String(anyErr.message);
  return fallback;
}

function resolveSupplierId(item: InventoryItem): string | null {
  if (
    typeof item.supplierId === 'string' &&
    item.supplierId.length > 0
  ) {
    return item.supplierId;
  }
  const nested = item.product?.supplier?.id;
  if (typeof nested === 'string' && nested.length > 0) return nested;
  return null;
}

function computeNeeded(item: InventoryItem): number {
  const reorderPoint = item.reorderPoint || 5;
  const reorderQuantity = item.reorderQuantity || 10;
  return Math.max(0, reorderPoint - item.quantity + reorderQuantity);
}

function isLow(item: InventoryItem): boolean {
  const reorderPoint = item.reorderPoint || 5;
  return item.quantity > 0 && item.quantity <= reorderPoint;
}

function isOut(item: InventoryItem): boolean {
  return item.quantity === 0;
}

// ============================================
// SUBCOMPONENTS
// ============================================

const StatusBadge: React.FC<{
  quantity: number;
  reorderPoint: number;
  isActive?: boolean;
}> = ({ quantity, reorderPoint, isActive = true }) => {
  if (!isActive) {
    return (
      <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        Inactive
      </span>
    );
  }

  if (quantity === 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Out of Stock
      </span>
    );
  }

  if (quantity <= reorderPoint) {
    return (
      <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Low Stock
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300 flex items-center gap-1">
      <CheckCircle className="w-3 h-3" />
      In Stock
    </span>
  );
};

const ProgressBar: React.FC<{
  value: number;
  max: number;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}> = ({ value, max, color = 'blue' }) => {
  const safeMax = max > 0 ? max : 1;
  const percentage = Math.max(0, Math.min((value / safeMax) * 100, 100));

  const colorClasses: Record<string, string> = {
    blue: 'bg-brand-500',
    green: 'bg-success-500',
    yellow: 'bg-warning-500',
    red: 'bg-danger-500',
  };

  return (
    <div className="w-full">
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} rounded-full transition-[width] duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// ============================================
// COMPONENT
// ============================================

export function LowStockAlert({
  className = '',
  maxItems = 50,
  showFilters = true,
  showActions = true,
  autoRefresh = true,
  refreshInterval = 60000,
  compact = false,
  onItemSelect,
  onGeneratePO,
}: LowStockAlertProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [generatingPO, setGeneratingPO] = useState(false);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const mountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Permissions ───────────────────────────────────────────

  const canManage = useMemo(() => {
    return hasPermission(`${PermissionResource.INVENTORY}:manage`);
  }, [hasPermission]);

  const canCreatePO = useMemo(() => {
    return hasPermission(`${PermissionResource.INVENTORY}:create`);
  }, [hasPermission]);

  // ── Business unit ─────────────────────────────────────────

  const [businessUnitId, setBusinessUnitId] = useState<string>('');

  useEffect(() => {
    if (businessUnitId) return;
    if (typeof window === 'undefined') return;

    const fromUser =
      user?.businessUnits?.[0]?.businessUnitId ||
      (user?.businessUnits?.[0] as any)?.id;

    if (fromUser) {
      setBusinessUnitId(fromUser);
      return;
    }

    try {
      const stored = localStorage.getItem('businessUnitId');
      if (stored) setBusinessUnitId(stored);
    } catch {
      /* ignore */
    }
  }, [user?.businessUnits, businessUnitId]);

  // ── Load ──────────────────────────────────────────────────

  const loadLowStockItems = useCallback(
    async (options: { silent?: boolean } = {}): Promise<boolean> => {
      const requestId = ++fetchRequestIdRef.current;

      if (!businessUnitId) {
        setLoading(false);
        setRefreshing(false);
        return false;
      }

      if (!options.silent) setLoading(true);
      setLoadError(null);

      try {
        const data: unknown =
          await inventoryService.getLowStockItems(businessUnitId);

        if (requestId !== fetchRequestIdRef.current) return false;
        if (!mountedRef.current) return false;

        const raw: unknown[] = Array.isArray(data) ? data : [];

        const itemsArray: InventoryItem[] = raw
          .map(normalizeInventoryItem)
          .filter((x): x is InventoryItem => x !== null);

        setItems(itemsArray);
        setLastFetchedAt(new Date());
        return true;
      } catch (error) {
        if (requestId !== fetchRequestIdRef.current) return false;
        if (!mountedRef.current) return false;

        const message = extractErrorMessage(
          error,
          'Failed to load low stock items',
        );
        console.error('[LowStockAlert] load failed:', message);
        setLoadError(message);
        setItems([]);
        return false;
      } finally {
        if (requestId === fetchRequestIdRef.current && mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [businessUnitId],
  );

  useEffect(() => {
    if (isAuthenticated && businessUnitId) {
      void loadLowStockItems();
    }
  }, [isAuthenticated, businessUnitId, loadLowStockItems]);

  useEffect(() => {
    if (!autoRefresh || !isAuthenticated || !businessUnitId) return;
    const id = setInterval(() => {
      void loadLowStockItems({ silent: true });
    }, refreshInterval);
    return () => clearInterval(id);
  }, [
    autoRefresh,
    refreshInterval,
    isAuthenticated,
    businessUnitId,
    loadLowStockItems,
  ]);

  // ── Stats ─────────────────────────────────────────────────

  const stats = useMemo(() => {
    const lowStock = items.filter(isLow).length;
    const outOfStock = items.filter(isOut).length;
    const totalValue = items.reduce(
      (sum, item) =>
        sum + (item.quantity || 0) * (item.product?.unitPrice || 0),
      0,
    );
    return { total: items.length, lowStock, outOfStock, totalValue };
  }, [items]);

  // ── Filtered list ─────────────────────────────────────────

  const filteredItems = useMemo((): InventoryItem[] => {
    let list = items;

    if (filter === 'low') {
      list = list.filter(isLow);
    } else if (filter === 'out') {
      list = list.filter(isOut);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.product?.name?.toLowerCase().includes(q) ||
          item.product?.sku?.toLowerCase().includes(q) ||
          item.supplier?.toLowerCase().includes(q),
      );
    }

    return [...list]
      .sort((a, b) => {
        const aRank = isOut(a) ? 0 : isLow(a) ? 1 : 2;
        const bRank = isOut(b) ? 0 : isLow(b) ? 1 : 2;
        return aRank - bRank;
      })
      .slice(0, showAll ? maxItems : Math.min(10, maxItems));
  }, [items, filter, searchQuery, showAll, maxItems]);

  // ── Selection ─────────────────────────────────────────────

  const allVisibleSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    const selected = new Set(selectedItems);
    return filteredItems.every((item) => selected.has(item.id));
  }, [filteredItems, selectedItems]);

  const handleSelectAll = useCallback(() => {
    const visibleIds = filteredItems.map((item) => item.id);
    const visibleSet = new Set(visibleIds);

    if (allVisibleSelected) {
      setSelectedItems((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.add(id);
        return Array.from(next);
      });
    }
  }, [filteredItems, allVisibleSelected]);

  const handleSelectItem = useCallback((id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  // ── Generate PO ───────────────────────────────────────────

  const handleGeneratePO = useCallback(
    async (explicitIds?: string[]) => {
      const ids = explicitIds ?? selectedItems;

      if (ids.length === 0) {
        toast.warning('Please select items to reorder');
        return;
      }

      if (!businessUnitId) {
        toast.error('Business unit not found');
        return;
      }

      if (!canCreatePO) {
        toast.error('You do not have permission to create purchase orders');
        return;
      }

      const selectedInventoryItems = items.filter((item) =>
        ids.includes(item.id),
      );

      if (selectedInventoryItems.length === 0) {
        toast.error('No matching items found');
        return;
      }

      const bySupplier = new Map<string, InventoryItem[]>();
      const withoutSupplier: InventoryItem[] = [];

      for (const item of selectedInventoryItems) {
        const supplierId = resolveSupplierId(item);
        if (!supplierId) {
          withoutSupplier.push(item);
          continue;
        }
        const bucket = bySupplier.get(supplierId) ?? [];
        bucket.push(item);
        bySupplier.set(supplierId, bucket);
      }

      if (bySupplier.size === 0 && withoutSupplier.length > 0) {
        toast.error(
          'None of the selected items have a supplier. Assign suppliers before generating a PO.',
        );
        return;
      }

      setGeneratingPO(true);

      const succeeded: string[] = [];
      const failed: Array<{ supplierId: string; message: string }> = [];

      try {
        if (onGeneratePO) {
          await onGeneratePO(selectedInventoryItems);
          toast.success('Purchase order request submitted');
          setSelectedItems([]);
          void loadLowStockItems({ silent: true });
          return;
        }

        // ⚠ `Map.forEach` iterates without requiring
        //    `--downlevelIteration` or a target ≥ ES2015. The
        //    callback's parameters are inferred from the Map's
        //    value type — `supplierItems` is `InventoryItem[]`,
        //    so `supplierItems.map((item) => ...)` has `item:
        //    InventoryItem` without an explicit annotation. This
        //    is what fixes both TS2802 and TS7006 without
        //    touching tsconfig.
        //
        //    `forEach` is synchronous, so `await` inside the
        //    callback is not awaited by the enclosing loop. To
        //    preserve the sequential behavior of the previous
        //    `for...of`, the async body is pushed into a queue
        //    of promises and awaited with `Promise.allSettled`.
        const tasks: Array<Promise<void>> = [];

        bySupplier.forEach((supplierItems, supplierId) => {
          tasks.push(
            (async () => {
              try {
                await purchaseOrderService.createPurchaseOrder({
                  supplierId,
                  businessUnitId,
                  items: supplierItems.map((item) => ({
                    productId: item.productId || item.id,
                    quantity: computeNeeded(item),
                    unitPrice:
                      item.product?.costPrice ??
                      item.product?.unitPrice ??
                      0,
                  })),
                  notes: 'Auto-generated from low stock alert',
                });
                succeeded.push(supplierId);
              } catch (err) {
                const message = extractErrorMessage(err, 'Unknown error');
                console.error(
                  `[LowStockAlert] PO for supplier ${supplierId} failed:`,
                  message,
                );
                failed.push({ supplierId, message });
              }
            })(),
          );
        });

        await Promise.allSettled(tasks);

        const messages: string[] = [];
        if (succeeded.length > 0) {
          messages.push(
            `${succeeded.length} purchase order${
              succeeded.length === 1 ? '' : 's'
            } created`,
          );
        }
        if (failed.length > 0) {
          messages.push(`${failed.length} failed`);
        }
        if (withoutSupplier.length > 0) {
          messages.push(
            `${withoutSupplier.length} item${
              withoutSupplier.length === 1 ? '' : 's'
            } skipped (no supplier)`,
          );
        }

        if (succeeded.length > 0 && failed.length === 0) {
          toast.success(messages.join(' • '));
          setSelectedItems([]);
        } else if (succeeded.length > 0) {
          toast.warning(messages.join(' • '));
          const failedIds = selectedInventoryItems
            .filter((item) => {
              const sid = resolveSupplierId(item);
              return sid && failed.some((f) => f.supplierId === sid);
            })
            .map((item) => item.id);
          setSelectedItems(failedIds);
        } else {
          toast.error(messages.join(' • ') || 'Failed to create purchase orders');
        }

        if (succeeded.length > 0) {
          void loadLowStockItems({ silent: true });
        }
      } catch (err) {
        const message = extractErrorMessage(
          err,
          'Failed to generate purchase order',
        );
        console.error('[LowStockAlert] PO generation failed:', message);
        toast.error(message);
      } finally {
        if (mountedRef.current) setGeneratingPO(false);
      }
    },
    [
      selectedItems,
      items,
      businessUnitId,
      canCreatePO,
      onGeneratePO,
      loadLowStockItems,
    ],
  );

  const handleReorderSingle = useCallback(
    (itemId: string) => {
      setSelectedItems([itemId]);
      void handleGeneratePO([itemId]);
    },
    [handleGeneratePO],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const ok = await loadLowStockItems({ silent: true });
    if (ok) {
      toast.success('Inventory refreshed');
    } else {
      toast.error('Failed to refresh inventory');
    }
  }, [loadLowStockItems]);

  // ── Render: unauthenticated ───────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Please log in to view low stock alerts
        </p>
      </div>
    );
  }

  // ── Render: first load ────────────────────────────────────

  if (loading && items.length === 0 && !loadError) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading low stock items…
        </span>
      </div>
    );
  }

  // ── Render: load error (no data) ──────────────────────────

  if (loadError && items.length === 0) {
    return (
      <div
        className={`p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-2xl flex items-start gap-3 ${className}`}
      >
        <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-danger-700 dark:text-danger-300">
            {loadError}
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            className="mt-2 text-sm text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 focus-ring rounded"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Render: main panel ────────────────────────────────────

  const hasItems = items.length > 0;
  const hasFilteredItems = filteredItems.length > 0;
  const hiddenSelectedCount = useMemo(() => {
    const visible = new Set(filteredItems.map((item) => item.id));
    return selectedItems.filter((id) => !visible.has(id)).length;
  }, [filteredItems, selectedItems]);

  return (
    <div className={`card-brand !p-0 overflow-hidden ${className}`}>
      <div
        className={`border-b bg-gradient-to-r from-danger-50 to-brand-50 dark:from-danger-900/20 dark:to-brand-900/20 ${
          compact ? 'p-3' : 'p-4'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger-100 dark:bg-danger-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-danger-600 dark:text-danger-400" />
            </div>
            <div>
              <h3 className="font-semibold text-danger-700 dark:text-danger-300 text-sm sm:text-base">
                Low Stock Alert
              </h3>
              <p className="text-2xs text-danger-600 dark:text-danger-400 tabular-nums">
                {hasItems
                  ? `${stats.total} item${stats.total === 1 ? '' : 's'} need attention`
                  : 'All stock levels are healthy'}
              </p>
            </div>
          </div>

          {!compact && showActions && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="Refresh low stock items"
                className="p-1.5 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50 focus-ring"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                />
              </button>

              {canManage && hasItems && (
                <>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={filteredItems.length === 0}
                    className="px-2 py-1 text-2xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors focus-ring disabled:opacity-50"
                  >
                    {allVisibleSelected ? 'Deselect All' : 'Select All'}
                  </button>

                  {canCreatePO && (
                    <button
                      type="button"
                      onClick={() => void handleGeneratePO()}
                      disabled={selectedItems.length === 0 || generatingPO}
                      className="px-3 py-1 text-2xs bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 flex items-center gap-1.5 transition-all focus-ring tabular-nums"
                    >
                      {generatingPO ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ShoppingCart className="w-3 h-3" />
                      )}
                      Generate PO ({selectedItems.length})
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {hiddenSelectedCount > 0 && (
          <p className="mt-2 text-2xs text-gray-500 dark:text-gray-400 tabular-nums">
            {hiddenSelectedCount} selected item
            {hiddenSelectedCount === 1 ? '' : 's'} not shown under the current
            filter.
          </p>
        )}

        {showFilters && hasItems && !compact && (
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div
              className="flex gap-1"
              role="group"
              aria-label="Stock status filter"
            >
              <button
                type="button"
                onClick={() => setFilter('all')}
                aria-pressed={filter === 'all'}
                className={`px-2 py-0.5 text-2xs rounded-lg transition-colors tabular-nums focus-ring ${
                  filter === 'all'
                    ? 'bg-white dark:bg-gray-700 shadow-sm dark:shadow-gray-900'
                    : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilter('low')}
                aria-pressed={filter === 'low'}
                className={`px-2 py-0.5 text-2xs rounded-lg transition-colors tabular-nums focus-ring ${
                  filter === 'low'
                    ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300'
                    : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
                }`}
              >
                Low ({stats.lowStock})
              </button>
              <button
                type="button"
                onClick={() => setFilter('out')}
                aria-pressed={filter === 'out'}
                className={`px-2 py-0.5 text-2xs rounded-lg transition-colors tabular-nums focus-ring ${
                  filter === 'out'
                    ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
                    : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
                }`}
              >
                Out ({stats.outOfStock})
              </button>
            </div>

            <div className="flex-1 min-w-[120px] relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Search products…"
                aria-label="Search low stock items"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-2xs border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 bg-white/80 dark:bg-gray-700/80 dark:text-white focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {compact && hasItems && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-2xs">
          <span className="text-gray-600 dark:text-gray-400 tabular-nums">
            <span className="text-danger-600 dark:text-danger-400 font-medium">
              {stats.outOfStock}
            </span>{' '}
            out of stock ·
            <span className="text-warning-600 dark:text-warning-400 font-medium">
              {' '}
              {stats.lowStock}
            </span>{' '}
            low stock
          </span>
          <span
            className="text-gray-400 tabular-nums"
            title="Value of items currently at or below reorder point"
          >
            Low stock value: {formatCurrency(stats.totalValue)}
          </span>
        </div>
      )}

      {!hasFilteredItems ? (
        <div className="p-8 text-center">
          {hasItems ? (
            <>
              <Check className="w-12 h-12 text-success-500 dark:text-success-400 mx-auto mb-3" />
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                No items match this filter
              </h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Try changing the filter or search term.
              </p>
            </>
          ) : (
            <>
              <Check className="w-12 h-12 text-success-500 dark:text-success-400 mx-auto mb-3" />
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                All Stock Levels Are Healthy
              </h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No items are currently below their reorder point.
              </p>
            </>
          )}
        </div>
      ) : (
        <div
          role="list"
          aria-label="Low stock items"
          className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[500px] overflow-y-auto custom-scrollbar"
        >
          {filteredItems.map((item, index) => {
            const isSelected = selectedItems.includes(item.id);
            const needed = computeNeeded(item);
            const hasImage =
              (item.product?.images?.length ?? 0) > 0 ||
              (item.images?.length ?? 0) > 0;
            const imageUrl = item.product?.images?.[0] ?? item.images?.[0];
            const shouldAnimate = index < 5;

            const content = (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {showActions && canManage && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectItem(item.id)}
                        aria-label={`Select ${item.product?.name ?? 'item'}`}
                        className="w-4 h-4 text-brand-600 rounded border-gray-300 dark:border-gray-600 focus:ring-brand-500 focus:outline-none flex-shrink-0"
                      />
                    )}

                    <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {hasImage && imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.product?.name ?? 'Product'}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Package className="w-4 h-4 text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {item.product?.name ?? 'Unknown Product'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-2xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono tabular-nums">
                          {item.product?.sku ?? 'N/A'}
                        </span>
                        {item.location && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">
                              |
                            </span>
                            <span>{item.location}</span>
                          </>
                        )}
                        {item.supplier && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">
                              |
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Building className="w-3 h-3" />
                              {item.supplier}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-2xs text-gray-500 dark:text-gray-400">
                          Stock
                        </p>
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            item.quantity === 0
                              ? 'text-danger-600 dark:text-danger-400'
                              : item.quantity <= (item.reorderPoint || 5)
                              ? 'text-warning-600 dark:text-warning-400'
                              : 'text-success-600 dark:text-success-400'
                          }`}
                        >
                          {item.quantity}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xs text-gray-500 dark:text-gray-400">
                          Reorder
                        </p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                          {item.reorderPoint || 5}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xs text-gray-500 dark:text-gray-400">
                          Needed
                        </p>
                        <p className="text-sm font-medium text-brand-600 dark:text-brand-400 tabular-nums">
                          {needed}
                        </p>
                      </div>
                    </div>

                    <StatusBadge
                      quantity={item.quantity || 0}
                      reorderPoint={item.reorderPoint || 5}
                      isActive={item.isActive}
                    />

                    {showActions && !compact && (
                      <div className="flex gap-1">
                        {canCreatePO &&
                          item.quantity <= (item.reorderPoint || 5) && (
                            <button
                              type="button"
                              onClick={() => handleReorderSingle(item.id)}
                              disabled={generatingPO}
                              className="px-2 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 rounded-lg hover:bg-warning-200 dark:hover:bg-warning-900/50 text-2xs font-medium disabled:opacity-50 transition-colors focus-ring"
                            >
                              Reorder
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => {
                            if (onItemSelect) {
                              onItemSelect(item);
                            } else {
                              router.push(`/admin/inventory/${item.id}`);
                            }
                          }}
                          className="p-1 hover:bg-orange-50 dark:hover:bg-gray-600 rounded-lg transition-colors focus-ring"
                          aria-label={`View ${
                            item.product?.name ?? 'item'
                          } details`}
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {!compact && (
                  <div className="mt-2">
                    <ProgressBar
                      value={item.quantity || 0}
                      max={Math.max((item.reorderPoint || 5) * 2, 10)}
                      color={
                        item.quantity === 0
                          ? 'red'
                          : item.quantity <= (item.reorderPoint || 5)
                          ? 'yellow'
                          : 'green'
                      }
                    />
                  </div>
                )}
              </>
            );

            if (shouldAnimate) {
              return (
                <motion.div
                  key={item.id}
                  role="listitem"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`p-3 hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors ${
                    compact ? 'p-2' : ''
                  }`}
                >
                  {content}
                </motion.div>
              );
            }

            return (
              <div
                key={item.id}
                role="listitem"
                className={`p-3 hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors ${
                  compact ? 'p-2' : ''
                }`}
              >
                {content}
              </div>
            );
          })}
        </div>
      )}

      {hasFilteredItems && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex flex-wrap items-center justify-between gap-2 text-2xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              Showing {filteredItems.length} of {items.length} item
              {items.length === 1 ? '' : 's'}
            </span>
            {items.length > 10 && !showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium focus-ring rounded"
              >
                View all ({items.length})
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {selectedItems.length > 0 && (
              <span className="text-brand-600 dark:text-brand-400 tabular-nums">
                {selectedItems.length} selected
              </span>
            )}
            {lastFetchedAt && (
              <span
                className="tabular-nums"
                title={lastFetchedAt.toISOString()}
              >
                Updated{' '}
                {lastFetchedAt.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LowStockAlert;
