// D:\Projects\Kalwanga\packages\web\components\cart\CartPromotionInput.tsx

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Loader2, X, Check } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { useAuth } from '../../hooks/useAuth';

interface CartPromotionInputProps {
  /**
   * Called after a successful promotion apply. Receives whatever the
   * cart service returned — typically the updated cart.
   */
  onPromotionApplied?: (result: unknown) => void;
  /**
   * Code currently applied to the cart, if any. When provided, the
   * input renders a "Remove" affordance instead of an empty field.
   */
  currentPromotionCode?: string;
  /**
   * Called after a successful removal of the current promotion.
   */
  onPromotionRemoved?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * State machine for the apply flow:
 *
 *   idle      → user can type and press Apply
 *   applying  → request in flight; input is disabled
 *   applied   → a code has been successfully applied
 *
 * The component does NOT stay in `applied` forever. After a short
 * confirmation flash, it returns to `idle` so the user can apply a
 * second (stackable) code or correct a mistake. Whether the backend
 * accepts stacking is a policy decision — the UI just doesn't block it.
 */
type ApplyState = 'idle' | 'applying' | 'applied';

export function CartPromotionInput({
  onPromotionApplied,
  currentPromotionCode,
  onPromotionRemoved,
  disabled = false,
  className = '',
}: CartPromotionInputProps) {
  const { isAuthenticated } = useAuth();
  const [promotionCode, setPromotionCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ApplyState>('idle');

  const activeCartService = useMemo(
    () => (isAuthenticated ? cartService : guestCartService),
    [isAuthenticated],
  );

  // Reset the transient confirmation after a short delay. Do this with
  // an effect so an unmount during the timeout doesn't set state on a
  // dead component.
  useEffect(() => {
    if (state !== 'applied') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);

  const handleApplyPromotion = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const code = promotionCode.trim().toUpperCase();

      if (!code) {
        setError('Please enter a promotion code');
        return;
      }

      // Skip if the same code is already applied. Cheap local guard
      // that saves a network round-trip; the server also rejects
      // duplicate applies.
      if (
        currentPromotionCode &&
        code === currentPromotionCode.toUpperCase()
      ) {
        setError('This code is already applied');
        return;
      }

      setError(null);
      setState('applying');

      try {
        const result = await activeCartService.applyPromotion(code);
        toast.success(`Promotion "${code}" applied`);
        setPromotionCode('');
        setState('applied');
        window.dispatchEvent(new CustomEvent('cart:updated'));
        onPromotionApplied?.(result);
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to apply promotion';
        setError(message);
        toast.error(message);
        setState('idle');
      }
    },
    [promotionCode, currentPromotionCode, activeCartService, onPromotionApplied],
  );

  const handleClear = useCallback(() => {
    setPromotionCode('');
    setError(null);
    // Do not touch `state` here — the user is clearing the input, not
    // the applied promotion.
  }, []);

  const handleRemoveApplied = useCallback(() => {
    setError(null);
    onPromotionRemoved?.();
  }, [onPromotionRemoved]);

  const isApplying = state === 'applying';
  const justApplied = state === 'applied';
  const inputDisabled = disabled || isApplying;
  const hasApplied = Boolean(currentPromotionCode);

  return (
    <div className={`space-y-2 ${className}`}>
      {hasApplied && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300 truncate">
              {currentPromotionCode}
            </span>
            <span className="text-xs text-purple-500 dark:text-purple-400">
              applied
            </span>
          </div>
          {onPromotionRemoved && (
            <button
              type="button"
              onClick={handleRemoveApplied}
              disabled={disabled}
              className="shrink-0 p-1 rounded-md text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50"
              aria-label="Remove applied promotion"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={handleApplyPromotion}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {justApplied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Gift className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <input
            type="text"
            value={promotionCode}
            onChange={(e) => {
              setPromotionCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder={
              hasApplied ? 'Add another code' : 'Enter promotion code'
            }
            disabled={inputDisabled}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={`w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-700 border rounded-lg focus:ring-2 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 transition-colors ${
              justApplied
                ? 'border-green-500 focus:ring-green-500'
                : error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500'
            }`}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'promotion-error' : undefined}
          />
          {promotionCode && (
            <button
              type="button"
              onClick={handleClear}
              disabled={inputDisabled}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
              aria-label="Clear promotion code"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={
            disabled ||
            isApplying ||
            justApplied ||
            !promotionCode.trim()
          }
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
        >
          {isApplying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Applying…
            </>
          ) : justApplied ? (
            <>
              <Check className="w-4 h-4" />
              Applied
            </>
          ) : (
            'Apply'
          )}
        </button>
      </form>

      {error && (
        <p
          id="promotion-error"
          className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default CartPromotionInput;
