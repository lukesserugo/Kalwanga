// src/components/RealTimeNotifications.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { realtimeClient } from '../../backend/src/services/realtimeClient';
import { BellIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
}

interface RealtimeData {
  title?: string;
  message?: string;
  type?: string;
  lowStock?: boolean;
  quantity?: number;
  reorderPoint?: number;
  productName?: string;
}

interface SaleData {
  id?: string;
  receiptNumber?: string;
  total?: number;
}

export default function RealTimeNotifications() {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Subscribe to real-time notifications
  useEffect(() => {
    realtimeClient.subscribe('NOTIFICATION', (data: RealtimeData) => {
      const notification: ToastNotification = {
        id: `toast-${Date.now()}`,
        title: data.title || 'Notification',
        message: data.message || '',
        type: (data.type?.toLowerCase() as ToastNotification['type']) || 'info',
        timestamp: new Date(),
      };
      setNotifications(prev => [notification, ...prev].slice(0, 10));
      setUnreadCount(prev => prev + 1);
    });

    realtimeClient.subscribe('SALE_CREATED', (sale: SaleData) => {
      const notification: ToastNotification = {
        id: `sale-${sale.id || Date.now()}`,
        title: 'New Sale',
        message: `Receipt #${sale.receiptNumber} - $${sale.total}`,
        type: 'success',
        timestamp: new Date(),
      };
      setNotifications(prev => [notification, ...prev].slice(0, 10));
      setUnreadCount(prev => prev + 1);
    });

    realtimeClient.subscribe('INVENTORY_UPDATED', (data: RealtimeData) => {
      if (data?.lowStock || (data?.quantity !== undefined && data?.reorderPoint !== undefined && data.quantity <= data.reorderPoint)) {
        const notification: ToastNotification = {
          id: `inventory-${Date.now()}`,
          title: 'Low Stock Alert',
          message: data.productName || 'Item is running low',
          type: 'warning',
          timestamp: new Date(),
        };
        setNotifications(prev => [notification, ...prev].slice(0, 10));
        setUnreadCount(prev => prev + 1);
      }
    });

    return () => {
      realtimeClient.disconnect();
    };
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      info: 'bg-primary-50 border-primary-200 text-primary-700 dark:bg-primary-950/30 dark:border-primary-900 dark:text-primary-300',
      success: 'bg-success-50 border-success-200 text-success-700 dark:bg-success-950/30 dark:border-success-900 dark:text-success-300',
      warning: 'bg-warning-50 border-warning-200 text-warning-700 dark:bg-warning-950/30 dark:border-warning-900 dark:text-warning-300',
      error: 'bg-danger-50 border-danger-200 text-danger-700 dark:bg-danger-950/30 dark:border-danger-900 dark:text-danger-300',
    };
    return colors[type] || colors.info;
  };

  // Toast notifications
  const visibleToasts = notifications.slice(0, 3);

  return (
    <>
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-toast space-y-2 max-w-sm">
        {visibleToasts.map((notification) => (
          <div
            key={notification.id}
            className={`${getTypeColor(notification.type)} border rounded-xl shadow-soft p-3 flex items-start gap-3 animate-slide-down`}
          >
            <BellIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">{notification.title}</p>
              <p className="text-2xs opacity-75 mt-0.5">{notification.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(notification.id)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-250 focus-ring rounded"
              aria-label={`Dismiss ${notification.title}`}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Notification Bell */}
      <button
        type="button"
        onClick={() => {
          setShowDropdown(!showDropdown);
          markAllRead();
        }}
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-250 focus-ring"
        title="Notifications"
        aria-label="Notifications"
      >
        <BellIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 min-w-4 h-4 px-1 bg-danger-500 text-white text-2xs rounded-full flex items-center justify-center tabular-nums animate-badge-pop">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 z-modal">
          <div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
            <button
              type="button"
              onClick={markAllRead}
              className="text-2xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition-colors duration-250 focus-ring rounded"
            >
              <CheckIcon className="w-4 h-4" />
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-2xs text-gray-500 dark:text-gray-400 py-8">No notifications</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-250"
                >
                  <p className="font-medium text-sm text-gray-900 dark:text-white">{notification.title}</p>
                  <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5">{notification.message}</p>
                  <p className="text-2xs text-gray-400 dark:text-gray-500 mt-1 tabular-nums">
                    {notification.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
