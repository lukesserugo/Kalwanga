// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\companies\components\CompanyStats.tsx

'use client';

import React from 'react';
import { 
  Users, 
  Briefcase, 
  Package, 
  DollarSign, 
  ShoppingBag, 
  UserPlus, 
  Truck,
  TrendingUp,
  Building,
  CreditCard,
  Calendar,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface CompanyStatsProps {
  stats: {
    totalUsers: number;
    totalBusinessUnits: number;
    totalProducts: number;
    totalSales: number;
    totalRevenue: number;
    totalCustomers: number;
    totalSuppliers: number;
  };
  currency?: string;
  timezone?: string;
  isLoading?: boolean;
}

export function CompanyStats({ stats, currency = 'USD', timezone = 'UTC', isLoading = false }: CompanyStatsProps) {
  // Get currency symbol
  const getCurrencySymbol = (code: string): string => {
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'NGN': '₦',
      'KES': 'KSh',
      'ZAR': 'R',
      'GHS': 'GH₵',
      'UGX': 'USh',
      'TZS': 'TSh',
      'AED': 'د.إ',
      'CAD': 'C$',
      'AUD': 'A$',
      'JPY': '¥',
      'CNY': '¥',
      'INR': '₹',
      'BRL': 'R$',
    };
    return symbols[code] || '$';
  };

  const currencySymbol = getCurrencySymbol(currency);

  // Format number with proper formatting
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  // Format revenue with currency
  const formatRevenue = (num: number): string => {
    if (num >= 1000000) {
      return `${currencySymbol}${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${currencySymbol}${(num / 1000).toFixed(1)}K`;
    }
    return `${currencySymbol}${num.toLocaleString()}`;
  };

  // Get trend indicator (mock data - in real app would come from API)
  const getTrend = (label: string): { direction: 'up' | 'down' | 'neutral'; percentage: number } => {
    // This is mock data - in a real app, you'd compare with previous period
    const trends: Record<string, { direction: 'up' | 'down' | 'neutral'; percentage: number }> = {
      'Users': { direction: 'up', percentage: 12 },
      'Revenue': { direction: 'up', percentage: 8.5 },
      'Sales': { direction: 'up', percentage: 15 },
      'Customers': { direction: 'up', percentage: 5 },
      'Business Units': { direction: 'neutral', percentage: 0 },
      'Products': { direction: 'up', percentage: 3.2 },
      'Suppliers': { direction: 'down', percentage: 2.1 },
    };
    return trends[label] || { direction: 'neutral', percentage: 0 };
  };

  const statCards = [
    {
      label: 'Business Units',
      value: stats.totalBusinessUnits || 0,
      icon: Briefcase,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/30',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    {
      label: 'Users',
      value: stats.totalUsers || 0,
      icon: Users,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/30',
      borderColor: 'border-green-200 dark:border-green-800',
    },
    {
      label: 'Products',
      value: stats.totalProducts || 0,
      icon: Package,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/30',
      borderColor: 'border-purple-200 dark:border-purple-800',
    },
    {
      label: 'Sales',
      value: stats.totalSales || 0,
      icon: ShoppingBag,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-900/30',
      borderColor: 'border-orange-200 dark:border-orange-800',
    },
    {
      label: 'Revenue',
      value: formatRevenue(stats.totalRevenue || 0),
      icon: DollarSign,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/30',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
    },
    {
      label: 'Customers',
      value: stats.totalCustomers || 0,
      icon: UserPlus,
      color: 'text-pink-600 dark:text-pink-400',
      bg: 'bg-pink-50 dark:bg-pink-900/30',
      borderColor: 'border-pink-200 dark:border-pink-800',
    },
    {
      label: 'Suppliers',
      value: stats.totalSuppliers || 0,
      icon: Truck,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-900/30',
      borderColor: 'border-indigo-200 dark:border-indigo-800',
    },
  ];

  // Calculate totals
  const totalStats = {
    total: stats.totalUsers + stats.totalCustomers + stats.totalSuppliers,
    revenue: stats.totalRevenue,
    sales: stats.totalSales,
    products: stats.totalProducts,
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded mt-2"></div>
              </div>
              <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const trend = getTrend(card.label);
          const TrendIcon = trend.direction === 'up' ? ArrowUp : trend.direction === 'down' ? ArrowDown : null;

          return (
            <div
              key={card.label}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${card.borderColor} p-4 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                    {trend.direction !== 'neutral' && TrendIcon && (
                      <span className={`text-xs font-medium flex items-center gap-0.5 ${
                        trend.direction === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        <TrendIcon className="w-3 h-3" />
                        {trend.percentage}%
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${card.bg}`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{stats.totalBusinessUnits}</span> Business Units
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{stats.totalUsers}</span> Users
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{stats.totalProducts}</span> Products
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{stats.totalSales}</span> Sales
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{formatRevenue(stats.totalRevenue)}</span> Revenue
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Updated: {new Date().toLocaleDateString()} • {timezone}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">Quick Stats</h4>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <p className="text-xs text-blue-600 dark:text-blue-400">Total Customers</p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-200">{stats.totalCustomers}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 dark:text-blue-400">Total Suppliers</p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-200">{stats.totalSuppliers}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-xl border border-green-200 dark:border-green-800 p-4">
          <h4 className="text-sm font-medium text-green-800 dark:text-green-300">Revenue Breakdown</h4>
          <div className="mt-2">
            <p className="text-xs text-green-600 dark:text-green-400">Average Revenue per Sale</p>
            <p className="text-lg font-bold text-green-900 dark:text-green-200">
              {stats.totalSales > 0 ? formatRevenue(stats.totalRevenue / stats.totalSales) : formatRevenue(0)}
            </p>
          </div>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
          <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300">Business Growth</h4>
          <div className="mt-2">
            <p className="text-xs text-purple-600 dark:text-purple-400">Revenue per Business Unit</p>
            <p className="text-lg font-bold text-purple-900 dark:text-purple-200">
              {stats.totalBusinessUnits > 0 ? formatRevenue(stats.totalRevenue / stats.totalBusinessUnits) : formatRevenue(0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
