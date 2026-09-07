// D:\Projects\Kalwanga\packages\web\components\products\ProductSalesAnalytics.tsx

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag,
  Users, Calendar, Clock, BarChart3, PieChart,
  Download, RefreshCw, Filter, ChevronDown,
  ArrowUp, ArrowDown, Eye, Star, Package,
  Loader2, AlertCircle, ChevronRight, Sparkles,
  Zap, Award, Gift, ThumbsUp, MessageCircle,
  TrendingUp as TrendingUpIcon, CheckCircle,
  XCircle, HelpCircle, Info
} from 'lucide-react';
import { productService } from '../../services/productService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';

interface SalesAnalyticsProps {
  productId: string;
  productName: string;
  unitPrice: number;
  className?: string;
}

interface SalesData {
  totalRevenue: number;
  totalUnits: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueTrend: number;
  unitsTrend: number;
  dailySales: Array<{ date: string; revenue: number; units: number }>;
  topCustomers: Array<{ id: string; name: string; totalSpent: number; orders: number }>;
  monthlyStats: Array<{ month: string; revenue: number; units: number }>;
  conversionRate: number;
  returnRate: number;
  averageRating: number;
  reviewCount: number;
  revenueByCategory?: Array<{ category: string; revenue: number; percentage: number }>;
  salesByDayOfWeek?: Array<{ day: string; revenue: number; orders: number }>;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

function MetricCard({ title, value, change, icon, color, subtitle }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white truncate">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 ${color} rounded-lg flex-shrink-0 ml-3`}>
          {icon}
        </div>
      </div>
      {change !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-sm">
          <span className={`flex items-center ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </span>
          <span className="text-gray-500 dark:text-gray-400">vs last period</span>
        </div>
      )}
    </div>
  );
}

export function ProductSalesAnalytics({ productId, productName, unitPrice, className = '' }: SalesAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SalesData | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [viewType, setViewType] = useState<'revenue' | 'units'>('revenue');
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'orders' | 'units'>('revenue');
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [productId, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock data with more realistic values
      const baseRevenue = 10000 + Math.random() * 5000;
      const baseUnits = 200 + Math.random() * 200;
      const baseOrders = 50 + Math.random() * 80;
      
      const mockData: SalesData = {
        totalRevenue: baseRevenue,
        totalUnits: baseUnits,
        totalOrders: baseOrders,
        averageOrderValue: baseRevenue / baseOrders,
        revenueTrend: 8 + Math.random() * 20 - 10,
        unitsTrend: 5 + Math.random() * 15 - 10,
        dailySales: Array.from({ length: 30 }, (_, i) => {
          const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
          return {
            date: date.toISOString().split('T')[0],
            revenue: 150 + Math.random() * 600,
            units: 4 + Math.floor(Math.random() * 18),
          };
        }),
        topCustomers: [
          { id: '1', name: 'John Doe', totalSpent: 1250, orders: 8 },
          { id: '2', name: 'Jane Smith', totalSpent: 980, orders: 6 },
          { id: '3', name: 'Bob Johnson', totalSpent: 750, orders: 5 },
          { id: '4', name: 'Alice Brown', totalSpent: 620, orders: 4 },
          { id: '5', name: 'Charlie Wilson', totalSpent: 450, orders: 3 },
        ],
        monthlyStats: [
          { month: 'Jan', revenue: 2100, units: 58 },
          { month: 'Feb', revenue: 1800, units: 45 },
          { month: 'Mar', revenue: 2400, units: 62 },
          { month: 'Apr', revenue: 2900, units: 78 },
          { month: 'May', revenue: 3300, units: 99 },
        ],
        conversionRate: 2.8 + Math.random() * 2,
        returnRate: 1.2 + Math.random() * 2,
        averageRating: 4.2 + Math.random() * 0.8,
        reviewCount: 20 + Math.floor(Math.random() * 30),
        revenueByCategory: [
          { category: 'Direct Sales', revenue: baseRevenue * 0.6, percentage: 60 },
          { category: 'Online Store', revenue: baseRevenue * 0.25, percentage: 25 },
          { category: 'Marketplace', revenue: baseRevenue * 0.1, percentage: 10 },
          { category: 'Other', revenue: baseRevenue * 0.05, percentage: 5 },
        ],
        salesByDayOfWeek: [
          { day: 'Mon', revenue: 1200, orders: 12 },
          { day: 'Tue', revenue: 1100, orders: 10 },
          { day: 'Wed', revenue: 1400, orders: 14 },
          { day: 'Thu', revenue: 1300, orders: 13 },
          { day: 'Fri', revenue: 1700, orders: 16 },
          { day: 'Sat', revenue: 1900, orders: 18 },
          { day: 'Sun', revenue: 800, orders: 7 },
        ],
      };
      setData(mockData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      setError('Failed to load sales analytics');
      toast.error('Failed to load sales analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // Simulate export
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Analytics exported successfully');
    } catch (error) {
      toast.error('Failed to export analytics');
    } finally {
      setExporting(false);
    }
  };

  const handleRefresh = () => {
    loadAnalytics();
    toast.info('Refreshing analytics...');
  };

  const handleTimeRangeChange = (range: '7d' | '30d' | '90d' | '1y') => {
    setTimeRange(range);
    toast.info(`Showing ${range} data`);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
        <button
          onClick={loadAnalytics}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">No sales data available</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.dailySales.map(d => d.revenue));
  const maxUnits = Math.max(...data.dailySales.map(d => d.units));
  const maxMonthlyRevenue = Math.max(...data.monthlyStats.map(m => m.revenue));

  const getValue = (day: { revenue: number; units: number }) => {
    return viewType === 'revenue' ? day.revenue : day.units;
  };

  const getMax = () => {
    return viewType === 'revenue' ? maxRevenue : maxUnits;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUpIcon className="w-5 h-5 text-blue-500" />
            Sales Analytics
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Performance metrics for <span className="font-medium text-gray-700 dark:text-gray-300">{productName}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            ) : (
              <Download className="w-4 h-4 text-gray-500" />
            )}
          </button>
          <button
            onClick={handleRefresh}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => setShowDetailedView(!showDetailedView)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {showDetailedView ? <Eye className="w-4 h-4 text-gray-500" /> : <BarChart3 className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(data.totalRevenue)}
          change={data.revenueTrend}
          icon={<DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />}
          color="bg-green-100 dark:bg-green-900/20"
        />
        <MetricCard
          title="Total Units Sold"
          value={formatNumber(data.totalUnits)}
          change={data.unitsTrend}
          icon={<ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          color="bg-blue-100 dark:bg-blue-900/20"
          subtitle={`Across ${data.totalOrders} orders`}
        />
        <MetricCard
          title="Avg. Order Value"
          value={formatCurrency(data.averageOrderValue)}
          icon={<TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
          color="bg-purple-100 dark:bg-purple-900/20"
          subtitle={`Unit price: ${formatCurrency(unitPrice)}`}
        />
        <MetricCard
          title="Average Rating"
          value={`${data.averageRating.toFixed(1)} ★`}
          icon={<Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400 fill-current" />}
          color="bg-yellow-100 dark:bg-yellow-900/20"
          subtitle={`${data.reviewCount} reviews`}
        />
      </div>

      {/* Additional Stats - Compact */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Conversion Rate</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{data.conversionRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Return Rate</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{data.returnRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Unit Price</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(unitPrice)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Orders</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{data.totalOrders}</p>
        </div>
      </div>

      {/* Sales Trend Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-900 dark:text-white">Sales Trend</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewType('revenue')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  viewType === 'revenue'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                Revenue
              </button>
              <button
                onClick={() => setViewType('units')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  viewType === 'units'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                Units
              </button>
            </div>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as 'revenue' | 'orders' | 'units')}
              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <option value="revenue">Revenue</option>
              <option value="orders">Orders</option>
              <option value="units">Units</option>
            </select>
          </div>
        </div>
        <div className="h-48 flex items-end gap-1">
          {data.dailySales.slice(-14).map((day, index) => {
            const maxValue = getMax();
            const value = getValue(day);
            const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute bottom-8 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                  {viewType === 'revenue' ? formatCurrency(day.revenue) : `${day.units} units`}
                </div>
                <div 
                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all duration-500 hover:from-blue-600 hover:to-blue-500"
                  style={{ height: `${Math.max(5, height)}%` }}
                />
                <span className="text-[8px] text-gray-400 mt-1 rotate-45 origin-left whitespace-nowrap">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed View */}
      <AnimatePresence>
        {showDetailedView && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Monthly Stats */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  Monthly Revenue
                </h4>
                <div className="space-y-2">
                  {data.monthlyStats.map((month) => (
                    <div key={month.month} className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400 w-10">{month.month}</span>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-green-500 rounded-full h-2 transition-all"
                          style={{ width: `${(month.revenue / maxMonthlyRevenue) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {formatCurrency(month.revenue)}
                      </span>
                      <span className="text-xs text-gray-400">{month.units} units</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Customers */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  Top Customers
                </h4>
                <div className="space-y-3">
                  {data.topCustomers.map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{customer.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{customer.orders} orders</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(customer.totalSpent)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Weekday Performance */}
      {data.salesByDayOfWeek && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            Performance by Day
          </h4>
          <div className="grid grid-cols-7 gap-2">
            {data.salesByDayOfWeek.map((day) => (
              <div key={day.day} className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">{day.day}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(day.revenue)}</p>
                <p className="text-xs text-gray-400">{day.orders} orders</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue by Category */}
      {data.revenueByCategory && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-gray-500" />
            Revenue by Channel
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.revenueByCategory.map((item) => (
              <div key={item.category} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{item.category}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(item.revenue)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-blue-500 rounded-full h-1.5 transition-all"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
