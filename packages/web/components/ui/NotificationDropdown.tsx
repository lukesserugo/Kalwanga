// D:\Projects\Kalwanga\packages\web\components\ui\NotificationDropdown.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BellIcon } from '@heroicons/react/24/outline';
// ✅ FIX: Import Notification type from the service
import { notificationService, Notification } from '../../services/notificationService';
import { NotificationItem } from './NotificationItem';
import { toast } from '../../utils/toast-manager';

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const result = await notificationService.getNotifications({ limit: 5 });
      setNotifications(result.data);
      setUnreadCount(result.data.filter((n: Notification) => !n.isRead).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      setMarkingId(id);
      await notificationService.markAsRead(id);
      await fetchNotifications();
      toast.success('Notification marked as read');
    } catch (error) {
      toast.error('Failed to mark as read');
    } finally {
      setMarkingId(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      await fetchNotifications();
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      setDeletingId(id);
      await notificationService.deleteNotification(id);
      await fetchNotifications();
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-250 focus-ring"
        aria-label="Notifications"
      >
        <BellIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center bg-danger-500 text-white text-2xs font-bold rounded-full tabular-nums animate-badge-pop">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 overflow-hidden z-modal">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-2xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline transition-colors duration-250 focus-ring rounded"
                >
                  Mark all as read
                </button>
              )}
              <Link
                href="/notifications"
                className="text-2xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline transition-colors duration-250 focus-ring rounded"
              >
                View all
              </Link>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-brand-500 dark:border-brand-400 border-t-transparent rounded-full"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <BellIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-2xs text-gray-500 dark:text-gray-400">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    id={notification.id}
                    title={notification.title}
                    message={notification.message}
                    type={notification.type}
                    isRead={notification.isRead}
                    createdAt={notification.createdAt}
                    readAt={notification.readAt || null}
                    link={notification.link}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                    isMarking={markingId === notification.id}
                    isDeleting={deletingId === notification.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-center">
              <Link
                href="/notifications"
                className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline transition-colors duration-250 focus-ring rounded"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;
