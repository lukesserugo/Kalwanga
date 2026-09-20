// D:\Projects\Kalwanga\packages\web\components\suppliers\SupplierGrid.tsx

'use client';

import React, { useMemo } from 'react';
import type { Supplier } from '../../types/supplier';
import { SupplierCard } from './SupplierCard';

// ============================================
// TYPES
// ============================================

type GridColumns = 2 | 3 | 4;

interface SupplierGridProps {
  suppliers: Supplier[];
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (supplier: Supplier) => void;
  onView?: (supplier: Supplier) => void;
  isLoading?: boolean;
  className?: string;
  emptyMessage?: string;
  emptySubMessage?: string;
  columns?: GridColumns;
}

// ============================================
// CONSTANTS
// ============================================

const COLUMN_CLASSES: Record<GridColumns, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
};

const SKELETON_COUNT = 6;

// ============================================
// HELPERS
// ============================================

/**
 * Safely coerce the `columns` prop to a supported value.
 * Falls back to `3` for any out-of-range or non-numeric input.
 */
function normaliseColumns(value: unknown): GridColumns {
  if (value === 2 || value === 3 || value === 4) return value;
  return 3;
}

/**
 * Returns `true` when `value` is a usable supplier object with a
 * non-empty `id`. Guards against `null`, `undefined`, and mistyped
 * entries that could arrive from an untyped API response.
 */
function isValidSupplier(value: unknown): value is Supplier {
  if (!value || typeof value !== 'object') return false;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && id.trim().length > 0;
}

// ============================================
// SKELETON
// ============================================

function SupplierGridSkeleton({
  columns,
  className,
}: {
  columns: GridColumns;
  className: string;
}) {
  return (
    <div
      className={`grid ${COLUMN_CLASSES[columns]} gap-4 ${className}`}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          className="bg-gray-100 dark:bg-gray-700 rounded-xl h-48 animate-pulse"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function SupplierGridEmpty({
  message,
  subMessage,
}: {
  message: string;
  subMessage: string;
}) {
  return (
    <div
      className="text-center py-12"
      role="status"
      aria-live="polite"
    >
      <div className="text-6xl mb-4" aria-hidden="true">
        🚚
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
        {message}
      </h3>
      {subMessage && (
        <p className="text-gray-500 dark:text-gray-400 mt-2">{subMessage}</p>
      )}
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function SupplierGrid({
  suppliers,
  onEdit,
  onDelete,
  onView,
  isLoading = false,
  className = '',
  emptyMessage = 'No suppliers found',
  emptySubMessage = 'Start by adding your first supplier',
  columns = 3,
}: SupplierGridProps) {
  // ---- Normalise inputs -------------------------------------------
  const safeColumns = useMemo(() => normaliseColumns(columns), [columns]);

  const safeSuppliers = useMemo<Supplier[]>(() => {
    if (!Array.isArray(suppliers)) return [];
    // Filter out anything that isn't a usable supplier object.
    return suppliers.filter(isValidSupplier);
  }, [suppliers]);

  // ---- Loading state ----------------------------------------------
  if (isLoading) {
    return (
      <SupplierGridSkeleton
        columns={safeColumns}
        className={className}
      />
    );
  }

  // ---- Empty state ------------------------------------------------
  if (safeSuppliers.length === 0) {
    return (
      <SupplierGridEmpty
        message={emptyMessage}
        subMessage={emptySubMessage}
      />
    );
  }

  // ---- Grid -------------------------------------------------------
  return (
    <div
      className={`grid ${COLUMN_CLASSES[safeColumns]} gap-4 ${className}`}
      role="list"
    >
      {safeSuppliers.map((supplier) => (
        <div key={supplier.id} role="listitem">
          <SupplierCard
            supplier={supplier}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            showActions={true}
            variant="default"
          />
        </div>
      ))}
    </div>
  );
}

export default SupplierGrid;
