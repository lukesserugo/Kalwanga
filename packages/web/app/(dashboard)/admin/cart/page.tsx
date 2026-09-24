// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\cart\page.tsx

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
  ShoppingCart,
  RefreshCw,
  Trash2,
  Eye,
  TrendingUp,
  Package,
  CreditCard,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  Info,
} from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { usePermission } from '../../../../hooks/usePermission';
import {
  cartService,
  type Cart,
} from '../../../../services/cartService';
import { toast } from '../../../../utils/toast-manager';
import {
  formatCurrency,
  formatDate,
} from '../../../../utils/formatters';
import {
  PermissionResource,
  CartStatus,
} from '../../../../types/enums';

import { CartSkeleton } from '../../../../components/cart';
import { useConfirm } from '../../../../components/notifications/ConfirmProvider';

// ============================================
// TYPES
// ============================================

interface AdminCartStats {
  totalCarts: number;
  activeCarts: number;
  abandonedCarts: number;
  totalItems: number;
  totalValue: number;
  averageValue: number;
  conversionRate: number;
}

interface AdminCartFilters {
  search: string;
  status: string;
  dateRange: string;
  minValue?: number;
  maxValue?: number;
  customerId?: string;
  businessUnitId?: string;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DEFAULT_FILTERS: AdminCartFilters = {
  search: '',
  status: 'all',
  dateRange: 'today',
};

const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

/**
 * The backend `/cart/abandoned` endpoint uses `hours` to determine the
 * cutoff. `computeDateRange` on the backend supports
 * `today | yesterday | week | month | quarter | year | custom`, and has
 * no `all` branch — it falls through to `week`. So we translate the UI
 * date ranges into `hours` here.
 */
const DATE_RANGE_TO_HOURS: Record<string, number> = {
  today: 24,
  week: 24 * 7,
  month: 24 * 30,
  quarter: 24 * 90,
  year: 24 * 365,
  all: 24 * 365 * 10,
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminCartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermission } = usePermission();
  const confirm = useConfirm();

  // ============================================
  // PERMISSIONS
  // ============================================

  const isSuperAdminOrAdmin =
    user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const canViewCart =
    isSuperAdminOrAdmin ||
    hasPermission(PermissionResource.CART_VIEW) ||
    hasPermission(PermissionResource.CART_MANAGE);

  const canManageCart =
    isSuperAdminOrAdmin ||
    hasPermission(PermissionResource.CART_MANAGE);

  const canViewCartHistory =
    isSuperAdminOrAdmin ||
    hasPermission(PermissionResource.CART_VIEW_HISTORY) ||
    canManageCart;

  const canCheckout =
    isSuperAdminOrAdmin ||
    hasPermission(PermissionResource.CART_CHECKOUT) ||
    canManageCart;

  // ============================================
  // STATE
  // ============================================

  const [carts, setCarts] = useState<Cart[]>([]);
  const [stats, setStats] = useState<AdminCartStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCart, setSelectedCart] = useState<Cart | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AdminCartFilters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] =
    useState<PaginationState>(DEFAULT_PAGINATION);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounce the search input so we don't re-filter on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
      setPagination((p) => ({ ...p, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  // ============================================
  // DATA FETCHING
  // ============================================

  /**
   * Fetch the cart list.
   *
   * BACKEND LIMITATION: there is no `GET /admin/carts` or
   * `GET /cart/all` endpoint. The two list endpoints that exist are:
   *
   *   - `GET /cart/history`   — the current user's carts only
   *   - `GET /cart/abandoned` — all carts, admin-gated, requires `hours`
   *
   * We use `/cart/abandoned` with a very wide `hours` window so the
   * page behaves as an admin list. Once a dedicated admin-list endpoint
   * exists, swap the call site below and drop the `hours` plumbing.
   */
  const fetchCarts = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
      if (!canViewCart) return;

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      try {
        const hours =
          DATE_RANGE_TO_HOURS[filters.dateRange] ??
          DATE_RANGE_TO_HOURS.week;

        const params: Record<string, unknown> = {
          page: pagination.page,
          limit: pagination.limit,
          hours,
        };
        if (filters.status !== 'all') params.status = filters.status;
        if (typeof filters.minValue === 'number')
          params.minValue = filters.minValue;
        if (typeof filters.maxValue === 'number')
          params.maxValue = filters.maxValue;
        if (filters.customerId) params.customerId = filters.customerId;
        if (filters.businessUnitId)
          params.businessUnitId = filters.businessUnitId;

        const response = await cartService.getAbandonedCarts(params);
        if (!isMountedRef.current) return;

        // The backend returns `{ carts, total, page, totalPages, limit }`
        // for this endpoint. Coerce defensively in case a wrapper
        // returns the array directly.
        const rawCarts: any[] = Array.isArray(response)
          ? response
          : response?.carts ?? [];

        // Client-side search fallback: the backend `/cart/abandoned`
        // endpoint does not accept a `search` param. Apply the filter
        // locally so the input does something useful.
        const cartList: Cart[] = debouncedSearch
          ? rawCarts.filter((c: any) => {
              const needle = debouncedSearch.toLowerCase();
              return (
                String(c.id || '').toLowerCase().includes(needle) ||
                String(c.userId || '').toLowerCase().includes(needle) ||
                String(c.customer?.firstName || '')
                  .toLowerCase()
                  .includes(needle) ||
                String(c.customer?.lastName || '')
                  .toLowerCase()
                  .includes(needle) ||
                String(c.customer?.email || '')
                  .toLowerCase()
                  .includes(needle)
              );
            })
          : rawCarts;

        setCarts(cartList);
        setPagination((prev) => ({
          ...prev,
          total: response?.total ?? cartList.length,
          totalPages: response?.totalPages ?? 1,
        }));

        // Stats reflect the current page only. A dedicated
        // `GET /admin/carts/stats` endpoint is the correct long-term fix.
        const activeCarts = cartList.filter(
          (c: any) => c.status === CartStatus.ACTIVE,
        ).length;
        const abandonedCarts = cartList.filter(
          (c: any) => c.status === CartStatus.ABANDONED,
        ).length;
        const totalItems = cartList.reduce(
          (sum: number, c: any) => sum + (c.itemCount || 0),
          0,
        );
        const totalValue = cartList.reduce(
          (sum: number, c: any) => sum + (c.total || 0),
          0,
        );
        const totalCarts = cartList.length;

        setStats({
          totalCarts,
          activeCarts,
          abandonedCarts,
          totalItems,
          totalValue,
          averageValue: totalCarts > 0 ? totalValue / totalCarts : 0,
          conversionRate:
            totalCarts > 0
              ? ((totalCarts - abandonedCarts) / totalCarts) * 100
              : 0,
        });
      } catch (error: any) {
        if (!isMountedRef.current) return;
        console.error('Failed to fetch carts:', error);
        toast.error(
          error?.response?.data?.message || 'Failed to load carts',
        );
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      canViewCart,
      debouncedSearch,
      filters.status,
      filters.dateRange,
      filters.minValue,
      filters.maxValue,
      filters.customerId,
      filters.businessUnitId,
      pagination.page,
      pagination.limit,
    ],
  );

  useEffect(() => {
    if (!canViewCart) return;
    void fetchCarts(loading ? 'initial' : 'silent');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canViewCart,
    debouncedSearch,
    filters.status,
    filters.dateRange,
    filters.minValue,
    filters.maxValue,
    filters.customerId,
    filters.businessUnitId,
    pagination.page,
    pagination.limit,
  ]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleRefresh = useCallback(async () => {
    await fetchCarts('refresh');
    toast.success('Carts refreshed');
  }, [fetchCarts]);

  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const handleLimitChange = useCallback((limit: number) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }));
  }, []);

  const handleFilterChange = useCallback(
    <K extends keyof AdminCartFilters>(
      key: K,
      value: AdminCartFilters[K],
    ) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      if (key !== 'search') {
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    },
    [],
  );

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleViewCart = useCallback((cart: Cart) => {
    setSelectedCart(cart);
    setShowCartModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowCartModal(false);
    setSelectedCart(null);
  }, []);

  /**
   * Deletion is intentionally a no-op against the backend — there is no
   * `DELETE /cart/:id` route. Rather than display a confirm dialog and
   * then a toast that the operation "isn't enabled", we disable the
   * button entirely and surface a tooltip. That's honest UI.
   *
   * When the backend adds the endpoint, uncomment the `cartService`
   * call and re-enable the button.
   */
  const handleDeleteCart = useCallback(
    async (cartId: string) => {
      if (!canManageCart) {
        toast.error('You do not have permission to delete carts');
        return;
      }

      const ok = await confirm({
        title: 'Delete this cart?',
        description:
          'The cart and its items will be permanently removed. This cannot be undone.',
        tone: 'danger',
        confirmLabel: 'Delete',
      });
      if (!ok) return;

      setDeletingId(cartId);
      try {
        // await cartService.deleteCart(cartId);
        // setCarts((prev) => prev.filter((c) => c.id !== cartId));
        // void fetchCarts('silent');
        toast.info(
          'Cart deletion is not yet enabled on the backend. No changes were made.',
        );
      } finally {
        if (isMountedRef.current) setDeletingId(null);
      }
    },
    [canManageCart, confirm, fetchCarts],
  );

  const handleCheckout = useCallback(
    (cartId: string) => {
      router.push(
        `/admin/cart/checkout?cartId=${encodeURIComponent(cartId)}`,
      );
      handleCloseModal();
    },
    [router, handleCloseModal],
  );

  // ============================================
  // HELPERS
  // ============================================

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      [CartStatus.ACTIVE]:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      [CartStatus.SAVED]:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      [CartStatus.CHECKED_OUT]:
        'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
      [CartStatus.ABANDONED]:
        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      [CartStatus.ACTIVE]: 'Active',
      [CartStatus.SAVED]: 'Saved',
      [CartStatus.CHECKED_OUT]: 'Checked Out',
      [CartStatus.ABANDONED]: 'Abandoned',
    };
    return labels[status] || status;
  };

  const hasExtendedFilters = useMemo(
    () =>
      typeof filters.minValue === 'number' ||
      typeof filters.maxValue === 'number' ||
      Boolean(filters.customerId) ||
      Boolean(filters.businessUnitId),
    [
      filters.minValue,
      filters.maxValue,
      filters.customerId,
      filters.businessUnitId,
    ],
  );

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!canViewCart) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Access Restricted
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You don't have permission to view cart management.
          </p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            Go Back
          </button>
        </motion.div>
      </div>
    );
  }

  // ============================================
  // RENDER — INITIAL LOAD
  // ============================================

  if (loading && carts.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-orange-500" />
            Cart Management
          </h1>
        </div>
        <CartSkeleton count={5} />
      </div>
    );
  }

  // ============================================
  // RENDER — MAIN
  // ============================================

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* ============================================
          HEADER
          ============================================ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-orange-500" />
            Cart Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage all shopping carts across the system
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          {canViewCartHistory && (
            <button
              type="button"
              onClick={() => router.push('/admin/cart/analytics')}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              Analytics
            </button>
          )}
          {canCheckout && (
            <button
              type="button"
              onClick={() => router.push('/admin/cart/checkout')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Checkout
            </button>
          )}
        </div>
      </div>

      {/* ============================================
          PAGE-STATS NOTICE
          ============================================ */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Summary statistics below reflect the <strong>current page</strong>{' '}
          only. A system-wide summary requires a dedicated backend endpoint
          that has not yet been implemented.
        </p>
      </div>

      {/* ============================================
          STATS
          ============================================ */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Carts (page)" value={stats.totalCarts} />
          <StatCard
            label="Active"
            value={stats.activeCarts}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Abandoned"
            value={stats.abandonedCarts}
            accent="text-red-600 dark:text-red-400"
          />
          <StatCard label="Total Items" value={stats.totalItems} />
          <StatCard
            label="Total Value"
            value={formatCurrency(stats.totalValue)}
          />
          <StatCard
            label="Conversion Rate"
            value={`${stats.conversionRate.toFixed(1)}%`}
            accent="text-orange-600 dark:text-orange-400"
          />
        </div>
      )}

      {/* ============================================
          FILTERS
          ============================================ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by cart ID, customer, or user…"
              value={filters.search}
              onChange={(e) =>
                handleFilterChange('search', e.target.value)
              }
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) =>
              handleFilterChange('status', e.target.value)
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Status</option>
            <option value={CartStatus.ACTIVE}>Active</option>
            <option value={CartStatus.SAVED}>Saved</option>
            <option value={CartStatus.CHECKED_OUT}>Checked Out</option>
            <option value={CartStatus.ABANDONED}>Abandoned</option>
          </select>
          <select
            value={filters.dateRange}
            onChange={(e) =>
              handleFilterChange('dateRange', e.target.value)
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 transition-colors text-sm"
            aria-expanded={showFilters}
          >
            <Filter className="w-4 h-4" />
            More
          </button>
          {hasExtendedFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FilterField label="Min Value">
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
                    className="filter-input"
                  />
                </FilterField>
                <FilterField label="Max Value">
                  <input
                    type="number"
                    value={filters.maxValue ?? ''}
                    onChange={(e) =>
                      handleFilterChange(
                        'maxValue',
                        e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      )
                    }
                    placeholder="0.00"
                    className="filter-input"
                  />
                </FilterField>
                <FilterField label="Customer ID">
                  <input
                    type="text"
                    value={filters.customerId ?? ''}
                    onChange={(e) =>
                      handleFilterChange(
                        'customerId',
                        e.target.value || undefined,
                      )
                    }
                    placeholder="Customer ID…"
                    className="filter-input"
                  />
                </FilterField>
                <FilterField label="Business Unit ID">
                  <input
                    type="text"
                    value={filters.businessUnitId ?? ''}
                    onChange={(e) =>
                      handleFilterChange(
                        'businessUnitId',
                        e.target.value || undefined,
                      )
                    }
                    placeholder="Business Unit ID…"
                    className="filter-input"
                  />
                </FilterField>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ============================================
          CARTS TABLE
          ============================================ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <Th>Cart ID</Th>
                <Th>User</Th>
                <Th>Customer</Th>
                <Th align="right">Items</Th>
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
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-lg font-medium">No carts found</p>
                    <p className="text-sm">Try adjusting your filters</p>
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
                    <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-300">
                      {cart.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {cart.userId?.slice(0, 8) || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {cart.customer ? (
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {cart.customer.firstName}{' '}
                          {cart.customer.lastName}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">
                          Guest
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                      {cart.itemCount || 0}
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleViewCart(cart)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {canManageCart && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCart(cart.id)}
                            disabled={deletingId === cart.id}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                            title="Delete cart (backend endpoint not yet available)"
                          >
                            {deletingId === cart.id ? (
                              <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-red-500" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
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
                onClick={() => handlePageChange(pagination.page - 1)}
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
                onClick={() => handlePageChange(pagination.page + 1)}
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

      {/* ============================================
          CART DETAIL MODAL
          ============================================ */}
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
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Cart Details
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <InfoTile label="Status">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedCart.status)}`}
                  >
                    {getStatusLabel(selectedCart.status)}
                  </span>
                </InfoTile>
                <InfoTile label="Items">
                  <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {selectedCart.itemCount || 0}
                  </p>
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
                {selectedCart.items && selectedCart.items.length > 0 ? (
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
                        {item.variant && (
                          <p className="text-xs text-gray-400">
                            Variant: {item.variant.name}
                          </p>
                        )}
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
                {canCheckout &&
                  selectedCart.status === CartStatus.ACTIVE &&
                  selectedCart.items &&
                  selectedCart.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCheckout(selectedCart.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 transition-colors shadow-md"
                    >
                      <CreditCard className="w-4 h-4" />
                      Checkout
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

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      {children}
    </div>
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
