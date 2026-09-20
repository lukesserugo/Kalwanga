// D:\Projects\Kalwanga\packages\web\components\notifications\ConnectionStatusPill.tsx

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import type { StreamStatus } from '../../hooks/notifications/useNotificationStream';

export function ConnectionStatusPill({
  status,
  onRetry,
}: {
  status: StreamStatus;
  onRetry?: () => void;
}) {
  const visible = status === 'reconnecting' || status === 'disconnected';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs font-medium"
          role="status"
        >
          {status === 'reconnecting' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          <span>
            {status === 'reconnecting'
              ? 'Reconnecting…'
              : 'Disconnected'}
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-1 inline-flex items-center gap-1 text-amber-900 dark:text-amber-200 hover:underline font-semibold"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Small dot indicator that can be embedded in headers. */
export function ConnectionStatusDot({
  status,
}: {
  status: StreamStatus;
}) {
  const color =
    status === 'connected'
      ? 'bg-emerald-500'
      : status === 'connecting' || status === 'reconnecting'
      ? 'bg-amber-500'
      : 'bg-gray-400';

  const label =
    status === 'connected'
      ? 'Live'
      : status === 'connecting'
      ? 'Connecting'
      : status === 'reconnecting'
      ? 'Reconnecting'
      : 'Offline';

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400"
      title={`Stream: ${label}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
