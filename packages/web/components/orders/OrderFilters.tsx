// D:\Projects\Kalwanga\packages\web\components\orders\OrderFilters.tsx

'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { OrderStatus } from '../../types/enums';

// ============================================
// TYPES
// ============================================

export interface OrderFilterValues {
  search: string;
  status: OrderStatus | '';
  startDate: string;
  endDate: string;
}

interface OrderFiltersProps {
  values: OrderFilterValues;
  onChange: <K extends keyof OrderFilterValues>(
    key: K,
    value: OrderFilterValues[K],
  ) => void;
  onClear?: () => void;
  disabled?: boolean;
  className?: string;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_OPTIONS: Array<{ value: OrderStatus | ''; label: string }> = [
  { value: '', label: 'All Status' },
  { value: OrderStatus.PENDING, label: 'Pending' },
  { value: OrderStatus.PROCESSING, label: 'Processing' },
  { value: OrderStatus.COMPLETED, label: 'Completed' },
  { value: OrderStatus.CANCELLED, label: 'Cancelled' },
  { value: OrderStatus.REFUNDED, label: 'Refunded' },
  { value: OrderStatus.ON_HOLD, label: 'On Hold' },
];

const inputBase =
  'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ' +
  'bg-white dark:bg-gray-700 text-gray-900 dark:text-white ' +
  'focus:ring-2 focus:ring-brand-500 focus:outline-none ' +
  'transition duration-250 disabled:opacity-60';

// ============================================
// COMPONENT
// ============================================

export function OrderFilters({
  values,
  onChange,
  onClear,
  disabled = false,
  className = '',
}: OrderFiltersProps) {
  const hasAnyFilter =
    values.search !== '' ||
    values.status !== '' ||
    values.startDate !== '' ||
    values.endDate !== '';

  return (
    <div className={`card-brand shadow-soft ${className}`}>
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search by order number, customer, or email…"
              value={values.search}
              onChange={(e) => onChange('search', e.target.value)}
              disabled={disabled}
              className={`w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:outline-none transition duration-250 disabled:opacity-60`}
              aria-label="Search orders"
            />
          </div>
        </div>

        <input
          type="date"
          value={values.startDate}
          onChange={(e) => onChange('startDate', e.target.value)}
          disabled={disabled}
          className={`${inputBase} tabular-nums`}
          aria-label="Start date"
        />

        <span className="text-gray-500 dark:text-gray-400">to</span>

        <input
          type="date"
          value={values.endDate}
          onChange={(e) => onChange('endDate', e.target.value)}
          disabled={disabled}
          className={`${inputBase} tabular-nums`}
          aria-label="End date"
        />

        <select
          value={values.status}
          onChange={(e) =>
            onChange('status', e.target.value as OrderStatus | '')
          }
          disabled={disabled}
          className={inputBase}
          aria-label="Order status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {onClear && hasAnyFilter && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-250 focus-ring disabled:opacity-60"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export default OrderFilters;
