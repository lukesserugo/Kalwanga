// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\cart\analytics\page.tsx

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
  TrendingUp,
  ShoppingCart,
  Download,
  RefreshCw,
  X,
  Loader2,
  AlertCircle,
  BarChart,
  Activity,
  DollarSign,
  Percent,
  ArrowUp,
  ArrowDown,
  Minus,
  BarChart3,
  LineChart,
  PieChart as PieChartIcon,
  Layers,
  Package,
  User,
  Calendar,
  Lock,
  Sparkles,
  Award,
  Shield,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { toast } from '../../../../../utils/toast-manager';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { api } from '../../../../../services/api';
import { cartService } from '../../../../../services/cartService';
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from '../../../../../utils/formatters';

// ============================================
// INTERFACES
// ============================================
//
// The backend `GET /cart/analytics` returns exactly six fields:
//   totalCarts, activeCarts, abandonedCarts,
//   averageItems, averageValue, conversionRate
//
// The additional fields below are declared for forward compatibility
// and are guarded at every use site. When the backend adds them, the
// UI lights up automatically.

interface CartAnalytics {
  totalCarts: number;
  activeCarts: number;
  abandonedCarts: number;
  averageItems: number;
  averageValue: number;
  conversionRate: number;
  // Not currently returned by the backend:
  todayCarts?: number;
  todayRevenue?: number;
  weeklyTrend?: WeeklyTrend[];
  categoryBreakdown?: CategoryBreakdown[];
  statusBreakdown?: StatusBreakdown[];
  recentActivity?: RecentActivity[];
}

interface WeeklyTrend {
  day: string;
  carts: number;
  revenue: number;
  conversionRate: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

interface RecentActivity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  details: string;
}

interface ExportOptions {
  format: 'csv' | 'excel' | 'json' | 'pdf';
  metrics?: string[];
  dateRange: string;
  startDate?: string;
  endDate?: string;
  includeCharts: boolean;
  includeSummary: boolean;
  includeDetailedData: boolean;
}

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
  { value: 'custom', label: 'Custom Range' },
];

/**
 * Translate a named range into concrete start/end dates.
 *
 * The backend `GET /cart/analytics` accepts only `startDate` and
 * `endDate` — it has no `period` parameter. Sending `period=week` was
 * silently ignored, so every request returned the same all-time data.
 */
function resolveDateRange(
  range: string,
  customStart?: string,
  customEnd?: string,
): { startDate: Date | null; endDate: Date | null } {
  const now = new Date();

  if (range === 'custom') {
    if (!customStart || !customEnd) return { startDate: null, endDate: null };
    return {
      startDate: new Date(customStart),
      endDate: new Date(customEnd),
    };
  }

  const start = new Date(now);
  const end = new Date(now);

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'yesterday': {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    }
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
    default:
      start.setDate(start.getDate() - 7);
  }

  return { startDate: start, endDate: end };
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  SAVED:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CHECKED_OUT:
    'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
  ABANDONED:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  SAVED: 'Saved',
  CHECKED_OUT: 'Checked Out',
  ABANDONED: 'Abandoned',
};

// NOTE: the backend `POST /cart/analytics/export` currently produces
// CSV regardless of the `format` field. Non-CSV options are shown
// disabled so the UI does not promise a file type it cannot deliver.
const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV', color: 'text-emerald-500', supported: true },
  { value: 'excel', label: 'Excel', color: 'text-green-500', supported: false },
  { value: 'json', label: 'JSON', color: 'text-blue-500', supported: false },
  { value: 'pdf', label: 'PDF', color: 'text-red-500', supported: false },
] as const;

const AVAILABLE_METRICS = [
  { id: 'totalCarts', label: 'Total Carts', icon: ShoppingCart },
  { id: 'activeCarts', label: 'Active Carts', icon: Activity },
  { id: 'abandonedCarts', label: 'Abandoned Carts', icon: AlertTriangle },
  { id: 'averageItems', label: 'Average Items', icon: Package },
  { id: 'averageValue', label: 'Average Value', icon: DollarSign },
  { id: 'conversionRate', label: 'Conversion Rate', icon: Percent },
  { id: 'todayCarts', label: "Today's Carts", icon: Calendar },
  { id: 'todayRevenue', label: "Today's Revenue", icon: DollarSign },
];

// ============================================
// EMPTY STATE
// ============================================

const EMPTY_ANALYTICS: CartAnalytics = {
  totalCarts: 0,
  activeCarts: 0,
  abandonedCarts: 0,
  averageItems: 0,
  averageValue: 0,
  conversionRate: 0,
  todayCarts: 0,
  todayRevenue: 0,
};

function unwrapApiResponse<T>(response: unknown): T | null {
  if (response == null) return null;
  if (typeof response === 'object' && 'data' in (response as any)) {
    const inner = (response as any).data;
    if (inner !== undefined && inner !== null) return inner as T;
  }
  return response as T;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CartAnalyticsPage() {
  const router = useRouter();
  const {
    hasPermission,
    isLoading: permissionLoading,
  } = usePermission();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] =
    useState<CartAnalytics | null>(null);
  const [dateRange, setDateRange] = useState('week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [viewMode, setViewMode] = useState<
    'overview' | 'trends' | 'details'
  >('overview');

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFormat, setExportFormat] =
    useState<'csv' | 'excel' | 'json' | 'pdf'>('csv');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(
    AVAILABLE_METRICS.map((m) => m.id),
  );
  const [includeCharts, setIncludeCharts] = useState(false);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeDetailedData, setIncludeDetailedData] = useState(true);
  const [exportDateRange, setExportDateRange] = useState(dateRange);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================
  // PERMISSIONS
  // ============================================

  const canViewAnalytics =
    hasPermission(PermissionResource.ANALYTICS) ||
    hasPermission(PermissionResource.CART_MANAGE) ||
    hasPermission(PermissionResource.CART_VIEW);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchAnalytics = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
      if (!canViewAnalytics) return;

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      try {
        setError(null);

        const { startDate, endDate } = resolveDateRange(
          dateRange,
          customStartDate,
          customEndDate,
        );

        // Custom range with incomplete dates: show a hint rather than
        // fetching (the backend would return all-time data).
        if (!startDate || !endDate) {
          if (isMountedRef.current) {
            setAnalytics(EMPTY_ANALYTICS);
            setLoading(false);
            setRefreshing(false);
          }
          return;
        }

        const params = {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        };

        const response = await api.get('/cart/analytics', { params });
        if (!isMountedRef.current) return;

        const payload = unwrapApiResponse<Partial<CartAnalytics>>(response);

        // Backend aggregates use `_avg` and `_count`, which can be
        // `null` when the set is empty. Coerce every numeric field.
        setAnalytics({
          ...EMPTY_ANALYTICS,
          ...(payload ?? {}),
          totalCarts: Number(payload?.totalCarts ?? 0),
          activeCarts: Number(payload?.activeCarts ?? 0),
          abandonedCarts: Number(payload?.abandonedCarts ?? 0),
          averageItems: Number(payload?.averageItems ?? 0),
          averageValue: Number(payload?.averageValue ?? 0),
          conversionRate: Number(payload?.conversionRate ?? 0),
        });
      } catch (err: any) {
        if (!isMountedRef.current) return;
        console.error('Failed to fetch cart analytics:', err);
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load analytics';
        setError(message);
        toast.error(message);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canViewAnalytics, dateRange, customStartDate, customEndDate],
  );

  useEffect(() => {
    if (!canViewAnalytics) {
      setLoading(false);
      return;
    }
    void fetchAnalytics(loading ? 'initial' : 'silent');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewAnalytics, dateRange, customStartDate, customEndDate]);

  // ============================================
  // EXPORT
  // ============================================

  const downloadFile = useCallback(
    (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [],
  );

  const handleExport = useCallback(async () => {
    if (selectedMetrics.length === 0) {
      toast.error('Please select at least one metric to export');
      return;
    }

    setExportLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = resolveDateRange(
        exportDateRange,
        exportStartDate,
        exportEndDate,
      );

      if (!startDate || !endDate) {
        toast.error('Please select both start and end dates');
        setExportLoading(false);
        return;
      }

      const payload: ExportOptions = {
        // The backend currently produces CSV regardless of `format`.
        // We always request CSV to keep the wire payload honest.
        format: 'csv',
        metrics: selectedMetrics,
        dateRange: exportDateRange,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        includeCharts,
        includeSummary,
        includeDetailedData,
      };

      const blob = await cartService.exportAnalytics(payload);
      downloadFile(
        blob,
        `cart-analytics-${new Date().toISOString().split('T')[0]}.csv`,
      );

      toast.success('Export downloaded');
      setShowExportModal(false);
    } catch (err: any) {
      console.error('Export failed:', err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to export data';
      setError(message);
      toast.error(message);
    } finally {
      if (isMountedRef.current) setExportLoading(false);
    }
  }, [
    selectedMetrics,
    exportDateRange,
    exportStartDate,
    exportEndDate,
    includeCharts,
    includeSummary,
    includeDetailedData,
    downloadFile,
  ]);

  const handleOpenExportModal = useCallback(() => {
    setExportDateRange(dateRange);
    // Only carry over custom dates when the primary view is on `custom`.
    setExportStartDate(dateRange === 'custom' ? customStartDate : '');
    setExportEndDate(dateRange === 'custom' ? customEndDate : '');
    setSelectedMetrics(AVAILABLE_METRICS.map((m) => m.id));
    setExportFormat('csv');
    setShowExportModal(true);
  }, [dateRange, customStartDate, customEndDate]);

  const toggleMetric = useCallback((metricId: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(metricId)
        ? prev.filter((id) => id !== metricId)
        : [...prev, metricId],
    );
  }, []);

  const toggleAllMetrics = useCallback(() => {
    setSelectedMetrics((prev) =>
      prev.length === AVAILABLE_METRICS.length
        ? []
        : AVAILABLE_METRICS.map((m) => m.id),
    );
  }, []);

  // ============================================
  // HANDLERS
  // ============================================

  const handleRefresh = useCallback(async () => {
    await fetchAnalytics('refresh');
    toast.success('Analytics refreshed');
  }, [fetchAnalytics]);

  const handleDateRangeChange = useCallback((value: string) => {
    setDateRange(value);
    if (value === 'custom') {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setCustomStartDate(start.toISOString().split('T')[0]);
      setCustomEndDate(end.toISOString().split('T')[0]);
    }
  }, []);

  // ============================================
  // DERIVED
  // ============================================

  /**
   * Fallback conversion rate when the backend returns 0 but the other
   * counters are non-zero. Matches the backend formula exactly:
   *   (total - active - abandoned) / total * 100
   */
  const completionRate = useMemo(() => {
    if (!analytics || analytics.totalCarts <= 0) return 0;
    const checkedOut =
      analytics.totalCarts - analytics.activeCarts - analytics.abandonedCarts;
    return (checkedOut / analytics.totalCarts) * 100;
  }, [analytics]);

  const trendData = useMemo(() => {
    if (!analytics?.weeklyTrend) return [];
    return analytics.weeklyTrend.map((day, index, arr) => ({
      ...day,
      delta: index === 0 ? 0 : day.carts - arr[index - 1].carts,
    }));
  }, [analytics?.weeklyTrend]);

  // ============================================
  // HELPERS
  // ============================================

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUp className="w-4 h-4 text-emerald-500" />;
    if (value < 0) return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const customRangeIncomplete =
    dateRange === 'custom' && (!customStartDate || !customEndDate);

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Checking permissions…
          </p>
        </div>
      </div>
    );
  }

  if (!canViewAnalytics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view cart analytics.
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading analytics…
          </p>
        </div>
      </div>
    );
  }

  if (customRangeIncomplete) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Pick a Date Range
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Select both a start and end date to view analytics.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <BarChart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Data Available
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              No analytics data found for the selected period.
            </p>
          </div>
        </div>
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
                <BarChart className="w-7 h-7 text-orange-500" />
                Cart Analytics
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Monitor cart performance, conversion rates, and
                customer behavior
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none"
            >
              {DATE_RANGES.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none"
                />
                <span className="text-gray-500 text-sm">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none"
                />
              </div>
            )}

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
              onClick={handleOpenExportModal}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Backend-scope notice */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 mb-6">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            The backend provides six core metrics (carts, average value,
            conversion rate). Trend charts, category breakdowns, status
            breakdowns, and recent-activity feeds are placeholders until a
            richer analytics endpoint is available.
          </p>
        </div>

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

        {/* View tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {(
            [
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'trends', label: 'Trends', icon: LineChart },
              { id: 'details', label: 'Details', icon: PieChartIcon },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                viewMode === id
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              aria-pressed={viewMode === id}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ---------- OVERVIEW ---------- */}
        {viewMode === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Carts"
                value={formatNumber(analytics.totalCarts)}
                icon={ShoppingCart}
                iconColor="text-orange-500"
                hint={
                  dateRange !== 'custom'
                    ? `This ${dateRange}`
                    : 'Custom period'
                }
              />
              <MetricCard
                label="Active Carts"
                value={formatNumber(analytics.activeCarts)}
                icon={Activity}
                iconColor="text-emerald-500"
                accent="text-emerald-600 dark:text-emerald-400"
                hint={
                  analytics.totalCarts > 0
                    ? `${(
                        (analytics.activeCarts /
                          analytics.totalCarts) *
                        100
                      ).toFixed(1)}% of total`
                    : 'No data'
                }
              />
              <MetricCard
                label="Abandoned Carts"
                value={formatNumber(analytics.abandonedCarts)}
                icon={AlertTriangle}
                iconColor="text-red-500"
                accent="text-red-600 dark:text-red-400"
                hint={
                  analytics.totalCarts > 0
                    ? `${(
                        (analytics.abandonedCarts /
                          analytics.totalCarts) *
                        100
                      ).toFixed(1)}% abandon rate`
                    : 'No data'
                }
              />
              <MetricCard
                label="Conversion Rate"
                value={`${(
                  analytics.conversionRate || completionRate
                ).toFixed(1)}%`}
                icon={Percent}
                iconColor="text-purple-500"
                accent="text-purple-600 dark:text-purple-400"
                hint={
                  analytics.totalCarts > 0
                    ? `${Math.max(
                        0,
                        analytics.totalCarts -
                          analytics.activeCarts -
                          analytics.abandonedCarts,
                      )} completed`
                    : 'No data'
                }
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Average Items"
                value={Number(analytics.averageItems ?? 0).toFixed(1)}
                icon={Package}
                iconColor="text-amber-500"
                hint="Items per cart"
              />
              <MetricCard
                label="Average Value"
                value={formatCurrency(
                  Number(analytics.averageValue ?? 0),
                )}
                icon={DollarSign}
                iconColor="text-emerald-500"
                accent="text-emerald-600 dark:text-emerald-400"
                hint="Per cart"
              />
              <MetricCard
                label="Today's Carts"
                value={formatNumber(analytics.todayCarts ?? 0)}
                icon={Calendar}
                iconColor="text-indigo-500"
                accent="text-indigo-600 dark:text-indigo-400"
                hint="New carts today"
              />
              <MetricCard
                label="Today's Revenue"
                value={formatCurrency(analytics.todayRevenue ?? 0)}
                icon={TrendingUp}
                iconColor="text-amber-500"
                accent="text-amber-600 dark:text-amber-400"
                hint="Revenue from today"
              />
            </div>

            {analytics.statusBreakdown &&
              analytics.statusBreakdown.length > 0 && (
                <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-orange-500" />
                    Cart Status Breakdown
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {analytics.statusBreakdown.map((status) => (
                      <div
                        key={status.status}
                        className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            STATUS_COLORS[status.status] ||
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {STATUS_LABELS[status.status] ||
                            status.status}
                        </span>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2 tabular-nums">
                          {formatNumber(status.count)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                          {status.percentage.toFixed(1)}%
                        </p>
                        <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all duration-500"
                            style={{
                              width: `${status.percentage}%`,
                              backgroundColor:
                                status.color || '#f97316',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
          </div>
        )}

        {/* ---------- TRENDS ---------- */}
        {viewMode === 'trends' && (
          <div className="space-y-6">
            {trendData.length > 0 ? (
              <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <LineChart className="w-5 h-5 text-orange-500" />
                  Weekly Trends
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <Th>Day</Th>
                        <Th align="right">Carts</Th>
                        <Th align="right">Revenue</Th>
                        <Th align="right">Conversion</Th>
                        <Th align="right">Change</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendData.map((day, index) => (
                        <tr
                          key={index}
                          className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">
                            {day.day}
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-300 tabular-nums">
                            {formatNumber(day.carts)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(day.revenue)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-purple-600 dark:text-purple-400 tabular-nums">
                            {day.conversionRate.toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span
                                className={`text-sm font-medium tabular-nums ${getTrendColor(day.delta)}`}
                              >
                                {day.delta > 0 ? '+' : ''}
                                {day.delta}
                              </span>
                              {getTrendIcon(day.delta)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <EmptyPanel
                icon={LineChart}
                title="Trend data not available"
                description="The backend does not currently return weekly trend data. Once an analytics endpoint exposes it, this panel will populate automatically."
              />
            )}

            {analytics.categoryBreakdown &&
              analytics.categoryBreakdown.length > 0 && (
                <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-purple-500" />
                    Category Breakdown
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analytics.categoryBreakdown.map((category) => (
                      <div
                        key={category.category}
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {category.category}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                            {category.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                          {formatNumber(category.count)}
                        </p>
                        <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all duration-500 bg-gradient-to-r from-orange-500 to-red-500"
                            style={{
                              width: `${category.percentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
          </div>
        )}

        {/* ---------- DETAILS ---------- */}
        {viewMode === 'details' && (
          <div className="space-y-6">
            {analytics.recentActivity &&
            analytics.recentActivity.length > 0 ? (
              <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-500" />
                  Recent Activity
                </h3>
                <div className="space-y-3">
                  {analytics.recentActivity.map((activity, index) => (
                    <div
                      key={activity.id ?? index}
                      className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {activity.userName || 'Unknown User'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {activity.action}
                        </p>
                        {activity.details && (
                          <p className="text-xs text-gray-400 truncate">
                            {activity.details}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                        {formatDate(activity.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <EmptyPanel
                icon={Activity}
                title="Recent activity not available"
                description="The backend does not currently expose a recent cart activity feed."
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <InsightCard
                icon={Award}
                iconColor="text-yellow-500"
                title="Top Insight"
                body={
                  analytics.conversionRate > 50
                    ? '📈 Great conversion rate! Your checkout process is working well.'
                    : analytics.abandonedCarts > analytics.activeCarts
                    ? '⚠️ High cart abandonment. Consider optimizing the checkout flow.'
                    : '📊 Your cart performance is stable.'
                }
              />

              <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    Health Score
                  </h4>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {analytics.conversionRate > 50
                      ? 'A'
                      : analytics.conversionRate > 30
                      ? 'B'
                      : 'C'}
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          analytics.conversionRate > 50
                            ? 'bg-emerald-500'
                            : analytics.conversionRate > 30
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            analytics.conversionRate,
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 tabular-nums">
                      {analytics.conversionRate.toFixed(1)}%
                      conversion rate
                    </p>
                  </div>
                </div>
              </section>

              <InsightCard
                icon={Sparkles}
                iconColor="text-purple-500"
                title="Recommendation"
                body={
                  analytics.abandonedCarts >
                  analytics.activeCarts * 0.5
                    ? '🔧 Consider adding a cart recovery email sequence.'
                    : analytics.averageItems < 3
                    ? '📦 Encourage add-ons with "Frequently Bought Together".'
                    : '✅ Your cart metrics look good. Keep it up!'
                }
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
          <p>
            Data updated: {new Date().toLocaleString()}
            {dateRange !== 'custom' &&
              ` • Period: ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`}
            {dateRange === 'custom' &&
              customStartDate &&
              customEndDate &&
              ` • ${new Date(customStartDate).toLocaleDateString()} – ${new Date(customEndDate).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {/* ============================================
          EXPORT MODAL
          ============================================ */}
      <AnimatePresence>
        {showExportModal && (
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
              onClick={() => setShowExportModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <Download className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Export Analytics
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Export cart analytics data as CSV
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-6">
                  {/* Format */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Export Format
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {EXPORT_FORMATS.map((format) => {
                        const isSelected = exportFormat === format.value;
                        const isDisabled = !format.supported;
                        return (
                          <button
                            key={format.value}
                            type="button"
                            disabled={isDisabled}
                            onClick={() =>
                              !isDisabled &&
                              setExportFormat(
                                format.value as ExportOptions['format'],
                              )
                            }
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                              isDisabled
                                ? 'opacity-40 cursor-not-allowed border-gray-200 dark:border-gray-700'
                                : isSelected
                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                : 'border-gray-200 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-500'
                            }`}
                            aria-pressed={isSelected}
                            title={
                              isDisabled
                                ? 'Not yet supported by the backend'
                                : undefined
                            }
                          >
                            <span
                              className={`text-lg font-bold ${format.color}`}
                            >
                              {format.value.toUpperCase()}
                            </span>
                            <span
                              className={`text-sm font-medium ${
                                isSelected
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {format.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Only CSV is currently produced by the backend. Other
                      formats are disabled.
                    </p>
                  </div>

                  {/* Metrics */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Include Metrics
                      </label>
                      <button
                        type="button"
                        onClick={toggleAllMetrics}
                        className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-800 transition-colors"
                      >
                        {selectedMetrics.length ===
                        AVAILABLE_METRICS.length
                          ? 'Deselect All'
                          : 'Select All'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {AVAILABLE_METRICS.map((metric) => {
                        const Icon = metric.icon;
                        const isSelected = selectedMetrics.includes(
                          metric.id,
                        );
                        return (
                          <label
                            key={metric.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                : 'border-gray-200 dark:border-gray-600 hover:border-orange-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleMetric(metric.id)}
                              className="w-4 h-4 text-orange-600 border-gray-300 dark:border-gray-600 rounded focus:ring-orange-500"
                            />
                            <Icon className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {metric.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 tabular-nums">
                      {selectedMetrics.length} of{' '}
                      {AVAILABLE_METRICS.length} metrics selected
                    </p>
                  </div>

                  {/* Date range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Date Range
                    </label>
                    <select
                      value={exportDateRange}
                      onChange={(e) => {
                        setExportDateRange(e.target.value);
                        if (e.target.value === 'custom') {
                          const end = new Date();
                          const start = new Date();
                          start.setDate(start.getDate() - 30);
                          setExportStartDate(
                            start.toISOString().split('T')[0],
                          );
                          setExportEndDate(
                            end.toISOString().split('T')[0],
                          );
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none"
                    >
                      {DATE_RANGES.map((range) => (
                        <option key={range.value} value={range.value}>
                          {range.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {exportDateRange === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={(e) =>
                          setExportStartDate(e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none"
                      />
                      <span className="text-gray-500 text-sm">to</span>
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={(e) =>
                          setExportEndDate(e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Options */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Additional Options
                    </label>
                    <div className="space-y-2">
                      <CheckboxOption
                        label="Include Summary"
                        checked={includeSummary}
                        onChange={setIncludeSummary}
                      />
                      <CheckboxOption
                        label="Include Detailed Data"
                        checked={includeDetailedData}
                        onChange={setIncludeDetailedData}
                      />
                      <CheckboxOption
                        label="Include Charts"
                        hint="(not yet supported)"
                        checked={includeCharts}
                        onChange={setIncludeCharts}
                        disabled
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4 shrink-0" />
                      <span>
                        Exporting data for:{' '}
                        <strong className="text-gray-900 dark:text-white">
                          {exportDateRange === 'custom' &&
                          exportStartDate &&
                          exportEndDate
                            ? `${new Date(
                                exportStartDate,
                              ).toLocaleDateString()} – ${new Date(
                                exportEndDate,
                              ).toLocaleDateString()}`
                            : DATE_RANGES.find(
                                (r) => r.value === exportDateRange,
                              )?.label || exportDateRange}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
                <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {selectedMetrics.length} metrics selected
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowExportModal(false)}
                    disabled={exportLoading}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={
                      exportLoading || selectedMetrics.length === 0
                    }
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {exportLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Exporting…
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Export
                      </>
                    )}
                  </button>
                </div>
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
      className={`py-3 px-4 text-${align} text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider`}
    >
      {children}
    </th>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  iconColor,
  accent = 'text-gray-900 dark:text-white',
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <p
        className={`text-2xl font-bold mt-2 tabular-nums ${accent}`}
      >
        {value}
      </p>
      {hint && (
        <p className="text-xs text-gray-400 mt-1 truncate">{hint}</p>
      )}
    </div>
  );
}

function InsightCard({
  icon: Icon,
  iconColor,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  body: string;
}) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <h4 className="font-semibold text-gray-900 dark:text-white">
          {title}
        </h4>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        {body}
      </p>
    </section>
  );
}

function CheckboxOption({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-orange-600 border-gray-300 dark:border-gray-600 rounded focus:ring-orange-500"
      />
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {label}
        {hint && (
          <span className="text-xs text-gray-400 ml-1">{hint}</span>
        )}
      </span>
    </label>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
      <Icon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
      <p className="text-lg font-medium text-gray-900 dark:text-white">
        {title}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {description}
      </p>
    </div>
  );
}
