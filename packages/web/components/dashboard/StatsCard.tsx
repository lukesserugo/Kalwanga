// D:\Projects\Kalwanga\packages\web\components\dashboard\StatsCard.tsx
'use client';

import React, { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'purple' | 'indigo' | 'orange' | 'red' | 'yellow' | 'pink' | 'teal' | 'cyan' | 'gray' | 'white';
  className?: string;
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
  pink: 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400',
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400',
  cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400',
  gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  white: 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const trendClasses = {
  up: 'text-green-600 dark:text-green-400',
  down: 'text-red-600 dark:text-red-400',
  neutral: 'text-gray-500 dark:text-gray-400',
};

const trendIcons = {
  up: '↑',
  down: '↓',
  neutral: '→',
};

export function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend = 'neutral',
  color = 'blue',
  className = ''
}: StatsCardProps) {
  const colorClass = colorClasses[color] || colorClasses.blue;
  const trendClass = trendClasses[trend] || trendClasses.neutral;
  const trendIcon = trendIcons[trend] || trendIcons.neutral;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
        <div className={`p-2 rounded-lg ${colorClass}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        {trend && trend !== 'neutral' && (
          <div className={`flex items-center gap-1 ${trendClass} text-sm font-medium`}>
            <span>{trendIcon}</span>
            <span>{trend === 'up' ? 'Positive' : 'Negative'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
