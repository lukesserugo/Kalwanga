'use client';

import React from 'react';
import { Package, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface InventoryChartsProps {
  data: any[];
  stats: {
    totalItems: number;
    totalValue: number;
    lowStock: number;
    outOfStock: number;
    totalCategories?: number;
    totalSuppliers?: number;
  };
}

export function InventoryCharts({ data, stats }: InventoryChartsProps) {
  // Calculate category distribution
  const categoryDistribution = data.reduce((acc: Record<string, number>, item) => {
    const category = item.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const categories = Object.entries(categoryDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxCount = Math.max(...categories.map(([, count]) => count), 1);

  return (
    <div className="space-y-6">
      {/* Category Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Category Distribution</h3>
        {categories.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No data available</p>
        ) : (
          <div className="space-y-3">
            {categories.map(([category, count]) => (
              <div key={category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">{category}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{count} items</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stock Status Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Stock Status</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Total Items</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalItems}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Total Value</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.totalValue)}</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
            <TrendingDown className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Low Stock</p>
            <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{stats.lowStock}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
            <TrendingUp className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Out of Stock</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.outOfStock}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
