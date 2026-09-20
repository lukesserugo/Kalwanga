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
  /**
   * When false (guest cart), the "Sync Inventory" and "Save for later"
   * buttons are hidden because those endpoints aren't implemented for
   * guest carts. Defaults to true.
   */
  supportsAdvancedActions?: boolean;
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
  supportsAdvancedActions = true,
}: CartActionsProps) {
  const anyBusy = isSyncing || isClearing || isSaving || isRestoring;

  const baseButton =
    'inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg ' +
    'transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
    'focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-gray-900';

  const neutralButton =
    baseButton +
    ' border border-gray-300 dark:border-gray-600 ' +
    'text-gray-700 dark:text-gray-300 ' +
    'hover:bg-gray-50 dark:hover:bg-gray-700 ' +
    'focus:ring-gray-400';

  const dangerButton =
    baseButton +
    ' text-red-600 dark:text-red-400 ' +
    'border border-red-300 dark:border-red-800 ' +
    'hover:bg-red-50 dark:hover:bg-red-900/20 ' +
    'focus:ring-red-500';

  return (
    <div className="flex flex-wrap gap-2">
      {supportsAdvancedActions && (
        <button
          type="button"
          onClick={onSync}
          disabled={anyBusy || disabled || !hasItems}
          className={neutralButton}
          title="Sync cart quantities with current inventory"
        >
          <RefreshCw
            className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
          />
          {isSyncing ? 'Syncing…' : 'Sync'}
        </button>
      )}

      <button
        type="button"
        onClick={onClear}
        disabled={anyBusy || disabled || !hasItems}
        className={dangerButton}
        title="Remove all items from the cart"
      >
        <Trash2 className="w-4 h-4" />
        {isClearing ? 'Clearing…' : 'Clear'}
      </button>

      {supportsAdvancedActions && onSaveForLater && hasItems && (
        <button
          type="button"
          onClick={onSaveForLater}
          disabled={anyBusy || disabled}
          className={neutralButton}
          title="Save this cart to restore later"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      )}

      {supportsAdvancedActions &&
        onRestore &&
        hasSavedCart &&
        !hasItems && (
          <button
            type="button"
            onClick={onRestore}
            disabled={anyBusy || disabled}
            className={neutralButton}
            title="Restore the last saved cart"
          >
            <RotateCcw
              className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`}
            />
            {isRestoring ? 'Restoring…' : 'Restore'}
          </button>
        )}
    </div>
  );
}

export default CartActions;
