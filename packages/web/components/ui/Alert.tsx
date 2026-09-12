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
    <div className={cn(
      'p-4 rounded-lg border',
      variant === 'destructive' 
        ? 'bg-red-50 border-red-200 text-red-800' 
        : 'bg-blue-50 border-blue-200 text-blue-800',
      className
    )}>
      {children}
    </div>
  );
}

interface AlertDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function AlertDescription({ children, className = '' }: AlertDescriptionProps) {
  return <div className={cn('text-sm', className)}>{children}</div>;
}
