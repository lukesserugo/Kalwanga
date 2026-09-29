// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\suppliers\[id]\products\page.tsx

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Package,
  Search,
  RefreshCw,
  Loader2,
  Lock,
  AlertCircle,
  X,
  Grid,
  List,
  Printer,
  Star,
  Tag,
} from 'lucide-react';
import { useAuth } from '../../../../../../hooks/useAuth';
import { usePermission } from '../../../../../../hooks/usePermission';
import {
  supplierService,
  type SupplierProduct,
} from '../../../../../../services/supplierService';
import { toast } from '../../../../../../utils/toast-manager';
import { formatCurrency } from '../../../../../../utils/formatters';
import { PermissionResource } from '../../../../../../types/enums';

// ============================================
// TYPES
// ============================================

interface ProductFilters {
  search: string;
  status: 'all' | 'active' | 'inactive';
  preferred: 'all' | 'preferred' | 'regular';
  sortBy: 'name' | 'price' | 'leadTime' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

// ============================================
// HELPERS
// ============================================

/**
 * The frontend service's `SupplierProduct` already carries every
 * field the backend returns — no local reshaping is needed. These
 * helpers just pick the right fallbacks when the nested `product`
 * is missing or the raw payload used a slightly different key.
 */
function getProductName(p: SupplierProduct): string {
  return (p as any).product?.name || 'Unknown Product';
}

function getProductSku(p: SupplierProduct): string {
  const raw: any = p;
  return raw.product?.sku || raw.variant?.sku || 'N/A';
}

function getProductCategory(p: SupplierProduct): string {
  return (p as any).product?.category?.name || 'Uncategorized';
}

function getProductPrice(p: SupplierProduct): number {
  const raw: any = p;
  return raw.unitPrice ?? raw.product?.unitPrice ?? 0;
}

function getProductLeadTime(p: SupplierProduct): number | null {
  const raw: any = p;
  const value = raw.leadTime;
  return typeof value === 'number' ? value : null;
}

function isProductPreferred(p: SupplierProduct): boolean {
  return (p as any).isPreferred === true;
}

function isProductActive(p: SupplierProduct): boolean {
  const raw: any = p;
  if (typeof raw.isActive === 'boolean') return raw.isActive;
  if (typeof raw.product?.isActive === 'boolean') return raw.product.isActive;
  return true;
}

function getProductVariant(
  p: SupplierProduct,
): { id: string; name: string; sku: string } | null {
  const raw: any = p;
  if (raw.variant && typeof raw.variant === 'object') {
    return {
      id: String(raw.variant.id ?? ''),
      name: String(raw.variant.name ?? ''),
      sku: String(raw.variant.sku ?? ''),
    };
  }
  return null;
}

/**
 * The backend's `getSupplierProducts` returns a paginated envelope:
 *   { products: [...], total, page, limit, totalPages }
 * The frontend service forwards that shape. We unwrap to the array.
 */
function extractProductArray(response: any): SupplierProduct[] {
  if (!response) return [];
  if (Array.isArray(response)) return response as SupplierProduct[];
  if (typeof response === 'object') {
    if (Array.isArray(response.products)) return response.products;
    if (Array.isArray(response.data)) return response.data;
  }
  return [];
}

// ============================================
// SUB-COMPONENTS
// ============================================

const ProductFiltersBar: React.FC<{
  filters: ProductFilters;
  onFilterChange: (key: keyof ProductFilters, value: any) => void;
  onReset: () => void;
  loading?: boolean;
}> = ({ filters, onFilterChange, onReset, loading }) => {
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  const preferredOptions = [
    { value: 'all', label: 'All' },
    { value: 'preferred', label: '★ Preferred' },
    { value: 'regular', label: 'Regular' },
  ];

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'price', label: 'Price' },
    { value: 'leadTime', label: 'Lead Time' },
    { value: 'createdAt', label: 'Created' },
  ];

  const activeFilterCount = [
    filters.search ? 1 : 0,
    filters.status !== 'all' ? 1 : 0,
    filters.preferred !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="card-brand p-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            disabled={loading}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 border-0 disabled:opacity-50"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={filters.preferred}
            onChange={(e) => onFilterChange('preferred', e.target.value)}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 border-0 disabled:opacity-50"
          >
            {preferredOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => onFilterChange('sortBy', e.target.value)}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 border-0 disabled:opacity-50"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort by {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={() =>
              onFilterChange(
                'sortOrder',
                filters.sortOrder === 'asc' ? 'desc' : 'asc',
              )
            }
            disabled={loading}
            className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 focus-ring"
            aria-label={`Sort ${
              filters.sortOrder === 'asc' ? 'descending' : 'ascending'
            }`}
          >
            {filters.sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={onReset}
              disabled={loading}
              className="text-sm text-danger-600 dark:text-danger-400 hover:text-danger-800 flex items-center gap-1 disabled:opacity-50 focus-ring rounded"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ProductCard: React.FC<{
  product: SupplierProduct;
  index: number;
}> = ({ product, index }) => {
  const name = getProductName(product);
  const sku = getProductSku(product);
  const category = getProductCategory(product);
  const price = getProductPrice(product);
  const leadTime = getProductLeadTime(product);
  const preferred = isProductPreferred(product);
  const active = isProductActive(product);
  const variant = getProductVariant(product);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className={`card-brand p-4 hover:shadow-card-hover transition-all ${
        active ? '' : 'opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg flex-shrink-0">
            <Package className="w-5 h-5 text-brand-500" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {name}
            </h4>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Tag className="w-3 h-3" />
              <span className="font-mono">{sku}</span>
            </div>
            {category && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {category}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0 ml-2">
          {preferred && (
            <span className="px-2 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 rounded-full text-xs font-medium flex items-center gap-1">
              <Star className="w-3 h-3 fill-warning-400" />
              Preferred
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Price</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(price)}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Lead Time
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
            {leadTime ? `${leadTime} days` : 'N/A'}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              active
                ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
            }`}
          >
            {active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {variant && (
        <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <span>Variant:</span>
          <span className="font-medium text-gray-600 dark:text-gray-300">
            {variant.name}
          </span>
          <span className="font-mono">({variant.sku})</span>
        </div>
      )}
    </motion.div>
  );
};

const ProductTable: React.FC<{
  products: SupplierProduct[];
}> = ({ products }) => {
  return (
    <div className="card-brand p-0 overflow-hidden">
      <div className="overflow-x-auto sidebar-scroll">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Product
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                SKU
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                Category
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Price
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                Lead Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {products.map((product) => {
              const name = getProductName(product);
              const sku = getProductSku(product);
              const category = getProductCategory(product);
              const price = getProductPrice(product);
              const leadTime = getProductLeadTime(product);
              const preferred = isProductPreferred(product);
              const active = isProductActive(product);
              const variant = getProductVariant(product);

              return (
                <tr
                  key={product.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {name}
                        </span>
                        {preferred && (
                          <span className="ml-2 text-xs text-warning-600 dark:text-warning-400">
                            ★ Preferred
                          </span>
                        )}
                        {variant && (
                          <span className="block text-xs text-gray-400 dark:text-gray-500">
                            {variant.name} ({variant.sku})
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono hidden md:table-cell">
                    {sku}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                    {category}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(price)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden sm:table-cell tabular-nums">
                    {leadTime ? `${leadTime} days` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        active
                          ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                          : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                      }`}
                    >
                      {active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SupplierProductsPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params?.id as string;
  const { user } = useAuth();
  const { canView, canManage, isLoading: permissionLoading } = usePermission();

  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    status: 'all',
    preferred: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const canViewProducts =
    canView(PermissionResource.SUPPLIER) ||
    canManage(PermissionResource.SUPPLIER);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && supplierId) {
      loadProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, isClient]);

  const loadProducts = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const response = await supplierService.getSupplierProducts(supplierId);
      const list = extractProductArray(response);
      setProducts(list);
    } catch (err: any) {
      console.error('Failed to load supplier products:', err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load products. Please try again.';
      setError(errorMessage);
      toast.error('Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProducts(false);
    toast.success('Products refreshed');
  };

  const handleFilterChange = (key: keyof ProductFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      preferred: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
    });
  };

  // ============================================
  // DERIVED
  // ============================================

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter((p) => {
        const name = getProductName(p).toLowerCase();
        const sku = getProductSku(p).toLowerCase();
        return name.includes(q) || sku.includes(q);
      });
    }

    if (filters.status !== 'all') {
      const wantActive = filters.status === 'active';
      filtered = filtered.filter(
        (p) => isProductActive(p) === wantActive,
      );
    }

    if (filters.preferred !== 'all') {
      const wantPreferred = filters.preferred === 'preferred';
      filtered = filtered.filter(
        (p) => isProductPreferred(p) === wantPreferred,
      );
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name':
          comparison = getProductName(a).localeCompare(getProductName(b));
          break;
        case 'price':
          comparison = getProductPrice(a) - getProductPrice(b);
          break;
        case 'leadTime':
          comparison =
            (getProductLeadTime(a) ?? 0) - (getProductLeadTime(b) ?? 0);
          break;
        case 'createdAt': {
          const aRaw = (a as any).createdAt;
          const bRaw = (b as any).createdAt;
          comparison =
            (aRaw ? new Date(aRaw).getTime() : 0) -
            (bRaw ? new Date(bRaw).getTime() : 0);
          break;
        }
        default:
          comparison = 0;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [products, filters]);

  const activeCount = useMemo(
    () => products.filter((p) => isProductActive(p)).length,
    [products],
  );
  const preferredCount = useMemo(
    () => products.filter((p) => isProductPreferred(p)).length,
    [products],
  );

  // ============================================
  // LOADING
  // ============================================

  if (permissionLoading || !isClient || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 dark:border-brand-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading products...
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // PERMISSION CHECK
  // ============================================

  if (!canViewProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view supplier products. Please contact
          your administrator.
        </p>
        <button
          onClick={() => router.push(`/admin/suppliers/${supplierId}`)}
          className="mt-4 px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors flex items-center gap-2 focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Supplier
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/suppliers/${supplierId}`}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-6 h-6 sm:w-7 sm:h-7 text-brand-500" />
                Supplier Products
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                <span className="tabular-nums">
                  {products.length} products
                </span>
                {filteredProducts.length !== products.length && (
                  <span className="text-brand-600 dark:text-brand-400 tabular-nums">
                    ({filteredProducts.length} filtered)
                  </span>
                )}
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                <span className="flex items-center gap-1 tabular-nums">
                  <span className="w-2 h-2 rounded-full bg-success-500"></span>
                  {activeCount} active
                </span>
                <span className="flex items-center gap-1 tabular-nums">
                  <span className="w-2 h-2 rounded-full bg-warning-400"></span>
                  {preferredCount} preferred
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() =>
                setViewMode(viewMode === 'grid' ? 'list' : 'grid')
              }
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
              aria-label="Toggle view mode"
            >
              {viewMode === 'grid' ? (
                <List className="w-4 h-4" />
              ) : (
                <Grid className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
              aria-label="Refresh products"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={() => window.print()}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
              aria-label="Print products"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0" />
            <span className="text-danger-700 dark:text-danger-300">
              {error}
            </span>
            <button
              onClick={() => loadProducts(false)}
              className="ml-auto px-3 py-1 bg-danger-100 dark:bg-danger-800/30 text-danger-700 dark:text-danger-300 rounded-lg hover:bg-danger-200 dark:hover:bg-danger-800/50 transition-colors text-sm focus-ring"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <ProductFiltersBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          loading={loading}
        />

        {/* Products Display */}
        {filteredProducts.length === 0 ? (
          <div className="card-brand p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              No products found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {filters.search ||
              filters.status !== 'all' ||
              filters.preferred !== 'all'
                ? 'Try adjusting your filters or search terms'
                : "This supplier doesn't have any products yet"}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        ) : (
          <ProductTable products={filteredProducts} />
        )}

        {/* Footer Info */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span className="tabular-nums">
            Showing {filteredProducts.length} of {products.length} products
            {filters.status !== 'all' && ` (filtered by ${filters.status})`}
            {filters.preferred !== 'all' && ` (${filters.preferred})`}
          </span>
          <span className="tabular-nums">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}
