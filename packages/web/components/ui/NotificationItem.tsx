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
  SALE: 'text-green-600 dark:text-green-400',
  INVENTORY: 'text-orange-600 dark:text-orange-400',
  ORDER: 'text-blue-600 dark:text-blue-400',
  PAYMENT: 'text-purple-600 dark:text-purple-400',
  CUSTOMER: 'text-indigo-600 dark:text-indigo-400',
  SYSTEM: 'text-gray-600 dark:text-gray-400',
  ALERT: 'text-red-600 dark:text-red-400',
  SUCCESS: 'text-green-600 dark:text-green-400',
  INFO: 'text-blue-600 dark:text-blue-400',
  WARNING: 'text-yellow-600 dark:text-yellow-400',
  ERROR: 'text-red-600 dark:text-red-400',
};

const typeBgColors: Record<string, string> = {
  SALE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  INVENTORY: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  ORDER: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  PAYMENT: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  CUSTOMER: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  SYSTEM: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
  ALERT: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  SUCCESS: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  INFO: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  WARNING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  ERROR: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
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
        bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all hover:shadow-md
        ${isRead
          ? 'border-gray-100 dark:border-gray-700'
          : 'border-l-4 border-l-blue-500 border-gray-200 dark:border-gray-700'
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
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBg}`}>
                {typeLabel}
              </span>
              {!isRead && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
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
                onClick={handleClick}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1"
              >
                View Details →
              </button>
            )}

            {/* Timestamps */}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(createdAt).toLocaleString()}
              </p>
              {readAt && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
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
              onClick={() => onMarkAsRead(id)}
              disabled={isMarking}
              className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
              title="Mark as read"
            >
              {isMarking ? (
                <div className="animate-spin h-5 w-5 border-2 border-green-600 dark:border-green-400 border-t-transparent rounded-full"></div>
              ) : (
                <CheckIcon className="w-5 h-5" />
              )}
            </button>
          )}
          <button
            onClick={() => onDelete(id)}
            disabled={isDeleting}
            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
            title="Delete"
          >
            {isDeleting ? (
              <div className="animate-spin h-5 w-5 border-2 border-red-600 dark:border-red-400 border-t-transparent rounded-full"></div>
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
