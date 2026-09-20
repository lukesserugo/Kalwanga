// D:\Projects\Kalwanga\packages\web\components\notifications\useConfirm.ts

'use client';

import { useContext } from 'react';
import {
  ConfirmContext,
  type ConfirmContextValue,
} from './ConfirmProvider';

/**
 * Access the imperative `confirm()` function from any component
 * inside `<ConfirmProvider>`.
 *
 * Returns a function that resolves to `true` when the user confirms,
 * `false` when they cancel, dismiss, or press Escape.
 *
 * @example
 * ```tsx
 * const confirm = useConfirm();
 * const ok = await confirm({
 *   title: 'Delete this item?',
 *   description: 'This cannot be undone.',
 *   tone: 'danger',
 *   confirmLabel: 'Delete',
 * });
 * if (!ok) return;
 * ```
 */
export function useConfirm(): ConfirmContextValue['confirm'] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error(
      'useConfirm must be used inside <ConfirmProvider>. ' +
        'Wrap your app (or dashboard layout) with <ConfirmProvider>.',
    );
  }
  return ctx.confirm;
}

export default useConfirm;
