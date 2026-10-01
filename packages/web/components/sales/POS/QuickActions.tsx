// packages/web/components/sales/POS/QuickProductModal.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Search, Package, Loader2, Plus, AlertCircle } from 'lucide-react';

import { productService } from '../../../services/productService';
import { categoryService } from '../../../services/categoryService';
import { toast } from '../../../utils/toast-manager';
import { formatCurrency } from '../../../utils/formatters';

// ============================================
// PUBLIC TYPES
// ============================================

/**
 * Minimal shape the modal emits back to the POS. The POS's
 * `handleAddItem` accepts this and forwards it to
 * `cartService.addItem({ productId, quantity })`.
 */
export interface QuickProduct {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  barcode?: string | null;
  images?: string[];
  category?: { id: string; name: string } | null;
  inventory?: {
    quantity: number;
    reserved: number;
    available: number;
  } | null;
}

export interface QuickProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: QuickProduct) => void;

  /**
   * ISO 4217 ledger currency supplied by the POS parent. Used to
   * format every price in the grid. When omitted, prices render as
   * raw numbers — the POS does not open this modal until the
   * currency resolves, so in practice this is always set.
   */
  currency?: string;

  /**
   * [NEW] Category filter mirrored from the POS's main search bar.
   *
   * When set and not `'all'` / `undefined` / empty, the modal's
   * product query passes `category: filterCategory` to
   * `productService.searchProducts`, so the grid shows only the
   * selected category. This keeps the Quick Product modal and the
   * main search grid in sync — one filter, one mental model.
   */
  filterCategory?: string;

  /**
   * Optional cap on the number of products shown. Defaults to 24.
   */
  limit?: number;
}

// ============================================
// HELPERS
// ============================================

/**
 * A category filter is "active" only when it is set to something
 * other than the POS's `'all'` sentinel and has a non-empty value.
 */
function isActiveFilter(filterCategory?: string): boolean {
  if (!filterCategory) return false;
  const trimmed = filterCategory.trim();
  if (!trimmed) return false;
  if (trimmed === 'all') return false;
  return true;
}

/**
 * Normalize an arbitrary API product row into the modal's
 * `QuickProduct` shape. Tolerates both the `Product` Prisma model
 * (with `unitPrice`, `category.name`) and lighter projections the
 * search endpoint may return.
 */
function normalizeProduct(raw: any): QuickProduct {
  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? 'Unnamed product'),
    sku: String(raw?.sku ?? 'N/A'),
    unitPrice: Number(raw?.unitPrice ?? raw?.price ?? 0),
    barcode: raw?.barcode ?? null,
    images: Array.isArray(raw?.images) ? raw.images : [],
    category: raw?.category
      ? {
          id: String(raw.category.id ?? ''),
          name: String(raw.category.name ?? ''),
        }
      : null,
    inventory: raw?.inventory
      ? {
          quantity: Number(raw.inventory.quantity ?? 0),
          reserved: Number(raw.inventory.reserved ?? 0),
          available: Number(raw.inventory.available ?? 0),
        }
      : null,
  };
}

// ============================================
// COMPONENT
// ============================================

export function QuickProductModal({
  isOpen,
  onClose,
  onSelectProduct,
  currency,
  filterCategory,
  limit = 24,
}: QuickProductModalProps) {
  const [products, setProducts] = useState<QuickProduct[]>([]);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState('');

  // ---------- Format helper ----------
  const fmt = useCallback(
    (amount: number): string =>
      currency ? formatCurrency(amount, currency) : String(amount),
    [currency],
  );

  // ---------- Reset on close ----------
  useEffect(() => {
    if (isOpen) return;
    // When the modal closes, clear the local search so a fresh
    // open starts clean. Leave `products` cached so reopening feels
    // instant — the fetch below will refresh in the background.
    setLocalSearch('');
    setError(null);
  }, [isOpen]);

  // ---------- Fetch categories (once) ----------
  useEffect(() => {
    if (!isOpen) return;
    if (categories.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await categoryService.getAllCategories({
          limit: 100,
          isActive: true,
        });
        if (cancelled) return;
        const normalized = (data ?? []).map((c: any) => ({
          id: String(c.id),
          name: String(c.name),
        }));
        setCategories(normalized);
      } catch (err) {
        console.error('[QuickProductModal] failed to load categories:', err);
        // Non-fatal — the grid still renders, just without a
        // category-label fallback.
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ---------- Fetch products ----------
  //
  // [NEW] `filterCategory` participates in the effect dependency
  // list. When the POS's category chip changes, the modal re-fetches
  // and the grid updates to match. This is what makes the two
  // surfaces consistent.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const query = localSearch.trim();
        const category = isActiveFilter(filterCategory)
          ? filterCategory
          : undefined;

        const results = await productService.searchProducts({
          query,
          category,
          limit,
        });

        if (cancelled) return;
        const normalized = (results ?? [])
          .map(normalizeProduct)
          .filter((p) => p.id);
        setProducts(normalized);
      } catch (err: any) {
        if (cancelled) return;
        console.error('[QuickProductModal] failed to load products:', err);
        setError(
          err?.response?.data?.message ??
            err?.message ??
            'Failed to load products',
        );
        setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `localSearch` is intentionally omitted so the effect only
    // fires on open / category / limit changes. Local search is
    // applied client-side via `visibleProducts` below, which keeps
    // typing instant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, filterCategory, limit]);

  // ---------- Client-side search filter ----------
  //
  // The server query handles the category filter. Local search
  // narrows the already-loaded list so the cashier sees matches as
  // they type without a round-trip per keystroke.
  const visibleProducts = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.sku.toLowerCase().includes(q)) return true;
      if (p.barcode && p.barcode.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [products, localSearch]);

  // ---------- Handlers ----------
  const handleSelect = useCallback(
    (product: QuickProduct) => {
      // `onSelectProduct` is the POS's `handleAddItem`. It owns the
      // cart mutation, the toast, and the modal close on the parent
      // side. We do NOT close here — the parent's handler closes
      // the modal via `setIsQuickProductModalOpen(false)` inside
      // `handleQuickProductSelect` in QuickActions.
      onSelectProduct(product);
    },
    [onSelectProduct],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Enter' && visibleProducts.length === 1) {
        e.preventDefault();
        handleSelect(visibleProducts[0]);
      }
    },
    [onClose, handleSelect, visibleProducts],
  );

  if (!isOpen) return null;

  // ---------- Render ----------
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-product-modal-title"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2
              id="quick-product-modal-title"
              className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"
            >
              <Package className="w-5 h-5 text-green-500" aria-hidden="true" />
              Quick Product
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pick a product to add to the current sale.
              {isActiveFilter(filterCategory) && (
                <span className="ml-1 text-gray-400">
                  Filtered by category.
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search the loaded products…"
              autoFocus
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="mt-2 text-sm">Loading products…</p>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2"
            >
              <AlertCircle
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">
                {localSearch
                  ? 'No products match your search.'
                  : isActiveFilter(filterCategory)
                    ? 'No products in this category.'
                    : 'No products available.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {visibleProducts.map((product) => {
                const available =
                  product.inventory?.available ??
                  product.inventory?.quantity ??
                  null;
                const outOfStock = available !== null && available <= 0;

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelect(product)}
                    disabled={outOfStock}
                    className="text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="w-full h-20 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center overflow-hidden mb-2">
                      {product.images?.[0] ? (
                        // Use a plain <img> here because the source is a
                        // dynamic remote URL and this modal is not the
                        // place to opt into next/image behaviour. If
                        // your project enforces next/image globally,
                        // swap in the shared `ProductThumb` component.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package
                          className="w-8 h-8 text-gray-400"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      SKU: {product.sku}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                        {fmt(product.unitPrice)}
                      </span>
                      {available !== null && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            outOfStock
                              ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                              : available <= 10
                                ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
                                : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          }`}
                        >
                          {available}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-1 text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-3 h-3" aria-hidden="true" />
                      <span>Add to cart</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {visibleProducts.length} product
            {visibleProducts.length === 1 ? '' : 's'}
            {localSearch && products.length !== visibleProducts.length
              ? ` (filtered from ${products.length})`
              : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuickProductModal;
