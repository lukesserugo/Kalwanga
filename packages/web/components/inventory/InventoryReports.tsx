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
  AlertCircle, Info, Lock, Shield,
  Activity, Users, Truck, ShoppingCart,
  Award, Star, Globe, Archive, Hash, Weight,
  Percent, Image as ImageIcon, Link2, ExternalLink,
  Copy, MoreVertical, Grid, List, LayoutGrid,
  Search, Plus, Minus, Edit, Trash2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from '../../utils/formatters';

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
  categoryData: Array<{
    name: string;
    count: number;
    value: number;
    percentage: number;
  }>;
  locationData: Array<{ name: string; count: number; value: number }>;
  lowStockItems: any[];
  outOfStockItems: any[];
  recentTransactions: any[];
  topProducts: Array<{
    name: string;
    sku: string;
    quantity: number;
    value: number;
  }>;
  movements: Array<{ date: string; in: number; out: number; net: number }>;
}

interface InventoryReportsProps {
  className?: string;
  compact?: boolean;
  onExport?: () => void;
}

const REPORT_TYPES: {
  value: ReportType;
  label: string;
  icon: React.ElementType;
}[] = [
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

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtext?: string;
  trend?: { value: number; direction: 'up' | 'down' | 'stable' };
}> = ({ label, value, icon: Icon, color, subtext, trend }) => {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    blue: {
      bg: 'bg-brand-50 dark:bg-brand-900/20',
      text: 'text-brand-600 dark:text-brand-400',
    },
    green: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      text: 'text-success-600 dark:text-success-400',
    },
    yellow: {
      bg: 'bg-warning-50 dark:bg-warning-900/20',
      text: 'text-warning-600 dark:text-warning-400',
    },
    red: {
      bg: 'bg-danger-50 dark:bg-danger-900/20',
      text: 'text-danger-600 dark:text-danger-400',
    },
    purple: {
      bg: 'bg-secondary-50 dark:bg-secondary-900/20',
      text: 'text-secondary-600 dark:text-secondary-400',
    },
    indigo: {
      bg: 'bg-secondary-50 dark:bg-secondary-900/20',
      text: 'text-secondary-600 dark:text-secondary-400',
    },
    teal: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      text: 'text-success-600 dark:text-success-400',
    },
    orange: {
      bg: 'bg-brand-50 dark:bg-brand-900/20',
      text: 'text-brand-600 dark:text-brand-400',
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${
        colorClasses[color]?.bg || colorClasses.blue.bg
      } rounded-2xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-card-hover transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p
            className={`text-2xl font-bold ${
              colorClasses[color]?.text || colorClasses.blue.text
            } mt-1 tabular-nums`}
          >
            {value}
          </p>
          {subtext && (
            <p className="text-2xs text-gray-400 dark:text-gray-500 mt-1 tabular-nums">
              {subtext}
            </p>
          )}
          {trend && (
            <div
              className={`flex items-center gap-1 mt-1 text-2xs tabular-nums ${
                trend.direction === 'up'
                  ? 'text-success-600 dark:text-success-400'
                  : trend.direction === 'down'
                  ? 'text-danger-600 dark:text-danger-400'
                  : 'text-gray-400'
              }`}
            >
              {trend.direction === 'up' && (
                <TrendingUp className="w-3 h-3" />
              )}
              {trend.direction === 'down' && (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>
                {trend.value > 0 ? '+' : ''}
                {trend.value.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        <div
          className={`p-2 rounded-lg bg-white dark:bg-gray-700/50`}
        >
          <Icon
            className={`w-5 h-5 ${
              colorClasses[color]?.text || colorClasses.blue.text
            }`}
          />
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
            <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl h-24" />
          </div>
        ))}
      </div>
      <div className="animate-pulse">
        <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl h-64" />
      </div>
    </div>
  );
};

export function InventoryReports({
  className = '',
  compact = false,
  onExport,
}: InventoryReportsProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [dateRange, setDateRange] = useState<string>('30d');
  const [customDateRange, setCustomDateRange] = useState<{
    start: string;
    end: string;
  }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const businessUnitId =
    user?.businessUnits?.[0]?.businessUnitId ||
    (user?.businessUnits?.[0] as any)?.id ||
    localStorage.getItem('businessUnitId') ||
    '';

  const canViewReports =
    hasPermission(`${PermissionResource.INVENTORY}:view`) ||
    user?.role === 'SUPER_ADMIN';
  const canExport =
    hasPermission(`${PermissionResource.INVENTORY}:export`) ||
    user?.role === 'SUPER_ADMIN';

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

      const [
        summary,
        stats,
        lowStock,
        outOfStock,
        transactions,
        categorySummary,
      ] = await Promise.all([
        inventoryService.getInventorySummary(businessUnitId),
        inventoryService.getInventoryStats(businessUnitId),
        inventoryService.getLowStockItems(businessUnitId),
        inventoryService.getOutOfStockItems(businessUnitId),
        inventoryService.getInventoryTransactions({
          businessUnitId,
          limit: 50,
        }),
        inventoryService.getCategorySummary(businessUnitId),
      ]);

      const rawStats = stats as any;
      const rawSummary = summary as any;

      const categoryData = (categorySummary || [])
        .map((cat: any) => ({
          name: cat.name || cat.category || 'Uncategorized',
          count: cat.count || 0,
          value: cat.value || 0,
          percentage:
            (summary?.totalValue || 0) > 0
              ? (cat.value / (summary?.totalValue || 1)) * 100
              : 0,
        }))
        .sort((a: any, b: any) => b.value - a.value);

      const locationData: Array<{
        name: string;
        count: number;
        value: number;
      }> = (rawStats?.byLocation ?? rawSummary?.byLocation ?? []).map(
        (loc: any) => ({
          name: loc.name ?? loc.location ?? 'Unknown',
          count: loc.count ?? loc.quantity ?? 0,
          value: loc.value ?? 0,
        })
      );

      const topProducts = (
        rawStats?.byProduct ??
        rawSummary?.topProducts ??
        categorySummary ??
        []
      )
        .map((item: any) => ({
          name: item.name ?? item.productName ?? item.category ?? 'Unknown',
          sku: item.sku ?? item.productSku ?? '—',
          quantity: item.quantity ?? item.count ?? 0,
          value: item.value ?? item.totalValue ?? 0,
        }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 10);

      const movements = (transactions?.data || []).map((tx: any) => ({
        date: tx.createdAt || new Date().toISOString(),
        in: tx.quantity > 0 ? tx.quantity : 0,
        out: tx.quantity < 0 ? Math.abs(tx.quantity) : 0,
        net: tx.quantity || 0,
      }));

      const totalValue = stats?.totalValue || summary?.totalValue || 0;
      const totalCost = stats?.totalCost || summary?.totalCost || 0;
      const totalItems = stats?.totalProducts || summary?.totalItems || 0;

      const reportSummary = {
        totalItems,
        totalValue,
        totalCost,
        potentialProfit: totalValue - totalCost,
        profitMargin:
          totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
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

  useEffect(() => {
    if (isAuthenticated && businessUnitId) {
      loadReportData();
    }
  }, [isAuthenticated, businessUnitId, loadReportData]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Please Login
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          You need to be logged in to view reports.
        </p>
      </div>
    );
  }

  if (!canViewReports) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Access Denied
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          You don't have permission to view reports.
        </p>
      </div>
    );
  }

  if (loading && !refreshing) {
    return <LoadingSkeleton />;
  }

  const hasActiveFilters = dateRange !== '30d';

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-brand-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Inventory Reports
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 focus-ring"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 border rounded-lg transition-colors focus-ring ${
              showFilters || hasActiveFilters
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          {canExport && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50 focus-ring"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          )}
        </div>
      </div>

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
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 focus-ring ${
                      reportType === type.value
                        ? 'bg-brand-gradient text-white shadow-brand'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-600'
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
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
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
                    value={customDateRange.start}
                    onChange={(e) =>
                      setCustomDateRange({
                        ...customDateRange,
                        start: e.target.value,
                      })
                    }
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    to
                  </span>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) =>
                      setCustomDateRange({
                        ...customDateRange,
                        end: e.target.value,
                      })
                    }
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
                  />
                </div>
              )}
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setDateRange('30d');
                  setCustomDateRange({
                    start: new Date(
                      Date.now() - 30 * 24 * 60 * 60 * 1000
                    )
                      .toISOString()
                      .split('T')[0],
                    end: new Date().toISOString().split('T')[0],
                  });
                }}
                className="text-sm text-danger-600 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300 flex items-center gap-1 focus-ring rounded"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl flex items-start gap-3 animate-slide-down">
          <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-danger-700 dark:text-danger-300">
              {error}
            </p>
            <button
              onClick={handleRefresh}
              className="mt-2 text-sm text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 focus-ring rounded"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && reportData && (
        <div className="space-y-6">
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
              subtext={`Avg: ${formatCurrency(
                reportData.summary.avgPrice
              )}/item`}
            />
            <StatCard
              label="Total Cost"
              value={formatCurrency(reportData.summary.totalCost)}
              icon={Activity}
              color="purple"
              subtext={`Avg: ${formatCurrency(
                reportData.summary.avgCost
              )}/item`}
            />
            <StatCard
              label="Profit Margin"
              value={formatPercent(reportData.summary.profitMargin / 100)}
              icon={TrendingUp}
              color={
                reportData.summary.profitMargin >= 0 ? 'green' : 'red'
              }
              subtext={`Profit: ${formatCurrency(
                reportData.summary.potentialProfit
              )}`}
            />
          </div>

          {(reportData.summary.lowStockCount > 0 ||
            reportData.summary.outOfStockCount > 0) && (
            <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning-800 dark:text-warning-300">
                  Low Stock Alert
                </p>
                <p className="text-sm text-warning-700 dark:text-warning-400 tabular-nums">
                  {reportData.summary.lowStockCount} items are low on stock and{' '}
                  {reportData.summary.outOfStockCount} items are out of stock.
                  {reportData.summary.outOfStockCount > 0 &&
                    ' Immediate attention required!'}
                </p>
              </div>
            </div>
          )}

          {reportData.categoryData.length > 0 && (
            <div className="card-brand">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-brand-500" />
                Category Distribution
              </h4>
              <div className="space-y-3">
                {reportData.categoryData.slice(0, 5).map((category, index) => (
                  <div key={category.name}>
                    <div className="flex justify-between text-sm mb-0.5">
                      <span className="text-gray-600 dark:text-gray-400 truncate flex-1 mr-2">
                        {category.name}
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium tabular-nums">
                        {formatCurrency(category.value)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full ${
                            [
                              'bg-brand-500',
                              'bg-success-500',
                              'bg-warning-500',
                              'bg-danger-500',
                              'bg-secondary-500',
                            ][index % 5]
                          } rounded-full`}
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(
                              category.percentage || 0,
                              100
                            )}%`,
                          }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <span className="text-2xs text-gray-400 whitespace-nowrap tabular-nums">
                        {category.percentage?.toFixed(1) || 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reportData.topProducts.length > 0 && (
            <div className="card-brand !p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-brand-500" />
                  Top Products by Value
                </h4>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-2xs font-medium text-gray-500 dark:text-gray-400">
                        Product
                      </th>
                      <th className="px-4 py-2 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        SKU
                      </th>
                      <th className="px-4 py-2 text-right text-2xs font-medium text-gray-500 dark:text-gray-400">
                        Qty
                      </th>
                      <th className="px-4 py-2 text-right text-2xs font-medium text-gray-500 dark:text-gray-400">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.topProducts
                      .slice(0, 10)
                      .map((product, index) => (
                        <tr
                          key={index}
                          className="hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                            {product.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 font-mono hidden sm:table-cell">
                            {product.sku}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400 tabular-nums">
                            {formatNumber(product.quantity)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-success-600 dark:text-success-400 tabular-nums">
                            {formatCurrency(product.value)}
                          </td>
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

export default InventoryReports;
