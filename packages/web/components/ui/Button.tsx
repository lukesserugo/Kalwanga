// D:\Projects\Kalwanga\packages\web\components\ui\Alert.tsx
'use client';

import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface AlertProps {
  children: ReactNode;
  variant?: 'default' | 'destructive';
  className?: string;
}

export function Alert({ children, variant = 'default', className = '' }: AlertProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border',
        variant === 'destructive'
          ? 'bg-danger-50 border-danger-200 text-danger-700 dark:bg-danger-950/30 dark:border-danger-900 dark:text-danger-300'
          : 'bg-primary-50 border-primary-200 text-primary-700 dark:bg-primary-950/30 dark:border-primary-900 dark:text-primary-300',
        className
      )}
    >
      {children}
    </div>
  );
}

interface AlertDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function AlertDescription({ children, className = '' }: AlertDescriptionProps) {
  return (
    <div className={cn('text-sm leading-relaxed', className)}>
      {children}
    </div>
  );
}
