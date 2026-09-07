// D:\Projects\Kalwanga\packages\web\components\cart\CartActions.tsx

'use client';

import React from 'react';
import { RefreshCw, Trash2, Save, RotateCcw } from 'lucide-react';

export interface CartActionsProps {
  onClear: () => void;
  onSync: () => void;
  onSaveForLater?: () => void;
  onRestore?: () => void;
  isSyncing?: boolean;
  isClearing?: boolean;
  isSaving?: boolean;
  isRestoring?: boolean;
  hasItems?: boolean;
  hasSavedCart?: boolean;
  disabled?: boolean;
}

export function CartActions({
  onClear,
  onSync,
  onSaveForLater,
  onRestore,
  isSyncing = false,
  isClearing = false,
  isSaving = false,
  isRestoring = false,
  hasItems = false,
  hasSavedCart = false,
  disabled = false,
}: CartActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onSync}
        disabled={isSyncing || isClearing || disabled || !hasItems}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Syncing...' : 'Sync Inventory'}
      </button>

      <button
        onClick={onClear}
        disabled={isClearing || isSyncing || disabled || !hasItems}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Trash2 className="w-4 h-4" />
        {isClearing ? 'Clearing...' : 'Clear'}
      </button>

      {onSaveForLater && hasItems && (
        <button
          onClick={onSaveForLater}
          disabled={isSaving || disabled}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Later'}
        </button>
      )}

      {onRestore && hasSavedCart && (
        <button
          onClick={onRestore}
          disabled={isRestoring || disabled || hasItems}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RotateCcw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
          {isRestoring ? 'Restoring...' : 'Restore'}
        </button>
      )}
    </div>
  );
}

// ✅ This is the key - default export
export default CartActions;
