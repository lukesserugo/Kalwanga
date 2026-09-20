'use client';

import { ReactNode } from 'react';
import {
  CurrencyDollarIcon,
  ShoppingBagIcon,
  CubeIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: string;
}

function StatCard({ title, value, icon, trend, color }: StatCardProps) {
  return (
    <div className="card-brand shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
            {value}
          </p>
          {trend && (
            <p
              className={`mt-2 text-sm tabular-nums ${
                trend.isPositive
                  ? 'text-success-600 dark:text-success-400'
                  : 'text-danger-600 dark:text-danger-400'
              }`}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

interface DashboardStatsProps {
  stats: {
    totalSales: number;
    revenue: number;
    products: number;
    customers: number;
  };
  trends?: {
    sales: number;
    revenue: number;
    products: number;
    customers: number;
  };
}

export default function DashboardStats({ stats, trends }: DashboardStatsProps) {
  const statCards = [
    {
      title: 'Total Sales',
      value: stats.totalSales,
      icon: <ShoppingBagIcon className="h-6 w-6 text-white" />,
      color: 'bg-primary-500',
      trend: trends?.sales ? { value: trends.sales, isPositive: trends.sales > 0 } : undefined,
    },
    {
      title: 'Revenue',
      value: `$${stats.revenue.toFixed(2)}`,
      icon: <CurrencyDollarIcon className="h-6 w-6 text-white" />,
      color: 'bg-success-500',
      trend: trends?.revenue ? { value: trends.revenue, isPositive: trends.revenue > 0 } : undefined,
    },
    {
      title: 'Products',
      value: stats.products,
      icon: <CubeIcon className="h-6 w-6 text-white" />,
      color: 'bg-secondary-500',
      trend: trends?.products ? { value: trends.products, isPositive: trends.products > 0 } : undefined,
    },
    {
      title: 'Customers',
      value: stats.customers,
      icon: <UsersIcon className="h-6 w-6 text-white" />,
      color: 'bg-brand-500 shadow-brand',
      trend: trends?.customers ? { value: trends.customers, isPositive: trends.customers > 0 } : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}
