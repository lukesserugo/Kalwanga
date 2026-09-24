'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Loader2, X, Check } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { useAuth } from '../../hooks/useAuth';

interface CartPromotionInputProps {
  onPromotionApplied?: (result: unknown) => void;
  currentPromotionCode?: string;
  /**
   * Notifies the parent that the user cleared the local input.
   *
   * IMPORTANT: the backend has no "remove promotion" endpoint. Calling
   * this callback does NOT clear the server-side promotion. To replace
   * a promotion, call `applyPromotion` again with a new code.
   */
  onPromotionCleared?: () => void;
  disabled?: boolean;
  className?: string;
}

type ApplyState = 'idle' | 'applying' | 'applied';

export function CartPromotionInput({
  onPromotionApplied,
  currentPromotionCode,
  onPromotionCleared,
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

  const handleClearInput = useCallback(() => {
    setPromotionCode('');
    setError(null);
  }, []);

  const handleClearLocal = useCallback(() => {
    setError(null);
    onPromotionCleared?.();
  }, [onPromotionCleared]);

  const isApplying = state === 'applying';
  const justApplied = state === 'applied';
  const inputDisabled = disabled || isApplying;
  const hasApplied = Boolean(currentPromotionCode);

  return (
    <div className={`space-y-2 ${className}`}>
      {hasApplied && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 text-secondary-600 dark:text-secondary-400 shrink-0" />
            <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300 truncate font-mono tabular-nums">
              {currentPromotionCode}
            </span>
            <span className="text-xs text-secondary-500 dark:text-secondary-400">
              applied
            </span>
          </div>
          {onPromotionCleared && (
            <button
              type="button"
              onClick={handleClearLocal}
              disabled={disabled}
              className="shrink-0 p-1 rounded-md text-secondary-600 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:bg-secondary-900/40 transition-colors disabled:opacity-50 focus-ring"
              aria-label="Clear local promotion display"
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
              <Check className="w-4 h-4 text-success-500" />
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
            className={`w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-700 border rounded-lg focus:ring-2 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 transition-colors font-mono uppercase ${
              justApplied
                ? 'border-success-500 focus:ring-success-500'
                : error
                ? 'border-danger-500 focus:ring-danger-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-secondary-500'
            }`}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'promotion-error' : undefined}
          />
          {promotionCode && (
            <button
              type="button"
              onClick={handleClearInput}
              disabled={inputDisabled}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-orange-50 dark:hover:bg-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 focus-ring"
              aria-label="Clear promotion code input"
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
          className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px] focus-ring"
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
          className="text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default CartPromotionInput;
