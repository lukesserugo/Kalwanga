// D:\Projects\Kalwanga\packages\web\components\notifications\ConnectionStatusPill.tsx

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import type { StreamStatus } from '../../hooks/useNotificationStream';

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
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning-50 dark:bg-warning-900/30 border border-warning-200 dark:border-warning-800 text-warning-800 dark:text-warning-300 text-xs font-medium z-fab shadow-soft"
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
              className="ml-1 inline-flex items-center gap-1 text-warning-900 dark:text-warning-200 hover:underline font-semibold transition duration-250 focus-ring rounded"
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
      ? 'bg-success-500'
      : status === 'connecting' || status === 'reconnecting'
      ? 'bg-warning-500'
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
      className="inline-flex items-center gap-1.5 text-2xs font-medium text-gray-500 dark:text-gray-400"
      title={`Stream: ${label}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
