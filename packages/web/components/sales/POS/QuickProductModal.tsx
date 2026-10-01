// packages/web/components/sales/POS/QuickProductModal.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  X,
  Search,
  Package,
  Loader2,
  Plus,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import { productService } from '../../../services/productService';
import { categoryService } from '../../../services/categoryService';
import { toast } from '../../../utils/toast-manager';
import { formatPosCurrency, getPosImageSource } from './posDisplay';

// ============================================
// PUBLIC TYPES
// ============================================

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

  /**
   * Fired when the cashier clicks a product. The POS owns the
   * cart mutation, the toast, and the close-on-success.
   */
  onSelectProduct: (product: QuickProduct) => void;

  /**
  * ISO 4217 ledger currency supplied by the POS parent. When it
  * has not resolved yet, prices show a neutral placeholder.
   */
  currency?: string;

  /**
   * Category filter mirrored from the POS's main search bar. When
   * set and not `'all'` / `undefined` / empty, the modal's product
   * query passes `category: filterCategory` to
   * `productService.searchProducts`.
   */
  filterCategory?: string;

  /**
   * Cap on the number of products returned per query. Defaults to
   * 24 — three rows of eight on a desktop viewport.
   */
  limit?: number;

  /**
   * Whether a shift is currently open. When false, the modal
   * renders read-only: the query still runs and the grid is
   * visible, but every card is disabled and a banner offers to
   * open the shift manager.
   */
  shiftOpen?: boolean;

  /**
   * Optional. Called when the cashier clicks "Open Shift" in the
   * disabled banner.
   */
  onOpenShiftManager?: () => void;

  /**
   * Debounce delay in milliseconds for the query box. Defaults to
   * 250ms — short enough that typing feels instant, long enough
   * that a fast typist doesn't fire one request per character.
   */
  debounceMs?: number;
}

// ============================================
// HELPERS
// ============================================

function isActiveFilter(filterCategory?: string): boolean {
  if (!filterCategory) return false;
  const trimmed = filterCategory.trim();
  if (!trimmed) return false;
  if (trimmed === 'all') return false;
  return true;
}

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
  shiftOpen = true,
  onOpenShiftManager,
  debounceMs = 250,
}: QuickProductModalProps) {
  // ---------- State ----------
  const [products, setProducts] = useState<QuickProduct[]>([]);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The text the cashier has typed.
  const [queryInput, setQueryInput] = useState('');
  // The text that was actually sent to the server (after debounce).
  // Used only for display, so we can show "showing results for X"
  // in the footer if we ever want to.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  // Bumping this re-fires the query. Used by the Reload button.
  const [reloadTick, setReloadTick] = useState(0);

  // In-flight request cancellation.
  const inFlightRef = useRef<AbortController | null>(null);
  // Request sequence number. Latest write wins — if two responses
  // arrive out of order, we only apply the newer one.
  const requestIdRef = useRef(0);

  // ---------- Format helper ----------
  const fmt = useCallback(
    (amount: number): string => formatPosCurrency(amount, currency),
    [currency],
  );

  // ---------- Reset local state on close ----------
  useEffect(() => {
    if (isOpen) return;
    setQueryInput('');
    setDebouncedQuery('');
    setError(null);
  }, [isOpen]);

  // ---------- Debounce the query input ----------
  //
  // `queryInput` updates on every keystroke. `debouncedQuery`
  // updates only after the cashier pauses for `debounceMs`. The
  // query effect below depends on `debouncedQuery`, so it fires
  // once per pause, not once per character.
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = queryInput.trim();
    const handle = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [queryInput, isOpen, debounceMs]);

  // ---------- Fetch categories (once per session) ----------
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
        // Non-fatal. The query grid still renders.
        console.warn(
          '[QuickProductModal] failed to load categories:',
          err,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ---------- The query effect ----------
  //
  // This is the heart of the "query for products" behaviour. It
  // fires when:
  //   • the modal opens
  //   • `debouncedQuery` changes (cashier typed and paused)
  //   • `filterCategory` changes (POS category chip changed)
  //   • `reloadTick` changes (cashier clicked Reload)
  //
  // It cancels any in-flight request before starting a new one, so
  // an earlier slow response can never overwrite a newer one.
  useEffect(() => {
    if (!isOpen) return;

    // Cancel the previous request.
    if (inFlightRef.current) {
      inFlightRef.current.abort();
    }
    const controller = new AbortController();
    inFlightRef.current = controller;

    // Sequence number for this request. When the response lands, we
    // only commit it if we are still the latest request.
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const category = isActiveFilter(filterCategory)
          ? filterCategory
          : undefined;

        const results = await productService.searchProducts({
          // The service accepts `query`, `category`, `limit`. An
          // empty query returns the top products for the given
          // category (or the top overall when category is
          // undefined).
          query: debouncedQuery,
          category,
          limit,
        });

        // Only the latest request may commit state.
        if (requestId !== requestIdRef.current) return;

        const normalized = (results ?? [])
          .map(normalizeProduct)
          .filter((p) => p.id);
        setProducts(normalized);
      } catch (err: any) {
        if (requestId !== requestIdRef.current) return;

        // AbortError from a superseded request — not a real error.
        const name = String(err?.name ?? '');
        const message = String(err?.message ?? '');
        if (name === 'AbortError' || name === 'CanceledError') return;
        if (message.toLowerCase().includes('canceled')) return;

        console.error(
          '[QuickProductModal] product query failed:',
          err,
        );
        setError(
          err?.response?.data?.message ??
            err?.message ??
            'Failed to load products',
        );
        setProducts([]);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isOpen, debouncedQuery, filterCategory, limit, reloadTick]);

  // ---------- Cleanup on unmount ----------
  useEffect(() => {
    return () => {
      if (inFlightRef.current) inFlightRef.current.abort();
    };
  }, []);

  // ---------- Derived ----------
  const hasActiveQuery =
    debouncedQuery.length > 0 || isActiveFilter(filterCategory);

  // ---------- Handlers ----------
  const handleSelect = useCallback(
    (product: QuickProduct) => {
      if (!shiftOpen) {
        toast.warning(
          'Please open a shift before adding products to the cart.',
        );
        return;
      }
      onSelectProduct(product);
    },
    [onSelectProduct, shiftOpen],
  );

  const handleReload = useCallback(() => {
    setReloadTick((n) => n + 1);
  }, []);

  const handleClearQuery = useCallback(() => {
    setQueryInput('');
    // No need to set `debouncedQuery` here — the debounce effect
    // will run and update it on the next tick. This avoids a
    // double-fetch: one from the explicit clear, one from the
    // debounce.
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Enter' && products.length === 1 && shiftOpen) {
        e.preventDefault();
        handleSelect(products[0]);
      }
    },
    [onClose, handleSelect, products, shiftOpen],
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
          <div className="min-w-0">
            <h2
              id="quick-product-modal-title"
              className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"
            >
              <Package
                className="w-5 h-5 text-green-500"
                aria-hidden="true"
              />
              Quick Product
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {shiftOpen
                ? 'Search the catalog and add a product to the sale.'
                : 'Open a shift to add products.'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleReload}
              disabled={loading}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh results"
              aria-label="Refresh results"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 ${
                  loading ? 'animate-spin' : ''
                }`}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Shift banner */}
        {!shiftOpen && (
          <div
            role="alert"
            className="mx-4 mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-300 flex items-start gap-2 flex-shrink-0"
          >
            <AlertCircle
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="font-medium">No shift is open.</p>
              <p className="mt-0.5 text-yellow-700 dark:text-yellow-400">
                Sales can&apos;t be recorded until you open a shift.
              </p>
            </div>
            {onOpenShiftManager && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenShiftManager();
                }}
                className="px-3 py-1 rounded bg-yellow-200 dark:bg-yellow-800 hover:bg-yellow-300 dark:hover:bg-yellow-700 font-medium transition-colors whitespace-nowrap"
              >
                Open Shift
              </button>
            )}
          </div>
        )}

        {/* Query bar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search products by name, SKU, or barcode…"
              autoFocus
              autoComplete="off"
              className="w-full pl-9 pr-20 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
            {loading && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <Loader2
                  className="w-4 h-4 text-blue-500 animate-spin"
                  aria-hidden="true"
                />
              </div>
            )}
            {queryInput && (
              <button
                type="button"
                onClick={handleClearQuery}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          {isActiveFilter(filterCategory) && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Filtered by category. Clear the category chip in the POS
              to see all products.
            </p>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="mt-2 text-sm">Searching products…</p>
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
              <div className="flex-1">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={handleReload}
                  className="mt-2 underline text-xs"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium">
                {hasActiveQuery
                  ? 'No products match your search.'
                  : 'No products available.'}
              </p>
              {hasActiveQuery && (
                <p className="mt-1 text-xs text-gray-400">
                  Try a different term, or clear the filters.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {products.map((product) => {
                const available =
                  product.inventory?.available ??
                  product.inventory?.quantity ??
                  null;
                const outOfStock = available !== null && available <= 0;
                const cardDisabled = !shiftOpen || outOfStock;
                const imageSource = getPosImageSource(product.images?.[0]);

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelect(product)}
                    disabled={cardDisabled}
                    title={
                      !shiftOpen
                        ? 'Open a shift first'
                        : outOfStock
                          ? 'Out of stock'
                          : undefined
                    }
                    className="text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="w-full h-20 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center overflow-hidden mb-2">
                      {imageSource ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageSource}
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
                    <p
                      className="text-xs text-gray-500 dark:text-gray-400 truncate"
                      title={product.barcode ? `Barcode: ${product.barcode}` : 'No barcode assigned'}
                    >
                      Barcode: {product.barcode || 'Not assigned'}
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
                    {!cardDisabled && (
                      <div className="mt-2 flex items-center justify-center gap-1 text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="w-3 h-3" aria-hidden="true" />
                        <span>Add to cart</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {loading
              ? 'Searching…'
              : `${products.length} product${
                  products.length === 1 ? '' : 's'
                }`}
            {debouncedQuery && !loading && (
              <> · for “{debouncedQuery}”</>
            )}
            {!shiftOpen && ' · read-only until a shift is open'}
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
