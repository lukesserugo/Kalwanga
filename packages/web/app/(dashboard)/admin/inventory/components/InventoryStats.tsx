// D:\Projects\Kalwanga\packages\web\app\(dashboard)\inventory\components\InventoryStats.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Package, DollarSign, AlertTriangle, AlertCircle,
  TrendingUp, TrendingDown, BarChart3, Users
} from 'lucide-react';
import { formatCurrency } from '../../../../../utils/formatters';

interface InventoryStatsProps {
  stats: {
    totalItems: number;
    totalValue: number;
    lowStock: number;
    outOfStock: number;
    totalCategories?: number;
    totalSuppliers?: number;
  };
}

const statCards = [
  {
    key: 'totalItems',
    label: 'Total Items',
    icon: Package,
    color: 'blue',
    formatter: (val: number) => val.toLocaleString(),
  },
  {
    key: 'totalValue',
    label: 'Total Value',
    icon: DollarSign,
    color: 'green',
    formatter: (val: number) => formatCurrency(val),
  },
  {
    key: 'lowStock',
    label: 'Low Stock',
    icon: AlertTriangle,
    color: 'yellow',
    formatter: (val: number) => val.toString(),
  },
  {
    key: 'outOfStock',
    label: 'Out of Stock',
    icon: AlertCircle,
    color: 'red',
    formatter: (val: number) => val.toString(),
  },
];

export function InventoryStats({ stats }: InventoryStatsProps) {
  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; iconBg: string }> = {
      blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/30' },
      green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', iconBg: 'bg-green-100 dark:bg-green-900/30' },
      yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', iconBg: 'bg-yellow-100 dark:bg-yellow-900/30' },
      red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-100 dark:bg-red-900/30' },
      purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-100 dark:bg-purple-900/30' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((card, index) => {
        const value = stats[card.key as keyof typeof stats] || 0;
        const colors = getColorClasses(card.color);
        const Icon = card.icon;

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`${colors.bg} rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                <p className={`text-2xl font-bold ${colors.text}`}>
                  {card.formatter(value)}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${colors.iconBg}`}>
                <Icon className={`w-6 h-6 ${colors.text}`} />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
