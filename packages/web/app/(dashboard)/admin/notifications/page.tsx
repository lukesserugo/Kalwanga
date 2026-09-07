// D:\Projects\Kalwanga\packages\web\app\(dashboard)\notifications\page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../services';
import { toast } from '../../../../utils/toast-manager';
import { 
  BellIcon, 
  CheckIcon, 
  TrashIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  link?: string;
  data?: Record<string, any>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

interface NotificationsResponse {
  data: Notification[];
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
  unreadCount?: number;
}

// ============================================
// HELPERS
// ============================================

const getTypeIcon = (type: string) => {
  const icons: Record<string, React.ComponentType<any>> = {
    SUCCESS: CheckCircleIcon,
    ERROR: ExclamationCircleIcon,
    WARNING: ExclamationTriangleIcon,
    INFO: InformationCircleIcon,
    ALERT: ExclamationCircleIcon,
    SALE: BellIcon,
    INVENTORY: BellIcon,
    ORDER: BellIcon,
    PAYMENT: BellIcon,
    CUSTOMER: BellIcon,
    SYSTEM: BellIcon,
  };
  return icons[type] || BellIcon;
};

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    SALE: 'text-green-600 dark:text-green-400',
    INVENTORY: 'text-orange-600 dark:text-orange-400',
    ORDER: 'text-blue-600 dark:text-blue-400',
    PAYMENT: 'text-purple-600 dark:text-purple-400',
    CUSTOMER: 'text-indigo-600 dark:text-indigo-400',
    SYSTEM: 'text-gray-600 dark:text-gray-400',
    ALERT: 'text-red-600 dark:text-red-400',
    SUCCESS: 'text-green-600 dark:text-green-400',
    INFO: 'text-blue-600 dark:text-blue-400',
    WARNING: 'text-yellow-600 dark:text-yellow-400',
    ERROR: 'text-red-600 dark:text-red-400',
  };
  return colors[type] || 'text-gray-600 dark:text-gray-400';
};

const getTypeBgColor = (type: string) => {
  const colors: Record<string, string> = {
    SALE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    INVENTORY: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    ORDER: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    PAYMENT: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    CUSTOMER: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    SYSTEM: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
    ALERT: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    SUCCESS: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    INFO: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    WARNING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    ERROR: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };
  return colors[type] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400';
};

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    SALE: 'Sale',
    INVENTORY: 'Inventory',
    ORDER: 'Order',
    PAYMENT: 'Payment',
    CUSTOMER: 'Customer',
    SYSTEM: 'System',
    ALERT: 'Alert',
    SUCCESS: 'Success',
    INFO: 'Info',
    WARNING: 'Warning',
    ERROR: 'Error',
  };
  return labels[type] || type;
};

// ============================================
// COMPONENT
// ============================================

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 20 };
      if (unreadOnly) params.unreadOnly = 'true';
      
      const response = await api.get<ApiResponse<NotificationsResponse>>('/notifications', { params });
      
      // Handle different response formats
      let data: Notification[] = [];
      let unread = 0;
      let total = 0;
      let pages = 1;
      
      if (response?.data) {
        if (Array.isArray(response.data)) {
          data = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          data = response.data.data;
          unread = response.data.unreadCount || 0;
          total = response.data.pagination?.total || data.length;
          pages = response.data.pagination?.totalPages || 1;
        }
      }
      
      setNotifications(data);
      setUnreadCount(unread);
      setTotalCount(total);
      setTotalPages(pages);
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error);
      toast.error(error.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      setIsMarking(id);
      await api.put(`/notifications/${id}/read`);
      toast.success('Notification marked as read');
      fetchNotifications();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to mark as read');
    } finally {
      setIsMarking(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      toast.success('All notifications marked as read');
      fetchNotifications();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to mark all as read');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      setIsDeleting(id);
      await api.delete(`/notifications/${id}`);
      toast.success('Notification deleted');
      fetchNotifications();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete notification');
    } finally {
      setIsDeleting(null);
    }
  };

  const deleteAllNotifications = async () => {
    if (!confirm('Delete all notifications? This action cannot be undone.')) return;
    
    try {
      await api.delete('/notifications');
      toast.success('All notifications deleted');
      fetchNotifications();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete all notifications');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              unreadOnly
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {unreadOnly ? 'Showing Unread' : 'Show All'}
          </button>
          {notifications.some(n => !n.isRead) && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 text-sm font-medium transition-colors"
            >
              Mark All as Read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={deleteAllNotifications}
              className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 text-sm font-medium transition-colors"
            >
              Delete All
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {notifications.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <BellIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">No notifications</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">You're all caught up!</p>
        </div>
      ) : (
        <>
          {/* Notification List */}
          <div className="space-y-3">
            {notifications.map((notification) => {
              const Icon = getTypeIcon(notification.type);
              const typeColor = getTypeColor(notification.type);
              const typeBg = getTypeBgColor(notification.type);
              const isUnread = !notification.isRead;
              
              return (
                <div
                  key={notification.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all hover:shadow-md ${
                    isUnread
                      ? 'border-l-4 border-l-blue-500 border-gray-200 dark:border-gray-700'
                      : 'border-gray-100 dark:border-gray-700'
                  }`}
                >
                  <div className="p-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`mt-0.5 flex-shrink-0 ${typeColor}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`font-medium truncate ${isUnread ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                            {notification.title}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBg}`}>
                            {getTypeLabel(notification.type)}
                          </span>
                          {isUnread && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                          {notification.message}
                        </p>
                        {notification.link && (
                          <a
                            href={notification.link}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                          >
                            View Details →
                          </a>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                          {notification.readAt && (
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              Read: {new Date(notification.readAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-1 flex-shrink-0">
                      {isUnread && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          disabled={isMarking === notification.id}
                          className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                          title="Mark as read"
                        >
                          {isMarking === notification.id ? (
                            <div className="animate-spin h-5 w-5 border-2 border-green-600 border-t-transparent rounded-full"></div>
                          ) : (
                            <CheckIcon className="w-5 h-5" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        disabled={isDeleting === notification.id}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {isDeleting === notification.id ? (
                          <div className="animate-spin h-5 w-5 border-2 border-red-600 border-t-transparent rounded-full"></div>
                        ) : (
                          <TrashIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {notifications.length} of {totalCount} notifications
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Notification Stats */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Total:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{totalCount}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Unread:</span>
                <span className="ml-2 font-medium text-blue-600 dark:text-blue-400">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Read:</span>
                <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                  {notifications.filter(n => n.isRead).length}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
