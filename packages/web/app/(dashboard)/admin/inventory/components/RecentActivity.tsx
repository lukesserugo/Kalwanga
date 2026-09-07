// D:\Projects\Kalwanga\packages\web\app\(dashboard)\inventory\components\RecentActivity.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, TrendingUp, TrendingDown, RefreshCw,
  Package, User, Calendar, ArrowRight
} from 'lucide-react';
import { inventoryService } from '../../../../../services/inventoryService';
import { formatDate } from '../../../../../utils/formatters';
import { useRouter } from 'next/navigation';

interface RecentActivityProps {
  businessUnitId: string;
}

export function RecentActivity({ businessUnitId }: RecentActivityProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    loadActivities();
  }, [businessUnitId]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const response = await inventoryService.getInventoryTransactions({
        businessUnitId,
        limit: 5,
      });
      setActivities(response.data || []);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'PURCHASE':
      case 'RESTOCK':
      case 'ADJUSTMENT_IN':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'SALE':
      case 'ISSUE':
      case 'ADJUSTMENT_OUT':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <RefreshCw className="w-4 h-4 text-blue-500" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'PURCHASE':
      case 'RESTOCK':
      case 'ADJUSTMENT_IN':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'SALE':
      case 'ISSUE':
      case 'ADJUSTMENT_OUT':
        return 'bg-red-50 dark:bg-red-900/20';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20';
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        </div>
        <button
          onClick={() => router.push('/inventory/transactions')}
          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View All
        </button>
      </div>

      <div className="space-y-3">
        {activities.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
            No recent activity
          </div>
        ) : (
          activities.map((activity, index) => (
            <motion.div
              key={activity.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-start gap-3 p-3 rounded-lg ${getActivityColor(activity.transactionType)} transition-colors hover:shadow-sm`}
            >
              <div className="p-1.5 rounded-full bg-white dark:bg-gray-700 shadow-sm">
                {getActivityIcon(activity.transactionType)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {activity.product?.name || 'Unknown Product'}
                  </p>
                  <span className={`text-sm font-medium ${
                    activity.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {activity.quantity > 0 ? '+' : ''}{activity.quantity}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  <span className="capitalize">{activity.transactionType?.replace('_', ' ') || 'Unknown'}</span>
                  <span>•</span>
                  <span>{formatDate(activity.createdAt)}</span>
                  {activity.user && (
                    <>
                      <span>•</span>
                      <span>by {activity.user.firstName} {activity.user.lastName}</span>
                    </>
                  )}
                </div>
                {activity.notes && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{activity.notes}</p>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Quick Stats */}
      {activities.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Today</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {activities.filter(a => new Date(a.createdAt).toDateString() === new Date().toDateString()).length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">This Week</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {activities.filter(a => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return new Date(a.createdAt) >= weekAgo;
                }).length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{activities.length}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
