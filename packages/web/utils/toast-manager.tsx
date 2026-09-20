'use client';

import { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  className?: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  onClick?: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  position: string;
  className?: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  onClick?: () => void;
  createdAt: number;
  isVisible: boolean;
}

class ToastManager {
  private listeners: ((toasts: Toast[]) => void)[] = [];
  private toasts: Toast[] = [];
  private idCounter = 0;
  private defaultDuration = 5000;
  private defaultPosition: ToastOptions['position'] = 'top-right';
  private maxToasts = 5;

  subscribe(listener: (toasts: Toast[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.toasts));
  }

  private addToast(
    message: string,
    type: ToastType,
    options?: ToastOptions,
    icon?: React.ReactNode
  ) {
    const id = String(++this.idCounter);
    // FIXED: Use defaultPosition as fallback when options?.position is undefined
    const position: string = options?.position || this.defaultPosition || 'top-right';
    
    const toast: Toast = {
      id,
      message,
      type,
      duration: options?.duration || this.defaultDuration,
      position: position,
      className: options?.className,
      icon: icon || this.getDefaultIcon(type),
      onClose: options?.onClose,
      onClick: options?.onClick,
      createdAt: Date.now(),
      isVisible: true,
    };

    if (this.toasts.length >= this.maxToasts) {
      this.toasts = this.toasts.slice(1);
    }

    this.toasts = [...this.toasts, toast];
    this.notify();

    if (toast.duration > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, toast.duration);
    }

    return id;
  }

  private removeToast(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }

  clearAll() {
    this.toasts = [];
    this.notify();
  }

  clearByType(type: ToastType) {
    this.toasts = this.toasts.filter(t => t.type !== type);
    this.notify();
  }

  private getDefaultIcon(type: ToastType): React.ReactNode {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  }

  success(message: string, options?: ToastOptions) {
    return this.addToast(message, 'success', options);
  }

  error(message: string, options?: ToastOptions) {
    return this.addToast(message, 'error', options);
  }

  warning(message: string, options?: ToastOptions) {
    return this.addToast(message, 'warning', options);
  }

  info(message: string, options?: ToastOptions) {
    return this.addToast(message, 'info', options);
  }

  custom(message: string, type: ToastType = 'info', options?: ToastOptions) {
    return this.addToast(message, type, options);
  }

  async promise<T>(
    promise: Promise<T>,
    {
      loading = 'Loading...',
      success = 'Success!',
      error = 'Something went wrong',
    }: {
      loading?: string;
      success?: string | ((data: T) => string);
      error?: string | ((err: any) => string);
    } = {}
  ): Promise<T> {
    const toastId = this.addToast(loading, 'info', { duration: 0 });
    
    try {
      const result = await promise;
      const successMessage = typeof success === 'function' ? success(result) : success;
      this.updateToast(toastId, {
        message: successMessage,
        type: 'success',
        duration: this.defaultDuration,
      });
      return result;
    } catch (err) {
      const errorMessage = typeof error === 'function' ? error(err) : error;
      this.updateToast(toastId, {
        message: errorMessage,
        type: 'error',
        duration: this.defaultDuration,
      });
      throw err;
    }
  }

  updateToast(
    id: string,
    updates: Partial<Omit<Toast, 'id' | 'createdAt'>>
  ) {
    this.toasts = this.toasts.map(toast =>
      toast.id === id ? { ...toast, ...updates } : toast
    );
    this.notify();
  }

  dismiss(id: string) {
    this.removeToast(id);
  }

  setDefaultDuration(duration: number) {
    this.defaultDuration = duration;
  }

  setDefaultPosition(position: ToastOptions['position']) {
    this.defaultPosition = position;
  }

  setMaxToasts(max: number) {
    this.maxToasts = max;
  }

  getToasts(): Toast[] {
    return this.toasts;
  }

  getToast(id: string): Toast | undefined {
    return this.toasts.find(t => t.id === id);
  }
}

export const toast = new ToastManager();

// ============================================
// TOAST CONTAINER COMPONENT
// ============================================

interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export function ToastContainer({ position = 'top-right' }: ToastContainerProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe((newToasts) => {
      setToasts(newToasts.filter(t => t.position === position || !t.position));
    });

    return unsubscribe;
  }, [position]);

  const getPositionClasses = (pos: string): string => {
    const positions: Record<string, string> = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'top-center': 'top-4 left-1/2 -translate-x-1/2',
      'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    };
    return positions[pos] || positions['top-right'];
  };

  const getTypeStyles = (type: ToastType): string => {
    const styles: Record<ToastType, string> = {
      success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
      error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
      warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
      info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    };
    return styles[type];
  };

  const getIconStyles = (type: ToastType): string => {
    const styles: Record<ToastType, string> = {
      success: 'text-green-500 dark:text-green-400',
      error: 'text-red-500 dark:text-red-400',
      warning: 'text-yellow-500 dark:text-yellow-400',
      info: 'text-blue-500 dark:text-blue-400',
    };
    return styles[type];
  };

  if (toasts.length === 0) return null;

  return (
    <div className={`fixed z-50 space-y-2 ${getPositionClasses(position)}`}>
      {toasts.map((toastItem) => (
        <div
          key={toastItem.id}
          className={`
            flex items-start gap-3 p-4 rounded-lg shadow-lg border
            ${getTypeStyles(toastItem.type)}
            ${toastItem.className || ''}
            min-w-[300px] max-w-[500px]
            animate-slide-up
          `}
          onClick={toastItem.onClick}
        >
          <span className={`text-lg ${getIconStyles(toastItem.type)}`}>
            {toastItem.icon}
          </span>
          <div className="flex-1">
            <p className="text-sm">{toastItem.message}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (toastItem.onClose) toastItem.onClose();
              toast.dismiss(toastItem.id);
            }}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================
// HOOKS
// ============================================

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe((newToasts) => {
      setToasts(newToasts);
    });

    return unsubscribe;
  }, []);

  return {
    toasts,
    success: toast.success.bind(toast),
    error: toast.error.bind(toast),
    warning: toast.warning.bind(toast),
    info: toast.info.bind(toast),
    custom: toast.custom.bind(toast),
    promise: toast.promise.bind(toast),
    dismiss: toast.dismiss.bind(toast),
    clearAll: toast.clearAll.bind(toast),
    clearByType: toast.clearByType.bind(toast),
  };
}

// ============================================
// COMPATIBILITY EXPORT
// ============================================

export type ToastCompatType = 'success' | 'error' | 'warning' | 'info';

/**
 * Legacy-compatible showToast. Drop-in replacement for the
 * hand-rolled hook that used to live in hooks/useToast.ts.
 */
export const showToast = (
  message: string,
  type: ToastCompatType = 'info',
  duration?: number
): string => {
  const options: ToastOptions = duration !== undefined ? { duration } : {};
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
};
export default toast;
