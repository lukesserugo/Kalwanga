// D:\Projects\Kalwanga\packages\web\components\users\UserActivityChart.tsx

'use client';

import React from 'react';
import { BarChart3, TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';

interface ActivityData {
  date: string;
  count: number;
  action?: string;
}

interface UserActivityChartProps {
  data: ActivityData[];
  title?: string;
  description?: string;
  total?: number;
  average?: number;
  change?: number;
  loading?: boolean;
  className?: string;
}

export function UserActivityChart({
  data,
  title = 'Activity Overview',
  description = 'User activity over time',
  total,
  average,
  change,
  loading = false,
  className = '',
}: UserActivityChartProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);
  const avgCount = data.length > 0 ? Math.round(totalCount / data.length) : 0;
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <BarChart3 className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {total ?? totalCount}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Average</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {average ?? avgCount}
          </p>
        </div>
        {change !== undefined && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Change</p>
            <p className={`text-xl font-bold flex items-center justify-center gap-1 ${
              isPositive ? 'text-green-600 dark:text-green-400' :
              isNegative ? 'text-red-600 dark:text-red-400' :
              'text-gray-500'
            }`}>
              {isPositive && <TrendingUp className="w-4 h-4" />}
              {isNegative && <TrendingDown className="w-4 h-4" />}
              {change}%
            </p>
          </div>
        )}
      </div>

      {/* Chart Bars */}
      <div className="relative h-48 flex items-end gap-1">
        {data.map((item, index) => {
          const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          const isToday = new Date(item.date).toDateString() === new Date().toDateString();
          
          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div
                className={`w-full rounded-t transition-all duration-300 ${
                  isToday ? 'bg-blue-600 dark:bg-blue-500' : 'bg-blue-400 dark:bg-blue-600'
                }`}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 rotate-45 origin-left">
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Details Panel */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {data.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {new Date(item.date).toLocaleDateString()}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {item.count} activities
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Showing {data.length} days of activity
        </span>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="w-3 h-3" />
          <span>Updated today</span>
        </div>
      </div>
    </div>
  );
}

export default UserActivityChart;
