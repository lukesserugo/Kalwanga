// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\orders\analytics\page.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Package,
} from 'lucide-react';
import {
  orderService,
  type OrderAnalytics,
  type OrderFulfillmentStatus,
  type OrderStats,
} from '../../../../../services/orderService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency } from '../../../../../utils/formatters';

type Range = 'week' | 'month' | 'quarter' | 'year';

const RANGE_OPTIONS: Array<{ value: Range; label: string }> = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'quarter', label: 'Last 90 days' },
  { value: 'year', label: 'Last 365 days' },
];

function resolveRange(range: Range): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const start = new Date(now);
  switch (range) {
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
    startDate: start.toISOString(),
    endDate: now.toISOString(),
  };
}

export default function AdminOrderAnalyticsPage() {
  const router = useRouter();

  const [analytics, setAnalytics] = useState<OrderAnalytics | null>(
    null,
  );
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [fulfillment, setFulfillment] =
    useState<OrderFulfillmentStatus | null>(null);

  const [range, setRange] = useState<Range>('month');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>(
    'day',
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      setError(null);

      try {
        const { startDate, endDate } = resolveRange(range);

        const [analyticsRes, statsRes, fulfillmentRes] =
          await Promise.allSettled([
            orderService.getOrderAnalytics({
              startDate,
              endDate,
              groupBy,
            }),
            orderService.getOrderStats(),
            orderService.getOrderFulfillmentStatus(),
          ]);

        if (!isMountedRef.current) return;

        if (analyticsRes.status === 'fulfilled')
          setAnalytics(analyticsRes.value);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value);
        if (fulfillmentRes.status === 'fulfilled')
          setFulfillment(fulfillmentRes.value);

        if (analyticsRes.status === 'rejected') {
          const message =
            analyticsRes.reason?.response?.data?.message ||
            analyticsRes.reason?.message ||
            'Failed to load order analytics';
          setError(message);
          toast.error(message);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [range, groupBy],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const maxSeriesRevenue = Math.max(
    1,
    ...(analytics?.series.map((s) => s.revenue) ?? [0]),
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/admin/orders')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <BarChart3 className="w-7 h-7 text-brand-500" />
                Order Analytics
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Performance across your order pipeline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              {RANGE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <select
              value={groupBy}
              onChange={(e) =>
                setGroupBy(e.target.value as 'day' | 'week' | 'month')
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>

            <button
              type="button"
              onClick={() => load('refresh')}
              disabled={refreshing}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
              aria-label="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800">
            <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-danger-800 dark:text-danger-200">
              {error}
            </p>
          </div>
        )}

        {/* Stats overview */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Total Orders"
              value={stats.totalOrders.toLocaleString()}
              icon={ShoppingBag}
              accent="text-primary-600 dark:text-primary-400"
              iconBg="bg-primary-100 dark:bg-primary-900/30"
            />
            <MetricCard
              label="Total Value"
              value={formatCurrency(stats.totalValue)}
              icon={DollarSign}
              accent="text-success-600 dark:text-success-400"
              iconBg="bg-success-100 dark:bg-success-900/30"
            />
            <MetricCard
              label="Average Order"
              value={formatCurrency(stats.averageOrderValue)}
              icon={TrendingUp}
              accent="text-brand-600 dark:text-brand-400"
              iconBg="bg-brand-100 dark:bg-brand-900/30"
            />
            <MetricCard
              label="Status Types"
              value={stats.statusBreakdown.length.toLocaleString()}
              icon={BarChart3}
              accent="text-warning-600 dark:text-warning-400"
              iconBg="bg-warning-100 dark:bg-warning-900/30"
            />
          </div>
        )}

        {/* Fulfillment */}
        {fulfillment && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-500" />
              Fulfillment Status
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <FulfillmentTile
                label="Pending"
                count={fulfillment.pending}
                icon={Clock}
                accent="text-warning-600 dark:text-warning-400"
              />
              <FulfillmentTile
                label="Processing"
                count={fulfillment.processing}
                icon={RefreshCw}
                accent="text-primary-600 dark:text-primary-400"
              />
              <FulfillmentTile
                label="Completed"
                count={fulfillment.completed}
                icon={CheckCircle}
                accent="text-success-600 dark:text-success-400"
              />
              <FulfillmentTile
                label="Cancelled"
                count={fulfillment.cancelled}
                icon={XCircle}
                accent="text-danger-600 dark:text-danger-400"
              />
              <FulfillmentTile
                label="On Hold"
                count={fulfillment.onHold}
                icon={Clock}
                accent="text-brand-600 dark:text-brand-400"
              />
            </div>
          </div>
        )}

        {/* Series */}
        {analytics && analytics.series.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Revenue Over Time
            </h2>
            <div className="space-y-3">
              {analytics.series.map((point) => {
                const pct =
                  maxSeriesRevenue > 0
                    ? (point.revenue / maxSeriesRevenue) * 100
                    : 0;
                return (
                  <div key={point.period}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300 tabular-nums">
                        {point.period}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(point.revenue)} ·{' '}
                        {point.orders} orders
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-brand-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status breakdown */}
        {stats && stats.statusBreakdown.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Status Breakdown
            </h2>
            <div className="space-y-3">
              {stats.statusBreakdown.map((row) => (
                <div
                  key={row.status}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-700 dark:text-gray-300 capitalize">
                    {row.status.toLowerCase().replace(/_/g, ' ')}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent orders */}
        {stats && stats.recentOrders.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Orders
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {stats.recentOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                  className="w-full text-left px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center justify-between gap-4 focus-ring"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-gray-900 dark:text-white truncate">
                      #{order.orderNumber}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {order.customer
                        ? `${order.customer.firstName} ${order.customer.lastName}`.trim()
                        : 'Guest'}
                    </p>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(order.total)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  iconBg,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  iconBg: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {label}
          </p>
          <p
            className={`text-xl font-bold tabular-nums mt-1 truncate ${accent}`}
          >
            {value}
          </p>
        </div>
        <div className={`p-2.5 rounded-lg shrink-0 ${iconBg}`}>
          <Icon className={`w-5 h-5 ${accent}`} />
        </div>
      </div>
    </div>
  );
}

function FulfillmentTile({
  label,
  count,
  icon: Icon,
  accent,
}: {
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <Icon className={`w-5 h-5 mx-auto mb-1 ${accent}`} />
      <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
        {count}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {label}
      </p>
    </div>
  );
}
