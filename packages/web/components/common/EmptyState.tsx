'use client';

import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`card-brand !p-12 text-center ${className}`}>
      {icon && <div className="text-6xl mb-4">{icon}</div>}
      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {title}
      </h2>
      {description && (
        <p className="text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
