// D:\Projects\Kalwanga\packages\web\components\ui\Badge.tsx
'use client';

import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'destructive' | 'secondary' | 'default';
  className?: string;
}

const variantStyles = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  destructive: 'bg-red-100 text-red-800',
  secondary: 'bg-gray-100 text-gray-600',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      variantStyles[variant],
      className
    )}>
      {children}
    </span>
  );
}
