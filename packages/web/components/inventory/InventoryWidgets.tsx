'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  DollarSign, Clock, ArrowUp, ArrowDown, RefreshCw,
  BarChart3, PieChart, ShoppingCart, Truck, Users,
  Building, Tag, MapPin, Bell, Zap, Award,
  Star, Globe, Shield, Eye, Edit, Plus,
  Minus, X, Loader2, AlertCircle, Info,
  Calendar, Hash, Weight, Percent,
  Lock, Scan,
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

interface WidgetData {
  totalItems: number;
  totalValue: number;
  totalCost?: number;
  totalProfit?: number;
  lowStock: number;
  outOfStock: number;
  inStock?: number;
  totalCategories: number;
  totalSuppliers: number;
  recentActivities: Array<{
    id: string;
    type: string;
    productName: string;
    quantity: number;
    timestamp: string;
    user?: string;
  }>;
  topCategories: Array<{
    name: string;
    count: number;
    value: number;
    percentage?: number;
  }>;
  topLocations: Array<{ name: string; count: number; value: number }>;
  stockTrend: { direction: 'up' | 'down' | 'stable'; value: number };
  alerts: Array<{
    id: string;
    type: 'low_stock' | 'out_of_stock' | 'expiring' | 'overstock';
    message: string;
    severity: 'info' | 'warning' | 'critical';
    productName: string;
    quantity?: number;
  }>;
  metrics: {
    avgPrice: number;
    avgCost: number;
    profitMargin: number;
    turnoverRate: number;
  };
}

interface InventoryWidgetsProps {
  className?: string;
  showAlerts?: boolean;
  showQuickActions?: boolean;
  compact?: boolean;
  onRefresh?: () => void;
}

const COLORS = [
  'bg-brand-500',
  'bg-success-500',
  'bg-warning-500',
  'bg-danger-500',
  'bg-secondary-500',
  'bg-secondary-500',
  'bg-brand-accent-500',
  'bg-success-500',
  'bg-brand-500',
  'bg-brand-500',
];

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  subtext?: string;
  trend?: { value: number; direction: 'up' | 'down' | 'stable' };
  loading?: boolean;
}> = ({ label, value, icon: Icon, color, bgColor, subtext, trend, loading }) => {
  if (loading) {
    return (
      <div className="card-brand !p-4 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-brand !p-4 hover:shadow-card-hover transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 truncate tabular-nums">
            {value}
          </p>
          {subtext && (
            <p className="text-2xs text-gray-400 dark:text-gray-500 mt-1">
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
              {trend.direction === 'up' && <ArrowUp className="w-3 h-3" />}
              {trend.direction === 'down' && (
                <ArrowDown className="w-3 h-3" />
              )}
              <span>
                {trend.value > 0 ? '+' : ''}
                {trend.value.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${bgColor} flex-shrink-0 ml-3`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </motion.div>
  );
};

const ChevronRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
);

const QuickActionCard: React.FC<{
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
  onClick: () => void;
}> = ({ label, icon: Icon, color, description, onClick }) => {
  const colorClasses: Record<
    string,
    { bg: string; text: string; hover: string }
  > = {
    blue: {
      bg: 'bg-brand-50 dark:bg-brand-900/20',
      text: 'text-brand-600 dark:text-brand-400',
      hover: 'hover:bg-brand-100 dark:hover:bg-brand-900/30',
    },
    green: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      text: 'text-success-600 dark:text-success-400',
      hover: 'hover:bg-success-100 dark:hover:bg-success-900/30',
    },
    purple: {
      bg: 'bg-secondary-50 dark:bg-secondary-900/20',
      text: 'text-secondary-600 dark:text-secondary-400',
      hover: 'hover:bg-secondary-100 dark:hover:bg-secondary-900/30',
    },
    orange: {
      bg: 'bg-brand-50 dark:bg-brand-900/20',
      text: 'text-brand-600 dark:text-brand-400',
      hover: 'hover:bg-brand-100 dark:hover:bg-brand-900/30',
    },
    teal: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      text: 'text-success-600 dark:text-success-400',
      hover: 'hover:bg-success-100 dark:hover:bg-success-900/30',
    },
    red: {
      bg: 'bg-danger-50 dark:bg-danger-900/20',
      text: 'text-danger-600 dark:text-danger-400',
      hover: 'hover:bg-danger-100 dark:hover:bg-danger-900/30',
    },
  };

  const classes = colorClasses[color] || colorClasses.blue;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`${classes.bg} ${classes.hover} rounded-2xl p-4 border border-gray-200 dark:border-gray-700 transition-all text-left w-full focus-ring`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${classes.bg}`}>
          <Icon className={`w-5 h-5 ${classes.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {description}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>
    </motion.button>
  );
};

export function InventoryWidgets({
  className = '',
  showAlerts = true,
  showQuickActions = true,
  compact = false,
  onRefresh,
}: InventoryWidgetsProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WidgetData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const canManage =
    hasPermission(`${PermissionResource.INVENTORY}:manage`) ||
    user?.role === 'SUPER_ADMIN';

  const businessUnitId =
    user?.businessUnits?.[0]?.businessUnitId ||
    (user?.businessUnits?.[0] as any)?.id ||
    localStorage.getItem('businessUnitId') ||
    '';

  const loadWidgetData = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const summary = await inventoryService.getInventorySummary(
        businessUnitId
      );
      const lowStockItems = await inventoryService.getLowStockItems(
        businessUnitId
      );
      const outOfStockItems = await inventoryService.getOutOfStockItems(
        businessUnitId
      );

      const widgetData = buildWidgetData(
        summary,
        lowStockItems,
        outOfStockItems
      );
      setData(widgetData);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Failed to load widget data:', error);
      setError(error?.message || 'Failed to load inventory data');
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId]);

  const buildWidgetData = (
    summary: any,
    lowStockItems: any[],
    outOfStockItems: any[]
  ): WidgetData => {
    const totalItems = summary.totalItems || 0;
    const totalValue = summary.totalValue || 0;
    const totalCost = summary.totalCost || 0;
    const lowStock = summary.lowStockItems || 0;
    const outOfStock = summary.outOfStockItems || 0;
    const inStock = totalItems - lowStock - outOfStock;

    const categories = (summary.categories || [])
      .map((cat: any) => ({
        name: cat.category || cat.name || 'Uncategorized',
        count: cat.count || 0,
        value: cat.value || 0,
        percentage: totalValue > 0 ? (cat.value / totalValue) * 100 : 0,
      }))
      .sort((a: any, b: any) => b.value - a.value);

    const locations = (summary.locations || [])
      .map((loc: any) => ({
        name: loc.location || loc.name || 'Warehouse',
        count: loc.count || 0,
        value: loc.value || 0,
      }))
      .sort((a: any, b: any) => b.value - a.value);

    const alerts: WidgetData['alerts'] = [];

    lowStockItems.slice(0, 5).forEach((item: any) => {
      const quantity = item.quantity || item.stock || 0;
      const reorderPoint = item.reorderPoint || item.minStock || 5;
      const ratio = quantity / reorderPoint;
      const severity: 'info' | 'warning' | 'critical' =
        ratio <= 0.3 ? 'critical' : ratio <= 0.6 ? 'warning' : 'info';

      alerts.push({
        id: `alert-${item.id}`,
        type: 'low_stock',
        message: `${item.name} is running low (${quantity} remaining)`,
        severity,
        productName: item.name || 'Unknown',
        quantity: quantity,
      });
    });

    outOfStockItems.slice(0, 3).forEach((item: any) => {
      alerts.push({
        id: `alert-oos-${item.id}`,
        type: 'out_of_stock',
        message: `${item.name} is out of stock!`,
        severity: 'critical',
        productName: item.name || 'Unknown',
        quantity: 0,
      });
    });

    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const avgPrice = totalItems > 0 ? totalValue / totalItems : 0;
    const avgCost = totalItems > 0 ? totalCost / totalItems : 0;
    const profitMargin =
      totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    const trendValue = totalItems > 0 ? 5.2 : 0;
    const trendDirection: 'up' | 'down' | 'stable' =
      trendValue > 0 ? 'up' : trendValue < 0 ? 'down' : 'stable';

    return {
      totalItems,
      totalValue,
      totalCost,
      totalProfit: totalValue - totalCost,
      lowStock,
      outOfStock,
      inStock,
      totalCategories: categories.length,
      totalSuppliers: summary.totalSuppliers || 0,
      recentActivities: [],
      topCategories: categories.slice(0, 5),
      topLocations: locations.slice(0, 3),
      stockTrend: {
        direction: trendDirection,
        value: Math.abs(trendValue),
      },
      alerts: alerts.slice(0, compact ? 3 : 8),
      metrics: {
        avgPrice,
        avgCost,
        profitMargin,
        turnoverRate: 0,
      },
    };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWidgetData();
    if (onRefresh) onRefresh();
    toast.success('Widgets refreshed');
  };

  useEffect(() => {
    if (isAuthenticated && businessUnitId) {
      loadWidgetData();
    }
  }, [isAuthenticated, businessUnitId, loadWidgetData]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Please login to view inventory widgets
        </p>
      </div>
    );
  }

  if (loading && !refreshing) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="card-brand !p-4 animate-pulse"
            >
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-2xl flex items-start gap-3 ${className}`}
      >
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
    );
  }

  if (!data) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          No inventory data available
        </p>
      </div>
    );
  }

  const displayAlerts = showAllAlerts
    ? data.alerts
    : data.alerts.slice(0, 3);
  const hasAlerts = data.alerts.length > 0;

  return (
    <div className={`space-y-5 ${className}`}>
      <div
        className={`grid ${
          compact
            ? 'grid-cols-2'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        } gap-4`}
      >
        <StatCard
          label="Total Items"
          value={formatNumber(data.totalItems)}
          icon={Package}
          color="text-brand-600 dark:text-brand-400"
          bgColor="bg-brand-50 dark:bg-brand-900/20"
          subtext={`${data.totalCategories} categories`}
          loading={loading && !refreshing}
        />
        <StatCard
          label="Total Value"
          value={formatCurrency(data.totalValue)}
          icon={DollarSign}
          color="text-success-600 dark:text-success-400"
          bgColor="bg-success-50 dark:bg-success-900/20"
          subtext={`Profit: ${formatCurrency(data.totalProfit || 0)}`}
          trend={data.stockTrend}
          loading={loading && !refreshing}
        />
        <StatCard
          label="Low Stock"
          value={data.lowStock}
          icon={AlertTriangle}
          color="text-warning-600 dark:text-warning-400"
          bgColor="bg-warning-50 dark:bg-warning-900/20"
          subtext={`${data.lowStock > 0 ? 'Needs reordering' : 'All good'}`}
          loading={loading && !refreshing}
        />
        <StatCard
          label="Out of Stock"
          value={data.outOfStock}
          icon={AlertCircle}
          color="text-danger-600 dark:text-danger-400"
          bgColor="bg-danger-50 dark:bg-danger-900/20"
          subtext={`${
            data.outOfStock > 0 ? 'Urgent attention needed' : 'All in stock'
          }`}
          loading={loading && !refreshing}
        />
      </div>

      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card-brand !p-4">
            <p className="text-2xs text-gray-500 dark:text-gray-400">
              In Stock
            </p>
            <p className="text-lg font-bold text-success-600 dark:text-success-400 tabular-nums">
              {data.inStock || 0}
            </p>
          </div>
          <div className="card-brand !p-4">
            <p className="text-2xs text-gray-500 dark:text-gray-400">
              Suppliers
            </p>
            <p className="text-lg font-bold text-secondary-600 dark:text-secondary-400 tabular-nums">
              {data.totalSuppliers || 0}
            </p>
          </div>
          <div className="card-brand !p-4">
            <p className="text-2xs text-gray-500 dark:text-gray-400">
              Avg Price
            </p>
            <p className="text-lg font-bold text-brand-600 dark:text-brand-400 tabular-nums">
              {formatCurrency(data.metrics.avgPrice)}
            </p>
          </div>
          <div className="card-brand !p-4">
            <p className="text-2xs text-gray-500 dark:text-gray-400">
              Profit Margin
            </p>
            <p
              className={`text-lg font-bold tabular-nums ${
                data.metrics.profitMargin >= 0
                  ? 'text-success-600 dark:text-success-400'
                  : 'text-danger-600 dark:text-danger-400'
              }`}
            >
              {data.metrics.profitMargin.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {showAlerts && hasAlerts && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-brand !p-0 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-warning-500" />
              <span className="font-medium text-gray-900 dark:text-white">
                Alerts
              </span>
              <span className="px-1.5 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 text-2xs rounded-full tabular-nums">
                {data.alerts.length}
              </span>
            </div>
            {data.alerts.length > 3 && (
              <button
                onClick={() => setShowAllAlerts(!showAllAlerts)}
                className="text-2xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors focus-ring rounded"
              >
                {showAllAlerts
                  ? 'Show less'
                  : `View all (${data.alerts.length})`}
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {displayAlerts.map((alert) => {
              const severityStyles = {
                critical:
                  'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-300',
                warning:
                  'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800 text-warning-700 dark:text-warning-300',
                info:
                  'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300',
              };
              const icons = {
                critical: AlertCircle,
                warning: AlertTriangle,
                info: Info,
              };
              const Icon = icons[alert.severity] || Info;

              return (
                <div
                  key={alert.id}
                  className={`px-4 py-2.5 flex items-start gap-3 ${severityStyles[alert.severity]}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {alert.productName}
                    </p>
                    <p className="text-2xs opacity-90">{alert.message}</p>
                  </div>
                  {alert.quantity !== undefined && (
                    <span className="text-2xs font-medium flex-shrink-0 tabular-nums">
                      {alert.quantity} units
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {data.topCategories.length > 0 && !compact && (
        <div className="card-brand !p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-brand-500" />
              Category Distribution
            </h3>
            <span className="text-2xs text-gray-400 tabular-nums">
              {data.topCategories.length} categories
            </span>
          </div>
          <div className="space-y-2.5">
            {data.topCategories.map((category, index) => {
              const colorIndex = index % COLORS.length;
              const percentage = category.percentage || 0;

              return (
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
                        className={`h-full ${COLORS[colorIndex]} rounded-full`}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(percentage, 100)}%`,
                        }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <span className="text-2xs text-gray-400 whitespace-nowrap tabular-nums">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showQuickActions && canManage && !compact && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <QuickActionCard
              label="Add Item"
              icon={Plus}
              color="blue"
              description="Create new inventory item"
              onClick={() => router.push('/admin/inventory/add')}
            />
            <QuickActionCard
              label="Scan Barcode"
              icon={Scan}
              color="purple"
              description="Scan items with barcode"
              onClick={() => router.push('/admin/inventory/scan')}
            />
            <QuickActionCard
              label="Transfer Stock"
              icon={Truck}
              color="orange"
              description="Move items between locations"
              onClick={() => router.push('/admin/inventory/transfer')}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-2xs text-gray-400 dark:text-gray-500">
        <span className="tabular-nums">
          Last updated: {lastUpdated.toLocaleString()}
          {businessUnitId && (
            <span className="ml-2">
              • BU: {businessUnitId.slice(0, 8)}
            </span>
          )}
        </span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 focus-ring rounded"
        >
          <RefreshCw
            className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`}
          />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}

export default InventoryWidgets;
