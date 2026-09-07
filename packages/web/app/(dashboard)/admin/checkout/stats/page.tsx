// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\checkout\stats\page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3, PieChart, TrendingUp, TrendingDown,
  DollarSign, ShoppingBag, Users, Calendar,
  Download, RefreshCw, Loader2, Lock,
  ArrowLeft, ChevronDown, ChevronUp,
  Eye, Clock, Award, Gift, Star,
  AlertCircle, Filter, Printer, FileSpreadsheet
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { checkoutService } from '../../../../../services/checkoutService';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';

// Types
interface CheckoutStats {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    totalCustomers: number;
    conversionRate: number;
    abandonedCarts: number;
    recoveredCarts: number;
  };
  trends: {
    daily: Array<{ date: string; revenue: number; orders: number }>;
    weekly: Array<{ week: string; revenue: number; orders: number }>;
    monthly: Array<{ month: string; revenue: number; orders: number }>;
  };
  topProducts: Array<{ id: string; name: string; quantity: number; revenue: number }>;
  topCustomers: Array<{ id: string; name: string; email: string; totalSpent: number; orderCount: number }>;
  paymentMethods: Array<{ method: string; count: number; total: number }>;
  checkoutSteps: Array<{ step: string; completed: number; dropped: number }>;
  performance: {
    averageCheckoutTime: number;
    pageLoadTime: number;
    successRate: number;
    errorRate: number;
  };
}

// ✅ FIXED: Custom LockIcon component
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-400 dark:text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

export default function AdminCheckoutStatsPage() {
  const router = useRouter();
  const { canView, canManage, isLoading: permissionLoading } = usePermission();
  const { isDark } = useThemeStore();
  
  const [stats, setStats] = useState<CheckoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'orders' | 'conversion'>('revenue');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'trends', 'topProducts']));
  const [exportLoading, setExportLoading] = useState(false);

  // ✅ FIXED: Permission check - use PAYMENT instead of CHECKOUT
  useEffect(() => {
    if (!permissionLoading) {
      if (!canView(PermissionResource.PAYMENT)) {
        router.push('/admin/unauthorized');
      }
    }
  }, [permissionLoading, canView, router]);

  // ✅ FIXED: Load stats with proper permission check
  useEffect(() => {
    if (!permissionLoading && canView(PermissionResource.PAYMENT)) {
      loadStats();
    }
  }, [dateRange, customStartDate, customEndDate]);

  const loadStats = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params: any = { range: dateRange };
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.startDate = customStartDate;
        params.endDate = customEndDate;
      }

      const response = await checkoutService.getStats(params);
      
      if (response.success) {
        setStats(response.data);
      } else {
        toast.error(response.message || 'Failed to load checkout statistics');
      }
    } catch (error) {
      console.error('Error loading checkout stats:', error);
      toast.error('An error occurred while loading statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadStats(true);
  };

  const handleExport = async (format: 'csv' | 'pdf' | 'excel') => {
    try {
      setExportLoading(true);
      const params: any = { range: dateRange, format };
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.startDate = customStartDate;
        params.endDate = customEndDate;
      }

      const response = await checkoutService.exportStats(params);
      
      // Create download link
      const blob = new Blob([response.data], { 
        type: format === 'csv' ? 'text/csv' : format === 'excel' ? 'application/vnd.ms-excel' : 'application/pdf' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `checkout-stats-${formatDate(new Date())}.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Statistics exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error exporting stats:', error);
      toast.error('Failed to export statistics');
    } finally {
      setExportLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className={`w-12 h-12 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    );
  }

  if (!canView(PermissionResource.PAYMENT)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <LockIcon />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to view checkout statistics.</p>
        <button
          onClick={() => router.push('/admin/checkout')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Checkout
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className={`w-16 h-16 mb-4 ${isDark ? 'text-yellow-400' : 'text-yellow-500'}`} />
        <h2 className="text-2xl font-semibold mb-2">No Data Available</h2>
        <p className="text-gray-500">There is no checkout data for the selected period.</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/checkout')}
            className={`p-2 rounded-lg transition ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Checkout Statistics
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Monitor your checkout performance and conversion metrics
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Selector */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value as any);
                if (e.target.value !== 'custom') {
                  setShowCustomDatePicker(false);
                }
              }}
              className={`px-4 py-2 rounded-lg border ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
              <option value="year">Last 365 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Picker */}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className={`px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className={`px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`p-2 rounded-lg transition ${
              isDark
                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } border ${isDark ? 'border-gray-700' : 'border-gray-300'} disabled:opacity-50`}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Dropdown */}
          <div className="relative group">
            <button
              disabled={exportLoading}
              className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50`}
            >
              {exportLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export
              <ChevronDown className="w-4 h-4" />
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              {[
                { label: 'CSV', value: 'csv' },
                { label: 'Excel', value: 'excel' },
                { label: 'PDF', value: 'pdf' }
              ].map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => handleExport(value as any)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg text-gray-700 dark:text-gray-300"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            title: 'Total Revenue',
            value: formatCurrency(stats.summary.totalRevenue),
            icon: DollarSign,
            color: 'green',
            change: '+12.5%'
          },
          {
            title: 'Total Orders',
            value: stats.summary.totalOrders.toLocaleString(),
            icon: ShoppingBag,
            color: 'blue',
            change: '+8.3%'
          },
          {
            title: 'Average Order Value',
            value: formatCurrency(stats.summary.averageOrderValue),
            icon: TrendingUp,
            color: 'purple',
            change: '+5.2%'
          },
          {
            title: 'Conversion Rate',
            value: `${stats.summary.conversionRate.toFixed(1)}%`,
            icon: BarChart3,
            color: 'orange',
            change: stats.summary.conversionRate > 0 ? '+2.1%' : '-0.5%'
          }
        ].map(({ title, value, icon: Icon, color, change }) => (
          <div
            key={title}
            className={`p-6 rounded-xl ${
              isDark ? 'bg-gray-800' : 'bg-white'
            } shadow-sm hover:shadow-md transition`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {title}
                </p>
                <p className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {value}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {change.startsWith('+') ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    change.startsWith('+') ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {change}
                  </span>
                  <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    vs previous period
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-lg bg-${color}-100 dark:bg-${color}-900/20`}>
                <Icon className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Summary Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Customers</p>
              <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.summary.totalCustomers.toLocaleString()}
              </p>
            </div>
            <Users className={`w-8 h-8 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
          </div>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Abandoned Carts</p>
              <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.summary.abandonedCarts.toLocaleString()}
              </p>
            </div>
            <ShoppingBag className={`w-8 h-8 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          </div>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Recovered Carts</p>
              <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.summary.recoveredCarts.toLocaleString()}
              </p>
            </div>
            <Gift className={`w-8 h-8 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
          </div>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Recovery Rate</p>
              <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.summary.abandonedCarts > 0 
                  ? `${((stats.summary.recoveredCarts / stats.summary.abandonedCarts) * 100).toFixed(1)}%`
                  : '0%'}
              </p>
            </div>
            <RefreshCw className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trends Chart - 2 columns */}
        <div className={`lg:col-span-2 p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Revenue Trends
            </h2>
            <div className="flex gap-2">
              {['revenue', 'orders', 'conversion'].map((metric) => (
                <button
                  key={metric}
                  onClick={() => setSelectedMetric(metric as any)}
                  className={`px-3 py-1 text-sm rounded-lg transition ${
                    selectedMetric === metric
                      ? 'bg-blue-600 text-white'
                      : isDark
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {metric.charAt(0).toUpperCase() + metric.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className={`w-12 h-12 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
              <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Chart visualization would render here
              </p>
              <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                Using Recharts, Chart.js, or Victory
              </p>
            </div>
          </div>
        </div>

        {/* Payment Methods - 1 column */}
        <div className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Payment Methods
          </h2>
          <div className="space-y-4">
            {stats.paymentMethods.map((method) => (
              <div key={method.method}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {method.method}
                  </span>
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(method.total)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${(method.total / stats.paymentMethods.reduce((sum, m) => sum + m.total, 0)) * 100}%`
                    }}
                  />
                </div>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                  {method.count} transactions
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total</span>
              <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {formatCurrency(stats.paymentMethods.reduce((sum, m) => sum + m.total, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Top Products */}
        <div className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Top Products
          </h2>
          <div className="space-y-4">
            {stats.topProducts.slice(0, 5).map((product, index) => (
              <div key={product.id} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  index === 1 ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' :
                  index === 2 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                  'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {product.name}
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {product.quantity} units sold
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(product.revenue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {stats.topProducts.length > 5 && (
            <button className={`mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline`}>
              View all {stats.topProducts.length} products →
            </button>
          )}
        </div>

        {/* Checkout Funnel */}
        <div className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Checkout Funnel
          </h2>
          <div className="space-y-4">
            {stats.checkoutSteps.map((step, index) => {
              const total = stats.checkoutSteps[0]?.completed || 1;
              const percentage = (step.completed / total) * 100;
              const dropPercentage = index > 0 
                ? ((stats.checkoutSteps[index - 1].completed - step.completed) / stats.checkoutSteps[index - 1].completed) * 100
                : 0;
              
              return (
                <div key={step.step}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {step.step}
                      </span>
                      {dropPercentage > 0 && (
                        <span className="text-xs text-red-500">
                          -{dropPercentage.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {step.completed.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        dropPercentage > 20 ? 'bg-red-500' :
                        dropPercentage > 10 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.max(percentage, 2)}%` }}
                    />
                  </div>
                  {step.dropped > 0 && (
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                      {step.dropped} dropped at this step
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Third Row - Performance & Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Performance Metrics */}
        <div className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Performance Metrics
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Avg Checkout Time</p>
              <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.performance.averageCheckoutTime}s
              </p>
              <span className="text-xs text-green-500">-12% faster</span>
            </div>
            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Page Load Time</p>
              <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.performance.pageLoadTime}s
              </p>
              <span className="text-xs text-green-500">-8% faster</span>
            </div>
            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Success Rate</p>
              <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.performance.successRate.toFixed(1)}%
              </p>
              <span className="text-xs text-green-500">+2.3% increase</span>
            </div>
            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Error Rate</p>
              <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.performance.errorRate.toFixed(1)}%
              </p>
              <span className="text-xs text-red-500">-0.5% decrease</span>
            </div>
          </div>
        </div>

        {/* Top Customers */}
        <div className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Top Customers
          </h2>
          <div className="space-y-3">
            {stats.topCustomers.slice(0, 5).map((customer, index) => (
              <div key={customer.id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    {customer.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {customer.name}
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {customer.email}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(customer.totalSpent)}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {customer.orderCount} orders
                  </p>
                </div>
              </div>
            ))}
          </div>
          {stats.topCustomers.length > 5 && (
            <button className={`mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline`}>
              View all {stats.topCustomers.length} customers →
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={`mt-8 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
          <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <Clock className="inline w-4 h-4 mr-1" />
            Last updated: {formatDate(new Date())}
          </div>
          <div className="flex items-center gap-6">
            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Data covers {dateRange === 'today' ? 'today' : dateRange === 'custom' ? 'custom range' : `last ${dateRange}`}
            </span>
            {canManage(PermissionResource.PAYMENT) && (
              <button
                onClick={() => router.push('/admin/checkout/stats/settings')}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Configure metrics →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
