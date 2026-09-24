// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\checkout\stats\page.tsx

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Download,
  RefreshCw,
  Loader2,
  Lock,
  ArrowLeft,
  Clock,
  Gift,
  AlertCircle,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import {
  checkoutService,
  type CheckoutStats,
  type GetCheckoutStatsQuery,
} from '../../../../../services/checkoutService';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { toast } from '../../../../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

type DateRangeOption =
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'custom';

/**
 * Convert a named range into concrete `dateFrom` / `dateTo` ISO strings.
 *
 * The backend `GET /checkout/stats/summary` accepts `dateFrom` and
 * `dateTo` — there is no `range` parameter. Sending one was silently
 * ignored and every request returned all-time stats.
 */
function resolveRange(
  range: DateRangeOption,
  customStart?: string,
  customEnd?: string,
): { dateFrom: string | null; dateTo: string | null } {
  const now = new Date();

  if (range === 'custom') {
    if (!customStart || !customEnd) return { dateFrom: null, dateTo: null };
    return {
      dateFrom: new Date(customStart).toISOString(),
      dateTo: new Date(customEnd).toISOString(),
    };
  }

  const start = new Date(now);
  const end = new Date(now);

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return {
    dateFrom: start.toISOString(),
    dateTo: end.toISOString(),
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminCheckoutStatsPage() {
  const router = useRouter();
  const { hasPermission, isLoading: permissionLoading } = usePermission();

  const [stats, setStats] = useState<CheckoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeOption>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const canViewStats = hasPermission(PermissionResource.PAYMENT);
  const canManageStats = hasPermission(PermissionResource.PAYMENT);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadStats = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!canViewStats) return;

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      try {
        const { dateFrom, dateTo } = resolveRange(
          dateRange,
          customStartDate,
          customEndDate,
        );

        if (!dateFrom || !dateTo) {
          if (isMountedRef.current) {
            setStats(null);
            setLoading(false);
            setRefreshing(false);
          }
          return;
        }

        const params: GetCheckoutStatsQuery = { dateFrom, dateTo };
        const data = await checkoutService.getCheckoutStats(params);
        if (!isMountedRef.current) return;
        setStats(data);
      } catch (error: any) {
        if (!isMountedRef.current) return;
        console.error('Error loading checkout stats:', error);
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            'Failed to load checkout statistics',
        );
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      canViewStats,
      dateRange,
      customStartDate,
      customEndDate,
    ],
  );

  useEffect(() => {
    if (permissionLoading) return;
    if (canViewStats) {
      void loadStats('initial');
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionLoading, canViewStats, dateRange, customStartDate, customEndDate]);

  const handleRefresh = useCallback(() => {
    void loadStats('refresh');
  }, [loadStats]);

  const handleExport = useCallback(async () => {
    try {
      setExportLoading(true);
      const { dateFrom, dateTo } = resolveRange(
        dateRange,
        customStartDate,
        customEndDate,
      );
      if (!dateFrom || !dateTo) {
        toast.error('Please select a valid date range');
        return;
      }

      // The stats endpoint does not have its own export; we export the
      // underlying rows via `exportCheckouts` and let the caller inspect
      // the summary separately.
      const result = await checkoutService.exportCheckouts({
        format: 'csv',
        dateFrom,
        dateTo,
      });

      const blob =
        result instanceof Blob
          ? result
          : new Blob([JSON.stringify(result)], {
              type: 'application/json',
            });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `checkout-stats-${
        new Date().toISOString().split('T')[0]
      }.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Statistics exported');
    } catch (error: any) {
      console.error('Error exporting stats:', error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to export statistics',
      );
    } finally {
      if (isMountedRef.current) setExportLoading(false);
    }
  }, [dateRange, customStartDate, customEndDate]);

  // ============================================
  // DERIVED
  // ============================================

  const recoveryRate = useMemo(() => {
    if (!stats) return 0;
    const { abandonedCarts, recoveredCarts } = stats.summary;
    if (abandonedCarts <= 0) return 0;
    return (recoveredCarts / abandonedCarts) * 100;
  }, [stats]);

  const totalPaymentVolume = useMemo(() => {
    if (!stats) return 0;
    return stats.paymentMethods.reduce((sum, m) => sum + m.total, 0);
  }, [stats]);

  // ============================================
  // GUARDS
  // ============================================

  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!canViewStats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view checkout statistics.
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin/checkout')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Checkout
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <AlertCircle className="w-16 h-16 mb-4 text-yellow-500" />
        <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">
          No Data Available
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          No checkout data for the selected period.
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/admin/checkout')}
            className="p-2 rounded-lg transition hover:bg-gray-200 dark:hover:bg-gray-700 focus-ring"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Checkout Statistics
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Monitor your checkout performance and conversion metrics
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
            className="px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
            <option value="year">Last 365 Days</option>
            <option value="custom">Custom Range</option>
          </select>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg transition bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-700 disabled:opacity-50 focus-ring"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={exportLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 focus-ring"
          >
            {exportLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            title: 'Total Revenue',
            value: formatCurrency(stats.summary.totalRevenue),
            icon: DollarSign,
            color: 'bg-green-100 dark:bg-green-900/20',
            iconColor: 'text-green-600 dark:text-green-400',
          },
          {
            title: 'Total Orders',
            value: stats.summary.totalOrders.toLocaleString(),
            icon: ShoppingBag,
            color: 'bg-blue-100 dark:bg-blue-900/20',
            iconColor: 'text-blue-600 dark:text-blue-400',
          },
          {
            title: 'Average Order Value',
            value: formatCurrency(stats.summary.averageOrderValue),
            icon: TrendingUp,
            color: 'bg-purple-100 dark:bg-purple-900/20',
            iconColor: 'text-purple-600 dark:text-purple-400',
          },
          {
            title: 'Conversion Rate',
            value: `${stats.summary.conversionRate.toFixed(1)}%`,
            icon: BarChart3,
            color: 'bg-orange-100 dark:bg-orange-900/20',
            iconColor: 'text-orange-600 dark:text-orange-400',
          },
        ].map(({ title, value, icon: Icon, color, iconColor }) => (
          <div
            key={title}
            className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {title}
                </p>
                <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white tabular-nums">
                  {value}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${color}`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Customers
              </p>
              <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white tabular-nums">
                {stats.summary.totalCustomers.toLocaleString()}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Abandoned Carts
              </p>
              <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white tabular-nums">
                {stats.summary.abandonedCarts.toLocaleString()}
              </p>
            </div>
            <ShoppingBag className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Recovered Carts
              </p>
              <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white tabular-nums">
                {stats.summary.recoveredCarts.toLocaleString()}
              </p>
            </div>
            <Gift className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Recovery Rate
              </p>
              <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white tabular-nums">
                {recoveryRate.toFixed(1)}%
              </p>
            </div>
            <RefreshCw className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Payment Methods
          </h2>
          <div className="space-y-4">
            {stats.paymentMethods.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No payment data for this period.
              </p>
            ) : (
              stats.paymentMethods.map((method) => {
                const share =
                  totalPaymentVolume > 0
                    ? (method.total / totalPaymentVolume) * 100
                    : 0;
                return (
                  <div key={method.method}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {method.method.toLowerCase().replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(method.total)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                      {method.count} transactions
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Top Products
          </h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No product data for this period.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.topProducts.slice(0, 5).map((product, index) => (
                <div key={product.id} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0
                        ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : index === 1
                        ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        : index === 2
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {product.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                      {product.quantity} units sold
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(product.revenue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Customers */}
      <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Top Customers
        </h2>
        {stats.topCustomers.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No customer data for this period.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.topCustomers.slice(0, 6).map((customer) => (
              <div key={customer.id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    {customer.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {customer.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {customer.email}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(customer.totalSpent)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                    {customer.orderCount} orders
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
          <div className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Last updated: {formatDate(new Date())}
          </div>
          <div className="flex items-center gap-6 text-gray-600 dark:text-gray-400">
            <span>
              Data covers{' '}
              {dateRange === 'custom'
                ? 'custom range'
                : `last ${dateRange}`}
            </span>
            {canManageStats && (
              <button
                type="button"
                onClick={() => router.push('/admin/checkout/settings')}
                className="text-blue-600 dark:text-blue-400 hover:underline focus-ring rounded"
              >
                Configure settings →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
