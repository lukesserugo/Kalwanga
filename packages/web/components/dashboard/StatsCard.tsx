'use client';

import React, { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?:
    | 'blue'
    | 'green'
    | 'purple'
    | 'indigo'
    | 'orange'
    | 'red'
    | 'yellow'
    | 'pink'
    | 'teal'
    | 'cyan'
    | 'gray'
    | 'white';
  className?: string;
}

const colorClasses: Record<NonNullable<StatsCardProps['color']>, string> = {
  blue:
    'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400',
  green:
    'bg-success-50 text-success-600 dark:bg-success-900/20 dark:text-success-400',
  purple:
    'bg-secondary-50 text-secondary-600 dark:bg-secondary-900/20 dark:text-secondary-400',
  indigo:
    'bg-secondary-50 text-secondary-600 dark:bg-secondary-900/20 dark:text-secondary-400',
  orange:
    'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400',
  red:
    'bg-danger-50 text-danger-600 dark:bg-danger-900/20 dark:text-danger-400',
  yellow:
    'bg-warning-50 text-warning-600 dark:bg-warning-900/20 dark:text-warning-400',
  pink:
    'bg-brand-accent-50 text-brand-accent-600 dark:bg-brand-accent-900/20 dark:text-brand-accent-400',
  teal:
    'bg-success-50 text-success-600 dark:bg-success-900/20 dark:text-success-400',
  cyan:
    'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400',
  gray:
    'bg-gray-50 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  white:
    'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const trendClasses = {
  up: 'text-success-600 dark:text-success-400',
  down: 'text-danger-600 dark:text-danger-400',
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
  className = '',
}: StatsCardProps) {
  const colorClass = colorClasses[color] || colorClasses.blue;
  const trendClass = trendClasses[trend] || trendClasses.neutral;
  const trendIcon = trendIcons[trend] || trendIcons.neutral;

  return (
    <div className={`card-brand !p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </p>
        <div className={`p-2 rounded-lg ${colorClass}`}>{icon}</div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {value}
          </p>
          {subtitle && (
            <p className="text-2xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
              {subtitle}
            </p>
          )}
        </div>
        {trend && trend !== 'neutral' && (
          <div
            className={`flex items-center gap-1 ${trendClass} text-sm font-medium`}
          >
            <span>{trendIcon}</span>
            <span>{trend === 'up' ? 'Positive' : 'Negative'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatsCard;
