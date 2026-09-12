// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryReports.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, PieChart, TrendingUp, TrendingDown,
  Download, RefreshCw, Calendar, Filter, X,
  Package, DollarSign, AlertTriangle, CheckCircle,
  Clock, User, Building, MapPin, Tag,
  FileText, Printer, Eye, ChevronDown, ChevronUp,
  AlertCircle, Info, Lock, Shield, // ✅ ADDED Lock
  Activity, Users, Truck, ShoppingCart,
  Award, Star, Globe, Archive, Hash, Weight,
  Percent, Image as ImageIcon, Link2, ExternalLink,
  Copy, MoreVertical, Grid, List, LayoutGrid,
  Search, Plus, Minus, Edit, Trash2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

type ReportType = 'summary' | 'turnover' | 'movements' | 'products' | 'lowstock';

interface ReportData {
  summary: {
    totalItems: number;
    totalValue: number;
    totalCost: number;
    potentialProfit: number;
    profitMargin: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalCategories: number;
    totalSuppliers: number;
    avgPrice: number;
    avgCost: number;
  };
  categoryData: Array<{ name: string; count: number; value: number; percentage: number }>;
  locationData: Array<{ name: string; count: number; value: number }>;
  lowStockItems: any[];
  outOfStockItems: any[];
  recentTransactions: any[];
  topProducts: Array<{ name: string; sku: string; quantity: number; value: number }>;
  movements: Array<{ date: string; in: number; out: number; net: number }>;
}

interface InventoryReportsProps {
  className?: string;
  compact?: boolean;
  onExport?: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const REPORT_TYPES: { value: ReportType; label: string; icon: React.ElementType }[] = [
  { value: 'summary', label: 'Summary', icon: BarChart3 },
  { value: 'turnover', label: 'Turnover', icon: TrendingUp },
  { value: 'movements', label: 'Movements', icon: Activity },
  { value: 'products', label: 'Products', icon: Package },
  { value: 'lowstock', label: 'Low Stock', icon: AlertTriangle },
];

const DATE_RANGES = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
];

// ============================================
// SUB-COMPONENTS
// ============================================

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtext?: string;
  trend?: { value: number; direction: 'up' | 'down' | 'stable' };
}> = ({ label, value, icon: Icon, color, subtext, trend }) => {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${colorClasses[color]?.bg || colorClasses.blue.bg} rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${colorClasses[color]?.text || colorClasses.blue.text} mt-1`}>
            {value}
          </p>
          {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${
              trend.direction === 'up' ? 'text-green-600 dark:text-green-400' :
              trend.direction === 'down' ? 'text-red-600 dark:text-red-400' :
              'text-gray-400'
            }`}>
              {trend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
              {trend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
              <span>{trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className={`p-2 rounded-lg bg-white dark:bg-gray-700/50`}>
          <Icon className={`w-5 h-5 ${colorClasses[color]?.text || colorClasses.blue.text}`} />
        </div>
      </div>
    </motion.div>
  );
};

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-24" />
          </div>
        ))}
      </div>
      <div className="animate-pulse">
        <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-64" />
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function InventoryReports({
  className = '',
  compact = false,
  onExport,
}: InventoryReportsProps) {
  const router = useRouter(); // ✅ Added router
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [dateRange, setDateRange] = useState<string>('30d');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId ||
    (user?.businessUnits?.[0] as any)?.id ||
    localStorage.getItem('businessUnitId') || '';

  const canViewReports = hasPermission(`${PermissionResource.INVENTORY}:view`) || user?.role === 'SUPER_ADMIN';
  const canExport = hasPermission(`${PermissionResource.INVENTORY}:export`) || user?.role === 'SUPER_ADMIN';

  // ============================================
  // DATA LOADING
  // ============================================

  const loadReportData = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }

    if (!canViewReports) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [summary, stats, lowStock, outOfStock, transactions, categorySummary] = await Promise.all([
        inventoryService.getInventorySummary(businessUnitId),
        inventoryService.getInventoryStats(businessUnitId),
        inventoryService.getLowStockItems(businessUnitId),
        inventoryService.getOutOfStockItems(businessUnitId),
        inventoryService.getInventoryTransactions({ businessUnitId, limit: 50 }),
        inventoryService.getCategorySummary(businessUnitId),
      ]);

      // Build category data
      const categoryData = (categorySummary || []).map((cat: any) => ({
        name: cat.name || cat.category || 'Uncategorized',
        count: cat.count || 0,
        value: cat.value || 0,
        percentage: (summary?.totalValue || 0) > 0 ? (cat.value / (summary?.totalValue || 1)) * 100 : 0,
      })).sort((a: any, b: any) => b.value - a.value);

      // Build location data
      const locationMap = new Map<string, { count: number; value: number }>();
      if (stats?.byCategory) {
        // Use available data
      }

      const locationData: Array<{ name: string; count: number; value: number }> = [];

      // Build top products
      const topProducts = (stats?.byCategory || []).map((cat: any) => ({
        name: cat.category || 'Unknown',
        sku: 'N/A',
        quantity: cat.count || 0,
        value: cat.value || 0,
      })).sort((a: any, b: any) => b.value - a.value).slice(0, 10);

      // Build movements data
      const movements = (transactions?.data || []).map((tx: any) => ({
        date: tx.createdAt || new Date().toISOString(),
        in: tx.quantity > 0 ? tx.quantity : 0,
        out: tx.quantity < 0 ? Math.abs(tx.quantity) : 0,
        net: tx.quantity || 0,
      }));

      // Calculate summary
      const totalValue = stats?.totalValue || summary?.totalValue || 0;
      const totalCost = stats?.totalCost || summary?.totalCost || 0;
      const totalItems = stats?.totalProducts || summary?.totalItems || 0;

      const reportSummary = {
        totalItems,
        totalValue,
        totalCost,
        potentialProfit: totalValue - totalCost,
        profitMargin: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
        lowStockCount: lowStock?.length || 0,
        outOfStockCount: outOfStock?.length || 0,
        totalCategories: categoryData.length || 0,
        totalSuppliers: 0,
        avgPrice: totalItems > 0 ? totalValue / totalItems : 0,
        avgCost: totalItems > 0 ? totalCost / totalItems : 0,
      };

      setReportData({
        summary: reportSummary,
        categoryData,
        locationData,
        lowStockItems: lowStock || [],
        outOfStockItems: outOfStock || [],
        recentTransactions: transactions?.data || [],
        topProducts,
        movements: movements.slice(0, 30),
      });

    } catch (error: any) {
      console.error('Failed to load report data:', error);
      setError(error?.message || 'Failed to load report data');
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId, canViewReports]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    toast.success('Reports refreshed');
  };

  const handleExport = async () => {
    if (!canExport) {
      toast.error('You do not have permission to export reports');
      return;
    }

    setExporting(true);
    try {
      await inventoryService.exportInventory(businessUnitId, 'csv');
      toast.success('Report exported successfully');
      if (onExport) onExport();
    } catch (error: any) {
      console.error('Failed to export:', error);
      toast.error(error?.message || 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Please Login</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">You need to be logged in to view reports.</p>
      </div>
    );
  }

  if (!canViewReports) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Access Denied</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">You don't have permission to view reports.</p>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  if (loading && !refreshing) {
    return <LoadingSkeleton />;
  }

  const hasActiveFilters = dateRange !== '30d';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Inventory Reports</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 border rounded-lg transition-colors ${
              showFilters || hasActiveFilters
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                : ''
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          {canExport && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {REPORT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setReportType(type.value)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                      reportType === type.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {type.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {DATE_RANGES.map(range => (
                  <option key={range.value} value={range.value}>{range.label}</option>
                ))}
              </select>
              {dateRange === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">to</span>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setDateRange('30d');
                  setCustomDateRange({
                    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    end: new Date().toISOString().split('T')[0],
                  });
                }}
                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Report Content */}
      {error && !loading && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && reportData && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Total Items"
              value={formatNumber(reportData.summary.totalItems)}
              icon={Package}
              color="blue"
              subtext={`${reportData.summary.totalCategories} categories`}
            />
            <StatCard
              label="Total Value"
              value={formatCurrency(reportData.summary.totalValue)}
              icon={DollarSign}
              color="green"
              subtext={`Avg: ${formatCurrency(reportData.summary.avgPrice)}/item`}
            />
            <StatCard
              label="Total Cost"
              value={formatCurrency(reportData.summary.totalCost)}
              icon={Activity}
              color="purple"
              subtext={`Avg: ${formatCurrency(reportData.summary.avgCost)}/item`}
            />
            <StatCard
              label="Profit Margin"
              value={formatPercent(reportData.summary.profitMargin / 100)}
              icon={TrendingUp}
              color={reportData.summary.profitMargin >= 0 ? 'green' : 'red'}
              subtext={`Profit: ${formatCurrency(reportData.summary.potentialProfit)}`}
            />
          </div>

          {/* Low Stock Alert */}
          {(reportData.summary.lowStockCount > 0 || reportData.summary.outOfStockCount > 0) && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  Low Stock Alert
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  {reportData.summary.lowStockCount} items are low on stock and {reportData.summary.outOfStockCount} items are out of stock.
                  {reportData.summary.outOfStockCount > 0 && ' Immediate attention required!'}
                </p>
              </div>
            </div>
          )}

          {/* Category Distribution */}
          {reportData.categoryData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-blue-500" />
                Category Distribution
              </h4>
              <div className="space-y-3">
                {reportData.categoryData.slice(0, 5).map((category, index) => (
                  <div key={category.name}>
                    <div className="flex justify-between text-sm mb-0.5">
                      <span className="text-gray-600 dark:text-gray-400 truncate flex-1 mr-2">{category.name}</span>
                      <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(category.value)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full ${
                            ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500'][index % 5]
                          } rounded-full`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(category.percentage || 0, 100)}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{category.percentage?.toFixed(1) || 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Products */}
          {reportData.topProducts.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-500" />
                  Top Products by Value
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Product</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">SKU</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.topProducts.slice(0, 10).map((product, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{product.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 font-mono hidden sm:table-cell">{product.sku}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{formatNumber(product.quantity)}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-green-600 dark:text-green-400">{formatCurrency(product.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// EXPORT
// ============================================

export default InventoryReports;
