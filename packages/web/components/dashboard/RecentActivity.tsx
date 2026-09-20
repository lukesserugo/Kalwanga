'use client';

import React from 'react';
import {
  Bell,
  ShoppingBag,
  Package,
  User,
  AlertTriangle,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface Activity {
  id: string;
  type:
    | 'sale'
    | 'order'
    | 'customer'
    | 'inventory'
    | 'payment'
    | 'alert'
    | 'system';
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  priority?: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

interface RecentActivityProps {
  activities: Activity[];
  limit?: number;
  className?: string;
  onViewAll?: () => void;
  onActivityClick?: (activity: Activity) => void;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'sale':
      return <ShoppingBag className="w-5 h-5 text-success-500" />;
    case 'order':
      return <Package className="w-5 h-5 text-brand-500" />;
    case 'customer':
      return <User className="w-5 h-5 text-secondary-500" />;
    case 'inventory':
      return <Package className="w-5 h-5 text-brand-500" />;
    case 'payment':
      return <CheckCircle className="w-5 h-5 text-success-500" />;
    case 'alert':
      return <AlertTriangle className="w-5 h-5 text-danger-500" />;
    case 'system':
      return <Bell className="w-5 h-5 text-gray-500" />;
    default:
      return <Bell className="w-5 h-5 text-gray-500" />;
  }
};

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'high':
      return 'border-l-4 border-danger-500';
    case 'medium':
      return 'border-l-4 border-warning-500';
    case 'low':
      return 'border-l-4 border-success-500';
    default:
      return '';
  }
};

const getTimeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

export function RecentActivity({
  activities,
  limit = 5,
  className = '',
  onViewAll,
  onActivityClick,
}: RecentActivityProps) {
  const displayActivities = activities.slice(0, limit);

  return (
    <div className={`card-brand !p-5 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recent Activity
        </h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors focus-ring rounded"
          >
            View All
          </button>
        )}
      </div>
      <div className="space-y-3">
        {displayActivities.map((activity) => (
          <div
            key={activity.id}
            onClick={() => onActivityClick && onActivityClick(activity)}
            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
              activity.isRead
                ? 'hover:bg-orange-50 dark:hover:bg-gray-700/50'
                : 'bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/30'
            } ${getPriorityColor(activity.priority)} ${
              onActivityClick ? 'cursor-pointer focus-ring' : ''
            }`}
          >
            <div className="p-2 rounded-full bg-white dark:bg-gray-700 shadow-sm flex-shrink-0">
              {getIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {activity.title}
                </p>
                <span className="text-2xs text-gray-500 dark:text-gray-400 flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3" />
                  {getTimeAgo(activity.timestamp)}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {activity.description}
              </p>
              {activity.priority === 'high' && (
                <div className="mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-danger-500" />
                  <span className="text-2xs text-danger-600 dark:text-danger-400 font-medium">
                    High Priority
                  </span>
                </div>
              )}
            </div>
            {!activity.isRead && (
              <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0 mt-1" />
            )}
          </div>
        ))}
        {displayActivities.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p>No recent activity</p>
            <p className="text-sm">Your activity will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecentActivity;
