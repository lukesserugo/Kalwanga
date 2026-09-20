// D:\Projects\Kalwanga\packages\web\components\notifications\NotificationDetailDrawer.tsx

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ExternalLink,
  Check,
  Circle,
  Copy,
  Bell,
  Clock,
} from 'lucide-react';
import type { Notification } from '../../types/notification';
import { toast } from '../../utils/toast-manager';

export function NotificationDetailDrawer({
  notification,
  open,
  onClose,
  onMarkRead,
  onMarkUnread,
}: {
  notification: Notification | null;
  open: boolean;
  onClose: () => void;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const handleCopyPayload = () => {
    if (!notification?.data) return;
    try {
      void navigator.clipboard.writeText(
        JSON.stringify(notification.data, null, 2),
      );
      toast.success('Payload copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <AnimatePresence>
      {open && notification && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl flex flex-col h-full"
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shrink-0">
                  <Bell className="w-4 h-4" />
                </span>
                <h2
                  id="drawer-title"
                  className="text-sm font-semibold text-gray-900 dark:text-white truncate"
                >
                  Notification details
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white break-words">
                  {notification.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap break-words">
                  {notification.message}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <Meta label="Type" value={notification.type} />
                <Meta label="Priority" value={notification.priority} />
                <Meta
                  label="Created"
                  value={new Date(notification.createdAt).toLocaleString()}
                />
                {notification.readAt && (
                  <Meta
                    label="Read"
                    value={new Date(notification.readAt).toLocaleString()}
                  />
                )}
              </div>

              {notification.data &&
                Object.keys(notification.data).length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Payload
                      </h4>
                      <button
                        type="button"
                        onClick={handleCopyPayload}
                        className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        Copy JSON
                      </button>
                    </div>
                    <pre className="text-[11px] leading-relaxed bg-gray-50 dark:bg-gray-950 rounded-xl p-3 overflow-x-auto border border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                      {JSON.stringify(notification.data, null, 2)}
                    </pre>
                  </div>
                )}

              {notification.link && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    Related
                  </h4>
                  <Link
                    href={notification.link}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors"
                  >
                    Open related page
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>

            <footer className="border-t border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center gap-2">
              {!notification.isRead && onMarkRead && (
                <button
                  type="button"
                  onClick={() => {
                    onMarkRead(notification.id);
                    onClose();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark as read
                </button>
              )}
              {notification.isRead && onMarkUnread && (
                <button
                  type="button"
                  onClick={() => {
                    onMarkUnread(notification.id);
                    onClose();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <Circle className="w-3.5 h-3.5" />
                  Mark as unread
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <p className="text-xs font-medium text-gray-900 dark:text-white mt-0.5 break-words">
        {value}
      </p>
    </div>
  );
}
