// D:\Projects\Kalwanga\packages\web\components\notifications\NotificationBell.tsx

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  CheckCheck,
  Loader2,
  Inbox,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

import { notificationService } from '../../services/notificationService';
import type { Notification } from '../../types/notification';
import { toast } from '../../utils/toast-manager';
import { useNotificationStream } from '../../hooks/useNotificationStream';
import { ConnectionStatusDot } from './ConnectionStatusPill';

const MAX_PREVIEW = 6;

/**
 * Coerce any value into a safe non-negative integer.
 * Defends against `[object Object]` reaching the badge if the API
 * ever changes shape again.
 */
function toSafeCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidate =
      typeof obj.count === 'number'
        ? obj.count
        : typeof obj.unreadCount === 'number'
        ? obj.unreadCount
        : typeof obj.unread === 'number'
        ? obj.unread
        : undefined;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return Math.max(0, Math.floor(candidate));
    }
  }
  return 0;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preview, setPreview] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleStreamNotification = useCallback(
    (notification: Notification) => {
      if (!isMountedRef.current) return;
      if (notification.isRead) return;
      setUnreadCount((c) => toSafeCount(c) + 1);
      setPreview((prev) => [notification, ...prev].slice(0, MAX_PREVIEW));
    },
    [],
  );

  const { status: streamStatus, reconnect } = useNotificationStream({
    onNotification: handleStreamNotification,
  });

  const refreshCount = useCallback(async () => {
    try {
      const res = await notificationService.getUnreadCount();
      if (!isMountedRef.current) return;
      setUnreadCount(toSafeCount(res));
    } catch {
      // Silent — badge just stays at its last known value.
    }
  }, []);

  const refreshPreview = useCallback(async () => {
    try {
      if (isMountedRef.current) setLoading(true);
      const result = await notificationService.getNotifications({
        page: 1,
        limit: MAX_PREVIEW,
        unreadOnly: true,
      });
      if (!isMountedRef.current) return;
      setPreview(result.data);
      if (typeof result.unreadCount === 'number') {
        setUnreadCount(toSafeCount(result.unreadCount));
      }
    } catch {
      // Silent.
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const interval = setInterval(refreshCount, 60_000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  useEffect(() => {
    if (open) void refreshPreview();
  }, [open, refreshPreview]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const handleMarkRead = useCallback(async (id: string) => {
    try {
      setWorkingId(id);
      await notificationService.markAsRead(id);
      if (!isMountedRef.current) return;
      setPreview((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((c) => Math.max(0, toSafeCount(c) - 1));
    } catch {
      toast.error('Failed to mark as read');
    } finally {
      if (isMountedRef.current) setWorkingId(null);
    }
  }, []);

  const handleMarkAll = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      if (!isMountedRef.current) return;
      setPreview([]);
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  }, []);

  const badgeText = useMemo(() => {
    const n = toSafeCount(unreadCount);
    if (n <= 0) return null;
    return n > 99 ? '99+' : String(n);
  }, [unreadCount]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition duration-250 focus-ring"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : 'Notifications'
        }
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" />
        {badgeText && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-gradient text-white text-2xs font-bold flex items-center justify-center tabular-nums shadow-brand animate-badge-pop">
            {badgeText}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-12 z-modal w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-card overflow-hidden"
            role="menu"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Notifications
                </h3>
                <ConnectionStatusDot status={streamStatus} />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void refreshPreview()}
                  disabled={loading}
                  className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition duration-250 disabled:opacity-50 focus-ring"
                  title="Refresh"
                  aria-label="Refresh notifications"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                  />
                </button>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAll}
                    className="p-1.5 rounded-lg text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/30 transition duration-250 focus-ring"
                    title="Mark all as read"
                    aria-label="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {loading && preview.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-gray-400 dark:text-gray-500 animate-spin" />
                </div>
              ) : preview.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/40 mb-3">
                    <Inbox className="w-6 h-6 text-brand-500 dark:text-brand-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    You're all caught up
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    No unread notifications
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {preview.map((n) => (
                    <li
                      key={n.id}
                      className="group relative hover:bg-gray-50 dark:hover:bg-gray-800/50 transition duration-250"
                    >
                      <Link
                        href={n.link || '/admin/notifications'}
                        className="block px-4 py-3"
                        onClick={() => setOpen(false)}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-1.5 inline-block w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {n.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                            <p className="text-2xs tabular-nums text-gray-400 dark:text-gray-500 mt-1">
                              {new Date(n.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          void handleMarkRead(n.id);
                        }}
                        disabled={workingId === n.id}
                        className="absolute top-3 right-3 p-1.5 rounded-lg text-success-600 dark:text-success-400 opacity-0 group-hover:opacity-100 hover:bg-success-50 dark:hover:bg-success-900/30 transition duration-250 disabled:opacity-50 focus-ring"
                        title="Mark as read"
                        aria-label={`Mark "${n.title}" as read`}
                      >
                        {workingId === n.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 flex">
              <Link
                href="/admin/notifications"
                onClick={() => setOpen(false)}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-gray-800 transition duration-250 border-r border-gray-100 dark:border-gray-800 focus-ring"
              >
                View all
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/notifications/settings"
                onClick={() => setOpen(false)}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-250 focus-ring"
              >
                Settings
              </Link>
            </div>

            {streamStatus === 'disconnected' && (
              <button
                type="button"
                onClick={reconnect}
                className="w-full text-2xs text-warning-700 dark:text-warning-300 bg-warning-50 dark:bg-warning-900/30 py-1.5 hover:bg-warning-100 dark:hover:bg-warning-900/50 transition duration-250 focus-ring animate-slide-down"
              >
                Offline — tap to retry
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
