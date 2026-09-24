// D:\Projects\Kalwanga\packages\web\components\orders\OrderStatusBadge.tsx

'use client';

import React from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Package,
  Undo2,
  PauseCircle,
} from 'lucide-react';
import { OrderStatus } from '../../types/enums';

// ============================================
// TYPES
// ============================================

export type OrderStatusBadgeSize = 'xs' | 'sm' | 'md';

interface OrderStatusBadgeProps {
  status: OrderStatus | string;
  size?: OrderStatusBadgeSize;
  showIcon?: boolean;
  className?: string;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Colour tokens per status. Uses the project's Tailwind design
 * tokens (`success`, `warning`, `danger`, `primary`, `secondary`,
 * `brand`) so the badge matches every other badge in the app.
 */
const STATUS_BADGE_CLASSES: Record<string, string> = {
  COMPLETED:
    'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  PROCESSING:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  PENDING:
    'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  CANCELLED:
    'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  REFUNDED:
    'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
  ON_HOLD:
    'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
};

const STATUS_BADGE_FALLBACK =
  'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';

/**
 * Human-readable labels for each status. Prevents the UI from
 * rendering `ON_HOLD` as-is when a user expects "On Hold".
 */
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  ON_HOLD: 'On Hold',
};

const SIZE_CLASSES: Record<OrderStatusBadgeSize, string> = {
  xs: 'px-1.5 py-0.5 text-[10px] gap-0.5',
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-2.5 py-1.5 text-sm gap-1.5',
};

const ICON_SIZE_CLASSES: Record<OrderStatusBadgeSize, string> = {
  xs: 'w-2.5 h-2.5',
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
};

// ============================================
// HELPERS
// ============================================

export function getOrderStatusIcon(
  status: string,
): React.ComponentType<{ className?: string }> {
  switch (status) {
    case OrderStatus.COMPLETED:
      return CheckCircle;
    case OrderStatus.PROCESSING:
      return RefreshCw;
    case OrderStatus.PENDING:
      return Clock;
    case OrderStatus.CANCELLED:
      return XCircle;
    case OrderStatus.REFUNDED:
      return Undo2;
    case OrderStatus.ON_HOLD:
      return PauseCircle;
    default:
      return Package;
  }
}

export function getOrderStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function getOrderStatusBadgeClasses(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? STATUS_BADGE_FALLBACK;
}

// ============================================
// COMPONENT
// ============================================

export function OrderStatusBadge({
  status,
  size = 'sm',
  showIcon = true,
  className = '',
}: OrderStatusBadgeProps) {
  const Icon = getOrderStatusIcon(status);
  const badgeClasses = getOrderStatusBadgeClasses(status);
  const label = getOrderStatusLabel(status);

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${SIZE_CLASSES[size]} ${badgeClasses} ${className}`}
    >
      {showIcon && <Icon className={ICON_SIZE_CLASSES[size]} />}
      {label}
    </span>
  );
}

export default OrderStatusBadge;

