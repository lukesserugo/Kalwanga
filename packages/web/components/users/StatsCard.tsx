// D:\Projects\Kalwanga\packages\web\components\users\StatsCard.tsx

'use client';

import React from 'react';
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  iconColor?: string;
  change?: number;
  changeLabel?: string;
  subtitle?: string;
  className?: string;
  loading?: boolean;
}

export function StatsCard({
  title,
  value,
  icon,
  iconColor = 'text-blue-600 dark:text-blue-400',
  change,
  changeLabel,
  subtitle,
  className = '',
  loading = false,
}: StatsCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    );
  }

  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          
          {(change !== undefined || subtitle) && (
            <div className="flex items-center gap-2 mt-2">
              {change !== undefined && (
                <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                  isPositive ? 'text-green-600 dark:text-green-400' :
                  isNegative ? 'text-red-600 dark:text-red-400' :
                  'text-gray-500 dark:text-gray-400'
                }`}>
                  {isPositive && <ArrowUp className="w-3 h-3" />}
                  {isNegative && <ArrowDown className="w-3 h-3" />}
                  {Math.abs(change)}%
                </span>
              )}
              {changeLabel && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{changeLabel}</span>
              )}
              {subtitle && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>
              )}
            </div>
          )}
        </div>
        
        <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-700 ${iconColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default StatsCard;
