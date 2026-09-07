// D:\Projects\Kalwanga\packages\web\components\dashboard\RecentActivity.tsx
'use client';

import React from 'react';
import { Bell, ShoppingBag, Package, User, AlertTriangle, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface Activity {
  id: string;
  type: 'sale' | 'order' | 'customer' | 'inventory' | 'payment' | 'alert' | 'system';
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
      return <ShoppingBag className="w-5 h-5 text-green-500" />;
    case 'order':
      return <Package className="w-5 h-5 text-blue-500" />;
    case 'customer':
      return <User className="w-5 h-5 text-purple-500" />;
    case 'inventory':
      return <Package className="w-5 h-5 text-orange-500" />;
    case 'payment':
      return <CheckCircle className="w-5 h-5 text-teal-500" />;
    case 'alert':
      return <AlertTriangle className="w-5 h-5 text-red-500" />;
    case 'system':
      return <Bell className="w-5 h-5 text-gray-500" />;
    default:
      return <Bell className="w-5 h-5 text-gray-500" />;
  }
};

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'high':
      return 'border-l-4 border-red-500';
    case 'medium':
      return 'border-l-4 border-yellow-500';
    case 'low':
      return 'border-l-4 border-green-500';
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
  onActivityClick 
}: RecentActivityProps) {
  const displayActivities = activities.slice(0, limit);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        {onViewAll && (
          <button 
            onClick={onViewAll}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
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
                ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50' 
                : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
            } ${getPriorityColor(activity.priority)} ${onActivityClick ? 'cursor-pointer' : ''}`}
          >
            <div className="p-2 rounded-full bg-white dark:bg-gray-700 shadow-sm flex-shrink-0">
              {getIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {activity.title}
                </p>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {getTimeAgo(activity.timestamp)}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {activity.description}
              </p>
              {activity.priority === 'high' && (
                <div className="mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">High Priority</span>
                </div>
              )}
            </div>
            {!activity.isRead && (
              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></div>
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
