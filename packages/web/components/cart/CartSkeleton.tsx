// D:\Projects\Kalwanga\packages\web\components\cart\CartSkeleton.tsx

'use client';

import React from 'react';

interface CartSkeletonProps {
  count?: number;
}

export function CartSkeleton({ count = 3 }: CartSkeletonProps) {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg"
        >
          <div className="w-20 h-20 bg-gray-200 dark:bg-gray-600 rounded"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/4"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/5"></div>
            <div className="flex items-center gap-3 mt-2">
              <div className="h-8 w-24 bg-gray-200 dark:bg-gray-600 rounded"></div>
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ✅ Keep default export for backwards compatibility
export default CartSkeleton;
