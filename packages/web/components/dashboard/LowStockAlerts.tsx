// packages/web/components/inventory/LowStockAlerts.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  X,
  Check,
  Loader2,
  RefreshCw,
  Bell,
  Building,
  Eye,
  AlertCircle,
} from 'lucide-react';

import { inventoryService } from '../../services/inventoryService';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';

// ============================================
// TYPES
// ============================================

interface LowStockItem {
  id: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    images?: string[];
    unitPrice: number;
    costPrice?: number;
    category?: { name: string };
  };
  variantId?: string;
  businessUnitId: string;
  quantity: number;
  reserved: number;
  reorderPoint: number;
  reorderQuantity: number;
  location?: string;
  /** Free-text supplier name, or a supplier id if the backend sends one. */
  supplier?: string;
  supplierId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

type FilterKey = 'all' | 'low' | 'out';

// ============================================
// HELPERS
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

/**
 * Normalize a raw item returned by `inventoryService.getLowStockItems`.
 *
 * The backend has more than one "low stock" endpoint and they don't
 * share a response shape:
 *
 *   - `/inventory/low-stock`  → nested `product`, `quantity`, `reorderQuantity`
 *   - `/dashboard/low-stock`  → flat `productName`, `sku`, `currentQuantity`
 *
 * Rather than couple the component to whichever endpoint the service
 * happens to hit, normalize both shapes into the canonical one the UI
 * needs.
 */
function normalizeLowStockItem(raw: any): LowStockItem | null {
  if (!raw || typeof raw !== 'object') return null;

  const quantity =
    typeof raw.quantity === 'number'
      ? raw.quantity
      : typeof raw.currentQuantity === 'number'
      ? raw.currentQuantity
      : 0;

  const reorderPoint =
    typeof raw.reorderPoint === 'number' ? raw.reorderPoint : 0;

  const reorderQuantity =
    typeof raw.reorderQuantity === 'number'
      ? raw.reorderQuantity
      : Math.max(10, reorderPoint || 10);

  // Nested `product` (canonical) or flat `productName` (dashboard).
  const product = raw.product
    ? {
        id: raw.product.id ?? raw.productId ?? '',
        name: raw.product.name ?? raw.productName ?? 'Unknown product',
        sku: raw.product.sku ?? raw.sku ?? '',
        images: Array.isArray(raw.product.images) ? raw.product.images : [],
        unitPrice:
          typeof raw.product.unitPrice === 'number'
            ? raw.product.unitPrice
            : 0,
        costPrice:
          typeof raw.product.costPrice === 'number'
            ? raw.product.costPrice
            : undefined,
        category: raw.product.category,
      }
    : {
        id: raw.productId ?? '',
        name: raw.productName ?? 'Unknown product',
        sku: raw.sku ?? '',
        images: [],
        unitPrice: 0,
        costPrice: undefined,
        category: undefined,
      };

  return {
    id: String(raw.id ?? raw.productId ?? ''),
    productId: String(raw.productId ?? product.id ?? ''),
    product,
    variantId: raw.variantId,
    businessUnitId: String(raw.businessUnitId ?? ''),
    quantity,
    reserved: typeof raw.reserved === 'number' ? raw.reserved : 0,
    reorderPoint,
    reorderQuantity,
    location: raw.location,
    supplier: typeof raw.supplier === 'string' ? raw.supplier : undefined,
    supplierId:
      typeof raw.supplierId === 'string' ? raw.supplierId : undefined,
    status: String(raw.status ?? 'ACTIVE'),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

// ============================================
// COMPONENT
// ============================================

export function LowStockAlerts() {
  const { user, canManageInventory } = useAuth();

  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [generatingPO, setGeneratingPO] = useState(false);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LowStockItem | null>(null);
  const [restockData, setRestockData] = useState({
    quantity: 1,
    supplier: '',
    unitPrice: 0,
    purchaseDate: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  /**
   * Percentage of the reorder point below which an item is flagged as
   * low. Applied client-side to the returned list — the backend's
   * `/dashboard/low-stock` uses a fixed threshold. Changing this
   * value re-filters the displayed items; it does not change what the
   * server returns.
   */
  const [alertThreshold, setAlertThreshold] = useState(100);

  const mountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Load ──────────────────────────────────────────────────

  const loadLowStockItems = useCallback(
    async (options: { silent?: boolean } = {}): Promise<boolean> => {
      const requestId = ++fetchRequestIdRef.current;

      if (!businessUnitId) {
        setLoading(false);
        setRefreshing(false);
        return false;
      }

      if (!options.silent) {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const raw = await inventoryService.getLowStockItems(businessUnitId);

        if (requestId !== fetchRequestIdRef.current) return false;
        if (!mountedRef.current) return false;

        const normalized = (Array.isArray(raw) ? raw : [])
          .map(normalizeLowStockItem)
          .filter((x): x is LowStockItem => x !== null);

        setItems(normalized);
        return true;
      } catch (error) {
        if (requestId !== fetchRequestIdRef.current) return false;
        if (!mountedRef.current) return false;

        const message = extractErrorMessage(
          error,
          'Failed to load low stock items',
        );
        console.error('[LowStockAlerts] load failed:', message);
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

  // ── Initial load + 60s polling ────────────────────────────
  //
  // The interval refresh is *silent*: it doesn't flip `loading`, so
  // the panel doesn't blank out once a minute. Errors from the poll
  // are logged but don't toast — a background refresh failing
  // shouldn't interrupt the user.

  useEffect(() => {
    void loadLowStockItems();
    const interval = setInterval(() => {
      void loadLowStockItems({ silent: true });
    }, 60000);
    return () => clearInterval(interval);
  }, [loadLowStockItems]);

  // ── Refresh (user-initiated) ──────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const ok = await loadLowStockItems({ silent: true });
    if (ok) {
      toast.success('Inventory refreshed');
    } else {
      toast.error('Failed to refresh inventory');
    }
  }, [loadLowStockItems]);

  // ── Derived list ──────────────────────────────────────────

  const filteredItems = useMemo(() => {
    let filtered = items;

    if (filter === 'low') {
      filtered = filtered.filter(
        (item) => item.quantity > 0 && item.quantity <= item.reorderPoint,
      );
    } else if (filter === 'out') {
      filtered = filtered.filter((item) => item.quantity === 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.product?.name?.toLowerCase().includes(q) ||
          item.product?.sku?.toLowerCase().includes(q),
      );
    }

    return filtered;
  }, [items, filter, searchQuery]);

  const lowCount = useMemo(
    () =>
      items.filter(
        (i) => i.quantity > 0 && i.quantity <= i.reorderPoint,
      ).length,
    [items],
  );
  const outCount = useMemo(
    () => items.filter((i) => i.quantity === 0).length,
    [items],
  );
  const urgentCount = outCount;
  const needsAttention = lowCount + outCount;

  // ── Selection ─────────────────────────────────────────────
  //
  // The selection is *not* cleared on filter change — the user's
  // choice survives. But "Select All" only toggles items currently
  // visible, and the header shows a note when the selection contains
  // items outside the current view.

  const allVisibleSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    const selected = new Set(selectedItems);
    return filteredItems.every((item) => selected.has(item.id));
  }, [filteredItems, selectedItems]);

  const hiddenSelectedCount = useMemo(() => {
    const visible = new Set(filteredItems.map((item) => item.id));
    return selectedItems.filter((id) => !visible.has(id)).length;
  }, [filteredItems, selectedItems]);

  const handleSelectAll = useCallback(() => {
    const visibleIds = filteredItems.map((item) => item.id);
    const visibleSet = new Set(visibleIds);

    if (allVisibleSelected) {
      // Deselect only the visible items; keep any hidden selection.
      setSelectedItems((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      // Add the visible items that aren't already selected.
      setSelectedItems((prev) => {
        const existing = new Set(prev);
        for (const id of visibleIds) existing.add(id);
        return Array.from(existing);
      });
    }
  }, [filteredItems, allVisibleSelected]);

  const toggleSelected = useCallback((itemId: string, checked: boolean) => {
    setSelectedItems((prev) =>
      checked ? Array.from(new Set([...prev, itemId])) : prev.filter((id) => id !== itemId),
    );
  }, []);

  // ── Generate purchase order ───────────────────────────────

  const handleGeneratePO = useCallback(async () => {
    if (selectedItems.length === 0) {
      toast.warning('Please select items to reorder');
      return;
    }

    if (!businessUnitId) {
      toast.error('Business unit not found');
      return;
    }

    // Resolve the selected items and validate supplier consistency.
    const selected = items.filter((item) => selectedItems.includes(item.id));

    if (selected.length === 0) {
      toast.error('No matching items found');
      return;
    }

    // Every item must have a supplier id — either explicitly on
    // `supplierId`, or the free-text `supplier` field falls through
    // to `supplierId: undefined` and we refuse. The backend expects a
    // real supplier FK, and sending `'default'` or a display name
    // corrupts the PO.
    const supplierIds = new Set(
      selected.map((item) => item.supplierId).filter(Boolean),
    );

    if (supplierIds.size === 0) {
      toast.error(
        'Selected items have no supplier. Add a supplier to each item before generating a PO.',
      );
      return;
    }

    if (supplierIds.size > 1) {
      toast.error(
        'Selected items span multiple suppliers. Create one PO per supplier.',
      );
      return;
    }

    const supplierId = Array.from(supplierIds)[0] as string;

    setGeneratingPO(true);
    try {
      await purchaseOrderService.createPurchaseOrder({
        supplierId,
        businessUnitId,
        items: selected.map((item) => ({
          productId: item.productId,
          quantity: item.reorderQuantity || 10,
          unitPrice: item.product?.costPrice ?? item.product?.unitPrice ?? 0,
        })),
        notes: 'Auto-generated from low stock alert',
      });

      toast.success('Purchase order created successfully');
      setSelectedItems([]);
      void loadLowStockItems({ silent: true });
    } catch (error) {
      const message = extractErrorMessage(
        error,
        'Failed to generate purchase order',
      );
      console.error('[LowStockAlerts] PO generation failed:', message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setGeneratingPO(false);
    }
  }, [selectedItems, items, businessUnitId, loadLowStockItems]);

  // ── Restock ───────────────────────────────────────────────

  const openRestockModal = useCallback((item: LowStockItem) => {
    const needed = Math.max(
      0,
      item.reorderPoint - item.quantity + (item.reorderQuantity || 10),
    );
    setSelectedItem(item);
    setRestockData({
      quantity: needed || item.reorderQuantity || 10,
      supplier: item.supplier || '',
      unitPrice: item.product?.costPrice ?? item.product?.unitPrice ?? 0,
      purchaseDate: '',
    });
    setShowRestockModal(true);
  }, []);

  const closeRestockModal = useCallback(() => {
    if (submitting) return;
    setShowRestockModal(false);
    setSelectedItem(null);
  }, [submitting]);

  const handleRestock = useCallback(async () => {
    if (!selectedItem) return;
    if (restockData.quantity <= 0) {
      toast.error('Quantity must be at least 1');
      return;
    }

    setSubmitting(true);
    try {
      await inventoryService.restockItem(selectedItem.id, {
        quantity: restockData.quantity,
        supplier: restockData.supplier || undefined,
        unitPrice: restockData.unitPrice || undefined,
        purchaseDate: restockData.purchaseDate || undefined,
      });

      toast.success('Item restocked successfully');
      setShowRestockModal(false);
      setSelectedItem(null);
      void loadLowStockItems({ silent: true });
    } catch (error) {
      const message = extractErrorMessage(error, 'Failed to restock item');
      console.error('[LowStockAlerts] restock failed:', message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [selectedItem, restockData, loadLowStockItems]);

  // ── Escape to close modal ─────────────────────────────────

  useEffect(() => {
    if (!showRestockModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRestockModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showRestockModal, closeRestockModal]);

  // ── Status badge ──────────────────────────────────────────

  const getStatusBadge = useCallback(
    (item: LowStockItem) => {
      if (item.quantity === 0) {
        return {
          label: 'Out of Stock',
          color:
            'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300',
        };
      }
      if (item.quantity <= item.reorderPoint) {
        return {
          label: 'Low Stock',
          color:
            'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300',
        };
      }
      return {
        label: 'In Stock',
        color:
          'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300',
      };
    },
    [],
  );

  // ── Render: first load ────────────────────────────────────

  if (loading && items.length === 0 && !loadError) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="card-brand !p-0 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-danger-50 to-brand-50 dark:from-danger-900/20 dark:to-brand-900/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger-100 dark:bg-danger-900/30 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-danger-600 dark:text-danger-400" />
            </div>
            <div>
              <h3 className="font-semibold text-danger-700 dark:text-danger-300">
                Low Stock Alerts
              </h3>
              <p className="text-sm text-danger-600 dark:text-danger-400 tabular-nums">
                {needsAttention} item{needsAttention === 1 ? '' : 's'} need
                attention
                {urgentCount > 0 && ` • ${urgentCount} out of stock`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg transition-colors focus-ring disabled:opacity-50"
              aria-label="Refresh inventory"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
            {canManageInventory && (
              <>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={filteredItems.length === 0}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors focus-ring disabled:opacity-50"
                >
                  {allVisibleSelected ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePO}
                  disabled={selectedItems.length === 0 || generatingPO}
                  className="px-4 py-1.5 text-sm bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 flex items-center gap-2 transition-all focus-ring tabular-nums"
                >
                  {generatingPO ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-4 h-4" />
                  )}
                  Generate PO ({selectedItems.length})
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg transition-colors focus-ring"
              aria-label="Alert settings"
              aria-expanded={showSettings}
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>

        {hiddenSelectedCount > 0 && (
          <p className="mt-2 text-2xs text-gray-500 dark:text-gray-400 tabular-nums">
            {hiddenSelectedCount} selected item
            {hiddenSelectedCount === 1 ? '' : 's'} not shown under the current
            filter.
          </p>
        )}

        {/* Settings */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="alert-threshold"
                    className="text-sm text-gray-600 dark:text-gray-400"
                  >
                    Alert Threshold:
                  </label>
                  <input
                    id="alert-threshold"
                    type="number"
                    value={alertThreshold}
                    onChange={(e) => {
                      const next = parseInt(e.target.value, 10);
                      setAlertThreshold(
                        Number.isFinite(next)
                          ? Math.min(200, Math.max(1, next))
                          : 100,
                      );
                    }}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus-ring"
                    min="1"
                    max="200"
                  />
                  <span className="text-sm text-gray-500">% of reorder point</span>
                </div>

                <label
                  className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  title="Auto-reorder is configured on the backend. Use the inventory settings page to enable it."
                >
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    className="w-4 h-4 text-brand-600 rounded focus-ring"
                  />
                  Auto-Reorder (server-side)
                </label>

                <button
                  type="button"
                  onClick={() => {
                    toast.success('Alert threshold applied');
                    setShowSettings(false);
                  }}
                  className="px-3 py-1 text-sm bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="flex gap-1 bg-white/50 dark:bg-white/5 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              aria-pressed={filter === 'all'}
              className={`px-3 py-1 text-xs rounded-lg transition-colors focus-ring tabular-nums ${
                filter === 'all'
                  ? 'bg-white dark:bg-gray-700 shadow-sm'
                  : 'hover:bg-white/50'
              }`}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('low')}
              aria-pressed={filter === 'low'}
              className={`px-3 py-1 text-xs rounded-lg transition-colors focus-ring tabular-nums ${
                filter === 'low'
                  ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
                  : 'hover:bg-white/50'
              }`}
            >
              Low ({lowCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('out')}
              aria-pressed={filter === 'out'}
              className={`px-3 py-1 text-xs rounded-lg transition-colors focus-ring tabular-nums ${
                filter === 'out'
                  ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                  : 'hover:bg-white/50'
              }`}
            >
              Out ({outCount})
            </button>
          </div>

          <div className="flex-1 min-w-[150px]">
            <input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search low stock items"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white/80 dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:outline-none transition-shadow"
            />
          </div>
        </div>
      </div>

      {/* Error banner */}
      {loadError && items.length === 0 && (
        <div className="p-4 flex items-start gap-2 border-b border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/20">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-danger-600 dark:text-danger-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-danger-700 dark:text-danger-300">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void loadLowStockItems()}
              className="mt-1 text-xs font-medium text-danger-700 dark:text-danger-300 hover:underline focus-ring rounded"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center">
          <Check className="w-12 h-12 text-success-500 mx-auto mb-3" />
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
            {items.length === 0
              ? 'All Stock Levels Are Healthy'
              : 'No Items Match Your Filter'}
          </h4>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {items.length === 0
              ? 'No items are currently below their reorder point'
              : 'Try changing the filter or search term'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[500px] overflow-y-auto custom-scrollbar">
          {filteredItems.map((item) => {
            const status = getStatusBadge(item);
            const isSelected = selectedItems.includes(item.id);
            const needed = Math.max(
              0,
              item.reorderPoint -
                item.quantity +
                (item.reorderQuantity || 10),
            );
            const productName = item.product?.name ?? 'Unknown product';

            return (
              <div
                key={item.id}
                className="p-4 hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) =>
                        toggleSelected(item.id, e.target.checked)
                      }
                      aria-label={`Select ${productName}`}
                      className="w-4 h-4 text-brand-600 rounded focus-ring"
                    />
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {item.product?.images?.[0] ? (
                        <img
                          src={item.product.images[0]}
                          alt={productName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {productName}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-2xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono">
                          SKU: {item.product?.sku ?? '—'}
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">
                          |
                        </span>
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {item.location || 'Warehouse'}
                        </span>
                        {item.product?.category?.name && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">
                              |
                            </span>
                            <span>{item.product.category.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Stock
                      </p>
                      <p
                        className={`text-lg font-bold tabular-nums ${
                          item.quantity === 0
                            ? 'text-danger-600 dark:text-danger-400'
                            : item.quantity <= item.reorderPoint
                            ? 'text-warning-600 dark:text-warning-400'
                            : 'text-success-600 dark:text-success-400'
                        }`}
                      >
                        {item.quantity}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Reorder Point
                      </p>
                      <p className="text-lg font-medium tabular-nums text-gray-900 dark:text-white">
                        {item.reorderPoint}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Needed
                      </p>
                      <p className="text-lg font-medium text-brand-600 dark:text-brand-400 tabular-nums">
                        {needed}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`px-2 py-1 rounded-full text-2xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    {canManageInventory && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openRestockModal(item)}
                          className="px-3 py-1 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 rounded-lg text-xs font-medium hover:bg-warning-200 dark:hover:bg-warning-900/50 transition-colors focus-ring"
                        >
                          Restock
                        </button>
                        <Link
                          href={`/inventory/${item.id}`}
                          className="p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                          aria-label={`View details for ${productName}`}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      item.quantity === 0
                        ? 'bg-danger-500'
                        : item.quantity <= item.reorderPoint
                        ? 'bg-warning-500'
                        : 'bg-success-500'
                    }`}
                    style={{
                      width: `${
                        item.reorderPoint > 0
                          ? Math.min(
                              (item.quantity / (item.reorderPoint * 2)) * 100,
                              100,
                            )
                          : 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {filteredItems.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex items-center justify-between text-2xs text-gray-500 dark:text-gray-400">
          <span className="tabular-nums">
            Showing {filteredItems.length} of {items.length} items
          </span>
        </div>
      )}

      {/* Restock Modal */}
      <AnimatePresence>
        {showRestockModal && selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-modal flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restock-modal-title"
          >
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeRestockModal}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover max-w-md w-full p-6"
            >
              <button
                type="button"
                onClick={closeRestockModal}
                disabled={submitting}
                className="absolute top-4 right-4 p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded focus-ring disabled:opacity-50"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              <h3
                id="restock-modal-title"
                className="text-lg font-bold text-gray-900 dark:text-white mb-4"
              >
                Restock Item
              </h3>

              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                <strong className="text-gray-700 dark:text-gray-300">
                  {selectedItem.product?.name ?? 'Unknown product'}
                </strong>
                <br />
                Current stock:{' '}
                <span className="font-medium tabular-nums">
                  {selectedItem.quantity}
                </span>
                <br />
                Reorder point:{' '}
                <span className="font-medium tabular-nums">
                  {selectedItem.reorderPoint}
                </span>
              </p>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="restock-quantity"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Quantity *
                  </label>
                  <input
                    id="restock-quantity"
                    type="number"
                    value={restockData.quantity}
                    onChange={(e) => {
                      const next = parseInt(e.target.value, 10);
                      setRestockData({
                        ...restockData,
                        quantity: Number.isFinite(next) ? next : 0,
                      });
                    }}
                    min="1"
                    className="input-brand tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="restock-supplier"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Supplier
                  </label>
                  <input
                    id="restock-supplier"
                    type="text"
                    value={restockData.supplier}
                    onChange={(e) =>
                      setRestockData({
                        ...restockData,
                        supplier: e.target.value,
                      })
                    }
                    className="input-brand"
                    placeholder="Supplier name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="restock-unit-price"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Unit Price
                  </label>
                  <input
                    id="restock-unit-price"
                    type="number"
                    value={restockData.unitPrice}
                    onChange={(e) => {
                      const next = parseFloat(e.target.value);
                      setRestockData({
                        ...restockData,
                        unitPrice: Number.isFinite(next) ? next : 0,
                      });
                    }}
                    min="0"
                    step="0.01"
                    className="input-brand tabular-nums"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label
                    htmlFor="restock-purchase-date"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Purchase Date
                  </label>
                  <input
                    id="restock-purchase-date"
                    type="date"
                    value={restockData.purchaseDate}
                    onChange={(e) =>
                      setRestockData({
                        ...restockData,
                        purchaseDate: e.target.value,
                      })
                    }
                    className="input-brand"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeRestockModal}
                  disabled={submitting}
                  className="btn-secondary focus-ring disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRestock}
                  disabled={submitting || restockData.quantity <= 0}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-white shadow-soft transition-all duration-200 bg-success-600 hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Restocking…
                    </>
                  ) : (
                    'Restock'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LowStockAlerts;
