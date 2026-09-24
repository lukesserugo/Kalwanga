// D:\Projects\Kalwanga\packages\web\components\orders\OrderTimeline.tsx

'use client';

import React from 'react';
import {
  CheckCircle,
  Clock,
  XCircle,
  Package,
  Truck,
  FileText,
  RefreshCw,
  Loader2,
  User as UserIcon,
} from 'lucide-react';
import type {
  OrderTimelineEntry,
} from '../../types/order';
import { formatDateTime } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

interface OrderTimelineProps {
  entries: OrderTimelineEntry[];
  loading?: boolean;
  className?: string;
  /**
   * When true, entries are displayed newest-first. Default: false
   * (oldest-first), which matches how most audit trails read.
   */
  reverse?: boolean;
}

// ============================================
// ICON SELECTION
// ============================================
//
// The backend's timeline entries describe events by `label`. We match
// common labels to icons. Unknown labels fall back to a neutral dot.

function pickIcon(
  label: string,
): React.ComponentType<{ className?: string }> {
  const normalized = label.toLowerCase();
  if (normalized.includes('creat')) return FileText;
  if (normalized.includes('complet')) return CheckCircle;
  if (normalized.includes('cancel')) return XCircle;
  if (normalized.includes('ship') || normalized.includes('deliver'))
    return Truck;
  if (normalized.includes('process')) return RefreshCw;
  if (normalized.includes('hold') || normalized.includes('pend'))
    return Clock;
  return Package;
}

// ============================================
// COMPONENT
// ============================================

export function OrderTimeline({
  entries,
  loading = false,
  className = '',
  reverse = false,
}: OrderTimelineProps) {
  if (loading) {
    return (
      <div
        className={`flex items-center justify-center py-8 ${className}`}
      >
        <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div
        className={`text-center py-8 text-sm text-gray-500 dark:text-gray-400 ${className}`}
      >
        No activity recorded yet.
      </div>
    );
  }

  const ordered = reverse ? [...entries].reverse() : entries;

  return (
    <ol className={`relative space-y-4 ${className}`}>
      {/* Vertical rail behind the dots. */}
      <span
        className="absolute left-4 top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700"
        aria-hidden="true"
      />

      {ordered.map((entry, index) => {
        const Icon = pickIcon(entry.label);
        const key = `${entry.timestamp}-${index}`;

        return (
          <li key={key} className="relative flex items-start gap-3">
            <span
              className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0"
              aria-hidden="true"
            >
              <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </span>

            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {entry.label}
              </p>

              {entry.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                  {entry.description}
                </p>
              )}

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="tabular-nums">
                  {formatDateTime(entry.timestamp)}
                </span>

                {entry.user && (
                  <span className="inline-flex items-center gap-1">
                    <UserIcon className="w-3 h-3" />
                    {entry.user.firstName} {entry.user.lastName}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default OrderTimeline;
