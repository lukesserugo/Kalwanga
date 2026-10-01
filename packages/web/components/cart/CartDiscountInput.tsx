'use client';

import React, { useCallback, useId, useState } from 'react';
import { Tag, Loader2, X } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatters';

interface CartDiscountInputProps {
  onDiscountApplied?: (result: unknown) => void;
  currentDiscount?: number;
  currentDiscountType?: 'PERCENTAGE' | 'FIXED';
  /**
   * Notifies the parent that the user cleared the local input.
   *
   * IMPORTANT: the backend has no "remove discount" endpoint. Calling
   * this callback does NOT clear the server-side discount. To replace a
   * discount, call `applyDiscount` again with a new value.
   */
  onDiscountCleared?: () => void;
  disabled?: boolean;
  className?: string;

  /**
   * ── Phase 2: ISO 4217 currency code for the cart. ─────────────
   *
   * Pass `cart.currency` from the parent. The applied-discount
   * amount (`currentDiscount`) is denominated in this currency, and
   * `formatCurrency(currentDiscount, currency)` renders it
   * correctly.
   *
   * ⚠ Optional for backward compatibility with callers that have
   *   not been migrated yet. When omitted, `formatCurrency` falls
   *   back to `'USD'` — which is what every caller got before
   *   Phase 2, so the unmigrated behaviour is unchanged.
   */
  currency?: string;

  /**
   * ── Phase 2: display symbol for `currency`. ───────────────────
   *
   * Pass `cart.currencySymbol` from the parent. Used as the label
   * of the `FIXED` option in the discount-type `<select>` and as
   * the suffix in the "applied" pill.
   *
   * ⚠ Optional for backward compatibility. When omitted, the
   *   component falls back to a local `window.__TENANT_CURRENCY__`
   *   shim that maps a short list of ISO codes to symbols. That
   *   shim is a migration aid, not a contract — the authoritative
   *   symbol comes from the backend via `cart.currencySymbol`.
   */
  currencySymbol?: string;
}

/**
 * Resolve the currency symbol for the DISPLAY-ONLY fallback path.
 *
 * ⚠ Phase 2: this is now a FALLBACK, not the primary path. The
 *   primary path is the `currencySymbol` prop, which comes from the
 *   backend (`cart.currencySymbol`) and is authoritative for the
 *   cart's business unit.
 *
 *   This shim exists so an unmigrated caller still renders *some*
 *   symbol rather than a bare `$`. It reads a global the app shell
 *   may or may not set (`window.__TENANT_CURRENCY__`) and maps a
 *   short list of ISO codes to symbols. It is NOT the source of
 *   truth — `BusinessUnit.currency` is, and the backend resolves it
 *   through `currencyService.resolveForBusiness`.
 *
 *   Once every caller passes `currencySymbol` explicitly, this
 *   function can be deleted.
 */
function getFallbackCurrencySymbol(): string {
  if (typeof window === 'undefined') return '$';
  const currency = (window as any).__TENANT_CURRENCY__;
  switch (currency) {
    case 'UGX':
      return 'USh';
    case 'KES':
      return 'KSh';
    case 'TZS':
      return 'TSh';
    case 'NGN':
      return '₦';
    case 'GHS':
      return '₵';
    case 'ZAR':
      return 'R';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return '$';
  }
}

export function CartDiscountInput({
  onDiscountApplied,
  currentDiscount = 0,
  currentDiscountType,
  onDiscountCleared,
  disabled = false,
  className = '',
  // ── Phase 2: currency props ──────────────────────────────
  // Optional for backward compatibility. See the prop JSDoc.
  // When omitted, the component degrades to the same
  // `formatCurrency(amount)` (USD) + `getFallbackCurrencySymbol()`
  // behaviour it had before Phase 2.
  currency,
  currencySymbol: currencySymbolProp,
}: CartDiscountInputProps) {
  const { isAuthenticated } = useAuth();
  const errorId = useId();
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>(
    'PERCENTAGE',
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasApplied = currentDiscount > 0;

  // ── Phase 2: resolve the currency symbol ─────────────────
  // Prefer the prop (authoritative — comes from `cart.currencySymbol`,
  // resolved server-side). Fall back to the local shim only when
  // the caller hasn't migrated yet.
  const currencySymbol =
    currencySymbolProp ?? getFallbackCurrencySymbol();

  // ── Phase 2: resolve the currency code for formatting ────
  // Same precedence: prop first (from `cart.currency`), USD
  // fallback for unmigrated callers so `formatCurrency` behaves
  // exactly as it did before Phase 2.
  const resolvedCurrency = currency ?? 'USD';

  const handleApplyDiscount = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const discountValue = parseFloat(discount);
      if (isNaN(discountValue) || discountValue <= 0) {
        setError('Please enter a valid discount amount');
        return;
      }

      if (discountType === 'PERCENTAGE' && discountValue > 100) {
        setError('Percentage cannot exceed 100%');
        return;
      }

      if (!isAuthenticated) {
        const message = 'Sign in to apply a discount';
        setError(message);
        toast.info(message);
        return;
      }

      setError(null);
      setIsLoading(true);

      try {
        const result = await cartService.applyDiscount(
          discountValue,
          discountType,
        );
        toast.success(
          `${
            discountType === 'PERCENTAGE' ? 'Percentage' : 'Fixed'
          } discount applied`,
        );
        setDiscount('');
        window.dispatchEvent(new CustomEvent('cart:updated'));
        onDiscountApplied?.(result);
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to apply discount';
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [discount, discountType, isAuthenticated, onDiscountApplied],
  );

  const handleClearInput = useCallback(() => {
    setDiscount('');
    setError(null);
  }, []);

  const handleClearLocal = useCallback(() => {
    setError(null);
    onDiscountCleared?.();
  }, [onDiscountCleared]);

  return (
    <div className={`space-y-2 ${className}`}>
      {hasApplied && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800">
          <div className="flex items-center gap-2 min-w-0">
            <Tag className="w-4 h-4 text-success-600 dark:text-success-400 shrink-0" />
            <span className="text-sm font-medium text-success-700 dark:text-success-300 tabular-nums">
              {/*
                ── Phase 2: format in the cart's own currency ──
                `formatCurrency(currentDiscount, resolvedCurrency)`
                renders the amount with the correct ISO code. When
                the caller is unmigrated (`currency` undefined),
                `resolvedCurrency` is `'USD'` and the render is
                identical to the pre-Phase-2 behaviour.
              */}
              {formatCurrency(currentDiscount, resolvedCurrency)}
            </span>
            <span className="text-xs text-success-500 dark:text-success-400">
              applied
              {currentDiscountType
                ? ` (${
                    currentDiscountType === 'PERCENTAGE'
                      ? '%'
                      : currencySymbol
                  })`
                : ''}
            </span>
          </div>
          {onDiscountCleared && (
            <button
              type="button"
              onClick={handleClearLocal}
              disabled={disabled}
              className="shrink-0 p-1 rounded-md text-success-600 hover:bg-success-100 dark:text-success-400 dark:hover:bg-success-900/40 transition-colors disabled:opacity-50 focus-ring"
              aria-label="Clear local discount display"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={handleApplyDiscount}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Tag className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            max={discountType === 'PERCENTAGE' ? 100 : undefined}
            value={discount}
            onChange={(e) => {
              setDiscount(e.target.value);
              setError(null);
            }}
            placeholder={
              hasApplied
                ? 'Replace discount'
                : discountType === 'PERCENTAGE'
                ? 'Discount %'
                : 'Discount amount'
            }
            disabled={disabled || isLoading || !isAuthenticated}
            inputMode="decimal"
            className={`w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-700 border rounded-lg focus:ring-2 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 transition-colors tabular-nums ${
              error
                ? 'border-danger-500 focus:ring-danger-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-success-500'
            }`}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? errorId : undefined}
          />
          {discount && (
            <button
              type="button"
              onClick={handleClearInput}
              disabled={disabled || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 focus-ring"
              aria-label="Clear discount input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={discountType}
          onChange={(e) =>
            setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED')
          }
          disabled={disabled || isLoading || !isAuthenticated}
          className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-success-500 focus:border-transparent focus:outline-none text-gray-900 dark:text-white disabled:opacity-50 text-sm"
          aria-label="Discount type"
        >
          <option value="PERCENTAGE">%</option>
          {/*
            ── Phase 2: the FIXED option label is the resolved ──
            currency symbol, not a hardcoded `$`. `currencySymbol`
            resolves from the prop first, falling back to the
            local shim only for unmigrated callers.
          */}
          <option value="FIXED">{currencySymbol}</option>
        </select>

        <button
          type="submit"
          disabled={
            disabled || isLoading || !discount || !isAuthenticated
          }
          className="px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px] shadow-soft focus-ring"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Applying…
            </>
          ) : (
            'Apply'
          )}
        </button>
      </form>

      {!isAuthenticated && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Sign in to apply a discount.
        </p>
      )}

      {error && (
        <p
          id={errorId}
          className="text-sm text-danger-600 dark:text-danger-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default CartDiscountInput;
