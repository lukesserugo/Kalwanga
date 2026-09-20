// D:\Projects\Kalwanga\packages\web\components\notifications\BrowserNotificationPrompt.tsx

'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, AlertTriangle } from 'lucide-react';

const DISMISS_KEY = 'kalwanga.notifications.pushPromptDismissedAt';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Permission = 'default' | 'granted' | 'denied' | 'unsupported';

export function BrowserNotificationPrompt() {
  const [permission, setPermission] = useState<Permission>('default');
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as Permission);

    // Respect dismissal cooldown.
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const withinCooldown =
      dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;

    if (
      Notification.permission === 'default' &&
      !withinCooldown
    ) {
      // Small delay so it doesn't flash on first paint.
      const t = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  const handleEnable = useCallback(async () => {
    if (!('Notification' in window)) return;
    setWorking(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as Permission);
      if (result === 'granted') {
        setVisible(false);
      }
    } finally {
      setWorking(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  if (permission === 'unsupported' || permission === 'granted') {
    return null;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="fixed bottom-6 right-6 z-40 w-80 max-w-[calc(100vw-3rem)] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl p-4"
          role="dialog"
          aria-labelledby="push-prompt-title"
        >
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-md shrink-0">
              <Bell className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3
                id="push-prompt-title"
                className="text-sm font-semibold text-gray-900 dark:text-white"
              >
                Stay in the loop
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Enable browser notifications to get real-time alerts even
                when Kalwanga isn't open.
              </p>
            </div>
          </div>

          {permission === 'denied' && (
            <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                You've blocked notifications. Enable them from your browser's
                site settings.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Not now
            </button>
            {permission !== 'denied' && (
              <button
                type="button"
                onClick={handleEnable}
                disabled={working}
                className="flex-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {working ? 'Enabling…' : 'Enable'}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
