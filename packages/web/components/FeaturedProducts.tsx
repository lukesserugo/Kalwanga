// packages/web/components/home/FeaturedProducts.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import type { Product } from '../types/product';

// ============================================
// TYPES
// ============================================

/**
 * The subset of fields this component renders. Derived from the
 * canonical `Product` so a rename in the type breaks this file
 * at compile time instead of silently rendering `undefined`.
 */
type FeaturedProduct = Pick<Product, 'id' | 'name' | 'unitPrice' | 'images'>;

// ============================================
// HELPERS
// ============================================

const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Normalize a `GET /products` response.
 *
 * `api.get<T>` unwraps the `{ success, data, pagination }` envelope
 * and returns the payload — which for this endpoint is a `Product[]`.
 * But some deployments wrap it once more, and the fallback path may
 * hit a different shape. Handle all three:
 *
 *   1. Bare array            → [Product, …]
 *   2. `{ data: Product[] }` → unwrapped payload
 *   3. `{ products: […] }`   → legacy shape
 */
function extractProducts(response: unknown): FeaturedProduct[] {
  if (Array.isArray(response)) {
    return response as FeaturedProduct[];
  }

  if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>;

    // Standard envelope: `{ success, data }` — used when the caller
    // passed the *un-unwrapped* axios response.
    if (Array.isArray(r.data)) {
      return r.data as FeaturedProduct[];
    }

    // Legacy `{ products: […] }`.
    if (Array.isArray(r.products)) {
      return r.products as FeaturedProduct[];
    }

    // Nested envelope: `{ data: { data: Product[] } }`.
    if (r.data && typeof r.data === 'object') {
      const inner = r.data as Record<string, unknown>;
      if (Array.isArray(inner.data)) {
        return inner.data as FeaturedProduct[];
      }
      if (Array.isArray(inner.products)) {
        return inner.products as FeaturedProduct[];
      }
    }
  }

  return [];
}

// ============================================
// COMPONENT
// ============================================

export default function FeaturedProducts() {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Fetch ────────────────────────────────────────────────

  const fetchFeaturedProducts = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setErrored(false);

    try {
      // First attempt: featured products.
      const featuredResponse = await api.get<unknown>('/products', {
        params: { limit: 4, isActive: true, featured: true },
      });

      if (requestId !== requestIdRef.current) return;
      if (!mountedRef.current) return;

      const featured = extractProducts(featuredResponse);

      if (featured.length > 0) {
        setProducts(featured);
        return;
      }

      // The featured query succeeded but returned nothing — try the
      // general product list. This is the actual "fallback to
      // regular products" the previous version only did on *error*.
      const fallbackResponse = await api.get<unknown>('/products', {
        params: { limit: 4, isActive: true },
      });

      if (requestId !== requestIdRef.current) return;
      if (!mountedRef.current) return;

      setProducts(extractProducts(fallbackResponse));
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      if (!mountedRef.current) return;

      console.error('[FeaturedProducts] fetch failed:', error);
      setErrored(true);

      // Fallback after a failed *featured* request.
      try {
        const fallbackResponse = await api.get<unknown>('/products', {
          params: { limit: 4, isActive: true },
        });

        if (requestId !== requestIdRef.current) return;
        if (!mountedRef.current) return;

        setProducts(extractProducts(fallbackResponse));
      } catch (fallbackError) {
        if (requestId !== requestIdRef.current) return;
        if (!mountedRef.current) return;

        console.error('[FeaturedProducts] fallback failed:', fallbackError);
        // Both fetches failed — leave `products` empty. The render
        // below hides the section (see `products.length === 0`).
      }
    } finally {
      if (requestId === requestIdRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchFeaturedProducts();
  }, [fetchFeaturedProducts]);

  // ── Image error handling ─────────────────────────────────

  const handleImageError = useCallback((url: string) => {
    setImageErrors((prev) => ({ ...prev, [url]: true }));
  }, []);

  const safeImageUrl = useCallback(
    (url: string | undefined): string => {
      if (!url) return PLACEHOLDER_IMAGE;
      if (imageErrors[url]) return PLACEHOLDER_IMAGE;
      return url;
    },
    [imageErrors],
  );

  // ── Render: loading skeleton ─────────────────────────────

  if (loading) {
    return (
      <section
        className="py-16 bg-gray-50 dark:bg-gray-900"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Featured Products
          </h2>
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            aria-hidden="true"
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 h-80 animate-pulse"
              >
                <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-t-xl" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
          <p className="sr-only">Loading featured products…</p>
        </div>
      </section>
    );
  }

  // ── Render: empty (or both fetches failed) ───────────────
  //
  // On a storefront, "no featured products" and "failed to fetch"
  // both mean "don't show the section." If you'd rather surface
  // the error, uncomment the `errored` branch below and render a
  // small retry card.

  if (products.length === 0) {
    // if (errored) {
    //   return (
    //     <section className="py-16 bg-gray-50 dark:bg-gray-900">
    //       <div className="max-w-container mx-auto px-4 text-center">
    //         <p className="text-gray-500 dark:text-gray-400">
    //           Could not load featured products.
    //         </p>
    //         <button
    //           type="button"
    //           onClick={() => void fetchFeaturedProducts()}
    //           className="mt-3 text-brand-600 dark:text-brand-400 hover:underline"
    //         >
    //           Retry
    //         </button>
    //       </div>
    //     </section>
    //   );
    // }
    return null;
  }

  // ── Render: products ─────────────────────────────────────

  return (
    <section className="py-16 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
          Featured Products
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const firstImage = product.images?.[0];
            const imageSrc = safeImageUrl(firstImage);
            const hasImage = Boolean(firstImage) && !imageErrors[firstImage!];

            return (
              <div
                key={product.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-soft hover:shadow-card-hover border border-gray-200 dark:border-gray-700 transition-shadow duration-350 overflow-hidden group"
              >
                <Link
                  href={`/shop/${product.id}`}
                  className="block"
                  aria-label={`View ${product.name}`}
                >
                  <div className="aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    {hasImage ? (
                      <img
                        src={imageSrc}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350"
                        onError={() => handleImageError(firstImage!)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {product.name}
                    </h3>
                    <p className="text-lg font-bold text-brand-600 dark:text-brand-400 mt-1 tabular-nums">
                      {formatCurrency(product.unitPrice)}
                    </p>
                    <span className="mt-2 inline-block text-brand-600 dark:text-brand-400 group-hover:text-brand-800 dark:group-hover:text-brand-300 text-sm font-medium transition-colors duration-350">
                      View Details →
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
