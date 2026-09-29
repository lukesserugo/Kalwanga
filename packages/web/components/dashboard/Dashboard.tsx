// packages/web/components/dashboard/Dashboard.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  DollarSign,
  Users,
  Package,
  AlertTriangle,
  ShoppingCart,
  Clock,
  Calendar,
  Loader2,
  AlertCircle,
  Bell,
} from 'lucide-react';

import { StatsCard } from './StatsCard';
import { SalesChart } from './SalesChart';
// ⚠ `<RecentActivity>` is temporarily replaced with an inline panel
//    while the prop contract is confirmed. Re-enable the import once
//    the actual `RecentActivityProps` interface is known:
//
//      import { RecentActivity } from './RecentActivity';
//
import { dashboardService } from '../../services/dashboardService';
import type {
  DashboardRange,
  DashboardStats,
  RealtimeData,
  RealtimeNotification,
  TrendsResult,
} from '../../services/dashboardService';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';

// ============================================
// CONSTANTS
// ============================================

const RANGE_OPTIONS: Array<{ key: DashboardRange; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

// ============================================
// HELPERS
// ============================================

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const anyErr = error as any;
  const data = anyErr?.response?.data;

  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: any) => `${e.field ?? 'field'}: ${e.message ?? 'invalid'}`)
        .join(', ');
    }
  }

  if (anyErr?.message) return String(anyErr.message);
  return fallback;
}

interface ChartPoint {
  date: string;
  revenue: number;
  orders: number;
}

/**
 * Merge the backend's two parallel trend arrays into a single
 * date-keyed series the chart consumes.
 */
function mergeTrends(trends: TrendsResult | null): ChartPoint[] {
  if (!trends) return [];

  const byDate = new Map<string, { revenue: number; orders: number }>();

  for (const p of trends.sales ?? []) {
    byDate.set(p.date, { revenue: p.value ?? 0, orders: 0 });
  }
  for (const p of trends.orders ?? []) {
    const existing = byDate.get(p.date);
    if (existing) {
      existing.orders = p.value ?? 0;
    } else {
      byDate.set(p.date, { revenue: 0, orders: p.value ?? 0 });
    }
  }

  return Array.from(byDate.entries())
    .map(([date, { revenue, orders }]) => ({ date, revenue, orders }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
  } catch {
    return '';
  }
}

const NOTIFICATION_TONE: Record<
  string,
  { bg: string; text: string }
> = {
  info: {
    bg: 'bg-brand-50 dark:bg-brand-900/20',
    text: 'text-brand-600 dark:text-brand-400',
  },
  success: {
    bg: 'bg-success-50 dark:bg-success-900/20',
    text: 'text-success-600 dark:text-success-400',
  },
  warning: {
    bg: 'bg-warning-50 dark:bg-warning-900/20',
    text: 'text-warning-600 dark:text-warning-400',
  },
  error: {
    bg: 'bg-danger-50 dark:bg-danger-900/20',
    text: 'text-danger-600 dark:text-danger-400',
  },
};

function toneFor(type: string | undefined) {
  if (type && NOTIFICATION_TONE[type]) return NOTIFICATION_TONE[type];
  return {
    bg: 'bg-gray-50 dark:bg-gray-700/50',
    text: 'text-gray-500 dark:text-gray-400',
  };
}

// ============================================
// COMPONENT
// ============================================

export function Dashboard() {
  const { user } = useAuth();

  const [range, setRange] = useState<DashboardRange>('today');

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [trends, setTrends] = useState<TrendsResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchRequestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Load dashboard stats + realtime ───────────────────────

  const loadDashboardData = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);
    setLoadError(null);

    try {
      const [statsData, realtimeData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getRealtimeData(),
      ]);

      if (requestId !== fetchRequestIdRef.current) return;
      if (!mountedRef.current) return;

      setStats(statsData);
      setRealtime(realtimeData);
    } catch (error) {
      if (requestId !== fetchRequestIdRef.current) return;
      if (!mountedRef.current) return;

      const message = extractErrorMessage(error, 'Failed to load dashboard');
      console.error('[Dashboard] load failed:', message);
      setLoadError(message);
      toast.error(message);
    } finally {
      if (requestId === fetchRequestIdRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  // ── Load trends whenever the range changes ────────────────

  useEffect(() => {
    let cancelled = false;
    setTrendsLoading(true);

    dashboardService
      .getTrends(range)
      .then((result) => {
        if (cancelled || !mountedRef.current) return;
        setTrends(result);
      })
      .catch((error) => {
        if (cancelled || !mountedRef.current) return;
        console.warn(
          '[Dashboard] trends fetch failed:',
          extractErrorMessage(error, 'unknown'),
        );
        setTrends({ range, sales: [], orders: [] });
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setTrendsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  // ── Derived chart data ────────────────────────────────────

  const chartData = useMemo<ChartPoint[]>(
    () => mergeTrends(trends),
    [trends],
  );

  const notifications: RealtimeNotification[] = useMemo(
    () => realtime?.notifications ?? [],
    [realtime?.notifications],
  );

  // ── Render: initial loading ───────────────────────────────

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading dashboard…
          </p>
        </div>
      </div>
    );
  }

  // ── Render: error (nothing loaded) ────────────────────────

  if (loadError && !stats) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-danger-500 mx-auto" />
        <p className="text-gray-700 dark:text-gray-300">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadDashboardData()}
          className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Render: dashboard ─────────────────────────────────────

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Welcome back
              {user?.firstName ? `, ${user.firstName}` : ''}! Here&apos;s
              what&apos;s happening with your business today.
            </p>
          </div>
          <div
            className="flex gap-2"
            role="tablist"
            aria-label="Time range"
          >
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={range === option.key}
                onClick={() => setRange(option.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-ring ${
                  range === option.key
                    ? 'bg-brand-gradient text-white shadow-brand'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6"
        aria-live="polite"
      >
        <StatsCard
          title="Today's Sales"
          value={formatCurrency(stats?.sales?.today?.total ?? 0)}
          subtitle={`${stats?.sales?.today?.count ?? 0} transactions`}
          icon={<DollarSign className="w-6 h-6" />}
          color="blue"
        />
        <StatsCard
          title="Weekly Sales"
          value={formatCurrency(stats?.sales?.week?.total ?? 0)}
          subtitle={`${stats?.sales?.week?.count ?? 0} transactions`}
          icon={<TrendingUp className="w-6 h-6" />}
          color="green"
        />
        <StatsCard
          title="Monthly Sales"
          value={formatCurrency(stats?.sales?.month?.total ?? 0)}
          subtitle={`${stats?.sales?.month?.count ?? 0} transactions`}
          icon={<Calendar className="w-6 h-6" />}
          color="purple"
        />
        <StatsCard
          title="Total Customers"
          value={stats?.customers?.total ?? 0}
          subtitle={`${stats?.customers?.newThisMonth ?? 0} new this month`}
          icon={<Users className="w-6 h-6" />}
          color="indigo"
        />
        <StatsCard
          title="Inventory Value"
          value={formatCurrency(stats?.inventory?.totalValue ?? 0)}
          subtitle={`${stats?.inventory?.totalItems ?? 0} items`}
          icon={<Package className="w-6 h-6" />}
          color="orange"
        />
        <StatsCard
          title="Low Stock Items"
          value={stats?.inventory?.lowStock ?? 0}
          subtitle={`${stats?.inventory?.outOfStock ?? 0} out of stock`}
          icon={<AlertTriangle className="w-6 h-6" />}
          trend={(stats?.inventory?.lowStock ?? 0) > 0 ? 'down' : 'up'}
          color="red"
        />
        <StatsCard
          title="Open Registers"
          value={stats?.registers?.open ?? 0}
          subtitle={
            stats?.registers?.total != null
              ? `${stats.registers.open} of ${stats.registers.total} open`
              : 'Cash registers'
          }
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
        <StatsCard
          title="Pending Orders"
          value={stats?.orders?.pending ?? 0}
          subtitle="Awaiting processing"
          icon={<ShoppingCart className="w-6 h-6" />}
          color="pink"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 card-brand">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Sales Overview
            </h3>
            {trendsLoading && (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            )}
          </div>
          <SalesChart data={chartData} />
        </div>

        <div className="card-brand">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Top Products
          </h3>
          <div className="space-y-4">
            {(stats?.topProducts ?? []).slice(0, 5).map((product, index) => (
              <div key={product.productId} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-semibold text-sm tabular-nums flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                    {product.productName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                    {product.quantity} sold
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white flex-shrink-0">
                  {formatCurrency(product.revenue)}
                </span>
              </div>
            ))}
            {(stats?.topProducts ?? []).length === 0 && (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">
                No sales in this period
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Inline notifications panel ───────────────────────
            Replaces `<RecentActivity>` while its prop contract is
            confirmed. Rendering notifications inline is the exact
            fallback behavior we want if the component can't be
            wired up: the user still sees the data. */}
        <div className="card-brand">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h3>
            {notifications.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {notifications.length} unread
              </span>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p>No recent activity</p>
              <p className="text-sm">You&apos;re all caught up</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.slice(0, 5).map((n) => {
                const tone = toneFor(n.type);
                return (
                  <li
                    key={n.id}
                    className={`flex items-start gap-3 p-3 rounded-lg ${tone.bg}`}
                  >
                    <Bell
                      className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tone.text}`}
                    />
                    <div className="flex-1 min-w-0">
                      {n.title && (
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {n.title}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {n.message}
                      </p>
                      {n.createdAt && (
                        <p className="text-2xs text-gray-400 dark:text-gray-500 mt-1 tabular-nums">
                          {formatDateTime(n.createdAt)}
                        </p>
                      )}
                    </div>
                    {!n.isRead && (
                      <span
                        className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1"
                        aria-label="Unread"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card-brand">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Low Stock Alert
            </h3>
          </div>
          <div className="space-y-3">
            {(realtime?.lowStockInventory ?? [])
              .slice(0, 5)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-100 dark:border-danger-800/30"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {item.product?.name ?? 'Unknown product'}
                    </p>
                    <p className="text-2xs text-gray-500 dark:text-gray-400 font-mono truncate">
                      SKU: {item.product?.sku ?? '—'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-danger-600 dark:text-danger-400 font-semibold tabular-nums">
                      {item.quantity} in stock
                    </p>
                    <p className="text-2xs text-gray-500 dark:text-gray-400 tabular-nums">
                      Reorder at: {item.reorderPoint}
                    </p>
                  </div>
                </div>
              ))}
            {(realtime?.lowStockInventory ?? []).length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p>No low stock items</p>
                <p className="text-sm">All inventory levels are healthy</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
