// D:\Projects\Kalwanga\packages\web\components\ui\Skeleton.tsx
'use client';

import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export function Skeleton({ className = '', children }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-200 dark:bg-gray-700 rounded transition-colors duration-250',
        className
      )}
    >
      {children}
    </div>
  );
}
