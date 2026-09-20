// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\cart\history\page.tsx

'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ShoppingCart,
  Clock,
  RefreshCw,
  Filter,
  X,
  Loader2,
  AlertCircle,
  Eye,
  Search,
  Package,
  User,
  Lock,
  Download,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from '../../../../../utils/toast-manager';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { cartService } from '../../../../../services/cartService';
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from '../../../../../utils/formatters';

// ============================================
// INTERFACES
// ============================================

interface CartHistoryItem {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  items: Array<{
    id: string;
    productId: string;
    product: {
      id: string;
      name: string;
      sku: string;
      unitPrice: number;
      images: string[];
    };
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  itemCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  checkedOutAt?: string;
  /** Server-provided link to the sale, if the cart was checked out. */
  saleId?: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

interface HistoryFilters {
  search: string;
  status: string;
  dateRange: string;
  minValue?: number;
  maxValue?: number;
  userId?: string;
}

const DEFAULT_FILTERS: HistoryFilters = {
  search: '',
  status: 'all',
  dateRange: 'week',
};

const DEFAULT_PAGINATION: PaginationInfo = {
  total: 0,
  page: 1,
  totalPages: 1,
  limit: 20,
};

// ============================================
// CONSTANTS
// ============================================

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SAVED', label: 'Saved' },
  { value: 'CHECKED_OUT', label: 'Checked Out' },
  { value: 'ABANDONED', label: 'Abandoned' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminCartHistoryPage() {
  const router = useRouter();
  const { canManage, isLoading: permissionLoading } = usePermission();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carts, setCarts] = useState<CartHistoryItem[]>([]);
  const [pagination, setPagination] =
    useState<PaginationInfo>(DEFAULT_PAGINATION);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCart, setSelectedCart] =
    useState<CartHistoryItem | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const isMountedRef = useRef(true);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // ============================================
  // PERMISSIONS
  // ============================================

  const canViewHistory =
    canManage(PermissionResource.CART_VIEW_HISTORY) ||
    canManage(PermissionResource.CART_VIEW) ||
    canManage(PermissionResource.CART_MANAGE);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchCartHistory = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
      if (!canViewHistory) return;

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      try {
        setError(null);

        const params: Record<string, unknown> = {
          page: pagination.page,
          limit: pagination.limit,
        };
        if (filters.search) params.search = filters.search;
        if (filters.status !== 'all') params.status = filters.status;
        if (typeof filters.minValue === 'number') {
          params.minValue = filters.minValue;
        }
        if (typeof filters.maxValue === 'number') {
          params.maxValue = filters.maxValue;
        }
        if (filters.userId) params.userId = filters.userId;
        if (filters.dateRange !== 'all') {
          params.dateRange = filters.dateRange;
        }

        const response = await cartService.getCartHistory(params);
        if (!isMountedRef.current) return;

        setCarts(response.carts ?? []);
        setPagination({
          total: response.total ?? 0,
          page: response.page ?? 1,
          totalPages: response.totalPages ?? 1,
          limit: response.limit ?? DEFAULT_PAGINATION.limit,
        });
      } catch (err: any) {
        if (!isMountedRef.current) return;
        console.error('Failed to fetch cart history:', err);
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load cart history';
        setError(message);
        toast.error(message);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      canViewHistory,
      filters.search,
      filters.status,
      filters.dateRange,
      filters.minValue,
      filters.maxValue,
      filters.userId,
      pagination.page,
      pagination.limit,
    ],
  );

  useEffect(() => {
    if (!canViewHistory) {
      setLoading(false);
      return;
    }
    void fetchCartHistory(loading ? 'initial' : 'silent');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canViewHistory,
    filters.search,
    filters.status,
    filters.dateRange,
    filters.minValue,
    filters.maxValue,
    filters.userId,
    pagination.page,
    pagination.limit,
  ]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleRefresh = useCallback(async () => {
    await fetchCartHistory('refresh');
    toast.success('Cart history refreshed');
  }, [fetchCartHistory]);

  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => {
      if (page < 1 || page > prev.totalPages) return prev;
      return { ...prev, page };
    });
  }, []);

  const handleLimitChange = useCallback((limit: number) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }));
  }, []);

  const handleFilterChange = useCallback(
    <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      if (key !== 'search') {
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    },
    [],
  );

  const handleSearchInput = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleViewCart = useCallback((cart: CartHistoryItem) => {
    setSelectedCart(cart);
    setShowCartModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowCartModal(false);
    setSelectedCart(null);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const blob = await cartService.exportHistory({
        format: 'csv',
        dateRange: filters.dateRange,
        status:
          filters.status !== 'all' ? filters.status : undefined,
        includeItems: true,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cart-history-${
        new Date().toISOString().split('T')[0]
      }.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Export downloaded');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to export cart history',
      );
    }
  }, [filters.dateRange, filters.status]);

  // ============================================
  // DERIVED
  // ============================================

  const stats = useMemo(() => {
    const total = pagination.total;
    const pageRevenue = carts.reduce(
      (sum, c) => sum + (c.total || 0),
      0,
    );
    const avgValue = carts.length > 0 ? pageRevenue / carts.length : 0;
    const checkedOutOnPage = carts.filter(
      (c) => c.status === 'CHECKED_OUT',
    ).length;
    const conversionRate =
      carts.length > 0 ? (checkedOutOnPage / carts.length) * 100 : 0;
    return { total, pageRevenue, avgValue, conversionRate };
  }, [carts, pagination.total]);

  // ============================================
  // HELPERS
  // ============================================

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      ACTIVE:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      SAVED:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      CHECKED_OUT:
        'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
      ABANDONED:
        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      ACTIVE: 'Active',
      SAVED: 'Saved',
      CHECKED_OUT: 'Checked Out',
      ABANDONED: 'Abandoned',
    };
    return labels[status] || status;
  };

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading cart history…
          </p>
        </div>
      </div>
    );
  }

  if (!canViewHistory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view cart history.
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin')}
          className="mt-4 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/admin/cart')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to cart management"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-7 h-7 text-orange-500" />
                Cart History
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                View all cart activity across the system
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setViewMode((v) => (v === 'table' ? 'grid' : 'table'))
              }
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label={
                viewMode === 'table'
                  ? 'Switch to grid view'
                  : 'Switch to table view'
              }
            >
              {viewMode === 'table' ? (
                <Grid className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <List className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw
                className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
              aria-expanded={showFilters}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Carts"
            value={formatNumber(stats.total)}
          />
          <StatCard
            label="Revenue (page)"
            value={formatCurrency(stats.pageRevenue)}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Avg Cart Value (page)"
            value={formatCurrency(stats.avgValue)}
            accent="text-orange-600 dark:text-orange-400"
          />
          <StatCard
            label="Conversion (page)"
            value={`${stats.conversionRate.toFixed(1)}%`}
            accent="text-purple-600 dark:text-purple-400"
          />
        </div>

        {/* Filters */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6 overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) =>
                        handleSearchInput(e.target.value)
                      }
                      placeholder="Search by user or email…"
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) =>
                      handleFilterChange('status', e.target.value)
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none"
                  >
                    {STATUS_FILTERS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date Range
                  </label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) =>
                      handleFilterChange('dateRange', e.target.value)
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none"
                  >
                    {DATE_RANGES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min Value
                  </label>
                  <input
                    type="number"
                    value={filters.minValue ?? ''}
                    onChange={(e) =>
                      handleFilterChange(
                        'minValue',
                        e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      )
                    }
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                >
                  Clear Filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 p-1"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Table / Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <Th>User</Th>
                    <Th>Items</Th>
                    <Th align="right">Total</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {carts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                      >
                        <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-lg font-medium">
                          No cart history found
                        </p>
                        <p className="text-sm">
                          Try adjusting your filters
                        </p>
                      </td>
                    </tr>
                  ) : (
                    carts.map((cart) => (
                      <motion.tr
                        key={cart.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                        onClick={() => handleViewCart(cart)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {cart.user?.firstName}{' '}
                                {cart.user?.lastName}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {cart.user?.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                          {cart.itemCount ??
                            cart.items?.length ??
                            0}{' '}
                          items
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(cart.total || 0)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(cart.status)}`}
                          >
                            {getStatusLabel(cart.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {cart.createdAt
                            ? formatDate(cart.createdAt)
                            : 'N/A'}
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleViewCart(cart)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="View Details"
                            aria-label="View details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {carts.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
                  <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-lg font-medium">
                    No cart history found
                  </p>
                </div>
              ) : (
                carts.map((cart) => (
                  <motion.div
                    key={cart.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleViewCart(cart)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {cart.user?.firstName} {cart.user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {cart.user?.email}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${getStatusColor(cart.status)}`}
                      >
                        {getStatusLabel(cart.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                        {cart.itemCount ??
                          cart.items?.length ??
                          0}{' '}
                        items
                      </span>
                      <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(cart.total || 0)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      {cart.createdAt
                        ? formatDate(cart.createdAt)
                        : 'N/A'}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                  Showing{' '}
                  {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total,
                  )}{' '}
                  of {pagination.total}
                </span>
                <select
                  value={pagination.limit}
                  onChange={(e) =>
                    handleLimitChange(parseInt(e.target.value, 10))
                  }
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handlePageChange(pagination.page - 1)
                  }
                  disabled={pagination.page <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handlePageChange(pagination.page + 1)
                  }
                  disabled={pagination.page >= pagination.totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {showCartModal && selectedCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleCloseModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Cart Details
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">
                      ID: {selectedCart.id.slice(0, 12)}…
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <InfoTile label="User">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {selectedCart.user?.firstName}{' '}
                    {selectedCart.user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {selectedCart.user?.email}
                  </p>
                </InfoTile>
                <InfoTile label="Status">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedCart.status)}`}
                  >
                    {getStatusLabel(selectedCart.status)}
                  </span>
                </InfoTile>
                <InfoTile label="Total">
                  <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(selectedCart.total || 0)}
                  </p>
                </InfoTile>
                <InfoTile label="Created">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedCart.createdAt
                      ? formatDate(selectedCart.createdAt)
                      : 'N/A'}
                  </p>
                </InfoTile>
              </div>

              {/* Items */}
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Items
                </h4>
                {selectedCart.items &&
                selectedCart.items.length > 0 ? (
                  selectedCart.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-lg overflow-hidden flex-shrink-0">
                        {item.product?.images?.[0] ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {item.product?.name || 'Product'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          SKU: {item.product?.sku || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(item.unitPrice)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                          Qty: {item.quantity}
                        </p>
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400 tabular-nums">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    No items in this cart
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                >
                  Close
                </button>
                {selectedCart.status === 'CHECKED_OUT' &&
                  selectedCart.saleId && (
                    <button
                      type="button"
                      onClick={() => {
                        router.push(
                          `/admin/sales/${selectedCart.saleId}`,
                        );
                        handleCloseModal();
                      }}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    >
                      <Eye className="w-4 h-4" />
                      View Sale
                    </button>
                  )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-4 py-3 text-${align} text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider`}
    >
      {children}
    </th>
  );
}

function InfoTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </p>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = 'text-gray-900 dark:text-white',
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${accent}`}>
        {value}
      </p>
    </div>
  );
}
