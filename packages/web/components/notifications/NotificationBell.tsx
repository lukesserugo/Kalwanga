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

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preview, setPreview] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleStreamNotification = useCallback(
    (notification: Notification) => {
      setUnreadCount((c) => c + 1);
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
      setUnreadCount(res ?? 0);
    } catch {
      // Silent.
    }
  }, []);

  const refreshPreview = useCallback(async () => {
    try {
      setLoading(true);
      const result = await notificationService.getNotifications({
        page: 1,
        limit: MAX_PREVIEW,
        unreadOnly: true,
      });
      setPreview(result.data);
      if (typeof result.unreadCount === 'number') {
        setUnreadCount(result.unreadCount);
      }
    } catch {
      // Silent.
    } finally {
      setLoading(false);
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
      setPreview((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      toast.error('Failed to mark as read');
    } finally {
      setWorkingId(null);
    }
  }, []);

  const handleMarkAll = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setPreview([]);
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  }, []);

  const badgeText = useMemo(() => {
    if (unreadCount === 0) return null;
    return unreadCount > 99 ? '99+' : String(unreadCount);
  }, [unreadCount]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums shadow-md">
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
            className="absolute right-0 top-12 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
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
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                  />
                </button>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAll}
                    className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {loading && preview.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              ) : preview.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/40 mb-3">
                    <Inbox className="w-6 h-6 text-orange-500" />
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
                      className="group relative hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <Link
                        href={n.link || '/admin/notifications'}
                        className="block px-4 py-3"
                        onClick={() => setOpen(false)}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-1.5 inline-block w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {n.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
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
                        className="absolute top-3 right-3 p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all disabled:opacity-50"
                        title="Mark as read"
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
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors border-r border-gray-100 dark:border-gray-800"
              >
                View all
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/notifications/settings"
                onClick={() => setOpen(false)}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Settings
              </Link>
            </div>

            {streamStatus === 'disconnected' && (
              <button
                type="button"
                onClick={reconnect}
                className="w-full text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 py-1.5 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
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
