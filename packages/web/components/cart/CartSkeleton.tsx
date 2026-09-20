// D:\Projects\Kalwanga\packages\web\components\cart\CartSkeleton.tsx

'use client';

import React from 'react';

interface CartSkeletonProps {
  /**
   * How many item rows to render. Defaults to 3 which fits most
   * viewports without overflowing.
   */
  count?: number;
  /**
   * Layout variant.
   *
   *  - `items`   → only the item list (used inside a sidebar)
   *  - `full`    → item list + summary sidebar, matching the real
   *                cart page's two-column layout
   *  - `compact` → 2 rows, tighter spacing, for the mini-cart
   *
   * Defaults to `items` for backward compatibility.
   */
  variant?: 'items' | 'full' | 'compact';
}

/**
 * Loading placeholder that mirrors the cart page's layout.
 *
 * Every placeholder block uses the same rounded, dark-mode-aware
 * palette as the real content so the transition from skeleton to
 * loaded state is seamless. The `aria-hidden` + `role="status"` combo
 * keeps screen readers from announcing the dummy blocks while still
 * telling them the page is loading.
 */
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
          className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${rowPadding} bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700`}
        >
          {/* Thumbnail */}
          <div
            className={`${imageSize} bg-gray-200 dark:bg-gray-700 rounded-md flex-shrink-0`}
          />

          {/* Text lines */}
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 sm:w-1/3" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 sm:w-1/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3 sm:w-1/5" />

            {/* Quantity stepper + price */}
            <div className="flex items-center gap-3 pt-1">
              <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-md" />
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>

          {/* Right-side total (desktop only) */}
          <div className="hidden sm:block text-right space-y-2 shrink-0 w-24">
            <div className="h-4 w-20 ml-auto bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-12 ml-auto bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );

  // Compact variant — no summary, tighter rows.
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

  // Items-only variant — no summary column.
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

  // Full variant — mirrors the cart page's two-column grid.
  return (
    <div
      className="animate-pulse grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8"
      role="status"
      aria-live="polite"
      aria-label="Loading cart"
    >
      {/* Left column — items */}
      <div className="lg:col-span-2 space-y-4">{itemRows}</div>

      {/* Right column — summary */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 space-y-4 sticky top-24">
          {/* Title */}
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />

          {/* Subtotal / tax / total lines */}
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

          {/* Total row */}
          <div className="flex justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>

          {/* Primary CTA */}
          <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-lg mt-2" />

          {/* Secondary text link */}
          <div className="h-3 w-32 mx-auto bg-gray-200 dark:bg-gray-700 rounded" />

          {/* Trust row */}
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
