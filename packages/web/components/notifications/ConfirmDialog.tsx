// D:\Projects\Kalwanga\packages\web\components\notifications\ConfirmDialog.tsx

'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Trash2,
  AlertCircle,
  Info,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';

export type ConfirmTone = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const TONE_STYLES: Record<
  ConfirmTone,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconFg: string;
    confirmClass: string;
  }
> = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-danger-100 dark:bg-danger-900/40',
    iconFg: 'text-danger-600 dark:text-danger-400',
    confirmClass:
      'bg-danger-600 hover:bg-danger-700 focus:ring-danger-500/40 text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-warning-100 dark:bg-warning-900/40',
    iconFg: 'text-warning-600 dark:text-warning-400',
    confirmClass:
      'bg-warning-600 hover:bg-warning-700 focus:ring-warning-500/40 text-white',
  },
  info: {
    icon: Info,
    iconBg: 'bg-primary-100 dark:bg-primary-900/40',
    iconFg: 'text-primary-600 dark:text-primary-400',
    confirmClass:
      'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500/40 text-white',
  },
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-success-100 dark:bg-success-900/40',
    iconFg: 'text-success-600 dark:text-success-400',
    confirmClass:
      'bg-success-600 hover:bg-success-700 focus:ring-success-500/40 text-white',
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'warning',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const styles = TONE_STYLES[tone];
  const Icon = styles.icon;
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => confirmButtonRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, loading, onCancel]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-modal flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !loading && onCancel()}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-card border border-gray-200 dark:border-gray-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition duration-250 disabled:opacity-50 focus-ring"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-4">
              <span
                className={`inline-flex items-center justify-center w-11 h-11 rounded-2xl shrink-0 ${styles.iconBg} ${styles.iconFg}`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <h2
                  id="confirm-title"
                  className="text-base font-semibold text-gray-900 dark:text-white"
                >
                  {title}
                </h2>
                {description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition duration-250 disabled:opacity-50 focus-ring"
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium shadow-soft focus:outline-none focus:ring-2 transition duration-250 disabled:opacity-50 ${styles.confirmClass}`}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {loading ? 'Working…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
