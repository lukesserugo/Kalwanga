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
      info: 'bg-blue-50 border-blue-200 text-blue-600',
      success: 'bg-green-50 border-green-200 text-green-600',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-600',
      error: 'bg-red-50 border-red-200 text-red-600',
    };
    return colors[type] || colors.info;
  };

  // Toast notifications
  const visibleToasts = notifications.slice(0, 3);

  return (
    <>
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {visibleToasts.map((notification) => (
          <div
            key={notification.id}
            className={`${getTypeColor(notification.type)} border rounded-lg shadow-lg p-3 flex items-start gap-3 animate-slide-down`}
          >
            <BellIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">{notification.title}</p>
              <p className="text-xs opacity-75 mt-0.5">{notification.message}</p>
            </div>
            <button
              onClick={() => dismissNotification(notification.id)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Notification Bell */}
      <button
        onClick={() => {
          setShowDropdown(!showDropdown);
          markAllRead();
        }}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        title="Notifications"
      >
        <BellIcon className="w-6 h-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-50">
          <div className="flex justify-between items-center p-3 border-b">
            <h3 className="font-semibold">Notifications</h3>
            <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
              <CheckIcon className="w-4 h-4" />
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No notifications</p>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="p-3 border-b last:border-b-0 hover:bg-gray-50">
                  <p className="font-medium text-sm">{notification.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{notification.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
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
