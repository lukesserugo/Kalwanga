// packages/web/app/(dashboard)/admin/sales/analytics/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Calendar,
  RefreshCw,
  PieChart,
  LineChart,
  Activity,
  Target,
  Award,
  Users,
} from 'lucide-react';
import { saleService } from '../../../../../services/saleService';
import { formatCurrency } from '../../../../../utils/formatters';
import { toast } from '../../../../../utils/toast-manager';

// ============================================
// INTERFACES
// ============================================

type AnalyticsView = 'daily' | 'weekly' | 'monthly';

interface SalesAnalyticsResponse {
  revenueTrend: Array<{ date: string; revenue: number; sales: number }>;
  distribution: Array<{ name: string; value: number }>;
  peakHours: Array<{ hour: number; sales: number; revenue: number }>;
  customerInsights: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    repeatRate?: number;
  };
  bestCategory: string;
  bestCategorySales: number;
  averageOrderValue: number;
  averageItems: number;
  retentionRate: number;
  conversionRate: number;
  totalVisitors: number;
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  totalSales: number;
  totalRevenue: number;
}

const DEFAULT_ANALYTICS: SalesAnalyticsResponse = {
  revenueTrend: [],
  distribution: [],
  peakHours: [],
  customerInsights: {
    totalCustomers: 0,
    newCustomers: 0,
    returningCustomers: 0,
    repeatRate: 0,
  },
  bestCategory: 'N/A',
  bestCategorySales: 0,
  averageOrderValue: 0,
  averageItems: 0,
  retentionRate: 0,
  conversionRate: 0,
  totalVisitors: 0,
  topProducts: [],
  totalSales: 0,
  totalRevenue: 0,
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SalesAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<SalesAnalyticsResponse>(
    DEFAULT_ANALYTICS
  );
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [view, setView] = useState<AnalyticsView>('daily');

  const loadAnalytics = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        const data = await saleService.getSalesAnalytics({
          startDate: dateRange.start,
          endDate: dateRange.end,
          view,
        });

        setAnalytics({ ...DEFAULT_ANALYTICS, ...(data || {}) });
      } catch (error: any) {
        console.error('Failed to load analytics:', error);
        toast.error(error?.message || 'Failed to load analytics');
        setAnalytics(DEFAULT_ANALYTICS);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateRange.start, dateRange.end, view]
  );

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Sales Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Advanced sales insights and performance metrics
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow-sm p-1 border border-gray-200 dark:border-gray-700">
              {(['daily', 'weekly', 'monthly'] as AnalyticsView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-ring ${
                    view === v
                      ? 'bg-brand-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => loadAnalytics(true)}
              disabled={refreshing}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2 focus-ring disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="card-brand p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Date Range:
              </span>
            </div>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
            <span className="text-gray-500 dark:text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
            <button
              onClick={() => loadAnalytics()}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
            >
              Apply Filter
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Total Revenue"
            value={formatCurrency(analytics.totalRevenue)}
            icon={TrendingUp}
            color="success"
          />
          <SummaryCard
            title="Total Sales"
            value={analytics.totalSales}
            icon={Activity}
            color="brand"
          />
          <SummaryCard
            title="Average Order"
            value={formatCurrency(analytics.averageOrderValue)}
            icon={Target}
            color="secondary"
          />
          <SummaryCard
            title="Avg Items / Order"
            value={analytics.averageItems.toFixed(1)}
            icon={Users}
            color="warning"
          />
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalyticsCard title="Revenue Trend" icon={LineChart}>
            <RevenueTrend data={analytics.revenueTrend} />
          </AnalyticsCard>

          <AnalyticsCard title="Sales Distribution" icon={PieChart}>
            <SalesDistribution data={analytics.distribution} />
          </AnalyticsCard>

          <AnalyticsCard title="Peak Hours" icon={Activity}>
            <PeakHours data={analytics.peakHours} />
          </AnalyticsCard>

          <AnalyticsCard title="Customer Insights" icon={Target}>
            <CustomerInsights data={analytics.customerInsights} />
          </AnalyticsCard>
        </div>

        {/* Top Products */}
        {analytics.topProducts.length > 0 && (
          <div className="card-brand p-6 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-warning-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Top Products
              </h3>
            </div>
            <div className="overflow-x-auto sidebar-scroll">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {analytics.topProducts.slice(0, 10).map((p, index) => (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400 tabular-nums">
                        {p.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Best Selling Category"
            value={analytics.bestCategory || 'N/A'}
            subtitle={`${formatCurrency(analytics.bestCategorySales)}`}
            icon={Award}
            color="warning"
          />
          <MetricCard
            title="Average Order Value"
            value={formatCurrency(analytics.averageOrderValue)}
            subtitle={`${analytics.averageItems.toFixed(1)} items per order`}
            icon={TrendingUp}
            color="success"
          />
          <MetricCard
            title="Customer Retention"
            value={`${(analytics.retentionRate || 0).toFixed(1)}%`}
            subtitle={`${analytics.customerInsights.returningCustomers} returning customers`}
            icon={Users}
            color="brand"
          />
          <MetricCard
            title="Repeat Rate"
            value={`${(analytics.customerInsights.repeatRate ?? 0).toFixed(1)}%`}
            subtitle={`${analytics.customerInsights.totalCustomers} total customers`}
            icon={Target}
            color="secondary"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface AnalyticsCardProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function AnalyticsCard({ title, icon: Icon, children }: AnalyticsCardProps) {
  return (
    <div className="card-brand p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}

function SummaryCard({ title, value, icon: Icon, color }: SummaryCardProps) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
    secondary:
      'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400',
    success:
      'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
    warning:
      'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400',
  };

  return (
    <div className="card-brand p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <div className={`p-2 rounded-lg ${colors[color] || colors.brand}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
        {value}
      </p>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: MetricCardProps) {
  const colors: Record<string, string> = {
    warning:
      'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400',
    success:
      'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
    brand: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
    secondary:
      'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400',
  };

  return (
    <div className="card-brand p-6">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-lg ${colors[color] || colors.brand}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// ANALYTICS SECTIONS
// ============================================

function RevenueTrend({
  data,
}: {
  data: Array<{ date: string; revenue: number; sales: number }>;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <LineChart className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No trend data available</p>
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const recent = data.slice(-14);

  return (
    <div className="h-48 flex flex-col">
      <div className="flex-1 flex items-end gap-1">
        {recent.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-brand-500 dark:bg-brand-400 rounded-t transition-all duration-500 hover:bg-brand-600 dark:hover:bg-brand-300"
              style={{
                height: `${Math.max(4, (item.revenue / maxRevenue) * 100)}%`,
              }}
              title={`${item.date}: ${formatCurrency(item.revenue)} (${item.sales} sales)`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
        <span>{recent[0]?.date || ''}</span>
        <span>{recent[recent.length - 1]?.date || ''}</span>
      </div>
    </div>
  );
}

function SalesDistribution({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <PieChart className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No distribution data available</p>
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

  return (
    <div className="h-48 overflow-y-auto sidebar-scroll space-y-2 pr-1">
      {data.map((item) => {
        const pct = (item.value / total) * 100;
        return (
          <div key={item.name} className="flex items-center gap-3">
            <span className="text-sm text-gray-700 dark:text-gray-300 w-24 truncate">
              {item.name.replace(/_/g, ' ')}
            </span>
            <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm text-gray-900 dark:text-white w-20 text-right tabular-nums">
              {formatCurrency(item.value)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right tabular-nums">
              {pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PeakHours({
  data,
}: {
  data: Array<{ hour: number; sales: number; revenue: number }>;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No hourly data available</p>
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((h) => h.revenue), 1);

  return (
    <div className="h-48 flex flex-col">
      <div className="flex-1 flex items-end gap-0.5">
        {data.map((hour) => (
          <div
            key={hour.hour}
            className="flex-1 flex flex-col items-center justify-end h-full"
          >
            <div
              className="w-full bg-brand-accent-500 dark:bg-brand-accent-400 rounded-t transition-all duration-500 hover:bg-brand-accent-600"
              style={{
                height: `${Math.max(2, (hour.revenue / maxRevenue) * 100)}%`,
              }}
              title={`${hour.hour}:00 — ${hour.sales} sales, ${formatCurrency(
                hour.revenue
              )}`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
        <span>0:00</span>
        <span>12:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}

function CustomerInsights({
  data,
}: {
  data: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    repeatRate?: number;
  };
}) {
  const rows: Array<{ label: string; value: string | number }> = [
    { label: 'Total Customers', value: data.totalCustomers || 0 },
    { label: 'New Customers', value: data.newCustomers || 0 },
    { label: 'Returning Customers', value: data.returningCustomers || 0 },
    {
      label: 'Repeat Rate',
      value: `${(data.repeatRate ?? 0).toFixed(1)}%`,
    },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">{row.label}</span>
          <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-4"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96 mb-8"></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 h-20"
          ></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 h-64"
          ></div>
        ))}
      </div>
    </div>
  );
}
