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

interface UseNotificationOptions {
  autoFetch?: boolean;
  limit?: number;
  refreshInterval?: number;
}

export function useNotification(options: UseNotificationOptions = {}) {
  const {
    autoFetch = true,
    limit = 20,
    refreshInterval = 60_000, // ✅ 60 seconds — was 30s, still fine
  } = options;

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
  const mountedRef = useRef(true);

  // ✅ Track mounted state to avoid setState after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ============================================
  // FETCHERS — stable, no external state deps
  // ============================================

  /**
   * Load a page of notifications.
   * @param pageOverride  optional page number (defaults to current `page`)
   * @param unreadOnly    optional filter
   *
   * NOTE: `page` is read via a ref-free pattern: we pass it in as an argument
   * so this callback can have a stable identity and not cause loops.
   */
  const loadNotifications = useCallback(
    async (pageOverride?: number, unreadOnly?: boolean) => {
      try {
        if (mountedRef.current) {
          setLoading(true);
          setError(null);
        }

        const targetPage = pageOverride ?? 1;
        const params: any = { limit, page: targetPage };
        if (unreadOnly) params.unreadOnly = 'true';

        const response = await notificationService.getNotifications(params);

        if (!mountedRef.current) return [];

        // Normalize response
        let notificationData: Notification[] = [];
        let totalCount = 0;
        let currentPage = targetPage;
        let totalPagesCount = 1;

        if (Array.isArray(response)) {
          notificationData = response;
          totalCount = response.length;
        } else if (response && typeof response === 'object') {
          const r: any = response;
          if (Array.isArray(r.data)) {
            notificationData = r.data;
          } else if (Array.isArray(r.notifications)) {
            notificationData = r.notifications;
          }
          if (typeof r.total === 'number') totalCount = r.total;
          if (typeof r.page === 'number') currentPage = r.page;
          if (typeof r.totalPages === 'number') totalPagesCount = r.totalPages;
        }

        setNotifications(notificationData);
        setTotal(totalCount || notificationData.length);
        setPage(currentPage);
        setTotalPages(totalPagesCount);

        // Update unread count from the list if server didn't send a total
        const computedUnread = notificationData.filter((n) => !n.isRead).length;
        setUnreadCount((prev) =>
          totalCount ? computedUnread : Math.max(prev, computedUnread)
        );

        return notificationData;
      } catch (err: any) {
        console.error('Failed to load notifications:', err);
        if (mountedRef.current) {
          setError(err?.message || 'Failed to load notifications');
        }
        return [];
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [limit] // ✅ only depends on `limit` — that's a primitive prop
  );

  /**
   * Fetch just the unread count.
   * This MUST have zero state dependencies to avoid re-subscribing the interval.
   */
  const fetchUnreadCount = useCallback(async (): Promise<number> => {
    try {
      const response: any = await notificationService.getUnreadCount();

      let count = 0;
      if (typeof response === 'number') {
        count = response;
      } else if (response && typeof response === 'object') {
        if (typeof response.count === 'number') {
          count = response.count;
        } else if (typeof response.data === 'number') {
          count = response.data;
        } else if (response.data && typeof response.data.count === 'number') {
          count = response.data.count;
        }
      }

      if (mountedRef.current) setUnreadCount(count);
      return count;
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
      return 0; // ✅ never return `unreadCount` (that would create a dependency)
    }
  }, []); // ✅ NO dependencies

  // ============================================
  // MUTATIONS
  // ============================================

  const markAsRead = useCallback(async (id: string) => {
    try {
      setMarkingId(id);
      await notificationService.markAsRead(id);

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      return true;
    } catch (err) {
      console.error('Failed to mark as read:', err);
      throw err;
    } finally {
      setMarkingId(null);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      return true;
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      throw err;
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      setDeletingId(id);
      const deleted = notifications.find((n) => n.id === id);
      await notificationService.deleteNotification(id);

      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (deleted && !deleted.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      return true;
    } catch (err) {
      console.error('Failed to delete notification:', err);
      throw err;
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
    } catch (err) {
      console.error('Failed to delete all notifications:', err);
      throw err;
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadNotifications(1);
    await fetchUnreadCount();
  }, [loadNotifications, fetchUnreadCount]);

  // ============================================
  // EFFECTS
  // ============================================

  // ✅ Initial fetch — runs once on mount
  useEffect(() => {
    if (!autoFetch) return;
    loadNotifications(1);
    fetchUnreadCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  // ✅ Polling interval — stable identity, only depends on primitives
  useEffect(() => {
    if (!autoFetch || refreshInterval <= 0) return;

    intervalRef.current = setInterval(() => {
      fetchUnreadCount();
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoFetch, refreshInterval, fetchUnreadCount]);

  // ============================================
  // RETURN
  // ============================================

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
