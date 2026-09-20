// D:\Projects\Kalwanga\packages\web\components\ui\NotificationBadge.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { notificationService } from '../../services/notificationService';

export interface NotificationBadgeProps {
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  refreshInterval?: number;
}

const sizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const badgeSizes = {
  sm: 'min-w-4 h-4 px-1 text-2xs -top-1 -right-1',
  md: 'min-w-5 h-5 px-1 text-2xs -top-1 -right-1',
  lg: 'min-w-6 h-6 px-1.5 text-2xs -top-1.5 -right-1.5',
};

export function NotificationBadge({
  onClick,
  className = '',
  size = 'md',
  showCount = true,
  refreshInterval = 30000,
}: NotificationBadgeProps) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = async () => {
    try {
      const result = await notificationService.getUnreadCount();
      setCount(result.count);
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex items-center justify-center
        rounded-full hover:bg-gray-100 dark:hover:bg-gray-800
        transition-colors duration-250
        focus-ring
        ${sizes[size]}
        ${className}
      `}
      aria-label="Notifications"
    >
      <BellIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      {showCount && count > 0 && !loading && (
        <span
          className={`
            absolute flex items-center justify-center
            bg-danger-500 text-white font-bold rounded-full
            tabular-nums animate-badge-pop
            ${badgeSizes[size]}
          `}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
      {loading && count === 0 && (
        <span
          className={`
            absolute flex items-center justify-center
            bg-gray-300 dark:bg-gray-600 rounded-full
            ${badgeSizes[size]}
          `}
        >
          <span className="animate-pulse">…</span>
        </span>
      )}
    </button>
  );
}

export default NotificationBadge;
