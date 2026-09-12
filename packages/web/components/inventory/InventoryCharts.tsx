// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryCharts.tsx

'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, DollarSign, TrendingUp, TrendingDown, 
  AlertTriangle, CheckCircle, BarChart3, PieChart,
  Tag, Building, Clock, Users, Star, Globe,
  AlertCircle, TrendingUp as TrendingUpIcon,
  ShoppingCart, Truck, Warehouse, Zap
} from 'lucide-react';
import { formatCurrency, formatNumber } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

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

// ============================================
// HELPER FUNCTIONS
// ============================================

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

// ============================================
// SUB-COMPONENTS
// ============================================

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo' | 'teal' | 'orange' | 'pink' | 'gray';
  subtext?: string;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
}> = ({ label, value, icon: Icon, color, subtext, trend }) => {
  const colorClasses: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/30' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', iconBg: 'bg-green-100 dark:bg-green-900/30' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', iconBg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-100 dark:bg-red-900/30' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-100 dark:bg-purple-900/30' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400', iconBg: 'bg-teal-100 dark:bg-teal-900/30' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-100 dark:bg-orange-900/30' },
    pink: { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-600 dark:text-pink-400', iconBg: 'bg-pink-100 dark:bg-pink-900/30' },
    gray: { bg: 'bg-gray-50 dark:bg-gray-800/50', text: 'text-gray-600 dark:text-gray-400', iconBg: 'bg-gray-100 dark:bg-gray-700/50' },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${colors.bg} rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${colors.text} mt-1`}>{value}</p>
          {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-600' : 'text-gray-400'}`}>
              {trend.direction === 'up' && <TrendingUpIcon className="w-3 h-3" />}
              {trend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
              <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
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

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-24"></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="animate-pulse">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-64"></div>
        </div>
        <div className="animate-pulse">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-64"></div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function InventoryCharts({ 
  data = [], 
  stats, 
  loading = false,
  className = ''
}: InventoryChartsProps) {
  // Calculate category distribution
  const categoryData = useMemo(() => {
    const distribution = data.reduce((acc: Record<string, { count: number; value: number; cost: number }>, item) => {
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
    }, {});

    return Object.entries(distribution)
      .map(([name, data]) => ({ 
        name, 
        count: data.count, 
        value: data.value, 
        cost: data.cost,
        profit: data.value - data.cost
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [data]);

  // Calculate location distribution
  const locationData = useMemo(() => {
    const distribution = data.reduce((acc: Record<string, { count: number; value: number }>, item) => {
      const location = item.location || 'Warehouse';
      const quantity = item.quantity || item.stock || 0;
      const price = item.price || item.unitPrice || 0;
      
      if (!acc[location]) {
        acc[location] = { count: 0, value: 0 };
      }
      acc[location].count += quantity;
      acc[location].value += quantity * price;
      return acc;
    }, {});

    return Object.entries(distribution)
      .map(([name, data]) => ({ name, count: data.count, value: data.value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [data]);

  // Calculate supplier distribution
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
  const totalCost = data.reduce((sum, item) => sum + (item.costPrice || 0) * (item.quantity || item.stock || 0), 0);
  const totalProfit = totalValue - totalCost;
  const maxCategoryCount = Math.max(...categoryData.map(c => c.count), 1);
  const maxLocationCount = Math.max(...locationData.map(l => l.count), 1);
  const maxSupplierCount = Math.max(...supplierData.map(s => s.count), 1);

  const stockHealth = {
    inStock: data.filter(item => (item.quantity || item.stock || 0) > 0).length,
    lowStock: data.filter(item => {
      const quantity = item.quantity || item.stock || 0;
      const reorderPoint = item.reorderPoint || item.minStock || 5;
      return quantity > 0 && quantity <= reorderPoint;
    }).length,
    outOfStock: data.filter(item => (item.quantity || item.stock || 0) === 0).length,
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (data.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No data available</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Add inventory items to see charts and analytics</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Quick Stats */}
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
          subtext={`${((stockHealth.lowStock / (totalItems || 1)) * 100).toFixed(1)}% of inventory`}
        />
        <StatCard
          label="Out of Stock"
          value={stats.outOfStock || stockHealth.outOfStock}
          icon={AlertCircle}
          color="red"
          subtext={`${((stockHealth.outOfStock / (totalItems || 1)) * 100).toFixed(1)}% of inventory`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-500" />
              Category Distribution
            </h3>
            <span className="text-xs text-gray-400">{categoryData.length} categories</span>
          </div>
          {categoryData.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No category data available</p>
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
                      <span className="text-gray-600 dark:text-gray-400 truncate">{category.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">{category.count} units</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(category.value)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-blue-600 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((category.count / maxCategoryCount) * 100, 100)}%` }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                    />
                  </div>
                  {category.profit > 0 && (
                    <div className="text-xs text-green-500 mt-0.5">
                      Profit: {formatCurrency(category.profit)}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Stock Health */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              Stock Health
            </h3>
            <span className="text-xs text-gray-400">{totalItems} total items</span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">In Stock</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {stockHealth.inStock} ({((stockHealth.inStock / (totalItems || 1)) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-green-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((stockHealth.inStock / (totalItems || 1)) * 100, 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Low Stock</span>
                <span className="font-medium text-yellow-600 dark:text-yellow-400">
                  {stockHealth.lowStock} ({((stockHealth.lowStock / (totalItems || 1)) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-yellow-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((stockHealth.lowStock / (totalItems || 1)) * 100, 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Out of Stock</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  {stockHealth.outOfStock} ({((stockHealth.outOfStock / (totalItems || 1)) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-red-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((stockHealth.outOfStock / (totalItems || 1)) * 100, 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>

          {/* Health Score */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Overall Health Score</span>
              <span className={`text-lg font-bold ${
                (stockHealth.inStock / (totalItems || 1)) > 0.7 ? 'text-green-600' :
                (stockHealth.inStock / (totalItems || 1)) > 0.4 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {Math.round((stockHealth.inStock / (totalItems || 1)) * 100)}%
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  (stockHealth.inStock / (totalItems || 1)) > 0.7 ? 'bg-green-500' :
                  (stockHealth.inStock / (totalItems || 1)) > 0.4 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((stockHealth.inStock / (totalItems || 1)) * 100, 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        {/* Location Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-orange-500" />
              Location Distribution
            </h3>
            <span className="text-xs text-gray-400">{locationData.length} locations</span>
          </div>
          {locationData.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No location data available</p>
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
                    <span className="text-gray-600 dark:text-gray-400 truncate">{location.name}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">{location.count} units</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(location.value)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-orange-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((location.count / maxLocationCount) * 100, 100)}%` }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Supplier Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-500" />
              Top Suppliers
            </h3>
            <span className="text-xs text-gray-400">{supplierData.length} suppliers</span>
          </div>
          {supplierData.length === 0 || (supplierData.length === 1 && supplierData[0].name === 'Unknown') ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No supplier data available</p>
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
                    <span className="text-gray-600 dark:text-gray-400 truncate">{supplier.name}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{supplier.count} units</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((supplier.count / maxSupplierCount) * 100, 100)}%` }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg Price per Item</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(stats.avgPrice || (totalValue / (totalItems || 1)))}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <TrendingDown className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg Cost per Item</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(stats.avgCost || (totalCost / (totalItems || 1)))}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <TrendingUpIcon className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Profit</p>
              <p className={`font-semibold ${totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(totalProfit)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Items per Category</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {(totalItems / (categoryData.length || 1)).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EXPORT
// ============================================

export default InventoryCharts;
