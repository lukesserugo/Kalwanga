'use client';

// D:\Projects\Kalwanga\packages\web\components\products\RecentlyViewed.tsx

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Package } from 'lucide-react';
import { productService, type Product } from '../../services/productService';
import { guestRecentlyViewedService } from '../../services/guestRecentlyViewedService';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { WishlistButton } from './WishlistButton';

// ============================================
// BACKEND CONTRACT
// ============================================
//
// Authenticated:
//   GET    /products/recently-viewed?limit=N   (auth required)
//   POST   /products/recently-viewed/:productId   (auth required)
//   DELETE /products/recently-viewed              (auth required)
//
// Anonymous:
//   GET    /recently-viewed/guest?limit=N
//   POST   /recently-viewed/guest/:productId
//   DELETE /recently-viewed/guest
//     Backed by `GuestSession.recentlyView` (JSON array of ids).
//     The controller hydrates ids into full product objects before
//     returning, so both routes have the same response shape.

const BACKEND_MAX_LIMIT = 50;
const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

interface RecentlyViewedProps {
  limit?: number;
  title?: string;
  showTitle?: boolean;
  className?: string;
  onProductClick?: (productId: string) => void;
}

export function RecentlyViewed({
  limit = 6,
  title = 'Recently Viewed',
  showTitle = true,
  className = '',
  onProductClick,
}: RecentlyViewedProps) {
  const { isAuthenticated } = useAuth();

  // Clamp to a range the backend honours.
  const effectiveLimit = Math.min(
    Math.max(1, Math.floor(limit)),
    BACKEND_MAX_LIMIT,
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================
  // DATA LOAD
  // ============================================
  //
  // ✅ Branches on auth:
  //    • Authenticated → `/products/recently-viewed` (server-side,
  //      per user).
  //    • Anonymous → `/recently-viewed/guest` (server-side, per guest
  //      session, backed by the `guest_session_id` cookie).
  //
  // Both routes return hydrated product objects, so the caller shape
  // is identical.

  const loadRecentlyViewed = useCallback(async () => {
    try {
      setLoading(true);

      const data = isAuthenticated
        ? await productService.getRecentlyViewed(effectiveLimit)
        : await guestRecentlyViewedService.getRecentlyViewed(effectiveLimit);

      if (!isMountedRef.current) return;
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      // The services swallow errors and return [], so this is
      // defensive only.
      console.warn('Failed to load recently viewed:', error);
      if (isMountedRef.current) setProducts([]);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [effectiveLimit, isAuthenticated]);

  useEffect(() => {
    loadRecentlyViewed();
  }, [loadRecentlyViewed]);

  // ============================================
  // VIEWPORT VISIBILITY
  // ============================================

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ============================================
  // IMAGE ERRORS
  // ============================================

  const resolveImageSrc = (image: string | undefined): string => {
    if (!image) return PLACEHOLDER_IMAGE;
    if (imageErrors.has(image)) return PLACEHOLDER_IMAGE;
    return image;
  };

  const handleImageError = (image: string) => {
    setImageErrors((prev) => {
      if (prev.has(image)) return prev;
      const next = new Set(prev);
      next.add(image);
      return next;
    });
  };

  // ============================================
  // HANDLERS
  // ============================================

  const handleProductClick = (productId: string) => {
    if (onProductClick) onProductClick(productId);
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div ref={containerRef} className={className}>
        {showTitle && (
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {title}
            </h2>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(effectiveLimit)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-100 dark:bg-gray-700 rounded-2xl h-32 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Nothing to show → hide the whole section. No "no items yet" banner.
  if (products.length === 0) {
    return null;
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {title}
            </h2>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {products.slice(0, effectiveLimit).map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group relative card-brand shadow-soft hover:shadow-card-hover transition duration-250 overflow-hidden"
          >
            <Link
              href={`/shop/${product.id}`}
              onClick={() => handleProductClick(product.id)}
              className="block focus-ring rounded-2xl"
            >
              <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                {product.images?.[0] ? (
                  <img
                    src={resolveImageSrc(product.images[0])}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={() => handleImageError(product.images[0])}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <WishlistButton
                    productId={product.id}
                    size="sm"
                    className="shadow-soft"
                  />
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {product.name}
                </p>
                <p className="text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-400">
                  {formatCurrency(product.unitPrice)}
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default RecentlyViewed;
