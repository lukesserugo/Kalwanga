// packages/web/hooks/useToast.ts

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast, type Toast as ManagerToast } from '../utils/toast-manager';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<ManagerToast[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe((next) => setToasts(next));
    return unsubscribe;
  }, []);

  // Stable for the lifetime of the component (and of the app, since
  // `toast` is a module-level singleton).
  const showToast = useCallback(
    (
      message: string,
      type: Toast['type'] = 'info',
      duration?: number
    ): string => {
      const options = duration !== undefined ? { duration } : undefined;
      switch (type) {
        case 'success':
          return toast.success(message, options);
        case 'error':
          return toast.error(message, options);
        case 'warning':
          return toast.warning(message, options);
        case 'info':
        default:
          return toast.info(message, options);
      }
    },
    [] // ← empty: never recreated
  );

  const removeToast = useCallback((id: string) => toast.dismiss(id), []);
  const clearToasts = useCallback(() => toast.clearAll(), []);

  // Memoize the returned object so destructuring doesn't churn
  // references for callers that pass it around.
  return useMemo(
    () => ({
      toasts: toasts as unknown as Toast[],
      showToast,
      removeToast,
      clearToasts,
    }),
    [toasts, showToast, removeToast, clearToasts]
  );
}

export default useToast;
