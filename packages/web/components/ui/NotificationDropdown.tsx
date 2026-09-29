// packages/web/components/ui/NotificationDropdown.tsx

'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { BellIcon } from '@heroicons/react/24/outline';

import {
  notificationService,
  type Notification,
} from '../../services/notificationService';
import { NotificationItem } from './NotificationItem';
import { toast } from '../../utils/toast-manager';

// ============================================
// HELPERS
// ============================================

/**
 * Normalize the response from `notificationService.getNotifications`
 * into a plain array.
 *
 * The service is a thin wrapper over `api.get<T>` and may return:
 *
 *   1. `Notification[]`                    — the payload directly
 *   2. `{ data: Notification[] }`          — a wrapped envelope
 *   3. `{ items: Notification[] }`         — a paginated variant
 *   4. `{ notifications: Notification[] }` — a legacy shape
 *
 * The component previously assumed shape (2) and would crash with
 * `Cannot read property 'filter' of undefined` if the service
 * returned (1) — which is what every other service in the codebase
 * does. This helper handles all four without throwing.
 */
function normalizeNotificationList(raw: unknown): Notification[] {
  if (Array.isArray(raw)) return raw as Notification[];

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Notification[];
    if (Array.isArray(obj.items)) return obj.items as Notification[];
    if (Array.isArray(obj.notifications)) {
      return obj.notifications as Notification[];
    }
  }

  return [];
}

/**
 * Extract a numeric unread count from whatever
 * `getUnreadCount()` returns.
 *
 * Handles `number`, `{ count }`, and `{ data: { count } }` — the
 * same shapes the header's unread-count fetch handles.
 */
function extractUnreadCount(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.count === 'number') return obj.count;
    if (obj.data && typeof obj.data === 'object') {
      const inner = obj.data as Record<string, unknown>;
      if (typeof inner.count === 'number') return inner.count;
    }
  }
  return 0;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const anyErr = error as any;
  const data = anyErr?.response?.data;

  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: any) => `${e.field ?? 'field'}: ${e.message ?? 'invalid'}`)
        .join(', ');
    }
  }

  if (anyErr?.message) return String(anyErr.message);
  return fallback;
}

// ============================================
// COMPONENT
// ============================================

const DROPDOWN_PAGE_SIZE = 5;

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);
  const markingInFlightRef = useRef(false);
  const deletingInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ============================================
  // FETCHES
  // ============================================

  /**
   * Fetch the badge count. Cheap — no list payload — so it's safe
   * to call on mount and after every mutation.
   *
   * The count is NOT derived from the first N notifications: a user
   * with 20 unread notifications whose 5 most recent ones happen to
   * be read would otherwise see a badge of 0. `getUnreadCount()`
   * returns the true count across all pages.
   */
  const fetchUnreadCount = useCallback(async () => {
    try {
      const raw = await notificationService.getUnreadCount();
      if (!mountedRef.current) return;
      setUnreadCount(extractUnreadCount(raw));
    } catch (error) {
      // Best-effort. The badge is decorative; a failure here
      // doesn't affect the dropdown's list fetch.
      console.warn(
        '[NotificationDropdown] unread count fetch failed:',
        extractErrorMessage(error, 'unknown'),
      );
    }
  }, []);

  /**
   * Fetch the visible list. Only called when the dropdown is open
   * (and after a mutation that changes the list). Not called on
   * mount — the badge count is what matters when the dropdown is
   * closed.
   */
  const fetchNotifications = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);
    setLoadError(null);

    try {
      const raw = await notificationService.getNotifications({
        limit: DROPDOWN_PAGE_SIZE,
      });

      if (requestId !== fetchRequestIdRef.current) return;
      if (!mountedRef.current) return;

      setNotifications(normalizeNotificationList(raw));
    } catch (error) {
      if (requestId !== fetchRequestIdRef.current) return;
      if (!mountedRef.current) return;

      const message = extractErrorMessage(
        error,
        'Failed to load notifications',
      );
      console.error('[NotificationDropdown] fetch failed:', message);
      setLoadError(message);
      setNotifications([]);
    } finally {
      if (requestId === fetchRequestIdRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch the unread count once on mount so the badge is populated
  // before the user interacts. The list is lazy — see the effect
  // below.
  useEffect(() => {
    void fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Fetch the list every time the dropdown opens. The list is
  // deliberately not fetched while closed — it would be wasted work
  // on every page navigation.
  useEffect(() => {
    if (!isOpen) return;
    void fetchNotifications();
    // Refresh the count too, in case notifications arrived while
    // the dropdown was closed and the SSE stream (if any) missed
    // them.
    void fetchUnreadCount();
  }, [isOpen, fetchNotifications, fetchUnreadCount]);

  // ============================================
  // CLICK-OUTSIDE + ESCAPE
  // ============================================
  //
  // Only registered while the dropdown is open. When it's closed,
  // there's nothing to close, so a global mousedown listener would
  // fire on every page click for no reason.

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // ============================================
  // MUTATIONS
  // ============================================

  const markAsRead = useCallback(
    async (id: string) => {
      if (markingInFlightRef.current) return;
      markingInFlightRef.current = true;
      setMarkingId(id);

      try {
        await notificationService.markAsRead(id);
        if (!mountedRef.current) return;

        // Refresh both the list (to reflect the read state on the
        // affected row) and the badge count (which changes by one).
        await fetchNotifications();
        await fetchUnreadCount();

        toast.success('Notification marked as read');
      } catch (error) {
        if (!mountedRef.current) return;
        toast.error(
          extractErrorMessage(error, 'Failed to mark as read'),
        );
      } finally {
        markingInFlightRef.current = false;
        if (mountedRef.current) setMarkingId(null);
      }
    },
    [fetchNotifications, fetchUnreadCount],
  );

  const markAllAsRead = useCallback(async () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);

    try {
      await notificationService.markAllAsRead();
      if (!mountedRef.current) return;

      await fetchNotifications();
      await fetchUnreadCount();

      toast.success('All notifications marked as read');
    } catch (error) {
      if (!mountedRef.current) return;
      toast.error(
        extractErrorMessage(error, 'Failed to mark all as read'),
      );
    } finally {
      if (mountedRef.current) setIsMarkingAll(false);
    }
  }, [isMarkingAll, fetchNotifications, fetchUnreadCount]);

  const deleteNotification = useCallback(
    async (id: string) => {
      if (deletingInFlightRef.current) return;
      deletingInFlightRef.current = true;
      setDeletingId(id);

      try {
        await notificationService.deleteNotification(id);
        if (!mountedRef.current) return;

        await fetchNotifications();
        await fetchUnreadCount();

        toast.success('Notification deleted');
      } catch (error) {
        if (!mountedRef.current) return;
        toast.error(
          extractErrorMessage(error, 'Failed to delete notification'),
        );
      } finally {
        deletingInFlightRef.current = false;
        if (mountedRef.current) setDeletingId(null);
      }
    },
    [fetchNotifications, fetchUnreadCount],
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-250 focus-ring"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="notification-dropdown-panel"
      >
        <BellIcon
          className="w-5 h-5 text-gray-600 dark:text-gray-400"
          aria-hidden="true"
        />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center bg-danger-500 text-white text-2xs font-bold rounded-full tabular-nums animate-badge-pop"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          id="notification-dropdown-panel"
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 overflow-hidden z-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
            <div className="flex gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  disabled={isMarkingAll}
                  className="text-2xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline transition-colors duration-250 focus-ring rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isMarkingAll ? 'Marking…' : 'Mark all as read'}
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
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div
                  className="animate-spin h-6 w-6 border-2 border-brand-500 dark:border-brand-400 border-t-transparent rounded-full"
                  aria-hidden="true"
                />
              </div>
            ) : loadError ? (
              <div
                role="alert"
                className="text-center py-8 px-4"
              >
                <BellIcon
                  className="w-12 h-12 text-danger-300 dark:text-danger-700 mx-auto mb-2"
                  aria-hidden="true"
                />
                <p className="text-2xs text-danger-600 dark:text-danger-400 mb-2">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => void fetchNotifications()}
                  className="text-2xs text-brand-600 dark:text-brand-400 hover:underline focus-ring rounded"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <BellIcon
                  className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2"
                  aria-hidden="true"
                />
                <p className="text-2xs text-gray-500 dark:text-gray-400">
                  No notifications
                </p>
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
                    readAt={notification.readAt ?? null}
                    link={notification.link ?? undefined}
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
