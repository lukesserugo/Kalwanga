'use client';

import { ReactNode } from 'react';
import { getStatusColor } from '../../utils/helpers';

interface StatusBadgeProps {
  status: string;
  children?: ReactNode;
  className?: string;
}

export function StatusBadge({ status, children, className = '' }: StatusBadgeProps) {
  const colorClass = getStatusColor(status);
  
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colorClass} ${className}`}>
      {children || status}
    </span>
  );
}
