// D:\Projects\Kalwanga\packages\web\hooks\useNotification.ts

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationService } from '../services/notificationService';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
  link?: string;
  data?: Record<string, any>;
  userId?: string;
  businessUnitId?: string;
  companyId?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

interface UseNotificationOptions {
  autoFetch?: boolean;
  limit?: number;
  refreshInterval?: number;
}

export function useNotification(options: UseNotificationOptions = {}) {
  const { autoFetch = true, limit = 20, refreshInterval = 30000 } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadNotifications = useCallback(async (unreadOnly?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = { limit, page };
      if (unreadOnly) params.unreadOnly = 'true';
      
      const response = await notificationService.getNotifications(params);
      
      // Extract data from paginated response
      let notificationData: Notification[] = [];
      let totalCount = 0;
      let currentPage = 1;
      let totalPagesCount = 1;
      
      if (Array.isArray(response)) {
        notificationData = response;
        totalCount = response.length;
      } else if (response && typeof response === 'object') {
        // Check if response has data property
        if ('data' in response) {
          const data = response.data;
          if (Array.isArray(data)) {
            notificationData = data;
          }
        }
        // Check for pagination
        if ('total' in response) {
          totalCount = response.total || 0;
        }
        if ('page' in response) {
          currentPage = response.page || 1;
        }
        if ('totalPages' in response) {
          totalPagesCount = response.totalPages || 1;
        }
      }
      
      setNotifications(notificationData);
      setTotal(totalCount || notificationData.length);
      setPage(currentPage);
      setTotalPages(totalPagesCount);
      setUnreadCount(notificationData.filter((n: Notification) => !n.isRead).length);
      
      return notificationData;
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setError(error instanceof Error ? error.message : 'Failed to load notifications');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [limit, page]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await notificationService.getUnreadCount();
      const count = typeof response === 'number' ? response : response?.count || 0;
      setUnreadCount(count);
      return count;
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
      return unreadCount;
    }
  }, [unreadCount]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      setMarkingId(id);
      await notificationService.markAsRead(id);
      
      setNotifications(prev =>
        prev.map(n => 
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      return true;
    } catch (error) {
      console.error('Failed to mark as read:', error);
      throw error;
    } finally {
      setMarkingId(null);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      
      return true;
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      throw error;
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      setDeletingId(id);
      const deleted = notifications.find(n => n.id === id);
      await notificationService.deleteNotification(id);
      
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (deleted && !deleted.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      return true;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      throw error;
    } finally {
      setDeletingId(null);
    }
  }, [notifications]);

  const deleteAllNotifications = useCallback(async () => {
    try {
      await notificationService.deleteAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      return true;
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
      throw error;
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadNotifications();
    await fetchUnreadCount();
  }, [loadNotifications, fetchUnreadCount]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      loadNotifications();
      fetchUnreadCount();
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoFetch, loadNotifications, fetchUnreadCount]);

  // Setup refresh interval
  useEffect(() => {
    if (autoFetch && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchUnreadCount();
      }, refreshInterval);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoFetch, refreshInterval, fetchUnreadCount]);

  return {
    // State
    notifications,
    unreadCount,
    loading,
    error,
    total,
    page,
    totalPages,
    markingId,
    deletingId,
    
    // Actions
    loadNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    refresh,
    setPage,
  };
}

export default useNotification;
