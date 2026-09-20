'use client';

import React from 'react';

interface CartSkeletonProps {
  count?: number;
  variant?: 'items' | 'full' | 'compact';
}

export function CartSkeleton({
  count = 3,
  variant = 'items',
}: CartSkeletonProps) {
  const effectiveCount = variant === 'compact' ? Math.min(count, 2) : count;
  const rowPadding = variant === 'compact' ? 'p-3' : 'p-4';
  const imageSize = variant === 'compact' ? 'w-12 h-12' : 'w-20 h-20';

  const itemRows = (
    <div className="space-y-3 sm:space-y-4">
      {Array.from({ length: effectiveCount }).map((_, i) => (
        <div
          key={i}
          className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${rowPadding} bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft`}
        >
          <div
            className={`${imageSize} bg-gray-200 dark:bg-gray-700 rounded-md flex-shrink-0`}
          />

          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 sm:w-1/3" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 sm:w-1/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3 sm:w-1/5" />

            <div className="flex items-center gap-3 pt-1">
              <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-md" />
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>

          <div className="hidden sm:block text-right space-y-2 shrink-0 w-24">
            <div className="h-4 w-20 ml-auto bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-12 ml-auto bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );

  if (variant === 'compact') {
    return (
      <div
        className="animate-pulse"
        role="status"
        aria-live="polite"
        aria-label="Loading cart items"
      >
        {itemRows}
        <span className="sr-only">Loading cart items…</span>
      </div>
    );
  }

  if (variant === 'items') {
    return (
      <div
        className="animate-pulse"
        role="status"
        aria-live="polite"
        aria-label="Loading cart items"
      >
        {itemRows}
        <span className="sr-only">Loading cart items…</span>
      </div>
    );
  }

  return (
    <div
      className="animate-pulse grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8"
      role="status"
      aria-live="polite"
      aria-label="Loading cart"
    >
      <div className="lg:col-span-2 space-y-4">{itemRows}</div>

      <div className="lg:col-span-1">
        <div className="card-brand sticky top-24 space-y-4">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />

          <div className="space-y-3 pt-2">
            <div className="flex justify-between">
              <div className="h-3.5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3.5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="flex justify-between">
              <div className="h-3.5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3.5 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>

          <div className="flex justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>

          <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-lg mt-2" />

          <div className="h-3 w-32 mx-auto bg-gray-200 dark:bg-gray-700 rounded" />

          <div className="pt-3 space-y-2 border-t border-gray-100 dark:border-gray-700">
            <div className="h-3 w-28 mx-auto bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-40 mx-auto bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>

      <span className="sr-only">Loading cart…</span>
    </div>
  );
}

export default CartSkeleton;

