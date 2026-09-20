// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\cart\abandoned\page.tsx

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
  AlertTriangle,
  Mail as MailIcon,
  X,
  Loader2,
  AlertCircle,
  Eye,
  Search,
  Filter,
  Package,
  RefreshCw,
  User,
  Clock,
  ThumbsUp,
  BarChart3,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from '../../../../../utils/toast-manager';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { cartService } from '../../../../../services/cartService';
import {
  formatCurrency,
  formatNumber,
  formatTimeAgo,
} from '../../../../../utils/formatters';
import { useConfirm } from '../../../../../components/notifications/ConfirmProvider';

// ============================================
// INTERFACES
// ============================================

interface AbandonedCart {
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
  abandonedAt: string;
  hoursAbandoned: number;
}

interface PaginationInfo {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

interface AbandonedFilters {
  search: string;
  hours: number;
  minValue?: number;
  status: string;
}

const DEFAULT_FILTERS: AbandonedFilters = {
  search: '',
  hours: 24,
  status: 'all',
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

const HOURS_OPTIONS = [
  { value: 12, label: 'Last 12 hours' },
  { value: 24, label: 'Last 24 hours' },
  { value: 48, label: 'Last 48 hours' },
  { value: 72, label: 'Last 72 hours' },
  { value: 168, label: 'Last 7 days' },
  { value: 720, label: 'Last 30 days' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SAVED', label: 'Saved' },
  { value: 'ABANDONED', label: 'Abandoned' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminAbandonedCartsPage() {
  const router = useRouter();
  const { canManage, isLoading: permissionLoading } = usePermission();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [pagination, setPagination] =
    useState<PaginationInfo>(DEFAULT_PAGINATION);
  const [filters, setFilters] =
    useState<AbandonedFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCart, setSelectedCart] =
    useState<AbandonedCart | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [workingCartId, setWorkingCartId] = useState<string | null>(null);

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

  const canViewAbandoned =
    canManage(PermissionResource.CART_VIEW) ||
    canManage(PermissionResource.CART_MANAGE) ||
    canManage(PermissionResource.ANALYTICS);

  const canRecoverCart =
    canManage(PermissionResource.CART_MANAGE) ||
    canManage(PermissionResource.CART_CHECKOUT);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchAbandonedCarts = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
      if (!canViewAbandoned) return;

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      try {
        setError(null);

        const params: Record<string, unknown> = {
          page: pagination.page,
          limit: pagination.limit,
          hours: filters.hours,
        };
        if (filters.search) params.search = filters.search;
        if (typeof filters.minValue === 'number') {
          params.minValue = filters.minValue;
        }
        if (filters.status !== 'all') params.status = filters.status;

        const response = await cartService.getAbandonedCarts(params);
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
        console.error('Failed to fetch abandoned carts:', err);
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load abandoned carts';
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
      canViewAbandoned,
      filters.search,
      filters.hours,
      filters.minValue,
      filters.status,
      pagination.page,
      pagination.limit,
    ],
  );

  // Refetch whenever the filters or pagination change.
  useEffect(() => {
    if (!canViewAbandoned) {
      setLoading(false);
      return;
    }
    void fetchAbandonedCarts(loading ? 'initial' : 'silent');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canViewAbandoned,
    filters.search,
    filters.hours,
    filters.minValue,
    filters.status,
    pagination.page,
    pagination.limit,
  ]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleRefresh = useCallback(async () => {
    await fetchAbandonedCarts('refresh');
    toast.success('Abandoned carts refreshed');
  }, [fetchAbandonedCarts]);

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
    <K extends keyof AbandonedFilters>(
      key: K,
      value: AbandonedFilters[K],
    ) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      // Search already debounces below; other filters reset to page 1
      // immediately.
      if (key !== 'search') {
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    },
    [],
  );

  const handleSearchInput = useCallback(
    (value: string) => {
      setFilters((prev) => ({ ...prev, search: value }));
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      searchDebounceRef.current = setTimeout(() => {
        setPagination((prev) => ({ ...prev, page: 1 }));
      }, 300);
    },
    [],
  );

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleViewCart = useCallback((cart: AbandonedCart) => {
    setSelectedCart(cart);
    setShowCartModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowCartModal(false);
    setSelectedCart(null);
  }, []);

  const handleRecoverCart = useCallback(
    async (cartId: string) => {
      if (!canRecoverCart) {
        toast.error('You do not have permission to recover carts');
        return;
      }

      const ok = await confirm({
        title: 'Recover this cart?',
        description:
          'The user will be notified and their session will be reactivated. The cart will be marked ACTIVE.',
        tone: 'info',
        confirmLabel: 'Recover',
      });
      if (!ok) return;

      setWorkingCartId(cartId);
      try {
        await cartService.recoverCart({ cartId, notifyUser: true });
        toast.success('Cart recovery initiated');
        window.dispatchEvent(new CustomEvent('cart:updated'));
        await fetchAbandonedCarts('silent');
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to recover cart';
        toast.error(message);
      } finally {
        if (isMountedRef.current) setWorkingCartId(null);
      }
    },
    [canRecoverCart, confirm, fetchAbandonedCarts],
  );

  const handleSendReminder = useCallback(
    async (cartId: string) => {
      if (!canRecoverCart) {
        toast.error('You do not have permission to send reminders');
        return;
      }

      setWorkingCartId(cartId);
      try {
        await cartService.sendReminder({ cartId });
        toast.success('Reminder sent');
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to send reminder';
        toast.error(message);
      } finally {
        if (isMountedRef.current) setWorkingCartId(null);
      }
    },
    [canRecoverCart],
  );

  // ============================================
  // DERIVED
  // ============================================

  const stats = useMemo(() => {
    const total = pagination.total;
    const pageValue = carts.reduce((sum, c) => sum + (c.total || 0), 0);
    const avgValue = carts.length > 0 ? pageValue / carts.length : 0;
    return { total, pageValue, avgValue };
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

  const getAbandonmentRisk = (
    hours: number,
  ): { label: string; color: string; icon: React.ReactNode } => {
    if (hours > 72) {
      return {
        label: 'High Risk',
        color: 'text-red-600 dark:text-red-400',
        icon: <AlertTriangle className="w-4 h-4" />,
      };
    }
    if (hours > 24) {
      return {
        label: 'Medium Risk',
        color: 'text-amber-600 dark:text-amber-400',
        icon: <Clock className="w-4 h-4" />,
      };
    }
    return {
      label: 'Low Risk',
      color: 'text-emerald-600 dark:text-emerald-400',
      icon: <ThumbsUp className="w-4 h-4" />,
    };
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
            Loading abandoned carts…
          </p>
        </div>
      </div>
    );
  }

  if (!canViewAbandoned) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view abandoned carts.
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
                <AlertTriangle className="w-7 h-7 text-red-500" />
                Abandoned Carts
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Monitor and recover carts that users have abandoned
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => router.push('/admin/cart/analytics')}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Abandoned"
            value={formatNumber(stats.total)}
            accent="text-red-600 dark:text-red-400"
          />
          <StatCard
            label="Potential Revenue (page)"
            value={formatCurrency(stats.pageValue)}
            accent="text-amber-600 dark:text-amber-400"
          />
          <StatCard
            label="Avg Cart Value (page)"
            value={formatCurrency(stats.avgValue)}
            accent="text-orange-600 dark:text-orange-400"
          />
          <StatCard
            label="Recovery Rate"
            value="—"
            accent="text-emerald-600 dark:text-emerald-400"
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
                    Hours Abandoned
                  </label>
                  <select
                    value={filters.hours}
                    onChange={(e) =>
                      handleFilterChange(
                        'hours',
                        parseInt(e.target.value, 10),
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none"
                  >
                    {HOURS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <Th>User</Th>
                  <Th>Items</Th>
                  <Th align="right">Total</Th>
                  <Th>Status</Th>
                  <Th>Abandoned</Th>
                  <Th>Risk</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {carts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-lg font-medium">
                        No abandoned carts
                      </p>
                      <p className="text-sm">
                        Try widening the hours filter or clearing
                        search.
                      </p>
                    </td>
                  </tr>
                ) : (
                  carts.map((cart) => {
                    const risk = getAbandonmentRisk(
                      cart.hoursAbandoned || 0,
                    );
                    const isWorking = workingCartId === cart.id;
                    return (
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
                          {cart.abandonedAt
                            ? formatTimeAgo(cart.abandonedAt)
                            : formatTimeAgo(cart.updatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`flex items-center gap-1 text-sm font-medium ${risk.color}`}
                          >
                            {risk.icon}
                            {risk.label}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleViewCart(cart)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title="View Details"
                              aria-label="View details"
                            >
                              <Eye className="w-4 h-4 text-gray-500" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleSendReminder(cart.id)
                              }
                              disabled={isWorking || !canRecoverCart}
                              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50"
                              title="Send Reminder"
                              aria-label="Send reminder"
                            >
                              {isWorking ? (
                                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                              ) : (
                                <MailIcon className="w-4 h-4 text-blue-500" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleRecoverCart(cart.id)
                              }
                              disabled={isWorking || !canRecoverCart}
                              className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded transition-colors disabled:opacity-50"
                              title="Recover Cart"
                              aria-label="Recover cart"
                            >
                              {isWorking ? (
                                <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4 text-emerald-500" />
                              )}
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

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
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Abandoned Cart Details
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
                <InfoTile label="Abandoned">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedCart.abandonedAt
                      ? formatTimeAgo(selectedCart.abandonedAt)
                      : formatTimeAgo(selectedCart.updatedAt)}
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
                {canRecoverCart && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void handleSendReminder(selectedCart.id);
                      }}
                      disabled={workingCartId === selectedCart.id}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {workingCartId === selectedCart.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MailIcon className="w-4 h-4" />
                      )}
                      Send Reminder
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleRecoverCart(selectedCart.id);
                      }}
                      disabled={workingCartId === selectedCart.id}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {workingCartId === selectedCart.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Recover Cart
                    </button>
                  </>
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
