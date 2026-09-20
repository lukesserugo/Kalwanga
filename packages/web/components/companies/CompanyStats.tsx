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
  Building,
  Calendar,
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
  /** Timestamp the stats were fetched. Defaults to now. */
  updatedAt?: string | Date;
  isLoading?: boolean;
}

// ============================================================
// Currency formatting helpers (module-level so they don't
// recreate on every render).
// ============================================================

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  KES: 'KSh',
  ZAR: 'R',
  GHS: 'GH₵',
  UGX: 'USh',
  TZS: 'TSh',
  AED: 'د.إ',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  BRL: 'R$',
};

function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] || code || '$';
}

function formatCompactNumber(num: number): string {
  if (!Number.isFinite(num)) return '0';
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toLocaleString();
}

function formatRevenue(num: number, symbol: string): string {
  if (!Number.isFinite(num)) return `${symbol}0`;
  if (Math.abs(num) >= 1_000_000) return `${symbol}${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${symbol}${(num / 1_000).toFixed(1)}K`;
  return `${symbol}${num.toLocaleString()}`;
}

// ============================================================
// Skeleton — matches the real layout so there's no layout shift
// ============================================================
function CompanyStatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
              </div>
              <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded mt-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompanyStats({
  stats,
  currency = 'USD',
  timezone = 'UTC',
  updatedAt,
  isLoading = false,
}: CompanyStatsProps) {
  if (isLoading) {
    return <CompanyStatsSkeleton />;
  }

  const currencySymbol = getCurrencySymbol(currency);

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
      value: formatRevenue(stats.totalRevenue || 0, currencySymbol),
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

  // Format the updated timestamp using the timezone prop
  const formattedTimestamp = (() => {
    const date = updatedAt ? new Date(updatedAt) : new Date();
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
      }).format(date);
    } catch {
      // Invalid timezone → fall back to local
      return date.toLocaleString();
    }
  })();

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${card.borderColor} p-4 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {card.value}
                  </p>
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
                <span className="font-medium text-gray-900 dark:text-white">
                  {stats.totalBusinessUnits}
                </span>{' '}
                Business Units
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">
                  {stats.totalUsers}
                </span>{' '}
                Users
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">
                  {stats.totalProducts}
                </span>{' '}
                Products
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">
                  {stats.totalSales}
                </span>{' '}
                Sales
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatRevenue(stats.totalRevenue, currencySymbol)}
                </span>{' '}
                Revenue
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Updated: {formattedTimestamp} • {timezone}
            </span>
          </div>
        </div>
      </div>

      {/* Derived Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
            Quick Stats
          </h4>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Total Customers
              </p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-200">
                {stats.totalCustomers}
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Total Suppliers
              </p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-200">
                {stats.totalSuppliers}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-xl border border-green-200 dark:border-green-800 p-4">
          <h4 className="text-sm font-medium text-green-800 dark:text-green-300">
            Revenue Breakdown
          </h4>
          <div className="mt-2">
            <p className="text-xs text-green-600 dark:text-green-400">
              Average Revenue per Sale
            </p>
            <p className="text-lg font-bold text-green-900 dark:text-green-200">
              {stats.totalSales > 0
                ? formatRevenue(
                    stats.totalRevenue / stats.totalSales,
                    currencySymbol
                  )
                : formatRevenue(0, currencySymbol)}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
          <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300">
            Business Growth
          </h4>
          <div className="mt-2">
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Revenue per Business Unit
            </p>
            <p className="text-lg font-bold text-purple-900 dark:text-purple-200">
              {stats.totalBusinessUnits > 0
                ? formatRevenue(
                    stats.totalRevenue / stats.totalBusinessUnits,
                    currencySymbol
                  )
                : formatRevenue(0, currencySymbol)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanyStats;
