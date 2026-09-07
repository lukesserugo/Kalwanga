// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\suppliers\[id]\products\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Package, Search, RefreshCw, Plus,
  Edit, Trash2, Loader2, Lock, AlertCircle,
  X, CheckCircle, Eye, DollarSign, Tag, ShoppingBag,
  Filter, Grid, List, Download, Printer, ExternalLink,
  ChevronDown, ChevronUp, Info, Star, StarHalf
} from 'lucide-react';
import { useAuth } from '../../../../../../hooks/useAuth';
import { usePermission } from '../../../../../../hooks/usePermission';
import { supplierService } from '../../../../../../services/supplierService';
import { toast } from '../../../../../../utils/toast-manager';
import { formatCurrency } from '../../../../../../utils/formatters';
import { PermissionResource } from '../../../../../../types/enums';

// ============================================
// TYPES
// ============================================

interface SupplierProduct {
  id: string;
  productId?: string;
  unitPrice: number;
  leadTime?: number | null;
  isPreferred: boolean;
  isActive: boolean;
  product?: {
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    unitPrice: number;
    costPrice?: number | null;
    category?: {
      id: string;
      name: string;
    } | null;
    images?: string[];
    isActive: boolean;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductFilters {
  search: string;
  status: 'all' | 'active' | 'inactive';
  preferred: 'all' | 'preferred' | 'regular';
  sortBy: 'name' | 'price' | 'leadTime' | 'createdAt';
  sortOrder: 'asc' | 'desc';
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            disabled={loading}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border-0 disabled:opacity-50"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filters.preferred}
            onChange={(e) => onFilterChange('preferred', e.target.value)}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border-0 disabled:opacity-50"
          >
            {preferredOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => onFilterChange('sortBy', e.target.value)}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border-0 disabled:opacity-50"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>Sort by {opt.label}</option>
            ))}
          </select>

          <button
            onClick={() => onFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
            disabled={loading}
            className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {filters.sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={onReset}
              disabled={loading}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 flex items-center gap-1 disabled:opacity-50"
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
  const productName = product.product?.name || 'Unknown Product';
  const productSku = product.product?.sku || product.variant?.sku || 'N/A';
  const categoryName = product.product?.category?.name || 'Uncategorized';
  const price = product.unitPrice || product.product?.unitPrice || 0;
  const leadTime = product.leadTime || null;
  const isPreferred = product.isPreferred || false;
  const isActive = product.isActive !== undefined ? product.isActive : (product.product?.isActive !== undefined ? product.product.isActive : true);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 hover:shadow-md transition-all ${
        isActive
          ? 'border-gray-200 dark:border-gray-700'
          : 'border-gray-200 dark:border-gray-700 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
            <Package className="w-5 h-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">{productName}</h4>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Tag className="w-3 h-3" />
              <span className="font-mono">{productSku}</span>
            </div>
            {categoryName && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{categoryName}</span>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0 ml-2">
          {isPreferred && (
            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-xs font-medium flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400" />
              Preferred
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Price</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatCurrency(price)}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Lead Time</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {leadTime ? `${leadTime} days` : 'N/A'}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isActive
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {product.variant && (
        <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <span>Variant:</span>
          <span className="font-medium text-gray-600 dark:text-gray-300">{product.variant.name}</span>
          <span className="font-mono">({product.variant.sku})</span>
        </div>
      )}
    </motion.div>
  );
};

const ProductTable: React.FC<{
  products: SupplierProduct[];
}> = ({ products }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Category</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Lead Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {products.map((product) => {
              const productName = product.product?.name || 'Unknown Product';
              const productSku = product.product?.sku || product.variant?.sku || 'N/A';
              const categoryName = product.product?.category?.name || 'Uncategorized';
              const price = product.unitPrice || product.product?.unitPrice || 0;
              const leadTime = product.leadTime || null;
              const isPreferred = product.isPreferred || false;
              const isActive = product.isActive !== undefined ? product.isActive : (product.product?.isActive !== undefined ? product.product.isActive : true);

              return (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{productName}</span>
                        {isPreferred && (
                          <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">★ Preferred</span>
                        )}
                        {product.variant && (
                          <span className="block text-xs text-gray-400 dark:text-gray-500">
                            {product.variant.name} ({product.variant.sku})
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono hidden md:table-cell">
                    {productSku}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                    {categoryName}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                    {formatCurrency(price)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                    {leadTime ? `${leadTime} days` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {isActive ? 'Active' : 'Inactive'}
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

  const canViewProducts = canView(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);
  const supplierName = useMemo(() => {
    // Try to get supplier name from localStorage or URL
    return 'Supplier';
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && supplierId) {
      loadProducts();
    }
  }, [supplierId, isClient]);

  const loadProducts = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const data = await supplierService.getSupplierProducts(supplierId);
      
      let productsData: any[] = [];
      if (data && typeof data === 'object') {
        if ('data' in data && Array.isArray(data.data)) {
          productsData = data.data;
        } else if (Array.isArray(data)) {
          productsData = data;
        }
      }
      
      setProducts(productsData);
    } catch (error) {
      console.error('Failed to load supplier products:', error);
      setError('Failed to load products. Please try again.');
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
    setFilters(prev => ({ ...prev, [key]: value }));
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

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        (p.product?.name?.toLowerCase().includes(searchLower) || false) ||
        (p.product?.sku?.toLowerCase().includes(searchLower) || false) ||
        (p.variant?.sku?.toLowerCase().includes(searchLower) || false) ||
        (p.variant?.name?.toLowerCase().includes(searchLower) || false)
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      const isActive = filters.status === 'active';
      filtered = filtered.filter(p => {
        const active = p.isActive !== undefined ? p.isActive : (p.product?.isActive !== undefined ? p.product.isActive : true);
        return active === isActive;
      });
    }

    // Preferred filter
    if (filters.preferred !== 'all') {
      const isPreferred = filters.preferred === 'preferred';
      filtered = filtered.filter(p => p.isPreferred === isPreferred);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name':
          comparison = (a.product?.name || '').localeCompare(b.product?.name || '');
          break;
        case 'price':
          comparison = (a.unitPrice || a.product?.unitPrice || 0) - (b.unitPrice || b.product?.unitPrice || 0);
          break;
        case 'leadTime':
          comparison = (a.leadTime || 0) - (b.leadTime || 0);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        default:
          comparison = 0;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [products, filters]);

  // Loading state
  if (permissionLoading || !isClient || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading products...</p>
        </div>
      </div>
    );
  }

  // Permission check
  if (!canViewProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view supplier products. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push(`/admin/suppliers/${supplierId}`)}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Supplier
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/suppliers/${supplierId}`}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
                Supplier Products
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>{products.length} products</span>
                {filteredProducts.length !== products.length && (
                  <span className="text-blue-600 dark:text-blue-400">
                    ({filteredProducts.length} filtered)
                  </span>
                )}
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  {products.filter(p => p.isActive !== false).length} active
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  {products.filter(p => p.isPreferred).length} preferred
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle view mode"
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => window.print()}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
            <button
              onClick={() => loadProducts(false)}
              className="ml-auto px-3 py-1 bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors text-sm"
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No products found</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {filters.search || filters.status !== 'all' || filters.preferred !== 'all'
                ? 'Try adjusting your filters or search terms'
                : 'This supplier doesn\'t have any products yet'}
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
          <span>
            Showing {filteredProducts.length} of {products.length} products
            {filters.status !== 'all' && ` (filtered by ${filters.status})`}
            {filters.preferred !== 'all' && ` (${filters.preferred})`}
          </span>
          <span>
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}
