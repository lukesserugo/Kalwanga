'use client';

// D:\Projects\Kalwanga\packages\web\components\products\ProductCompare.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Minus,
  Package,
  Star,
  ShoppingCart,
  Share2,
  Scale,
  Loader2,
  Eye,
  Layers,
  ImageIcon,
  Link2,
} from 'lucide-react';

import { productService } from '../../services/productService';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../utils/toast-manager';
import { formatCurrency } from '../../utils/formatters';
import { WishlistButton } from './WishlistButton';

// ============================================
// TYPES
// ============================================

interface CompareProduct {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  images?: string[];
  description?: string | null;
  category?: { id: string; name: string } | null;
  inventory?: { quantity?: number; reserved?: number } | null;
  minStock?: number;
  rating?: number | null;
  reviewCount?: number | null;
  isActive: boolean;
  featured?: boolean;
  isDigital?: boolean;
  tags?: string[];
  attributes?: Record<string, any> | null;
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
    isActive: boolean;
    images?: string[];
    attributes?: Record<string, any>;
    barcode?: string | null;
    inventoryId?: string | null;
  }>;
  inventoryId?: string | null;
  selected?: boolean;
}

interface ProductCompareProps {
  initialProductIds?: string[];
  maxCompare?: number;
  onClose?: () => void;
  className?: string;
}

// ============================================
// CONSTANTS
// ============================================

const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const STORAGE_KEY = 'compareList';
const SEARCH_DEBOUNCE_MS = 300;

// ============================================
// HELPERS
// ============================================

function safeReadCompareIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function safeWriteCompareIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* storage full / disabled — not fatal */
  }
}

function safeClearCompareIds(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Normalize a raw API product into the shape this component needs.
 * Guards against null/missing fields.
 */
function normalizeCompareProduct(raw: any): CompareProduct {
  return {
    id: raw.id,
    name: raw.name,
    sku: raw.sku,
    unitPrice: raw.unitPrice ?? 0,
    images: Array.isArray(raw.images) ? raw.images : [],
    description: raw.description ?? null,
    category: raw.category ?? null,
    inventory: raw.inventory ?? null,
    minStock: raw.minStock ?? 5,
    rating: raw.rating ?? null,
    reviewCount: raw.reviewCount ?? 0,
    isActive: raw.isActive !== undefined ? raw.isActive : true,
    featured: raw.featured ?? false,
    isDigital: raw.isDigital ?? false,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    attributes: raw.attributes ?? null,
    variants: Array.isArray(raw.variants)
      ? raw.variants.map((v: any) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price ?? 0,
          stock: v.stock ?? 0,
          isActive: v.isActive !== undefined ? v.isActive : true,
          images: Array.isArray(v.images) ? v.images : [],
          attributes: v.attributes || {},
          barcode: v.barcode ?? null,
          inventoryId: v.inventoryId ?? null,
        }))
      : [],
    inventoryId: raw.inventoryId ?? null,
  };
}

// ============================================
// COMPONENT
// ============================================

export function ProductCompare({
  initialProductIds = [],
  maxCompare = 4,
  onClose,
  className = '',
}: ProductCompareProps) {
  const { isAuthenticated } = useAuth();

  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [compareList, setCompareList] = useState<string[]>([]);

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [variantImageErrors, setVariantImageErrors] = useState<
    Record<string, boolean>
  >({});

  const [showProductSelector, setShowProductSelector] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<CompareProduct[]>(
    [],
  );
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [selectorSearch, setSelectorSearch] = useState('');
  const [debouncedSelectorSearch, setDebouncedSelectorSearch] = useState('');

  const selectorFetchId = useRef(0);
  const initialLoadDone = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================
  // IMAGE HANDLERS
  // ============================================

  const handleImageError = useCallback((imageUrl: string) => {
    setImageErrors((prev) => ({ ...prev, [imageUrl]: true }));
  }, []);

  const handleVariantImageError = useCallback((imageUrl: string) => {
    setVariantImageErrors((prev) => ({ ...prev, [imageUrl]: true }));
  }, []);

  const getValidImage = useCallback(
    (imageUrl: string | undefined): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (imageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [imageErrors],
  );

  const getValidVariantImage = useCallback(
    (imageUrl: string | undefined): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (variantImageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [variantImageErrors],
  );

  // ============================================
  // LOAD COMPARE PRODUCTS
  // ============================================
  //
  // Authenticated callers hit `POST /products/compare` which returns
  // the full list in one shot. Anonymous callers compose the list
  // client-side by fetching each product via `/products/public/:id`.

  const loadCompareProducts = useCallback(
    async (rawIds: string[]) => {
      const ids = Array.from(new Set(rawIds.filter(Boolean))).slice(
        0,
        maxCompare,
      );

      if (ids.length === 0) {
        setProducts([]);
        setCompareList([]);
        safeWriteCompareIds([]);
        return;
      }

      setLoading(true);
      try {
        let loaded: CompareProduct[] = [];

        if (isAuthenticated && ids.length >= 2) {
          // Authenticated path — single round-trip bulk compare.
          const data = await productService.compareProducts(ids);
          loaded = (data || []).map(normalizeCompareProduct);
        } else {
          // Anonymous (or single-id) path — fetch each product
          // individually via the public route. Parallel requests.
          const settled = await Promise.allSettled(
            ids.map((id) =>
              productService.getPublicProductById(id),
            ),
          );

          loaded = settled
            .map((r, i) => {
              if (r.status === 'fulfilled' && r.value && (r.value as any).id) {
                return normalizeCompareProduct(r.value);
              }
              // Drop ids that fail (deleted, inactive, or unknown).
              console.warn(
                `Compare: dropping product id "${ids[i]}" — not available`,
              );
              return null;
            })
            .filter((p): p is CompareProduct => p !== null);
        }

        if (!isMountedRef.current) return;
        setProducts(loaded);
        setCompareList(loaded.map((p) => p.id));
        safeWriteCompareIds(loaded.map((p) => p.id));
      } catch (err) {
        console.error('Failed to load compare products:', err);
        if (!isMountedRef.current) return;
        toast.error('Failed to load products for comparison');
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [maxCompare, isAuthenticated],
  );

  // ============================================
  // INITIAL LOAD
  // ============================================

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const seed =
      initialProductIds.length > 0 ? initialProductIds : safeReadCompareIds();

    if (seed.length > 0) {
      loadCompareProducts(seed);
    }
  }, [initialProductIds, loadCompareProducts]);

  // React to parent changing `initialProductIds`.
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (initialProductIds.length === 0) return;

    const currentKey = compareList.slice().sort().join(',');
    const nextKey = initialProductIds.slice().sort().join(',');
    if (currentKey === nextKey) return;

    loadCompareProducts(initialProductIds);
  }, [initialProductIds, compareList, loadCompareProducts]);

  // ============================================
  // SELECTOR SEARCH DEBOUNCE
  // ============================================

  useEffect(() => {
    const handle = setTimeout(
      () => setDebouncedSelectorSearch(selectorSearch.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(handle);
  }, [selectorSearch]);

  // ============================================
  // SELECTOR FETCH
  // ============================================
  //
  // Always uses the PUBLIC list endpoint so guests can add products
  // to the comparison. Authenticated users get the same public list
  // — it's sufficient for a selector UI.

  const loadAvailableProducts = useCallback(async (search?: string) => {
    const fetchId = ++selectorFetchId.current;
    setLoadingAvailable(true);
    try {
      const result = await productService.getPublicProducts({
        page: 1,
        limit: 20,
        search: search || undefined,
      });
      if (fetchId !== selectorFetchId.current) return;
      if (!isMountedRef.current) return;
      setAvailableProducts(
        Array.isArray(result.data)
          ? result.data.map(normalizeCompareProduct)
          : [],
      );
    } catch (err) {
      if (fetchId !== selectorFetchId.current) return;
      if (!isMountedRef.current) return;
      console.error('Failed to load available products:', err);
      toast.error('Failed to load products');
    } finally {
      if (fetchId === selectorFetchId.current && isMountedRef.current) {
        setLoadingAvailable(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!showProductSelector) return;
    loadAvailableProducts(debouncedSelectorSearch || undefined);
  }, [showProductSelector, debouncedSelectorSearch, loadAvailableProducts]);

  // ============================================
  // HANDLERS
  // ============================================

  const removeFromCompare = useCallback(
    (productId: string) => {
      const newList = compareList.filter((id) => id !== productId);
      setCompareList(newList);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      safeWriteCompareIds(newList);
      toast.success('Product removed from comparison');
    },
    [compareList],
  );

  const clearCompare = useCallback(() => {
    setCompareList([]);
    setProducts([]);
    safeClearCompareIds();
    if (onClose) onClose();
  }, [onClose]);

  const addToCompare = useCallback(
    async (productId: string) => {
      if (compareList.includes(productId)) {
        toast.warning('Product already in comparison');
        return;
      }
      if (compareList.length >= maxCompare) {
        toast.warning(`Maximum ${maxCompare} products can be compared`);
        return;
      }
      const newList = [...compareList, productId];
      setShowProductSelector(false);
      setSelectorSearch('');
      setDebouncedSelectorSearch('');
      await loadCompareProducts(newList);
    },
    [compareList, maxCompare, loadCompareProducts],
  );

  const openSelector = useCallback(() => {
    setShowProductSelector(true);
    setSelectorSearch('');
    setDebouncedSelectorSearch('');
    loadAvailableProducts();
  }, [loadAvailableProducts]);

  const handleShare = useCallback(() => {
    const shareUrl = `${window.location.origin}/compare?ids=${compareList.join(
      ',',
    )}`;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => toast.success('Comparison link copied!'))
      .catch(() => toast.error('Failed to copy comparison link'));
  }, [compareList]);

  // ============================================
  // DERIVED
  // ============================================

  const uniqueAttributes = useMemo(() => {
    const set = new Set<string>();
    for (const product of products) {
      if (product.attributes) {
        for (const key of Object.keys(product.attributes)) set.add(key);
      }
    }
    return Array.from(set);
  }, [products]);

  // ✅ Prefer each variant's linked Inventory row; fall back to the
  //    denormalized `stock`. Mirrors the backend's aggregation.
  const getTotalStock = useCallback((product: CompareProduct): number => {
    const inv = product.inventory;
    const mainStock = inv
      ? Math.max(0, (inv.quantity ?? 0) - (inv.reserved ?? 0))
      : 0;

    const variantStock = (product.variants || []).reduce(
      (sum, v: any) => {
        if (v.inventory) {
          return (
            sum +
            Math.max(
              0,
              (v.inventory.quantity ?? 0) - (v.inventory.reserved ?? 0),
            )
          );
        }
        return sum + (v.stock || 0);
      },
      0,
    );

    return mainStock + variantStock;
  }, []);

  const getVariantStock = useCallback(
    (product: CompareProduct): number =>
      (product.variants || []).reduce(
        (sum, v: any) => sum + (v.stock || 0),
        0,
      ),
    [],
  );

  const getVariantCount = useCallback(
    (product: CompareProduct): number => product.variants?.length ?? 0,
    [],
  );

  const hasVariantImages = useCallback(
    (product: CompareProduct): boolean =>
      (product.variants || []).some(
        (v: any) => Array.isArray(v.images) && v.images.length > 0,
      ),
    [],
  );

  const isInventoryLinked = useCallback(
    (product: CompareProduct): boolean => !!product.inventoryId,
    [],
  );

  const renderStars = useCallback((rating: number = 0) => {
    return (
      <div className="flex items-center justify-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= Math.round(rating)
                ? 'text-warning-400 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
        <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400 ml-1">
          ({rating.toFixed(1)})
        </span>
      </div>
    );
  }, []);

  // ============================================
  // EARLY RETURNS
  // ============================================

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading comparison...
        </span>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 card-brand shadow-soft animate-fade-in">
        <Scale className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          No products to compare
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Add products to compare their features side by side
        </p>
        <Link
          href="/shop"
          className="mt-4 btn-brand"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div
      className={`card-brand shadow-card overflow-hidden animate-fade-in ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Compare Products (<span className="tabular-nums">{products.length}</span>)
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {products.length > 0 && (
            <button
              type="button"
              onClick={clearCompare}
              className="text-sm text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 transition duration-250 focus-ring rounded"
            >
              Clear All
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition duration-250 focus-ring"
              aria-label="Close comparison"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto p-4 custom-scrollbar">
        <div className="min-w-[640px]">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-32 text-left text-sm font-medium text-gray-500 dark:text-gray-400 py-2 eyebrow">
                  Feature
                </th>
                {products.map((product) => (
                  <th
                    key={product.id}
                    className="text-center px-4 py-2 min-w-[180px]"
                  >
                    <div className="relative group">
                      <button
                        type="button"
                        onClick={() => removeFromCompare(product.id)}
                        className="absolute -top-2 -right-2 p-1 bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-full hover:bg-danger-200 dark:hover:bg-danger-900/50 transition duration-250 opacity-0 group-hover:opacity-100 focus:opacity-100 focus-ring"
                        aria-label={`Remove ${product.name} from comparison`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="w-24 h-24 mx-auto rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 relative">
                        {product.images?.[0] ? (
                          <img
                            src={getValidImage(product.images[0])}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={() =>
                              handleImageError(product.images![0])
                            }
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                          </div>
                        )}

                        {getVariantCount(product) > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 bg-secondary-500/80 text-white text-2xs tabular-nums py-0.5 flex items-center justify-center gap-0.5">
                            <Layers className="w-3 h-3" />
                            {getVariantCount(product)}
                            {hasVariantImages(product) && (
                              <ImageIcon className="w-3 h-3" />
                            )}
                          </div>
                        )}

                        {isInventoryLinked(product) && (
                          <div className="absolute top-0 right-0 p-0.5 bg-brand-500/80 text-white rounded-bl-lg">
                            <Link2 className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/shop/${product.id}`}
                        className="block mt-2 text-sm font-medium text-gray-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition duration-250 line-clamp-2"
                      >
                        {product.name}
                      </Link>

                      <p className="text-lg font-bold tabular-nums text-brand-600 dark:text-brand-400">
                        {formatCurrency(product.unitPrice)}
                      </p>

                      <div className="flex items-center justify-center gap-2 mt-2">
                        <WishlistButton productId={product.id} size="sm" />
                        <Link
                          href={`/shop/${product.id}`}
                          className="p-1.5 btn-brand focus-ring"
                          aria-label={`View ${product.name}`}
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </th>
                ))}

                {products.length < maxCompare && (
                  <th className="text-center px-4 py-2 min-w-[120px]">
                    <button
                      type="button"
                      onClick={openSelector}
                      className="w-full h-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 hover:border-brand-500 dark:hover:border-brand-400 transition duration-250 flex flex-col items-center justify-center focus-ring"
                    >
                      <Plus className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                      <span className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                        Add Product
                      </span>
                    </button>
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {/* SKU */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                  SKU
                </td>
                {products.map((product) => (
                  <td
                    key={product.id}
                    className="text-center text-sm tabular-nums text-gray-700 dark:text-gray-300 py-2"
                  >
                    {product.sku}
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>

              {/* Category */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                  Category
                </td>
                {products.map((product) => (
                  <td
                    key={product.id}
                    className="text-center text-sm text-gray-700 dark:text-gray-300 py-2"
                  >
                    {product.category?.name || 'N/A'}
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>

              {/* Rating */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                  Rating
                </td>
                {products.map((product) => (
                  <td key={product.id} className="text-center py-2">
                    {product.rating ? renderStars(product.rating) : 'N/A'}
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>

              {/* Stock */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                  Stock
                </td>
                {products.map((product) => {
                  const stock = getTotalStock(product);
                  const variantStock = getVariantStock(product);
                  return (
                    <td key={product.id} className="text-center py-2">
                      <span
                        className={`text-sm font-medium tabular-nums ${
                          stock > 10
                            ? 'text-success-600 dark:text-success-400'
                            : stock > 0
                            ? 'text-warning-600 dark:text-warning-400'
                            : 'text-danger-600 dark:text-danger-400'
                        }`}
                      >
                        {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                      </span>
                      {variantStock > 0 && (
                        <p className="text-xs tabular-nums text-gray-400 dark:text-gray-500 mt-0.5">
                          Includes {variantStock} variant stock
                        </p>
                      )}
                    </td>
                  );
                })}
                {products.length < maxCompare && <td />}
              </tr>

              {/* Variants */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Variants
                  </span>
                </td>
                {products.map((product) => (
                  <td key={product.id} className="text-center py-2">
                    <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {getVariantCount(product)}
                    </span>
                    {hasVariantImages(product) && (
                      <span className="ml-1 text-xs text-secondary-500 dark:text-secondary-400 inline-flex items-center gap-0.5">
                        <ImageIcon className="w-3 h-3" />
                        with images
                      </span>
                    )}
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>

              {/* Inventory link */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                  <span className="inline-flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Inventory
                  </span>
                </td>
                {products.map((product) => (
                  <td key={product.id} className="text-center py-2">
                    <span
                      className={`text-sm inline-flex items-center justify-center gap-1 ${
                        isInventoryLinked(product)
                          ? 'text-brand-600 dark:text-brand-400'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {isInventoryLinked(product) ? (
                        <>
                          <Link2 className="w-3 h-3" />
                          Linked
                        </>
                      ) : (
                        'Not Linked'
                      )}
                    </span>
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>

              {/* Status */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                  Status
                </td>
                {products.map((product) => (
                  <td key={product.id} className="text-center py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-2xs font-medium ${
                        product.isActive
                          ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                          : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                      }`}
                    >
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>

              {/* Custom attributes */}
              {uniqueAttributes.map((attr) => (
                <tr key={attr}>
                  <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2 capitalize">
                    {attr}
                  </td>
                  {products.map((product) => (
                    <td
                      key={product.id}
                      className="text-center text-sm text-gray-700 dark:text-gray-300 py-2"
                    >
                      {product.attributes?.[attr] ?? '-'}
                    </td>
                  ))}
                  {products.length < maxCompare && <td />}
                </tr>
              ))}

              {/* Actions */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                  Actions
                </td>
                {products.map((product) => (
                  <td key={product.id} className="text-center py-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeFromCompare(product.id)}
                        className="p-1.5 text-danger-600 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded-lg transition duration-250 focus-ring"
                        title="Remove from comparison"
                        aria-label={`Remove ${product.name} from comparison`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/shop/${product.id}`}
                        className="p-1.5 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded-lg transition duration-250 focus-ring"
                        aria-label={`View ${product.name}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      {products.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
              Comparing {products.length} of {maxCompare} products
            </p>
            <div className="flex gap-2">
              <Link
                href="/shop"
                className="btn-secondary"
              >
                Browse More
              </Link>
              <button
                type="button"
                onClick={handleShare}
                className="btn-brand"
              >
                <Share2 className="w-4 h-4" />
                Share Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product selector modal */}
      <AnimatePresence>
        {showProductSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-modal flex items-center justify-center p-4"
          >
            <div
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
              onClick={() => setShowProductSelector(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-card max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto custom-scrollbar animate-slide-down"
            >
              <button
                type="button"
                onClick={() => setShowProductSelector(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition duration-250 focus-ring"
                aria-label="Close product selector"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Select Product to Compare
              </h3>

              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={selectorSearch}
                  onChange={(e) => setSelectorSearch(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition duration-250"
                />
              </div>

              {loadingAvailable ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                </div>
              ) : availableProducts.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No products found
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                  {availableProducts
                    .filter((p) => !compareList.includes(p.id))
                    .map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addToCompare(product.id)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-250 border border-gray-100 dark:border-gray-700 text-left focus-ring"
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                          {product.images?.[0] ? (
                            <img
                              src={getValidImage(product.images[0])}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={() =>
                                handleImageError(product.images![0])
                              }
                            />
                          ) : (
                            <Package className="w-full h-full p-2 text-gray-400 dark:text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {product.name}
                          </p>
                          <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
                            {product.sku} • {formatCurrency(product.unitPrice)}
                          </p>
                        </div>
                        <Plus className="w-5 h-5 text-brand-500 flex-shrink-0" />
                      </button>
                    ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProductCompare;
