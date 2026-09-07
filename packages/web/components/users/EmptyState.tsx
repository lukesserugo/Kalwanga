// D:\Projects\Kalwanga\packages\web\components\users\EmptyState.tsx

'use client';

import React from 'react';
import { Plus, Upload, Send, Users, Search, Filter, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionIcon?: React.ReactNode;
  onSecondaryAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  actionIcon,
  onAction,
  secondaryActionLabel,
  secondaryActionIcon,
  onSecondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
        {icon || <Users className="w-10 h-10 text-gray-400" />}
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      
      <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
        {description}
      </p>
      
      <div className="flex flex-wrap gap-3 justify-center">
        {onAction && actionLabel && (
          <button
            onClick={onAction}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            {actionIcon || <Plus className="w-4 h-4" />}
            {actionLabel}
          </button>
        )}
        
        {onSecondaryAction && secondaryActionLabel && (
          <button
            onClick={onSecondaryAction}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            {secondaryActionIcon || <RefreshCw className="w-4 h-4" />}
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default EmptyState;
