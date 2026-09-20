// D:\Projects\Kalwanga\packages\web\components\ui\NotificationItem.tsx

'use client';

import React from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  BellIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

export interface NotificationItemProps {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
  link?: string;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onView?: (id: string) => void;
  isMarking?: boolean;
  isDeleting?: boolean;
}

const icons: Record<string, React.ComponentType<any>> = {
  SUCCESS: CheckCircleIcon,
  ERROR: ExclamationCircleIcon,
  WARNING: ExclamationTriangleIcon,
  ALERT: ExclamationCircleIcon,
  INFO: InformationCircleIcon,
  SALE: BellIcon,
  INVENTORY: BellIcon,
  ORDER: BellIcon,
  PAYMENT: BellIcon,
  CUSTOMER: BellIcon,
  SYSTEM: BellIcon,
};

const typeColors: Record<string, string> = {
  SALE: 'text-success-600 dark:text-success-400',
  INVENTORY: 'text-brand-600 dark:text-brand-400',
  ORDER: 'text-primary-600 dark:text-primary-400',
  PAYMENT: 'text-secondary-600 dark:text-secondary-400',
  CUSTOMER: 'text-primary-700 dark:text-primary-300',
  SYSTEM: 'text-gray-600 dark:text-gray-400',
  ALERT: 'text-danger-600 dark:text-danger-400',
  SUCCESS: 'text-success-600 dark:text-success-400',
  INFO: 'text-primary-600 dark:text-primary-400',
  WARNING: 'text-warning-600 dark:text-warning-400',
  ERROR: 'text-danger-600 dark:text-danger-400',
};

const typeBgColors: Record<string, string> = {
  SALE: 'bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-300',
  INVENTORY: 'bg-brand-100 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300',
  ORDER: 'bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300',
  PAYMENT: 'bg-secondary-100 dark:bg-secondary-950/40 text-secondary-700 dark:text-secondary-300',
  CUSTOMER: 'bg-primary-100 dark:bg-primary-950/40 text-primary-800 dark:text-primary-200',
  SYSTEM: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
  ALERT: 'bg-danger-100 dark:bg-danger-950/40 text-danger-700 dark:text-danger-300',
  SUCCESS: 'bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-300',
  INFO: 'bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300',
  WARNING: 'bg-warning-100 dark:bg-warning-950/40 text-warning-700 dark:text-warning-300',
  ERROR: 'bg-danger-100 dark:bg-danger-950/40 text-danger-700 dark:text-danger-300',
};

const typeLabels: Record<string, string> = {
  SALE: 'Sale',
  INVENTORY: 'Inventory',
  ORDER: 'Order',
  PAYMENT: 'Payment',
  CUSTOMER: 'Customer',
  SYSTEM: 'System',
  ALERT: 'Alert',
  SUCCESS: 'Success',
  INFO: 'Info',
  WARNING: 'Warning',
  ERROR: 'Error',
};

export function NotificationItem({
  id,
  title,
  message,
  type,
  isRead,
  createdAt,
  readAt,
  link,
  onMarkAsRead,
  onDelete,
  onView,
  isMarking = false,
  isDeleting = false,
}: NotificationItemProps) {
  const Icon = icons[type] || BellIcon;
  const typeColor = typeColors[type] || 'text-gray-600 dark:text-gray-400';
  const typeBg = typeBgColors[type] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400';
  const typeLabel = typeLabels[type] || type;

  const handleClick = () => {
    if (link) {
      window.location.href = link;
    }
    if (onView) {
      onView(id);
    }
    if (!isRead) {
      onMarkAsRead(id);
    }
  };

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-xl shadow-soft border transition-all duration-250 hover:shadow-card-hover
        ${isRead
          ? 'border-gray-100 dark:border-gray-700'
          : 'border-l-4 border-l-brand-500 border-gray-200 dark:border-gray-700'
        }
      `}
    >
      <div className="p-4 flex items-start justify-between gap-4">
        {/* Left: Icon + Content */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`mt-0.5 flex-shrink-0 ${typeColor}`}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-medium truncate ${isRead ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                {title}
              </p>
              <span className={`px-2 py-0.5 rounded-full text-2xs font-medium ${typeBg}`}>
                {typeLabel}
              </span>
              {!isRead && (
                <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-brand-100 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300">
                  New
                </span>
              )}
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
              {message}
            </p>

            {/* Link */}
            {link && (
              <button
                type="button"
                onClick={handleClick}
                className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline mt-1 transition-colors duration-250 focus-ring rounded"
              >
                View Details →
              </button>
            )}

            {/* Timestamps */}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <p className="text-2xs text-gray-400 dark:text-gray-500 tabular-nums">
                {new Date(createdAt).toLocaleString()}
              </p>
              {readAt && (
                <p className="text-2xs text-gray-400 dark:text-gray-500 tabular-nums">
                  Read: {new Date(readAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-start gap-1 flex-shrink-0">
          {!isRead && (
            <button
              type="button"
              onClick={() => onMarkAsRead(id)}
              disabled={isMarking}
              className="p-2 text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-950/30 rounded-lg transition-colors duration-250 disabled:opacity-50 focus-ring"
              title="Mark as read"
              aria-label={`Mark "${title}" as read`}
            >
              {isMarking ? (
                <div className="animate-spin h-5 w-5 border-2 border-success-600 dark:border-success-400 border-t-transparent rounded-full"></div>
              ) : (
                <CheckIcon className="w-5 h-5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(id)}
            disabled={isDeleting}
            className="p-2 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/30 rounded-lg transition-colors duration-250 disabled:opacity-50 focus-ring"
            title="Delete"
            aria-label={`Delete "${title}"`}
          >
            {isDeleting ? (
              <div className="animate-spin h-5 w-5 border-2 border-danger-600 dark:border-danger-400 border-t-transparent rounded-full"></div>
            ) : (
              <XMarkIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotificationItem;
