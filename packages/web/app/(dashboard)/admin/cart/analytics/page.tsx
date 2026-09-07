// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\cart\analytics\page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, TrendingUp, ShoppingCart, Users, Clock,
  Calendar, Download, RefreshCw, Filter, X,
  Loader2, AlertCircle, CheckCircle, BarChart,
  PieChart, Activity, DollarSign, Percent,
  Eye, EyeOff, ChevronDown, ChevronUp,
  Sparkles, Zap, Crown, Shield, Award,
  TrendingDown, Minus, Plus, ArrowUp, ArrowDown,
  BarChart3, LineChart, AreaChart, PieChart as PieChartIcon,
  Layers, Package, ShoppingBag, Wallet,
  CreditCard, Gift, User, Mail, Phone,
  MapPin, Building2, Globe, Clock8,
  Timer, AlertTriangle, ThumbsUp, ThumbsDown,
  Star, Heart, Share2, Send, Printer,
  FileText, DownloadCloud, CalendarDays,
  ChevronLeft, ChevronRight, Menu,
  Grid, List, Settings, Bell, Search,
  Lock
} from 'lucide-react';
import { toast } from '../../../../../utils/toast-manager';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { api } from '../../../../../services/api';
import { cartService } from '../../../../../services/cartService';
import { formatCurrency, formatDate, formatNumber } from '../../../../../utils/formatters';

// ============================================
// INTERFACES
// ============================================

interface CartAnalytics {
  totalCarts: number;
  activeCarts: number;
  abandonedCarts: number;
  averageItems: number;
  averageValue: number;
  conversionRate: number;
  todayCarts: number;
  todayRevenue: number;
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
  metrics: string[];
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

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  SAVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CHECKED_OUT: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
  ABANDONED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  SAVED: 'Saved',
  CHECKED_OUT: 'Checked Out',
  ABANDONED: 'Abandoned',
};

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV', color: 'text-green-500' },
  { value: 'excel', label: 'Excel', color: 'text-emerald-500' },
  { value: 'json', label: 'JSON', color: 'text-blue-500' },
  { value: 'pdf', label: 'PDF', color: 'text-red-500' },
];

const AVAILABLE_METRICS = [
  { id: 'totalCarts', label: 'Total Carts', icon: ShoppingCart },
  { id: 'activeCarts', label: 'Active Carts', icon: Activity },
  { id: 'abandonedCarts', label: 'Abandoned Carts', icon: AlertTriangle },
  { id: 'averageItems', label: 'Average Items', icon: Package },
  { id: 'averageValue', label: 'Average Value', icon: DollarSign },
  { id: 'conversionRate', label: 'Conversion Rate', icon: Percent },
  { id: 'todayCarts', label: "Today's Carts", icon: Clock },
  { id: 'todayRevenue', label: "Today's Revenue", icon: DollarSign },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function CartAnalyticsPage() {
  const router = useRouter();
  const { canManage, isLoading: permissionLoading } = usePermission();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<CartAnalytics | null>(null);
  const [dateRange, setDateRange] = useState('week');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'trends' | 'details'>('overview');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  
  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'json' | 'pdf'>('csv');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(AVAILABLE_METRICS.map(m => m.id));
  const [includeCharts, setIncludeCharts] = useState(false);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeDetailedData, setIncludeDetailedData] = useState(true);
  const [exportDateRange, setExportDateRange] = useState(dateRange);
  const [exportStartDate, setExportStartDate] = useState(customStartDate);
  const [exportEndDate, setExportEndDate] = useState(customEndDate);

  const canViewAnalytics = canManage(PermissionResource.ANALYTICS) || 
                           canManage(PermissionResource.CART_MANAGE) ||
                           canManage(PermissionResource.CART_VIEW);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchAnalytics = useCallback(async (showLoading = true) => {
    if (!canViewAnalytics) return;

    try {
      if (showLoading) setLoading(true);
      if (!showLoading) setRefreshing(true);
      setError(null);

      const params: any = {};

      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.startDate = new Date(customStartDate).toISOString();
        params.endDate = new Date(customEndDate).toISOString();
      } else if (dateRange !== 'custom') {
        params.period = dateRange;
      }

      console.log('📤 Fetching cart analytics with params:', params);

      const response = await api.get('/cart/analytics', { params });
      console.log('📥 Cart analytics response:', response);

      if (response) {
        setAnalytics(response as CartAnalytics);
      }
    } catch (error: any) {
      console.error('Failed to fetch cart analytics:', error);
      setError(error?.message || 'Failed to load analytics');
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canViewAnalytics, dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (canViewAnalytics) {
      fetchAnalytics();
    } else {
      setLoading(false);
    }
  }, [canViewAnalytics, fetchAnalytics]);

  // ============================================
  // EXPORT HANDLERS
  // ============================================

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (selectedMetrics.length === 0) {
      toast.error('Please select at least one metric to export');
      return;
    }

    setExportLoading(true);
    setError(null);

    try {
      const payload: ExportOptions = {
        format: exportFormat,
        metrics: selectedMetrics,
        dateRange: exportDateRange,
        includeCharts,
        includeSummary,
        includeDetailedData,
      };

      if (exportDateRange === 'custom') {
        payload.startDate = exportStartDate;
        payload.endDate = exportEndDate;
      }

      console.log('📤 Exporting with payload:', payload);

      const blob = await cartService.exportAnalytics(payload);
      
      const extension = exportFormat === 'excel' ? 'xlsx' : exportFormat;
      downloadFile(blob, `cart-analytics-${new Date().toISOString().split('T')[0]}.${extension}`);
      
      toast.success('Export completed successfully!');
      setShowExportModal(false);
    } catch (error: any) {
      console.error('❌ Export failed:', error);
      setError(error?.message || 'Failed to export data');
      toast.error(error?.message || 'Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const handleOpenExportModal = () => {
    setExportDateRange(dateRange);
    setExportStartDate(customStartDate);
    setExportEndDate(customEndDate);
    setSelectedMetrics(AVAILABLE_METRICS.map(m => m.id));
    setShowExportModal(true);
  };

  const toggleMetric = (metricId: string) => {
    setSelectedMetrics(prev =>
      prev.includes(metricId)
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    );
  };

  const toggleAllMetrics = () => {
    setSelectedMetrics(prev =>
      prev.length === AVAILABLE_METRICS.length
        ? []
        : AVAILABLE_METRICS.map(m => m.id)
    );
  };

  // ============================================
  // HANDLERS
  // ============================================

  const handleRefresh = () => {
    fetchAnalytics(false);
    toast.success('Analytics refreshed');
  };

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    if (value === 'custom') {
      setShowCustomDatePicker(true);
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setCustomStartDate(start.toISOString().split('T')[0]);
      setCustomEndDate(end.toISOString().split('T')[0]);
    } else {
      setShowCustomDatePicker(false);
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (value < 0) return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-600 dark:text-green-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading analytics...</p>
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
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view cart analytics. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/admin')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  if (!analytics) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <BarChart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Data Available</h3>
            <p className="text-gray-500 dark:text-gray-400">No analytics data found for the selected period.</p>
          </div>
        </div>
      </div>
    );
  }

  const completionRate = analytics.totalCarts > 0 
    ? ((analytics.totalCarts - analytics.abandonedCarts) / analytics.totalCarts) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                Cart Analytics
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Monitor cart performance, conversion rates, and customer behavior
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <select
                value={dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {DATE_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>

            {showCustomDatePicker && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleOpenExportModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 dark:text-red-400 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* View Mode Tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'trends', label: 'Trends', icon: LineChart },
            { id: 'details', label: 'Details', icon: PieChartIcon },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                viewMode === id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Overview View */}
        {viewMode === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Carts</p>
                  <ShoppingCart className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {formatNumber(analytics.totalCarts)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {dateRange !== 'custom' ? `This ${dateRange}` : 'Custom period'}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Active Carts</p>
                  <Activity className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                  {formatNumber(analytics.activeCarts)}
                </p>
                <p className="text-xs text-green-500 mt-1">
                  {analytics.totalCarts > 0 
                    ? `${((analytics.activeCarts / analytics.totalCarts) * 100).toFixed(1)}% of total`
                    : 'No data'}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Abandoned Carts</p>
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
                  {formatNumber(analytics.abandonedCarts)}
                </p>
                <p className="text-xs text-red-500 mt-1">
                  {analytics.totalCarts > 0 
                    ? `${((analytics.abandonedCarts / analytics.totalCarts) * 100).toFixed(1)}% abandoned rate`
                    : 'No data'}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Conversion Rate</p>
                  <Percent className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                  {formatPercentage(analytics.conversionRate || completionRate)}
                </p>
                <p className="text-xs text-purple-500 mt-1">
                  {analytics.totalCarts > 0 ? `${analytics.activeCarts} completed` : 'No data'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Average Items</p>
                  <Package className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {analytics.averageItems.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Items per cart</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Average Value</p>
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                  {formatCurrency(analytics.averageValue)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Per cart</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Today's Carts</p>
                  <Clock className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                  {formatNumber(analytics.todayCarts || 0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">New carts today</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Today's Revenue</p>
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                  {formatCurrency(analytics.todayRevenue || 0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Revenue from today</p>
              </div>
            </div>

            {analytics.statusBreakdown && analytics.statusBreakdown.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-blue-500" />
                  Cart Status Breakdown
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {analytics.statusBreakdown.map((status) => (
                    <div key={status.status} className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status.status] || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_LABELS[status.status] || status.status}
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {formatNumber(status.count)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {status.percentage.toFixed(1)}%
                      </p>
                      <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${status.percentage}%`,
                            backgroundColor: status.color || '#3b82f6'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trends View */}
        {viewMode === 'trends' && analytics.weeklyTrend && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <LineChart className="w-5 h-5 text-blue-500" />
                Weekly Trends
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Day</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Carts</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Revenue</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Conversion Rate</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.weeklyTrend.map((day, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">{day.day}</td>
                        <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-300">{formatNumber(day.carts)}</td>
                        <td className="py-3 px-4 text-right text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(day.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-purple-600 dark:text-purple-400">
                          {day.conversionRate.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className={`text-sm font-medium ${getTrendColor(day.carts - (analytics.weeklyTrend?.[index - 1]?.carts || 0))}`}>
                              {day.carts - (analytics.weeklyTrend?.[index - 1]?.carts || 0) > 0 ? '+' : ''}
                              {day.carts - (analytics.weeklyTrend?.[index - 1]?.carts || 0)}
                            </span>
                            {getTrendIcon(day.carts - (analytics.weeklyTrend?.[index - 1]?.carts || 0))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {analytics.categoryBreakdown && analytics.categoryBreakdown.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-500" />
                  Category Breakdown
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analytics.categoryBreakdown.map((category) => (
                    <div key={category.category} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">{category.category}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{category.percentage.toFixed(1)}%</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {formatNumber(category.count)}
                      </p>
                      <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-purple-500"
                          style={{ width: `${category.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Details View */}
        {viewMode === 'details' && (
          <div className="space-y-6">
            {analytics.recentActivity && analytics.recentActivity.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-500" />
                  Recent Activity
                </h3>
                <div className="space-y-3">
                  {analytics.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {activity.userName || 'Unknown User'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{activity.action}</p>
                        <p className="text-xs text-gray-400">{activity.details}</p>
                      </div>
                      <div className="text-xs text-gray-400 flex-shrink-0">
                        {formatDate(activity.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <h4 className="font-semibold text-gray-900 dark:text-white">Top Insight</h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {analytics.conversionRate > 50 
                    ? '📈 Great conversion rate! Your checkout process is working well.'
                    : analytics.abandonedCarts > analytics.activeCarts
                    ? '⚠️ High cart abandonment rate. Consider optimizing your checkout flow.'
                    : '📊 Your cart performance is stable.'}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-green-500" />
                  <h4 className="font-semibold text-gray-900 dark:text-white">Health Score</h4>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {analytics.conversionRate > 50 ? 'A' : analytics.conversionRate > 30 ? 'B' : 'C'}
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          analytics.conversionRate > 50 ? 'bg-green-500' : 
                          analytics.conversionRate > 30 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(analytics.conversionRate, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {analytics.conversionRate.toFixed(1)}% conversion rate
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  <h4 className="font-semibold text-gray-900 dark:text-white">Recommendation</h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {analytics.abandonedCarts > analytics.activeCarts * 0.5
                    ? '🔧 Consider adding a cart recovery email sequence to recapture abandoned carts.'
                    : analytics.averageItems < 3
                    ? '📦 Encourage add-on purchases with "Frequently Bought Together" recommendations.'
                    : '✅ Your cart metrics are looking good. Keep up the great work!'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
          <p>
            Data updated: {new Date().toLocaleString()}
            {dateRange !== 'custom' && ` • Period: ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`}
            {dateRange === 'custom' && customStartDate && customEndDate && 
              ` • ${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`
            }
          </p>
        </div>
      </div>

      {/* ✅ Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowExportModal(false)} />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Export Analytics
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Export cart analytics data in various formats
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                <div className="space-y-6">
                  {/* Format Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Export Format
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {EXPORT_FORMATS.map((format) => (
                        <button
                          key={format.value}
                          onClick={() => setExportFormat(format.value as any)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                            exportFormat === format.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          <span className={`text-lg font-bold ${format.color}`}>
                            {format.value.toUpperCase()}
                          </span>
                          <span className={`text-sm font-medium ${
                            exportFormat === format.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {format.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Metrics Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Select Metrics
                      </label>
                      <button
                        onClick={toggleAllMetrics}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors"
                      >
                        {selectedMetrics.length === AVAILABLE_METRICS.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_METRICS.map((metric) => {
                        const Icon = metric.icon;
                        const isSelected = selectedMetrics.includes(metric.id);
                        return (
                          <label
                            key={metric.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleMetric(metric.id)}
                              className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                            />
                            <Icon className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {metric.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {selectedMetrics.length} of {AVAILABLE_METRICS.length} metrics selected
                    </p>
                  </div>

                  {/* Date Range */}
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
                          setExportStartDate(start.toISOString().split('T')[0]);
                          setExportEndDate(end.toISOString().split('T')[0]);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {DATE_RANGES.map((range) => (
                        <option key={range.value} value={range.value}>
                          {range.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Date Picker */}
                  {exportDateRange === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Additional Options */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Additional Options
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeSummary}
                          onChange={(e) => setIncludeSummary(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Include Summary</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeDetailedData}
                          onChange={(e) => setIncludeDetailedData(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Include Detailed Data</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeCharts}
                          onChange={(e) => setIncludeCharts(e.target.checked)}
                          disabled={exportFormat !== 'pdf'}
                          className={`w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 ${
                            exportFormat !== 'pdf' ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Include Charts <span className="text-xs text-gray-400">(PDF only)</span>
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Exporting data for: <strong className="text-gray-900 dark:text-white">
                          {exportDateRange === 'custom' && exportStartDate && exportEndDate
                            ? `${new Date(exportStartDate).toLocaleDateString()} - ${new Date(exportEndDate).toLocaleDateString()}`
                            : DATE_RANGES.find(r => r.value === exportDateRange)?.label || exportDateRange
                        }</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedMetrics.length} metrics selected
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowExportModal(false)}
                    disabled={exportLoading}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exportLoading || selectedMetrics.length === 0}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exportLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Exporting...
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
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
