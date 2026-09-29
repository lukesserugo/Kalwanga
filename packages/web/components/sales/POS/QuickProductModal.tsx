// packages/web/components/pos/QuickProductModal.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  X,
  Search,
  Loader2,
  Package,
  Plus,
  ShoppingBag,
  AlertCircle,
} from 'lucide-react';

import { productService } from '../../../services/productService';
import { toast } from '../../../utils/toast-manager';
import { formatCurrency } from '../../../utils/formatters';

// ============================================
// TYPES
// ============================================

/**
 * Wire shape returned by `productService.searchProducts` (which
 * hits `GET /products/search` → `ProductService.searchProducts` on
 * the backend). The backend returns normalized `Product` rows; the
 * `inventory` relation is SINGULAR (`Inventory | null`), not an
 * array — see the backend's `normalizeProduct`.
 */
interface ProductSearchRow {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  images?: string[];
  /** Singular — matches the backend's canonical shape. */
  inventory?: {
    quantity?: number;
    reserved?: number;
    available?: number;
  } | null;
}

/**
 * The subset of fields this modal renders and passes to
 * `onSelectProduct`. Derived from the search row, with the
 * inventory flattened to a plain available count.
 */
export interface QuickProduct {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  images: string[];
  availableStock: number;
  /** Optional. Set by the modal when the operator selects a quantity. */
  quantity?: number;
}

export interface QuickProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: QuickProduct) => void;
}

// ============================================
// CONSTANTS
// ============================================

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;
const MAX_QUANTITY = 99;
const LOW_STOCK_THRESHOLD = 5;

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
 * Compute available stock from a product's inventory relation.
 *
 * The backend's `normalizeProduct` returns `inventory` as a singular
 * object (or `null`). The value of `available` is already computed
 * server-side as `quantity - reserved`. Prefer it; fall back to
 * recomputing from the raw fields when `available` is missing.
 *
 * ⚠ The previous version read `p.inventory?.[0]` — an array access
 *   on a singular field. That silently returns `undefined` and
 *   always reports zero stock. This is the fix.
 */
function readAvailableStock(
  inventory: ProductSearchRow['inventory'],
): number {
  if (!inventory) return 0;
  if (typeof inventory.available === 'number') {
    return Math.max(0, inventory.available);
  }
  const quantity = inventory.quantity ?? 0;
  const reserved = inventory.reserved ?? 0;
  return Math.max(0, quantity - reserved);
}

/**
 * Normalize a raw search row into the modal's internal shape.
 * Returns `null` for rows without a usable id/name — the caller
 * filters them out.
 */
function normalizeSearchRow(raw: unknown): QuickProduct | null {
  if (!raw || typeof raw !== 'object') return null;

  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : null;
  const name = typeof r.name === 'string' ? r.name : null;

  if (!id || !name) return null;

  const sku = typeof r.sku === 'string' ? r.sku : '';

  const unitPrice =
    typeof r.unitPrice === 'number' && Number.isFinite(r.unitPrice)
      ? r.unitPrice
      : 0;

  const images = Array.isArray(r.images)
    ? (r.images as unknown[]).filter(
        (x): x is string => typeof x === 'string',
      )
    : [];

  const inventory =
    r.inventory && typeof r.inventory === 'object'
      ? (r.inventory as ProductSearchRow['inventory'])
      : null;

  return {
    id,
    name,
    sku,
    unitPrice,
    images,
    availableStock: readAvailableStock(inventory),
  };
}

// ============================================
// COMPONENT
// ============================================

export function QuickProductModal({
  isOpen,
  onClose,
  onSelectProduct,
}: QuickProductModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<QuickProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<QuickProduct | null>(
    null,
  );
  const [quantity, setQuantity] = useState(1);

  const mountedRef = useRef(true);
  const searchRequestIdRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Reset on open transition ─────────────────────────────
  //
  // State persists across open/close cycles unless we clear it.
  // Resetting on the false → true transition gives the operator a
  // fresh modal every time.

  const wasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      setSearchQuery('');
      setProducts([]);
      setSearching(false);
      setSearchError(null);
      setSelectedProduct(null);
      setQuantity(1);
    }
  }, [isOpen]);

  // Focus the search input when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  // ── Search ───────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    const trimmed = searchQuery.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setProducts([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const results = await productService.searchProducts({
          query: trimmed,
        });

        // Drop stale responses — a faster subsequent search may
        // already have resolved.
        if (requestId !== searchRequestIdRef.current) return;
        if (!mountedRef.current) return;

        const normalized: QuickProduct[] = (Array.isArray(results)
          ? results
          : []
        )
          .map(normalizeSearchRow)
          .filter((x): x is QuickProduct => x !== null);

        setProducts(normalized);
        setSearching(false);
      } catch (error) {
        if (requestId !== searchRequestIdRef.current) return;
        if (!mountedRef.current) return;

        const message = extractErrorMessage(
          error,
          'Failed to search products',
        );
        console.error('[QuickProductModal] search failed:', message);
        setSearchError(message);
        setProducts([]);
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  // ── Handlers ─────────────────────────────────────────────

  const handleSelectProduct = useCallback((product: QuickProduct) => {
    setSelectedProduct(product);
    setQuantity(1);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  const handleQuantityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseInt(e.target.value, 10);
      if (!Number.isFinite(parsed)) {
        setQuantity(1);
        return;
      }
      setQuantity(Math.max(1, Math.min(MAX_QUANTITY, parsed)));
    },
    [],
  );

  const handleAddProduct = useCallback(() => {
    if (!selectedProduct) return;

    if (selectedProduct.availableStock <= 0) {
      toast.warning('This product is out of stock');
      return;
    }

    if (quantity > selectedProduct.availableStock) {
      toast.warning(
        `Only ${selectedProduct.availableStock} available`,
      );
      return;
    }

    onSelectProduct({ ...selectedProduct, quantity });
    // Parent owns what happens next; close the modal for consistency
    // with the other modals in this folder.
    onClose();
  }, [selectedProduct, quantity, onSelectProduct, onClose]);

  // ── Render ───────────────────────────────────────────────

  if (!isOpen) return null;

  const trimmedQuery = searchQuery.trim();
  const showEmptySearch = trimmedQuery.length < MIN_QUERY_LENGTH;
  const showNoResults =
    !showEmptySearch && !searching && products.length === 0 && !searchError;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-product-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2
              id="quick-product-title"
              className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
            >
              <Package className="w-5 h-5 text-green-500" aria-hidden="true" />
              Quick Product
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Search and add products quickly
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
          >
            <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search by name or SKU…"
              aria-label="Search products"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus-ring rounded"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Results — `min-h-0` so the flex item shrinks when the
            selected-product footer appears. */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {searching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2
                className="w-8 h-8 text-blue-500 animate-spin"
                aria-hidden="true"
              />
              <span className="ml-2 text-gray-500 dark:text-gray-400">
                Searching…
              </span>
            </div>
          ) : searchError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300"
            >
              <AlertCircle
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="flex-1">{searchError}</p>
            </div>
          ) : products.length > 0 ? (
            <div className="space-y-2" role="list">
              {products.map((product) => (
                <ProductResultItem
                  key={product.id}
                  product={product}
                  isSelected={selectedProduct?.id === product.id}
                  onSelect={() => handleSelectProduct(product)}
                />
              ))}
            </div>
          ) : showNoResults ? (
            <div className="text-center py-12">
              <Package
                className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2"
                aria-hidden="true"
              />
              <p className="text-gray-500 dark:text-gray-400">
                No products found
              </p>
            </div>
          ) : showEmptySearch ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <ShoppingBag
                className="w-12 h-12 mx-auto mb-2 opacity-50"
                aria-hidden="true"
              />
              <p>
                Type at least {MIN_QUERY_LENGTH} characters to search
              </p>
            </div>
          ) : null}
        </div>

        {/* Selected product actions */}
        {selectedProduct && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {selectedProduct.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                  {formatCurrency(selectedProduct.unitPrice)} · SKU:{' '}
                  {selectedProduct.sku || '—'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  Available: {selectedProduct.availableStock}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="quick-product-quantity"
                  className="text-sm text-gray-600 dark:text-gray-400"
                >
                  Qty:
                </label>
                <input
                  id="quick-product-quantity"
                  type="number"
                  min={1}
                  max={Math.min(
                    MAX_QUANTITY,
                    Math.max(1, selectedProduct.availableStock),
                  )}
                  value={quantity}
                  onChange={handleQuantityChange}
                  className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums"
                />
              </div>
              <button
                type="button"
                onClick={handleAddProduct}
                disabled={selectedProduct.availableStock <= 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// PRODUCT RESULT ITEM
// ============================================

interface ProductResultItemProps {
  product: QuickProduct;
  isSelected: boolean;
  onSelect: () => void;
}

function ProductResultItem({
  product,
  isSelected,
  onSelect,
}: ProductResultItemProps) {
  const availableStock = product.availableStock;
  const isOutOfStock = availableStock === 0;
  const isLowStock = !isOutOfStock && availableStock <= LOW_STOCK_THRESHOLD;

  const stockLabel = isOutOfStock
    ? 'Out of Stock'
    : isLowStock
    ? `${availableStock} left`
    : `${availableStock} in stock`;

  const stockClass = isOutOfStock
    ? 'text-red-500'
    : isLowStock
    ? 'text-yellow-500'
    : 'text-green-500';

  return (
    <button
      type="button"
      role="listitem"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`w-full p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors flex items-center justify-between text-left focus-ring ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover rounded-lg"
              loading="lazy"
              onError={(e) => {
                // Hide the broken image so the placeholder icon
                // underneath shows through.
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <Package
              className="w-5 h-5 text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {product.name}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="truncate">
              SKU: {product.sku || '—'}
            </span>
            <span className="text-xs text-gray-400" aria-hidden="true">
              |
            </span>
            <span className={`tabular-nums ${stockClass}`}>
              {stockLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <p className="font-bold text-gray-900 dark:text-white tabular-nums">
          {formatCurrency(product.unitPrice)}
        </p>
        {isSelected && (
          <span className="text-xs text-blue-600 dark:text-blue-400">
            Selected
          </span>
        )}
      </div>
    </button>
  );
}

export default QuickProductModal;
