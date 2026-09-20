// D:\Projects\Kalwanga\packages\web\components\products\ProductSalesAnalytics.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign,
  Package,
  Star,
  AlertCircle,
  Loader2,
  TrendingUp,
  Layers,
  Boxes,
  Info,
  RefreshCw,
} from 'lucide-react';
import { productService } from '../../services/productService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';

// ============================================
// TYPES
// ============================================
//
// Everything shown here is derived from endpoints the backend
// actually serves today:
//
//   • GET /products/:id               → product + inventory + variants  (auth)
//   • GET /products/:id/reviews/stats → rating + review count           (auth)
//
// There is NO /products/:id/sales, /analytics, /performance, or
// /stats endpoint on the backend. Time-series, top customers,
// conversion rate, return rate, revenue-by-channel, and sales-by-
// day-of-week are not available and are deliberately not shown.

interface VariantSnapshot {
  id: string;
  name: string;
  sku: string;
  price: number;
  costPrice?: number | null;
  stock: number;
  inventoryQuantity: number;
  inventoryReserved: number;
  available: number;
  isActive: boolean;
}

interface ProductSnapshot {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  costPrice?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  minStock?: number | null;
  isActive: boolean;
  featured?: boolean;

  // Product-level inventory (singular — matches backend).
  inventory: {
    quantity: number;
    reserved: number;
    available: number;
    reorderPoint: number;
    location?: string | null;
  } | null;

  variants: VariantSnapshot[];

  // Aggregates we compute client-side from the above (mirrors the
  // backend's computeStockAggregates logic).
  totalStock: number;
  totalAvailable: number;
}

interface ReviewStats {
  average: number;
  total: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

interface ProductSalesAnalyticsProps {
  productId: string;
  productName: string;
  unitPrice: number;
  className?: string;
}

const DEFAULT_REVIEW_STATS: ReviewStats = {
  average: 0,
  total: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

// ============================================
// HELPERS
// ============================================

function computeSnapshotAggregates(
  product: any,
): Pick<ProductSnapshot, 'totalStock' | 'totalAvailable'> {
  const inv = product.inventory;
  const productQty = inv?.quantity ?? 0;
  const productRes = inv?.reserved ?? 0;

  let variantStock = 0;
  let variantAvailable = 0;

  for (const v of product.variants ?? []) {
    if (v.inventory) {
      const q = v.inventory.quantity ?? 0;
      const r = v.inventory.reserved ?? 0;
      variantStock += q;
      variantAvailable += Math.max(0, q - r);
    } else {
      variantStock += v.stock ?? 0;
      variantAvailable += v.stock ?? 0;
    }
  }

  return {
    totalStock: productQty + variantStock,
    totalAvailable: Math.max(
      0,
      productQty - productRes + variantAvailable,
    ),
  };
}

function toSnapshot(raw: any): ProductSnapshot {
  const inv = raw.inventory
    ? {
        quantity: raw.inventory.quantity ?? 0,
        reserved: raw.inventory.reserved ?? 0,
        available:
          (raw.inventory.quantity ?? 0) - (raw.inventory.reserved ?? 0),
        reorderPoint: raw.inventory.reorderPoint ?? 0,
        location: raw.inventory.location ?? null,
      }
    : null;

  const variants: VariantSnapshot[] = Array.isArray(raw.variants)
    ? raw.variants.map((v: any) => {
        const vInv = v.inventory;
        const q = vInv?.quantity ?? v.stock ?? 0;
        const r = vInv?.reserved ?? 0;
        return {
          id: v.id,
          name: v.name ?? '',
          sku: v.sku ?? '',
          price: v.price ?? 0,
          costPrice: v.costPrice ?? null,
          stock: v.stock ?? 0,
          inventoryQuantity: q,
          inventoryReserved: r,
          available: Math.max(0, q - r),
          isActive: v.isActive !== undefined ? v.isActive : true,
        };
      })
    : [];

  const { totalStock, totalAvailable } = computeSnapshotAggregates({
    inventory: raw.inventory,
    variants: raw.variants,
  });

  return {
    id: raw.id,
    name: raw.name ?? '',
    sku: raw.sku ?? '',
    unitPrice: raw.unitPrice ?? 0,
    costPrice: raw.costPrice ?? null,
    rating: raw.rating ?? null,
    reviewCount: raw.reviewCount ?? null,
    minStock: raw.minStock ?? 5,
    isActive: raw.isActive !== undefined ? raw.isActive : true,
    featured: !!raw.featured,
    inventory: inv,
    variants,
    totalStock,
    totalAvailable,
  };
}

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  hint?: string;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  hint,
}: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-2 ${color} rounded-lg flex-shrink-0 ml-3`}>
          {icon}
        </div>
      </div>
      {hint && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{hint}</span>
        </p>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ProductSalesAnalytics({
  productId,
  productName,
  unitPrice,
  className = '',
}: ProductSalesAnalyticsProps) {
  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductSnapshot | null>(null);
  const [reviewStats, setReviewStats] =
    useState<ReviewStats>(DEFAULT_REVIEW_STATS);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    // ✅ Defensive guard. This view is admin-only; if it's ever
    //    mounted under a storefront path, surface a clear message
    //    instead of a 401 that shows as "Failed to load".
    if (!isAuthenticated) {
      setError('Sign in to view product analytics');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Both of these hit real backend endpoints.
      const [rawProduct, stats] = await Promise.all([
        productService.getProductById(productId),
        productService
          .getReviewStats(productId)
          .catch(() => DEFAULT_REVIEW_STATS),
      ]);

      if (!isMountedRef.current) return;

      if (!rawProduct || !rawProduct.id) {
        throw new Error('Product not found');
      }

      setProduct(toSnapshot(rawProduct));
      setReviewStats({
        average: Number(stats?.average) || 0,
        total: Number(stats?.total) || 0,
        distribution:
          stats?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
    } catch (err: any) {
      console.error('Failed to load product analytics:', err);
      if (!isMountedRef.current) return;

      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setError('Sign in to view product analytics');
        return;
      }

      setError('Failed to load product data');
      toast.error('Failed to load product data');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [productId, isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData();
    toast.info('Refreshing product data...');
  };

  // ============================================
  // EARLY RETURNS
  // ============================================

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading product data...
          </p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400">
          {error || 'No data available'}
        </p>
        {isAuthenticated && (
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // ============================================
  // DERIVED METRICS
  // ============================================

  const margin =
    product.costPrice != null && product.unitPrice > 0
      ? ((product.unitPrice - product.costPrice) / product.unitPrice) * 100
      : null;

  const marginAmount =
    product.costPrice != null
      ? product.unitPrice - product.costPrice
      : null;

  const stockStatus =
    product.totalAvailable <= 0
      ? 'out_of_stock'
      : product.totalAvailable <= (product.minStock ?? 5)
      ? 'low_stock'
      : 'in_stock';

  const hasVariants = product.variants.length > 0;

  // ✅ The stats endpoint aggregates live from `ProductReview`. The
  //    denormalized `product.reviewCount` is only trustworthy if the
  //    stats call failed. Prefer live; fall back to denormalized.
  const effectiveReviewCount =
    reviewStats.total > 0
      ? reviewStats.total
      : product.reviewCount ?? 0;

  const effectiveAverageRating =
    reviewStats.average > 0
      ? reviewStats.average
      : product.rating ?? 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Product Overview
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Live data for{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {productName}
            </span>
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Unit Price"
          value={formatCurrency(product.unitPrice)}
          subtitle={`SKU: ${product.sku}`}
          icon={
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
          }
          color="bg-green-100 dark:bg-green-900/20"
        />

        <StatCard
          title="Total Stock"
          value={formatNumber(product.totalStock)}
          subtitle={
            product.totalAvailable !== product.totalStock
              ? `${product.totalAvailable} available`
              : undefined
          }
          icon={
            <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          }
          color="bg-blue-100 dark:bg-blue-900/20"
        />

        <StatCard
          title="Average Rating"
          value={
            effectiveAverageRating > 0
              ? `${effectiveAverageRating.toFixed(1)} ★`
              : 'N/A'
          }
          subtitle={
            effectiveReviewCount > 0
              ? `${effectiveReviewCount} reviews`
              : 'No reviews yet'
          }
          icon={
            <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400 fill-current" />
          }
          color="bg-yellow-100 dark:bg-yellow-900/20"
          hint="Includes pending reviews"
        />

        <StatCard
          title="Variants"
          value={hasVariants ? product.variants.length : '—'}
          subtitle={hasVariants ? undefined : 'No variants'}
          icon={
            <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          }
          color="bg-purple-100 dark:bg-purple-900/20"
        />
      </div>

      {/* Margin & stock status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Margin
          </p>
          {margin != null ? (
            <>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {margin.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatCurrency(marginAmount ?? 0)} per unit
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Cost price not set
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Stock Status
          </p>
          <p
            className={`text-lg font-bold ${
              stockStatus === 'out_of_stock'
                ? 'text-red-600 dark:text-red-400'
                : stockStatus === 'low_stock'
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-green-600 dark:text-green-400'
            }`}
          >
            {stockStatus === 'out_of_stock'
              ? 'Out of Stock'
              : stockStatus === 'low_stock'
              ? 'Low Stock'
              : 'In Stock'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Reorder at {product.minStock ?? 5} units
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Product State
          </p>
          <p
            className={`text-lg font-bold ${
              product.isActive
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {product.isActive ? 'Active' : 'Inactive'}
          </p>
          {product.featured && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              ★ Featured
            </p>
          )}
        </div>
      </div>

      {/* Review distribution */}
      {reviewStats.total > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-gray-500" />
            Review Distribution
          </h4>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count =
                reviewStats.distribution[rating as 1 | 2 | 3 | 4 | 5] || 0;
              const pct =
                reviewStats.total > 0
                  ? (count / reviewStats.total) * 100
                  : 0;
              return (
                <div key={rating} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-8">
                    {rating} ★
                  </span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-yellow-400 rounded-full h-2 transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Variant breakdown */}
      {hasVariants && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-gray-500" />
            Variant Breakdown
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase pb-2">
                    Variant
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase pb-2">
                    SKU
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase pb-2">
                    Price
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase pb-2">
                    Cost
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase pb-2">
                    Available
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {product.variants.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2 text-sm text-gray-900 dark:text-white">
                      {v.name}
                      {!v.isActive && (
                        <span className="ml-2 text-xs text-gray-400">
                          (inactive)
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {v.sku}
                    </td>
                    <td className="py-2 text-sm text-gray-900 dark:text-white text-right">
                      {formatCurrency(v.price)}
                    </td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-400 text-right">
                      {v.costPrice != null
                        ? formatCurrency(v.costPrice)
                        : '—'}
                    </td>
                    <td className="py-2 text-sm text-gray-900 dark:text-white text-right">
                      {v.available}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Explanation of what's not shown */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Time-series analytics (daily/monthly sales, revenue trends, top
          customers, conversion rate, return rate, revenue by channel) are
          not yet available from the backend. This view shows only the
          live product, stock, and review data the API currently serves.
        </p>
      </div>
    </div>
  );
}

export default ProductSalesAnalytics;
