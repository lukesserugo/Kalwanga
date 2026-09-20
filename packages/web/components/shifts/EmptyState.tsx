// D:\Projects\Kalwanga\packages\web\components\shifts\EmptyState.tsx
'use client';

import { Plus, CreditCard } from 'lucide-react';
import { Button } from '../ui/Button';

interface EmptyStateProps {
  onAdd: () => void;
  searchTerm?: string;
}

export function EmptyState({ onAdd, searchTerm }: EmptyStateProps) {
  return (
    <div className="text-center py-12 animate-fade-in">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <CreditCard className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {searchTerm ? 'No registers found' : 'No cash registers yet'}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto line-clamp-2">
        {searchTerm
          ? `No registers match "${searchTerm}"`
          : 'Get started by creating your first cash register to manage shifts and transactions.'
        }
      </p>
      <Button onClick={onAdd} className="focus-ring">
        <Plus className="h-4 w-4 mr-2" />
        Create Register
      </Button>
    </div>
  );
}
