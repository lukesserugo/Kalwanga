'use client';

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Package, DollarSign, AlertTriangle, AlertCircle,
  TrendingUp, TrendingDown, BarChart3, Users,
  Barcode, CheckCircle, Building, Tag,
  Clock, ShoppingCart, Truck, Archive,
  Weight, Percent, Star, Globe, Image as ImageIcon,
  Calendar, Hash, Link, Eye, Lock,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface InventoryStatsData {
  totalItems: number;
  totalValue: number;
  totalCost: number;
  lowStock: number;
  outOfStock: number;
  totalCategories: number;
  totalSuppliers: number;
  profitMargin?: number;
  potentialProfit?: number;
  totalUnits?: number;
  totalReserved?: number;
  availableUnits?: number;
  withBarcode?: number;
  withoutBarcode?: number;
  inStock?: number;
  inStockValue?: number;
  locations?: Array<{ location: string; count: number; value: number }>;
  categories?: Array<{ category: string; count: number; value: number }>;
  totalImages?: number;
  itemsWithImages?: number;
  itemsWithoutImages?: number;
  totalTags?: number;
  digitalItems?: number;
  featuredItems?: number;
  activeItems?: number;
  inactiveItems?: number;
  avgPrice?: number;
  avgCost?: number;
  totalWeight?: number;
}

interface InventoryStatsProps {
  stats: InventoryStatsData;
  loading?: boolean;
  className?: string;
  showDetailed?: boolean;
}

interface StatCardConfig {
  key: keyof InventoryStatsData;
  label: string;
  icon: React.FC<{ className?: string }>;
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
  formatter: (val: any) => string;
  showOnDetail?: boolean;
  condition?: (stats: InventoryStatsData) => boolean;
}

const statCards: StatCardConfig[] = [
  {
    key: 'totalItems',
    label: 'Total Items',
    icon: Package,
    color: 'blue',
    formatter: (val: number) => val?.toLocaleString() || '0',
  },
  {
    key: 'totalValue',
    label: 'Total Value',
    icon: DollarSign,
    color: 'green',
    formatter: (val: number) => formatCurrency(val || 0),
  },
  {
    key: 'totalCost',
    label: 'Total Cost',
    icon: TrendingDown,
    color: 'purple',
    formatter: (val: number) => formatCurrency(val || 0),
    condition: (stats) => (stats.totalCost || 0) > 0,
  },
  {
    key: 'lowStock',
    label: 'Low Stock',
    icon: AlertTriangle,
    color: 'yellow',
    formatter: (val: number) => val?.toString() || '0',
  },
  {
    key: 'outOfStock',
    label: 'Out of Stock',
    icon: AlertCircle,
    color: 'red',
    formatter: (val: number) => val?.toString() || '0',
  },
  {
    key: 'inStock',
    label: 'In Stock',
    icon: CheckCircle,
    color: 'teal',
    formatter: (val: number) => val?.toString() || '0',
  },
  {
    key: 'profitMargin',
    label: 'Profit Margin',
    icon: TrendingUp,
    color: 'green',
    formatter: (val: number) => `${(val || 0).toFixed(1)}%`,
    condition: (stats) => (stats.profitMargin || 0) > 0,
  },
  {
    key: 'potentialProfit',
    label: 'Potential Profit',
    icon: TrendingUp,
    color: 'green',
    formatter: (val: number) => formatCurrency(val || 0),
    condition: (stats) => (stats.potentialProfit || 0) > 0,
  },
  {
    key: 'withBarcode',
    label: 'With Barcode',
    icon: Barcode,
    color: 'indigo',
    formatter: (val: number) => val?.toString() || '0',
    condition: (stats) =>
      (stats.withBarcode || 0) > 0 || (stats.withoutBarcode || 0) > 0,
  },
  {
    key: 'withoutBarcode',
    label: 'No Barcode',
    icon: Barcode,
    color: 'gray',
    formatter: (val: number) => val?.toString() || '0',
    condition: (stats) =>
      (stats.withBarcode || 0) > 0 || (stats.withoutBarcode || 0) > 0,
  },
  {
    key: 'totalCategories',
    label: 'Categories',
    icon: Tag,
    color: 'purple',
    formatter: (val: number) => val?.toString() || '0',
  },
  {
    key: 'totalSuppliers',
    label: 'Suppliers',
    icon: Building,
    color: 'blue',
    formatter: (val: number) => val?.toString() || '0',
  },
  {
    key: 'digitalItems',
    label: 'Digital Products',
    icon: Globe,
    color: 'indigo',
    formatter: (val: number) => val?.toString() || '0',
    showOnDetail: true,
  },
  {
    key: 'featuredItems',
    label: 'Featured Items',
    icon: Star,
    color: 'yellow',
    formatter: (val: number) => val?.toString() || '0',
    showOnDetail: true,
  },
  {
    key: 'activeItems',
    label: 'Active Items',
    icon: CheckCircle,
    color: 'green',
    formatter: (val: number) => val?.toString() || '0',
    showOnDetail: true,
  },
  {
    key: 'inactiveItems',
    label: 'Inactive Items',
    icon: Archive,
    color: 'gray',
    formatter: (val: number) => val?.toString() || '0',
    showOnDetail: true,
  },
  {
    key: 'itemsWithImages',
    label: 'With Images',
    icon: ImageIcon,
    color: 'pink',
    formatter: (val: number) => val?.toString() || '0',
    showOnDetail: true,
  },
  {
    key: 'itemsWithoutImages',
    label: 'No Images',
    icon: ImageIcon,
    color: 'gray',
    formatter: (val: number) => val?.toString() || '0',
    showOnDetail: true,
  },
  {
    key: 'avgPrice',
    label: 'Avg Price',
    icon: DollarSign,
    color: 'teal',
    formatter: (val: number) => formatCurrency(val || 0),
    showOnDetail: true,
  },
  {
    key: 'avgCost',
    label: 'Avg Cost',
    icon: DollarSign,
    color: 'purple',
    formatter: (val: number) => formatCurrency(val || 0),
    showOnDetail: true,
  },
  {
    key: 'totalUnits',
    label: 'Total Units',
    icon: Package,
    color: 'blue',
    formatter: (val: number) => val?.toLocaleString() || '0',
    showOnDetail: true,
  },
  {
    key: 'availableUnits',
    label: 'Available Units',
    icon: CheckCircle,
    color: 'green',
    formatter: (val: number) => val?.toLocaleString() || '0',
    showOnDetail: true,
  },
  {
    key: 'totalReserved',
    label: 'Reserved Units',
    icon: Lock,
    color: 'orange',
    formatter: (val: number) => val?.toLocaleString() || '0',
    showOnDetail: true,
  },
];

const getColorClasses = (color: string) => {
  const colors: Record<
    string,
    { bg: string; text: string; iconBg: string; border: string }
  > = {
    blue: {
      bg: 'bg-brand-50 dark:bg-brand-900/20',
      text: 'text-brand-600 dark:text-brand-400',
      iconBg: 'bg-brand-100 dark:bg-brand-900/30',
      border: 'border-brand-200 dark:border-brand-800/30',
    },
    green: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      text: 'text-success-600 dark:text-success-400',
      iconBg: 'bg-success-100 dark:bg-success-900/30',
      border: 'border-success-200 dark:border-success-800/30',
    },
    yellow: {
      bg: 'bg-warning-50 dark:bg-warning-900/20',
      text: 'text-warning-600 dark:text-warning-400',
      iconBg: 'bg-warning-100 dark:bg-warning-900/30',
      border: 'border-warning-200 dark:border-warning-800/30',
    },
    red: {
      bg: 'bg-danger-50 dark:bg-danger-900/20',
      text: 'text-danger-600 dark:text-danger-400',
      iconBg: 'bg-danger-100 dark:bg-danger-900/30',
      border: 'border-danger-200 dark:border-danger-800/30',
    },
    purple: {
      bg: 'bg-secondary-50 dark:bg-secondary-900/20',
      text: 'text-secondary-600 dark:text-secondary-400',
      iconBg: 'bg-secondary-100 dark:bg-secondary-900/30',
      border: 'border-secondary-200 dark:border-secondary-800/30',
    },
    indigo: {
      bg: 'bg-secondary-50 dark:bg-secondary-900/20',
      text: 'text-secondary-600 dark:text-secondary-400',
      iconBg: 'bg-secondary-100 dark:bg-secondary-900/30',
      border: 'border-secondary-200 dark:border-secondary-800/30',
    },
    teal: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      text: 'text-success-600 dark:text-success-400',
      iconBg: 'bg-success-100 dark:bg-success-900/30',
      border: 'border-success-200 dark:border-success-800/30',
    },
    orange: {
      bg: 'bg-brand-50 dark:bg-brand-900/20',
      text: 'text-brand-600 dark:text-brand-400',
      iconBg: 'bg-brand-100 dark:bg-brand-900/30',
      border: 'border-brand-200 dark:border-brand-800/30',
    },
    pink: {
      bg: 'bg-brand-accent-50 dark:bg-brand-accent-900/20',
      text: 'text-brand-accent-600 dark:text-brand-accent-400',
      iconBg: 'bg-brand-accent-100 dark:bg-brand-accent-900/30',
      border: 'border-brand-accent-200 dark:border-brand-accent-800/30',
    },
    gray: {
      bg: 'bg-gray-50 dark:bg-gray-800/50',
      text: 'text-gray-600 dark:text-gray-400',
      iconBg: 'bg-gray-100 dark:bg-gray-700/50',
      border: 'border-gray-200 dark:border-gray-700/50',
    },
  };
  return colors[color] || colors.blue;
};

const LoadingSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl h-24" />
        </div>
      ))}
    </div>
  );
};

export function InventoryStats({
  stats,
  loading = false,
  className = '',
  showDetailed = false,
}: InventoryStatsProps) {
  if (loading) {
    return <LoadingSkeleton count={showDetailed ? 8 : 4} />;
  }

  const visibleCards = statCards.filter((card) => {
    if (showDetailed && card.showOnDetail === false) return true;
    if (!showDetailed && card.showOnDetail === true) return false;

    if (card.condition && !card.condition(stats)) return false;

    const value = stats[card.key];
    if (value === undefined || value === null) return false;

    if (typeof value === 'number' && value === 0) {
      const alwaysShowZero = [
        'totalItems',
        'lowStock',
        'outOfStock',
        'inStock',
      ].includes(card.key);
      if (!alwaysShowZero) return false;
    }

    return true;
  });

  if (visibleCards.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p>No inventory data available</p>
      </div>
    );
  }

  const totalItems =
    typeof stats.totalItems === 'number' ? stats.totalItems : 1;
  const inStock = typeof stats.inStock === 'number' ? stats.inStock : 0;
  const lowStock = typeof stats.lowStock === 'number' ? stats.lowStock : 0;
  const outOfStock =
    typeof stats.outOfStock === 'number' ? stats.outOfStock : 0;

  const getGridCols = (count: number) => {
    if (count <= 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    if (count <= 6)
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6';
    if (count <= 8)
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className={`grid ${getGridCols(visibleCards.length)} gap-4`}>
        {visibleCards.map((card, index) => {
          const value = stats[card.key];
          const colors = getColorClasses(card.color);
          const Icon = card.icon;

          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`${colors.bg} ${colors.border} rounded-2xl p-4 border hover:shadow-card-hover transition-all duration-200 group`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {card.label}
                  </p>
                  <p
                    className={`text-2xl font-bold ${colors.text} truncate tabular-nums`}
                  >
                    {card.formatter(value)}
                  </p>
                  {['inStock', 'lowStock', 'outOfStock'].includes(card.key) &&
                    totalItems > 0 && (
                      <div className="mt-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                        <div
                          className={`rounded-full h-1 transition-all duration-500 ${
                            card.key === 'inStock'
                              ? 'bg-success-500'
                              : card.key === 'lowStock'
                              ? 'bg-warning-500'
                              : 'bg-danger-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              ((value as number) / totalItems) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  {showDetailed && card.key === 'totalItems' && (
                    <p className="text-2xs text-gray-400 mt-0.5 tabular-nums">
                      {stats.withBarcode || 0} with barcode
                    </p>
                  )}
                  {showDetailed &&
                    card.key === 'totalValue' &&
                    stats.totalCost !== undefined && (
                      <p className="text-2xs text-gray-400 mt-0.5 tabular-nums">
                        Cost: {formatCurrency(stats.totalCost || 0)}
                      </p>
                    )}
                  {showDetailed &&
                    card.key === 'totalItems' &&
                    stats.activeItems !== undefined && (
                      <p className="text-2xs text-gray-400 mt-0.5 tabular-nums">
                        {stats.activeItems || 0} active
                      </p>
                    )}
                </div>
                <div
                  className={`p-3 rounded-lg ${colors.iconBg} group-hover:scale-110 transition-transform duration-200 flex-shrink-0 ml-3`}
                >
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {showDetailed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div className="card-brand !p-3">
            <p className="text-2xs text-gray-500 dark:text-gray-400">
              Stock Health
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                <div
                  className="bg-success-500 h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      (inStock / (totalItems || 1)) * 100,
                      100
                    )}%`,
                  }}
                />
                <div
                  className="bg-warning-500 h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      (lowStock / (totalItems || 1)) * 100,
                      100
                    )}%`,
                  }}
                />
                <div
                  className="bg-danger-500 h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      (outOfStock / (totalItems || 1)) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
              <span className="text-2xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap tabular-nums">
                {Math.min((inStock / (totalItems || 1)) * 100, 100).toFixed(0)}
                %
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-2xs text-gray-400 tabular-nums">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success-500" />
                {inStock}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-warning-500" />
                {lowStock}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-danger-500" />
                {outOfStock}
              </span>
            </div>
          </div>

          <div className="card-brand !p-3">
            <p className="text-2xs text-gray-500 dark:text-gray-400">
              Barcode Coverage
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                <div
                  className="bg-brand-500 h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      ((stats.withBarcode || 0) / (totalItems || 1)) * 100,
                      100
                    )}%`,
                  }}
                />
                <div
                  className="bg-gray-400 h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      ((stats.withoutBarcode || 0) / (totalItems || 1)) *
                        100,
                      100
                    )}%`,
                  }}
                />
              </div>
              <span className="text-2xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap tabular-nums">
                {Math.min(
                  ((stats.withBarcode || 0) / (totalItems || 1)) * 100,
                  100
                ).toFixed(0)}
                %
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-2xs text-gray-400 tabular-nums">
              <span className="flex items-center gap-1">
                <Barcode className="w-3 h-3" />
                {stats.withBarcode || 0}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                {stats.withoutBarcode || 0}
              </span>
            </div>
          </div>

          <div className="card-brand !p-3">
            <p className="text-2xs text-gray-500 dark:text-gray-400">
              Profitability
            </p>
            <div className="flex items-center gap-4 mt-1">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {stats.profitMargin !== undefined
                    ? `${Math.min(stats.profitMargin, 100).toFixed(1)}%`
                    : 'N/A'}
                </p>
                <p className="text-2xs text-gray-400">Margin</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {stats.potentialProfit !== undefined
                    ? formatCurrency(stats.potentialProfit)
                    : 'N/A'}
                </p>
                <p className="text-2xs text-gray-400">Potential Profit</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {showDetailed && stats.categories && stats.categories.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="card-brand !p-4"
        >
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-400" />
            Category Breakdown
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {stats.categories.slice(0, 8).map((cat, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
              >
                <span className="text-gray-600 dark:text-gray-300 truncate flex-1 mr-2">
                  {cat.category}
                </span>
                <span className="text-gray-500 dark:text-gray-400 font-medium tabular-nums">
                  {cat.count}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="text-right text-2xs text-gray-400 dark:text-gray-500 tabular-nums">
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
}

export default InventoryStats;

export function useInventoryStats(stats: InventoryStatsData) {
  const getStockHealth = useCallback(() => {
    const total = typeof stats.totalItems === 'number' ? stats.totalItems : 1;
    const inStock = typeof stats.inStock === 'number' ? stats.inStock : 0;
    const lowStock = typeof stats.lowStock === 'number' ? stats.lowStock : 0;
    const outOfStock =
      typeof stats.outOfStock === 'number' ? stats.outOfStock : 0;

    return {
      inStock: inStock / total,
      lowStock: lowStock / total,
      outOfStock: outOfStock / total,
      health: (inStock / total) * 100,
    };
  }, [stats]);

  const getBarcodeCoverage = useCallback(() => {
    const total = typeof stats.totalItems === 'number' ? stats.totalItems : 1;
    const withBarcode =
      typeof stats.withBarcode === 'number' ? stats.withBarcode : 0;
    const withoutBarcode =
      typeof stats.withoutBarcode === 'number' ? stats.withoutBarcode : 0;

    return {
      withBarcode: withBarcode / total,
      withoutBarcode: withoutBarcode / total,
      coverage: (withBarcode / total) * 100,
    };
  }, [stats]);

  const getProfitability = useCallback(() => {
    return {
      margin:
        typeof stats.profitMargin === 'number' ? stats.profitMargin : 0,
      potentialProfit:
        typeof stats.potentialProfit === 'number'
          ? stats.potentialProfit
          : 0,
      totalValue:
        typeof stats.totalValue === 'number' ? stats.totalValue : 0,
      totalCost: typeof stats.totalCost === 'number' ? stats.totalCost : 0,
    };
  }, [stats]);

  return {
    getStockHealth,
    getBarcodeCoverage,
    getProfitability,
    totalItems:
      typeof stats.totalItems === 'number' ? stats.totalItems : 0,
    totalValue:
      typeof stats.totalValue === 'number' ? stats.totalValue : 0,
    lowStock: typeof stats.lowStock === 'number' ? stats.lowStock : 0,
    outOfStock:
      typeof stats.outOfStock === 'number' ? stats.outOfStock : 0,
  };
}
