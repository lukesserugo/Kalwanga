'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Package, TrendingUp, TrendingDown, RefreshCw, Loader2 } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { formatDate } from '../../utils/formatters';

interface RecentActivityProps {
  businessUnitId: string;
  limit?: number;
}

export function RecentActivity({ businessUnitId, limit = 10 }: RecentActivityProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [businessUnitId]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getStockMovements({
        businessUnitId,
        limit,
      });
      setActivities(data || []);
    } catch (error) {
      console.error('Failed to load activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'SALE':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'PURCHASE':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'ADJUSTMENT':
        return <RefreshCw className="w-4 h-4 text-blue-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityColor = (quantity: number) => {
    if (quantity > 0) return 'text-green-600 dark:text-green-400';
    if (quantity < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-5">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-blue-500" />
        Recent Activity
      </h3>

      {activities.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-6">No recent activity</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="p-2 bg-white dark:bg-gray-600 rounded-lg flex-shrink-0">
                {getActivityIcon(activity.transactionType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {activity.transactionType}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(activity.createdAt)}
                </p>
              </div>
              <span className={`text-sm font-medium ${getActivityColor(activity.quantity)}`}>
                {activity.quantity > 0 ? '+' : ''}{activity.quantity}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
