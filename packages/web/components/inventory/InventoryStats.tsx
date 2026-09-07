'use client';

import React from 'react';
import { Package, DollarSign, AlertTriangle, Bell } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

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

export function InventoryStats({ stats }: InventoryStatsProps) {
  const cards = [
    {
      title: 'Total Items',
      value: stats.totalItems,
      icon: Package,
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Total Value',
      value: formatCurrency(stats.totalValue),
      icon: DollarSign,
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    },
    {
      title: 'Low Stock',
      value: stats.lowStock,
      icon: Bell,
      color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    },
    {
      title: 'Out of Stock',
      value: stats.outOfStock,
      icon: AlertTriangle,
      color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.title} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
