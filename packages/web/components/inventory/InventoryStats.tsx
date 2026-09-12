// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\components\InventoryStats.tsx

'use client';

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Package, DollarSign, AlertTriangle, AlertCircle,
  TrendingUp, TrendingDown, BarChart3, Users,
  Barcode, CheckCircle, Building, Tag,
  Clock, ShoppingCart, Truck, Archive,
  Weight, Percent, Star, Globe, Image as ImageIcon,
  Calendar, Hash, Link, Eye, Lock
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

// ============================================
// TYPES - UPDATED
// ============================================

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
  // ✅ UPDATED: New fields
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

// ============================================
// STAT CARD CONFIGURATION - UPDATED
// ============================================

interface StatCardConfig {
  key: keyof InventoryStatsData;
  label: string;
  icon: React.FC<{ className?: string }>;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo' | 'teal' | 'orange' | 'pink' | 'gray';
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
    condition: (stats) => (stats.withBarcode || 0) > 0 || (stats.withoutBarcode || 0) > 0,
  },
  {
    key: 'withoutBarcode',
    label: 'No Barcode',
    icon: Barcode,
    color: 'gray',
    formatter: (val: number) => val?.toString() || '0',
    condition: (stats) => (stats.withBarcode || 0) > 0 || (stats.withoutBarcode || 0) > 0,
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
  // ✅ UPDATED: New stat cards
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

// ============================================
// COLOR HELPERS
// ============================================

const getColorClasses = (color: string) => {
  const colors: Record<string, { bg: string; text: string; iconBg: string; border: string }> = {
    blue: { 
      bg: 'bg-blue-50 dark:bg-blue-900/20', 
      text: 'text-blue-600 dark:text-blue-400', 
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      border: 'border-blue-200 dark:border-blue-800/30'
    },
    green: { 
      bg: 'bg-green-50 dark:bg-green-900/20', 
      text: 'text-green-600 dark:text-green-400', 
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      border: 'border-green-200 dark:border-green-800/30'
    },
    yellow: { 
      bg: 'bg-yellow-50 dark:bg-yellow-900/20', 
      text: 'text-yellow-600 dark:text-yellow-400', 
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
      border: 'border-yellow-200 dark:border-yellow-800/30'
    },
    red: { 
      bg: 'bg-red-50 dark:bg-red-900/20', 
      text: 'text-red-600 dark:text-red-400', 
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      border: 'border-red-200 dark:border-red-800/30'
    },
    purple: { 
      bg: 'bg-purple-50 dark:bg-purple-900/20', 
      text: 'text-purple-600 dark:text-purple-400', 
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      border: 'border-purple-200 dark:border-purple-800/30'
    },
    indigo: { 
      bg: 'bg-indigo-50 dark:bg-indigo-900/20', 
      text: 'text-indigo-600 dark:text-indigo-400', 
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      border: 'border-indigo-200 dark:border-indigo-800/30'
    },
    teal: { 
      bg: 'bg-teal-50 dark:bg-teal-900/20', 
      text: 'text-teal-600 dark:text-teal-400', 
      iconBg: 'bg-teal-100 dark:bg-teal-900/30',
      border: 'border-teal-200 dark:border-teal-800/30'
    },
    orange: { 
      bg: 'bg-orange-50 dark:bg-orange-900/20', 
      text: 'text-orange-600 dark:text-orange-400', 
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      border: 'border-orange-200 dark:border-orange-800/30'
    },
    pink: { 
      bg: 'bg-pink-50 dark:bg-pink-900/20', 
      text: 'text-pink-600 dark:text-pink-400', 
      iconBg: 'bg-pink-100 dark:bg-pink-900/30',
      border: 'border-pink-200 dark:border-pink-800/30'
    },
    gray: { 
      bg: 'bg-gray-50 dark:bg-gray-800/50', 
      text: 'text-gray-600 dark:text-gray-400', 
      iconBg: 'bg-gray-100 dark:bg-gray-700/50',
      border: 'border-gray-200 dark:border-gray-700/50'
    },
  };
  return colors[color] || colors.blue;
};

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-24"></div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function InventoryStats({ 
  stats, 
  loading = false, 
  className = '',
  showDetailed = false 
}: InventoryStatsProps) {
  if (loading) {
    return <LoadingSkeleton count={showDetailed ? 8 : 4} />;
  }

  // Filter cards based on showDetailed and conditions
  const visibleCards = statCards.filter(card => {
    // Check if card should be shown based on detail mode
    if (showDetailed && card.showOnDetail === false) return true; // Show all in detailed mode
    if (!showDetailed && card.showOnDetail === true) return false; // Hide detail-only in compact mode
    
    // Check condition
    if (card.condition && !card.condition(stats)) return false;
    
    // Check if value exists and is meaningful
    const value = stats[card.key];
    if (value === undefined || value === null) return false;
    
    // For count values, only show if > 0
    if (typeof value === 'number' && value === 0) {
      // Always show zero for certain metrics (total items, low stock, out of stock)
      const alwaysShowZero = ['totalItems', 'lowStock', 'outOfStock', 'inStock'].includes(card.key);
      if (!alwaysShowZero) return false;
    }
    
    return true;
  });

  // If no cards are visible, show a message
  if (visibleCards.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p>No inventory data available</p>
      </div>
    );
  }

  // ✅ FIXED: Convert to number for arithmetic
  const totalItems = typeof stats.totalItems === 'number' ? stats.totalItems : 1;
  const inStock = typeof stats.inStock === 'number' ? stats.inStock : 0;
  const lowStock = typeof stats.lowStock === 'number' ? stats.lowStock : 0;
  const outOfStock = typeof stats.outOfStock === 'number' ? stats.outOfStock : 0;

  // Determine grid columns based on number of cards
  const getGridCols = (count: number) => {
    if (count <= 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    if (count <= 6) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6';
    if (count <= 8) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Stats Grid */}
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
              className={`${colors.bg} ${colors.border} rounded-xl p-4 border hover:shadow-md transition-all duration-200 group`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{card.label}</p>
                  <p className={`text-2xl font-bold ${colors.text} truncate`}>
                    {card.formatter(value)}
                  </p>
                  {/* ✅ FIXED: Use converted number values for calculations */}
                  {['inStock', 'lowStock', 'outOfStock'].includes(card.key) && totalItems > 0 && (
                    <div className="mt-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                      <div
                        className={`rounded-full h-1 transition-all duration-500 ${
                          card.key === 'inStock' ? 'bg-green-500' :
                          card.key === 'lowStock' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ 
                          width: `${Math.min(((value as number || 0) / totalItems) * 100, 100)}%` 
                        }}
                      />
                    </div>
                  )}
                  {/* Show sub-label for detailed stats */}
                  {showDetailed && card.key === 'totalItems' && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {stats.withBarcode || 0} with barcode
                    </p>
                  )}
                  {showDetailed && card.key === 'totalValue' && stats.totalCost !== undefined && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Cost: {formatCurrency(stats.totalCost || 0)}
                    </p>
                  )}
                  {showDetailed && card.key === 'totalItems' && stats.activeItems !== undefined && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {stats.activeItems || 0} active
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-lg ${colors.iconBg} group-hover:scale-110 transition-transform duration-200 flex-shrink-0 ml-3`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary Row for Detailed View */}
      {showDetailed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Stock Health</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                <div 
                  className="bg-green-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(((inStock || 0) / (totalItems || 1)) * 100, 100)}%` }}
                />
                <div 
                  className="bg-yellow-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(((lowStock || 0) / (totalItems || 1)) * 100, 100)}%` }}
                />
                <div 
                  className="bg-red-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(((outOfStock || 0) / (totalItems || 1)) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                {Math.min(((inStock || 0) / (totalItems || 1) * 100), 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {inStock || 0}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                {lowStock || 0}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {outOfStock || 0}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Barcode Coverage</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(((stats.withBarcode || 0) / (totalItems || 1)) * 100, 100)}%` }}
                />
                <div 
                  className="bg-gray-400 h-full transition-all duration-500"
                  style={{ width: `${Math.min(((stats.withoutBarcode || 0) / (totalItems || 1)) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                {Math.min(((stats.withBarcode || 0) / (totalItems || 1) * 100), 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
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

          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Profitability</p>
            <div className="flex items-center gap-4 mt-1">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {stats.profitMargin !== undefined ? `${Math.min(stats.profitMargin, 100).toFixed(1)}%` : 'N/A'}
                </p>
                <p className="text-xs text-gray-400">Margin</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {stats.potentialProfit !== undefined ? formatCurrency(stats.potentialProfit) : 'N/A'}
                </p>
                <p className="text-xs text-gray-400">Potential Profit</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Category Breakdown (optional) */}
      {showDetailed && stats.categories && stats.categories.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-400" />
            Category Breakdown
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {stats.categories.slice(0, 8).map((cat, index) => (
              <div key={index} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <span className="text-gray-600 dark:text-gray-300 truncate flex-1 mr-2">{cat.category}</span>
                <span className="text-gray-500 dark:text-gray-400 font-medium">{cat.count}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Last Updated Timestamp */}
      <div className="text-right text-xs text-gray-400 dark:text-gray-500">
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
}

// ============================================
// EXPORT HELPERS
// ============================================

export default InventoryStats;

// Hook for using inventory stats
export function useInventoryStats(stats: InventoryStatsData) {
  const getStockHealth = useCallback(() => {
    const total = typeof stats.totalItems === 'number' ? stats.totalItems : 1;
    const inStock = typeof stats.inStock === 'number' ? stats.inStock : 0;
    const lowStock = typeof stats.lowStock === 'number' ? stats.lowStock : 0;
    const outOfStock = typeof stats.outOfStock === 'number' ? stats.outOfStock : 0;
    
    return {
      inStock: inStock / total,
      lowStock: lowStock / total,
      outOfStock: outOfStock / total,
      health: (inStock / total) * 100,
    };
  }, [stats]);

  const getBarcodeCoverage = useCallback(() => {
    const total = typeof stats.totalItems === 'number' ? stats.totalItems : 1;
    const withBarcode = typeof stats.withBarcode === 'number' ? stats.withBarcode : 0;
    const withoutBarcode = typeof stats.withoutBarcode === 'number' ? stats.withoutBarcode : 0;
    
    return {
      withBarcode: withBarcode / total,
      withoutBarcode: withoutBarcode / total,
      coverage: (withBarcode / total) * 100,
    };
  }, [stats]);

  const getProfitability = useCallback(() => {
    return {
      margin: typeof stats.profitMargin === 'number' ? stats.profitMargin : 0,
      potentialProfit: typeof stats.potentialProfit === 'number' ? stats.potentialProfit : 0,
      totalValue: typeof stats.totalValue === 'number' ? stats.totalValue : 0,
      totalCost: typeof stats.totalCost === 'number' ? stats.totalCost : 0,
    };
  }, [stats]);

  return {
    getStockHealth,
    getBarcodeCoverage,
    getProfitability,
    totalItems: typeof stats.totalItems === 'number' ? stats.totalItems : 0,
    totalValue: typeof stats.totalValue === 'number' ? stats.totalValue : 0,
    lowStock: typeof stats.lowStock === 'number' ? stats.lowStock : 0,
    outOfStock: typeof stats.outOfStock === 'number' ? stats.outOfStock : 0,
  };
}
