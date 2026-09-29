// D:\Projects\Kalwanga\packages\web\app\wishlist\page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  ShoppingBag,
  Trash2,
  ShoppingCart,
  Eye,
  Package,
  Star,
  Loader2,
} from 'lucide-react';
import { productService } from '../../../services/productService';
import { toast } from '../../../utils/toast-manager';
import { formatCurrency } from '../../../utils/formatters';
import { useAuth } from '../../../hooks/useAuth';
import { useThemeStore } from '../../stores/themeStore';

// ============================================
// TYPES
// ============================================
//
// The `Product` type from `services/productService` is the canonical
// wire shape. `WishlistProduct` is the UI's view-model for the grid —
// it only declares the fields the grid actually renders.
//
// ⚠ `inventory` is declared as `Inventory[]` here (matching the wire
//   shape when the backend nests a to-one relation as an array in a
//   list response). The grid reads `product.inventory?.[0]` to grab
//   the singular inventory row. When the backend returns a single
//   object instead of an array, the code below normalises it.

interface WishlistInventory {
  quantity: number;
  reserved: number;
}

interface WishlistProduct {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  images?: string[];
  category?: { id: string; name: string } | null;
  inventory?: WishlistInventory | WishlistInventory[] | null;
  rating?: number | null;
  reviewCount?: number | null;
  isActive: boolean;
  featured?: boolean;
  description?: string | null;
}

// ============================================
// HELPERS
// ============================================

/**
 * Read the available stock from a product's inventory field.
 *
 * The backend serialises `Product.inventory` as a to-one relation,
 * but the list endpoint sometimes wraps it in an array. This helper
 * normalises both shapes and returns the max(0, quantity - reserved).
 */
function getAvailableStock(product: WishlistProduct): number {
  const inv = product.inventory;
  if (!inv) return 0;

  const row = Array.isArray(inv) ? inv[0] : inv;
  if (!row) return 0;

  const quantity = typeof row.quantity === 'number' ? row.quantity : 0;
  const reserved = typeof row.reserved === 'number' ? row.reserved : 0;

  return Math.max(0, quantity - reserved);
}

/**
 * Narrow an arbitrary string to the shape `WishlistProduct` needs.
 *
 * The service returns `string[]` from `getWishlist()`, so the page
 * fetches the full product for each id. Each fetched product goes
 * through this adapter before landing in state — it strips the
 * wide-shape differences between the wire `Product` and the local
 * `WishlistProduct` view-model.
 */
function toWishlistProduct(raw: any): WishlistProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') {
    return null;
  }

  return {
    id: raw.id,
    name: raw.name,
    sku: typeof raw.sku === 'string' ? raw.sku : '',
    unitPrice: typeof raw.unitPrice === 'number' ? raw.unitPrice : 0,
    images: Array.isArray(raw.images) ? raw.images : [],
    category: raw.category ?? null,
    inventory: raw.inventory ?? null,
    rating: raw.rating ?? null,
    reviewCount: raw.reviewCount ?? null,
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
    featured: Boolean(raw.featured),
    description: raw.description ?? null,
  };
}

// ============================================
// PAGE
// ============================================

export default function WishlistPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { isDark } = useThemeStore();

  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  // ============================================
  // LOAD WISHLIST
  // ============================================
  //
  // `productService.getWishlist()` returns `string[]` — an array of
  // product IDs. The older code branched on whether the response was
  // an array of strings or objects, but the service signature is now
  // stable: it's always `string[]`. We fetch the product for each id
  // in parallel and map the results through `toWishlistProduct`.
  //
  // Any individual fetch that fails (deleted product, network hiccup)
  // is filtered out rather than failing the whole load.

  const loadWishlist = useCallback(async () => {
    try {
      setLoading(true);

      const ids = await productService.getWishlist();

      if (!Array.isArray(ids) || ids.length === 0) {
        setProducts([]);
        return;
      }

      const fetched = await Promise.all(
        ids.map((id) =>
          productService
            .getProductById(id)
            .then((p) => toWishlistProduct(p))
            .catch((err) => {
              console.warn(`Failed to fetch wishlist product ${id}:`, err);
              return null;
            }),
        ),
      );

      setProducts(
        fetched.filter((p): p is WishlistProduct => p !== null),
      );
    } catch (error) {
      console.error('Failed to load wishlist:', error);
      toast.error('Failed to load wishlist');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect_url=/wishlist');
      return;
    }
    void loadWishlist();
  }, [isAuthenticated, loadWishlist, router]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleRemove = useCallback(
    async (productId: string) => {
      setRemoving(productId);
      try {
        const result = await productService.toggleWishlist(productId);
        if (!result.added) {
          setProducts((prev) => prev.filter((p) => p.id !== productId));
          toast.success('Removed from wishlist');
        }
      } catch (error) {
        toast.error('Failed to remove from wishlist');
      } finally {
        setRemoving(null);
      }
    },
    [],
  );

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderStars = (rating: number = 0) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= Math.round(rating)
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
        {rating > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
            ({rating.toFixed(1)})
          </span>
        )}
      </div>
    );
  };

  // ============================================
  // LOADING
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 pt-24 md:pt-28 pb-8">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 dark:border-orange-400" />
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 pt-24 md:pt-28 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Heart className="w-8 h-8 text-red-500 fill-current" />
              My Wishlist
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {products.length} items in your wishlist
            </p>
          </div>
          {products.length > 0 && (
            <button
              onClick={() => router.push('/shop')}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-md"
            >
              <ShoppingBag className="w-4 h-4" />
              Continue Shopping
            </button>
          )}
        </div>

        {products.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Your wishlist is empty
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
              Start adding products you love to your wishlist by clicking the
              heart icon on any product.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 justify-center">
              <Link
                href="/shop"
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-md"
              >
                <ShoppingBag className="w-4 h-4" />
                Browse Products
              </Link>
              <Link
                href="/categories"
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                Browse Categories
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {products.map((product, index) => {
                const available = getAvailableStock(product);
                const isOutOfStock = available <= 0;

                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 group"
                  >
                    <Link href={`/shop/${product.id}`} className="block">
                      <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-16 h-16 text-gray-300 dark:text-gray-600" />
                          </div>
                        )}
                        {product.featured && (
                          <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            Featured
                          </div>
                        )}
                        {isOutOfStock && (
                          <div className="absolute top-2 left-2 px-2 py-1 bg-red-600 text-white text-xs rounded">
                            Out of Stock
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleRemove(product.id);
                          }}
                          disabled={removing === product.id}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                          title="Remove from wishlist"
                          aria-label={`Remove ${product.name} from wishlist`}
                        >
                          {removing === product.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </Link>

                    <div className="p-4">
                      <Link href={`/shop/${product.id}`}>
                        <h3 className="font-semibold text-gray-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors line-clamp-1">
                          {product.name}
                        </h3>
                      </Link>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        SKU: {product.sku}
                      </p>
                      {product.category && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {product.category.name}
                        </p>
                      )}
                      {product.rating && product.rating > 0 && (
                        <div className="mt-1">
                          {renderStars(product.rating)}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                          {formatCurrency(product.unitPrice)}
                        </span>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/shop/${product.id}`}
                            className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                            title="View Details"
                            aria-label={`View details for ${product.name}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/shop/${product.id}`}
                            aria-disabled={isOutOfStock}
                            onClick={(e) => {
                              if (isOutOfStock) e.preventDefault();
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isOutOfStock
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
                            }`}
                            title={
                              isOutOfStock
                                ? 'Out of stock'
                                : 'Go to product to add to cart'
                            }
                            aria-label={`Open ${product.name} to add to cart`}
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                      {!isOutOfStock && available <= 5 && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                          Only {available} left
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
