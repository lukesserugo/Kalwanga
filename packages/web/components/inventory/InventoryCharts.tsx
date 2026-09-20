'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Package, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, BarChart3, PieChart,
  Tag, Building, Clock, Users, Star, Globe,
  AlertCircle, TrendingUp as TrendingUpIcon,
  ShoppingCart, Truck, Warehouse, Zap,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface InventoryItem {
  id: string;
  name?: string;
  category?: string;
  categoryId?: string;
  quantity?: number;
  stock?: number;
  price?: number;
  unitPrice?: number;
  costPrice?: number;
  reorderPoint?: number;
  minStock?: number;
  location?: string;
  supplier?: string;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  images?: string[];
  tags?: string[];
}

interface InventoryStats {
  totalItems: number;
  totalValue: number;
  totalCost?: number;
  lowStock: number;
  outOfStock: number;
  totalCategories?: number;
  totalSuppliers?: number;
  profitMargin?: number;
  potentialProfit?: number;
  withBarcode?: number;
  withoutBarcode?: number;
  inStock?: number;
  totalUnits?: number;
  totalReserved?: number;
  availableUnits?: number;
  avgPrice?: number;
  avgCost?: number;
}

interface InventoryChartsProps {
  data: InventoryItem[];
  stats: InventoryStats;
  loading?: boolean;
  className?: string;
}

const getStockValue = (item: InventoryItem): number => {
  const quantity = item.quantity || item.stock || 0;
  const price = item.price || item.unitPrice || 0;
  return quantity * price;
};

const getProfitValue = (item: InventoryItem): number => {
  const quantity = item.quantity || item.stock || 0;
  const price = item.price || item.unitPrice || 0;
  const cost = item.costPrice || 0;
  return quantity * (price - cost);
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color:
    | 'blue'
    | 'green'
    | 'yellow'
    | 'red'
    | 'purple'
    | 'indigo'
    | 'teal'
    | 'orange'
    | 'pink'
    | 'gray';
  subtext?: string;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
}> = ({ label, value, icon: Icon, color, subtext, trend }) => {
  const colorClasses: Record<
    string,
    { bg: string; text: string; iconBg: string }
  > = {
    blue: {
      bg: 'bg-brand-50 dark:bg-brand-900/20',
      text: 'text-brand-600 dark:text-brand-400',
      iconBg: 'bg-brand-100 dark:bg-brand-900/30',
    },
    green: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      text: 'text-success-600 dark:text-success-400',
      iconBg: 'bg-success-100 dark:bg-success-900/30',
    },
    yellow: {
      bg: 'bg-warning-50 dark:bg-warning-900/20',
      text: 'text-warning-600 dark:text-warning-400',
      iconBg: 'bg-warning-100 dark:bg-warning-900/30',
    },
    red: {
      bg: 'bg-danger-50 dark:bg-danger-900/20',
      text: 'text-danger-600 dark:text-danger-400',
      iconBg: 'bg-danger-100 dark:bg-danger-900/30',
    },
    purple: {
      bg: 'bg-secondary-50 dark:bg-secondary-900/20',
      text: 'text-secondary-600 dark:text-secondary-400',
      iconBg: 'bg-secondary-100 dark:bg-secondary-900/30',
    },
    indigo: {
      bg: 'bg-secondary-50 dark:bg-secondary-900/20',
      text: 'text-secondary-600 dark:text-secondary-400',
      iconBg: 'bg-secondary-100 dark:bg-secondary-900/30',
    },
    teal: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      text: 'text-success-600 dark:text-success-400',
      iconBg: 'bg-success-100 dark:bg-success-900/30',
    },
    orange: {
      bg: 'bg-brand-50 dark:bg-brand-900/20',
      text: 'text-brand-600 dark:text-brand-400',
      iconBg: 'bg-brand-100 dark:bg-brand-900/30',
    },
    pink: {
      bg: 'bg-brand-accent-50 dark:bg-brand-accent-900/20',
      text: 'text-brand-accent-600 dark:text-brand-accent-400',
      iconBg: 'bg-brand-accent-100 dark:bg-brand-accent-900/30',
    },
    gray: {
      bg: 'bg-gray-50 dark:bg-gray-800/50',
      text: 'text-gray-600 dark:text-gray-400',
      iconBg: 'bg-gray-100 dark:bg-gray-700/50',
    },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${colors.bg} rounded-2xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-card-hover transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${colors.text} mt-1 tabular-nums`}>
            {value}
          </p>
          {subtext && (
            <p className="text-2xs text-gray-400 dark:text-gray-500 mt-1 tabular-nums">
              {subtext}
            </p>
          )}
          {trend && (
            <div
              className={`flex items-center gap-1 mt-1 text-2xs ${
                trend.direction === 'up'
                  ? 'text-success-600'
                  : trend.direction === 'down'
                  ? 'text-danger-600'
                  : 'text-gray-400'
              }`}
            >
              {trend.direction === 'up' && (
                <TrendingUpIcon className="w-3 h-3" />
              )}
              {trend.direction === 'down' && (
                <TrendingDown className="w-3 h-3" />
              )}
              <span className="tabular-nums">
                {trend.value > 0 ? '+' : ''}
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        <div className={`p-2 rounded-lg ${colors.iconBg}`}>
          <Icon className={`w-5 h-5 ${colors.text}`} />
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="animate-pulse">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl h-64" />
        </div>
        <div className="animate-pulse">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl h-64" />
        </div>
      </div>
    </div>
  );
};

export function InventoryCharts({
  data = [],
  stats,
  loading = false,
  className = '',
}: InventoryChartsProps) {
  const categoryData = useMemo(() => {
    const distribution = data.reduce(
      (
        acc: Record<string, { count: number; value: number; cost: number }>,
        item
      ) => {
        const category = item.category || 'Uncategorized';
        const quantity = item.quantity || item.stock || 0;
        const price = item.price || item.unitPrice || 0;
        const cost = item.costPrice || 0;

        if (!acc[category]) {
          acc[category] = { count: 0, value: 0, cost: 0 };
        }
        acc[category].count += quantity;
        acc[category].value += quantity * price;
        acc[category].cost += quantity * cost;
        return acc;
      },
      {}
    );

    return Object.entries(distribution)
      .map(([name, data]) => ({
        name,
        count: data.count,
        value: data.value,
        cost: data.cost,
        profit: data.value - data.cost,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [data]);

  const locationData = useMemo(() => {
    const distribution = data.reduce(
      (acc: Record<string, { count: number; value: number }>, item) => {
        const location = item.location || 'Warehouse';
        const quantity = item.quantity || item.stock || 0;
        const price = item.price || item.unitPrice || 0;

        if (!acc[location]) {
          acc[location] = { count: 0, value: 0 };
        }
        acc[location].count += quantity;
        acc[location].value += quantity * price;
        return acc;
      },
      {}
    );

    return Object.entries(distribution)
      .map(([name, data]) => ({ name, count: data.count, value: data.value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [data]);

  const supplierData = useMemo(() => {
    const distribution = data.reduce((acc: Record<string, number>, item) => {
      const supplier = item.supplier || 'Unknown';
      if (!acc[supplier]) acc[supplier] = 0;
      acc[supplier] += item.quantity || item.stock || 0;
      return acc;
    }, {});

    return Object.entries(distribution)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [data]);

  const totalItems = data.length;
  const totalValue = data.reduce((sum, item) => sum + getStockValue(item), 0);
  const totalCost = data.reduce(
    (sum, item) =>
      sum + (item.costPrice || 0) * (item.quantity || item.stock || 0),
    0
  );
  const totalProfit = totalValue - totalCost;
  const maxCategoryCount = Math.max(...categoryData.map((c) => c.count), 1);
  const maxLocationCount = Math.max(...locationData.map((l) => l.count), 1);
  const maxSupplierCount = Math.max(...supplierData.map((s) => s.count), 1);

  const stockHealth = {
    inStock: data.filter((item) => (item.quantity || item.stock || 0) > 0).length,
    lowStock: data.filter((item) => {
      const quantity = item.quantity || item.stock || 0;
      const reorderPoint = item.reorderPoint || item.minStock || 5;
      return quantity > 0 && quantity <= reorderPoint;
    }).length,
    outOfStock: data.filter((item) => (item.quantity || item.stock || 0) === 0)
      .length,
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (data.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          No data available
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Add inventory items to see charts and analytics
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Items"
          value={formatNumber(stats.totalItems || totalItems)}
          icon={Package}
          color="blue"
        />
        <StatCard
          label="Total Value"
          value={formatCurrency(stats.totalValue || totalValue)}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          label="Low Stock"
          value={stats.lowStock || stockHealth.lowStock}
          icon={AlertTriangle}
          color="yellow"
          subtext={`${(
            (stockHealth.lowStock / (totalItems || 1)) *
            100
          ).toFixed(1)}% of inventory`}
        />
        <StatCard
          label="Out of Stock"
          value={stats.outOfStock || stockHealth.outOfStock}
          icon={AlertCircle}
          color="red"
          subtext={`${(
            (stockHealth.outOfStock / (totalItems || 1)) *
            100
          ).toFixed(1)}% of inventory`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-brand">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-brand-500" />
              Category Distribution
            </h3>
            <span className="text-2xs text-gray-400 tabular-nums">
              {categoryData.length} categories
            </span>
          </div>
          {categoryData.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No category data available
            </p>
          ) : (
            <div className="space-y-3">
              {categoryData.map((category, index) => (
                <motion.div
                  key={category.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600 dark:text-gray-400 truncate">
                        {category.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-2xs">
                      <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                        {category.count} units
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(category.value)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-brand-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(
                          (category.count / maxCategoryCount) * 100,
                          100
                        )}%`,
                      }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                    />
                  </div>
                  {category.profit > 0 && (
                    <div className="text-2xs text-success-500 mt-0.5 tabular-nums">
                      Profit: {formatCurrency(category.profit)}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="card-brand">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-secondary-500" />
              Stock Health
            </h3>
            <span className="text-2xs text-gray-400 tabular-nums">
              {totalItems} total items
            </span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">
                  In Stock
                </span>
                <span className="font-medium text-success-600 dark:text-success-400 tabular-nums">
                  {stockHealth.inStock} (
                  {((stockHealth.inStock / (totalItems || 1)) * 100).toFixed(1)}
                  %)
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-success-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(
                      (stockHealth.inStock / (totalItems || 1)) * 100,
                      100
                    )}%`,
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">
                  Low Stock
                </span>
                <span className="font-medium text-warning-600 dark:text-warning-400 tabular-nums">
                  {stockHealth.lowStock} (
                  {((stockHealth.lowStock / (totalItems || 1)) * 100).toFixed(1)}
                  %)
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-warning-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(
                      (stockHealth.lowStock / (totalItems || 1)) * 100,
                      100
                    )}%`,
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">
                  Out of Stock
                </span>
                <span className="font-medium text-danger-600 dark:text-danger-400 tabular-nums">
                  {stockHealth.outOfStock} (
                  {(
                    (stockHealth.outOfStock / (totalItems || 1)) *
                    100
                  ).toFixed(1)}
                  %)
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-danger-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(
                      (stockHealth.outOfStock / (totalItems || 1)) * 100,
                      100
                    )}%`,
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Overall Health Score
              </span>
              <span
                className={`text-lg font-bold tabular-nums ${
                  stockHealth.inStock / (totalItems || 1) > 0.7
                    ? 'text-success-600'
                    : stockHealth.inStock / (totalItems || 1) > 0.4
                    ? 'text-warning-600'
                    : 'text-danger-600'
                }`}
              >
                {Math.round((stockHealth.inStock / (totalItems || 1)) * 100)}%
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  stockHealth.inStock / (totalItems || 1) > 0.7
                    ? 'bg-success-500'
                    : stockHealth.inStock / (totalItems || 1) > 0.4
                    ? 'bg-warning-500'
                    : 'bg-danger-500'
                }`}
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(
                    (stockHealth.inStock / (totalItems || 1)) * 100,
                    100
                  )}%`,
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        <div className="card-brand">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-brand-500" />
              Location Distribution
            </h3>
            <span className="text-2xs text-gray-400 tabular-nums">
              {locationData.length} locations
            </span>
          </div>
          {locationData.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No location data available
            </p>
          ) : (
            <div className="space-y-3">
              {locationData.map((location, index) => (
                <motion.div
                  key={location.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400 truncate">
                      {location.name}
                    </span>
                    <div className="flex items-center gap-3 text-2xs">
                      <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                        {location.count} units
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(location.value)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-brand-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(
                          (location.count / maxLocationCount) * 100,
                          100
                        )}%`,
                      }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="card-brand">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-secondary-500" />
              Top Suppliers
            </h3>
            <span className="text-2xs text-gray-400 tabular-nums">
              {supplierData.length} suppliers
            </span>
          </div>
          {supplierData.length === 0 ||
          (supplierData.length === 1 &&
            supplierData[0].name === 'Unknown') ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No supplier data available
            </p>
          ) : (
            <div className="space-y-3">
              {supplierData.map((supplier, index) => (
                <motion.div
                  key={supplier.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400 truncate">
                      {supplier.name}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                      {supplier.count} units
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-secondary-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(
                          (supplier.count / maxSupplierCount) * 100,
                          100
                        )}%`,
                      }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-brand !p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-50 dark:bg-success-900/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <p className="text-2xs text-gray-500 dark:text-gray-400">
                Avg Price per Item
              </p>
              <p className="font-semibold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(
                  stats.avgPrice || totalValue / (totalItems || 1)
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="card-brand !p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary-50 dark:bg-secondary-900/20 rounded-lg">
              <TrendingDown className="w-5 h-5 text-secondary-500" />
            </div>
            <div>
              <p className="text-2xs text-gray-500 dark:text-gray-400">
                Avg Cost per Item
              </p>
              <p className="font-semibold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(stats.avgCost || totalCost / (totalItems || 1))}
              </p>
            </div>
          </div>
        </div>
        <div className="card-brand !p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-50 dark:bg-success-900/20 rounded-lg">
              <TrendingUpIcon className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <p className="text-2xs text-gray-500 dark:text-gray-400">
                Total Profit
              </p>
              <p
                className={`font-semibold tabular-nums ${
                  totalProfit >= 0
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-danger-600 dark:text-danger-400'
                }`}
              >
                {formatCurrency(totalProfit)}
              </p>
            </div>
          </div>
        </div>
        <div className="card-brand !p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
              <Users className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <p className="text-2xs text-gray-500 dark:text-gray-400">
                Items per Category
              </p>
              <p className="font-semibold text-gray-900 dark:text-white tabular-nums">
                {(totalItems / (categoryData.length || 1)).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InventoryCharts;
