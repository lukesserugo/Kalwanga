// D:\Projects\Kalwanga\packages\web\app\(dashboard)\inventory\components\InventoryCharts.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, PieChart, TrendingUp, TrendingDown,
  Package, DollarSign, AlertTriangle, Calendar,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatCurrency } from '../../../../../utils/formatters';

interface InventoryChartsProps {
  data: any[];
  stats: {
    totalItems: number;
    totalValue: number;
    lowStock: number;
    outOfStock: number;
  };
}

export function InventoryCharts({ data, stats }: InventoryChartsProps) {
  const [chartType, setChartType] = useState<'value' | 'stock' | 'category'>('value');
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  // Calculate category distribution
  const categoryData = React.useMemo(() => {
    const categories: Record<string, { count: number; value: number }> = {};
    data.forEach(item => {
      const category = item.category || 'Uncategorized';
      if (!categories[category]) {
        categories[category] = { count: 0, value: 0 };
      }
      categories[category].count += item.stock || 0;
      categories[category].value += (item.price || 0) * (item.stock || 0);
    });
    return Object.entries(categories)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [data]);

  // Calculate stock health
  const stockHealth = [
    { label: 'In Stock', value: stats.totalItems - stats.lowStock - stats.outOfStock, color: 'bg-green-500' },
    { label: 'Low Stock', value: stats.lowStock, color: 'bg-yellow-500' },
    { label: 'Out of Stock', value: stats.outOfStock, color: 'bg-red-500' },
  ];

  const maxValue = Math.max(...categoryData.map(d => d.value), 1);
  const maxCount = Math.max(...categoryData.map(d => d.count), 1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Inventory Insights</h3>
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => setChartType('value')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              chartType === 'value' 
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            Value
          </button>
          <button
            onClick={() => setChartType('stock')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              chartType === 'stock' 
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            Stock
          </button>
          <button
            onClick={() => setChartType('category')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              chartType === 'category' 
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            Category
          </button>
        </div>
      </div>

      {/* Chart Content */}
      <div className="space-y-4">
        {chartType === 'category' ? (
          // Category Chart
          <div className="space-y-2">
            {categoryData.map((cat, index) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex justify-between text-sm mb-0.5">
                  <span className="text-gray-600 dark:text-gray-400 truncate">{cat.name}</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formatCurrency(cat.value)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(cat.value / maxValue) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-2 rounded-full bg-gradient-to-r ${
                      index === 0 ? 'from-blue-500 to-blue-600' :
                      index === 1 ? 'from-green-500 to-green-600' :
                      index === 2 ? 'from-yellow-500 to-yellow-600' :
                      index === 3 ? 'from-purple-500 to-purple-600' :
                      index === 4 ? 'from-pink-500 to-pink-600' :
                      'from-gray-500 to-gray-600'
                    }`}
                    style={{ width: `${(cat.value / maxValue) * 100}%` }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          // Stock Health Chart
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex h-4 rounded-full overflow-hidden">
                  {stockHealth.map((item, index) => (
                    <motion.div
                      key={item.label}
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.value / Math.max(stats.totalItems, 1)) * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.1 }}
                      className={`${item.color} h-full`}
                    />
                  ))}
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats.totalItems}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">items</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {stockHealth.map((item) => (
                <div key={item.label} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Categories</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{categoryData.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Value per Item</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {stats.totalItems > 0 ? formatCurrency(stats.totalValue / stats.totalItems) : formatCurrency(0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
