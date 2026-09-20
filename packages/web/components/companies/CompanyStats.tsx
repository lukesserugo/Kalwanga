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
  updatedAt?: string | Date;
  isLoading?: boolean;
}

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
  if (Math.abs(num) >= 1_000_000)
    return `${symbol}${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${symbol}${(num / 1_000).toFixed(1)}K`;
  return `${symbol}${num.toLocaleString()}`;
}

function CompanyStatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="card-brand !p-4">
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

      <div className="card-brand !p-4">
        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card-brand !p-4">
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
      color: 'text-brand-600 dark:text-brand-400',
      bg: 'bg-brand-50 dark:bg-brand-900/30',
      borderColor: 'border-brand-200 dark:border-brand-800',
    },
    {
      label: 'Users',
      value: stats.totalUsers || 0,
      icon: Users,
      color: 'text-success-600 dark:text-success-400',
      bg: 'bg-success-50 dark:bg-success-900/30',
      borderColor: 'border-success-200 dark:border-success-800',
    },
    {
      label: 'Products',
      value: stats.totalProducts || 0,
      icon: Package,
      color: 'text-secondary-600 dark:text-secondary-400',
      bg: 'bg-secondary-50 dark:bg-secondary-900/30',
      borderColor: 'border-secondary-200 dark:border-secondary-800',
    },
    {
      label: 'Sales',
      value: stats.totalSales || 0,
      icon: ShoppingBag,
      color: 'text-brand-600 dark:text-brand-400',
      bg: 'bg-brand-50 dark:bg-brand-900/30',
      borderColor: 'border-brand-200 dark:border-brand-800',
    },
    {
      label: 'Revenue',
      value: formatRevenue(stats.totalRevenue || 0, currencySymbol),
      icon: DollarSign,
      color: 'text-warning-600 dark:text-warning-400',
      bg: 'bg-warning-50 dark:bg-warning-900/30',
      borderColor: 'border-warning-200 dark:border-warning-800',
    },
    {
      label: 'Customers',
      value: stats.totalCustomers || 0,
      icon: UserPlus,
      color: 'text-brand-accent-600 dark:text-brand-accent-400',
      bg: 'bg-brand-accent-50 dark:bg-brand-accent-900/30',
      borderColor: 'border-brand-accent-200 dark:border-brand-accent-800',
    },
    {
      label: 'Suppliers',
      value: stats.totalSuppliers || 0,
      icon: Truck,
      color: 'text-secondary-600 dark:text-secondary-400',
      bg: 'bg-secondary-50 dark:bg-secondary-900/30',
      borderColor: 'border-secondary-200 dark:border-secondary-800',
    },
  ];

  const formattedTimestamp = (() => {
    const date = updatedAt ? new Date(updatedAt) : new Date();
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
      }).format(date);
    } catch {
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
              className={`card-brand !p-4 !border ${card.borderColor} hover:shadow-card-hover transition-shadow`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
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
      <div className="card-brand !p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {stats.totalBusinessUnits}
                </span>{' '}
                Business Units
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {stats.totalUsers}
                </span>{' '}
                Users
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {stats.totalProducts}
                </span>{' '}
                Products
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {stats.totalSales}
                </span>{' '}
                Sales
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {formatRevenue(stats.totalRevenue, currencySymbol)}
                </span>{' '}
                Revenue
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-2xs text-gray-400 dark:text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Updated: {formattedTimestamp} • {timezone}
            </span>
          </div>
        </div>
      </div>

      {/* Derived Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-900/10 rounded-2xl border border-brand-200 dark:border-brand-800 p-4">
          <h4 className="text-sm font-medium text-brand-800 dark:text-brand-300">
            Quick Stats
          </h4>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <p className="text-2xs text-brand-600 dark:text-brand-400">
                Total Customers
              </p>
              <p className="text-lg font-bold text-brand-900 dark:text-brand-200 tabular-nums">
                {stats.totalCustomers}
              </p>
            </div>
            <div>
              <p className="text-2xs text-brand-600 dark:text-brand-400">
                Total Suppliers
              </p>
              <p className="text-lg font-bold text-brand-900 dark:text-brand-200 tabular-nums">
                {stats.totalSuppliers}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-success-50 to-success-100 dark:from-success-900/20 dark:to-success-900/10 rounded-2xl border border-success-200 dark:border-success-800 p-4">
          <h4 className="text-sm font-medium text-success-800 dark:text-success-300">
            Revenue Breakdown
          </h4>
          <div className="mt-2">
            <p className="text-2xs text-success-600 dark:text-success-400">
              Average Revenue per Sale
            </p>
            <p className="text-lg font-bold text-success-900 dark:text-success-200 tabular-nums">
              {stats.totalSales > 0
                ? formatRevenue(
                    stats.totalRevenue / stats.totalSales,
                    currencySymbol,
                  )
                : formatRevenue(0, currencySymbol)}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-secondary-50 to-secondary-100 dark:from-secondary-900/20 dark:to-secondary-900/10 rounded-2xl border border-secondary-200 dark:border-secondary-800 p-4">
          <h4 className="text-sm font-medium text-secondary-800 dark:text-secondary-300">
            Business Growth
          </h4>
          <div className="mt-2">
            <p className="text-2xs text-secondary-600 dark:text-secondary-400">
              Revenue per Business Unit
            </p>
            <p className="text-lg font-bold text-secondary-900 dark:text-secondary-200 tabular-nums">
              {stats.totalBusinessUnits > 0
                ? formatRevenue(
                    stats.totalRevenue / stats.totalBusinessUnits,
                    currencySymbol,
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
