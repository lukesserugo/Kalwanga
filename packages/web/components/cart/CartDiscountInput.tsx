// D:\Projects\Kalwanga\packages\web\components\cart\CartDiscountInput.tsx

'use client';

import React, { useCallback, useState } from 'react';
import { Tag, Loader2, X } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatters';

interface CartDiscountInputProps {
  /**
   * Called after a successful apply. Receives whatever the cart
   * service returned — typically the updated cart.
   */
  onDiscountApplied?: (result: unknown) => void;
  /**
   * Current discount amount on the cart. When > 0, the input shows
   * the applied discount with a clear button.
   */
  currentDiscount?: number;
  /**
   * Current discount type, if any. Used for display only.
   */
  currentDiscountType?: 'PERCENTAGE' | 'FIXED';
  /**
   * Called after a successful removal of the current discount.
   */
  onDiscountRemoved?: () => void;
  disabled?: boolean;
  className?: string;
}

export function CartDiscountInput({
  onDiscountApplied,
  currentDiscount = 0,
  currentDiscountType,
  onDiscountRemoved,
  disabled = false,
  className = '',
}: CartDiscountInputProps) {
  const { isAuthenticated } = useAuth();
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>(
    'PERCENTAGE',
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasApplied = currentDiscount > 0;

  // ============================================
  // HANDLERS
  // ============================================

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

      // ✅ Guest carts don't support discounts. `guestCartService`
      //    exposes neither `applyDiscount` nor `applyPromotion`, so
      //    calling them through the union triggers TS2339. Surface a
      //    clear "sign in" message instead.
      if (!isAuthenticated) {
        const message = 'Sign in to apply a discount';
        setError(message);
        toast.info(message);
        return;
      }

      setError(null);
      setIsLoading(true);

      try {
        // ✅ TypeScript narrows to the concrete service here. The
        //    `isAuthenticated` check above guarantees `cartService`.
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

  const handleClearDiscount = useCallback(() => {
    setDiscount('');
    setError(null);
  }, []);

  const handleRemoveApplied = useCallback(() => {
    setError(null);
    onDiscountRemoved?.();
  }, [onDiscountRemoved]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={`space-y-2 ${className}`}>
      {hasApplied && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 min-w-0">
            <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatCurrency(currentDiscount)}
            </span>
            <span className="text-xs text-emerald-500 dark:text-emerald-400">
              applied
              {currentDiscountType
                ? ` (${currentDiscountType === 'PERCENTAGE' ? '%' : '$'})`
                : ''}
            </span>
          </div>
          {onDiscountRemoved && (
            <button
              type="button"
              onClick={handleRemoveApplied}
              disabled={disabled}
              className="shrink-0 p-1 rounded-md text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
              aria-label="Remove applied discount"
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
            className={`w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-700 border rounded-lg focus:ring-2 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 transition-colors ${
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-emerald-500'
            }`}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'discount-error' : undefined}
          />
          {discount && (
            <button
              type="button"
              onClick={handleClearDiscount}
              disabled={disabled || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
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
          className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:outline-none text-gray-900 dark:text-white disabled:opacity-50 text-sm"
          aria-label="Discount type"
        >
          <option value="PERCENTAGE">%</option>
          <option value="FIXED">$</option>
        </select>

        <button
          type="submit"
          disabled={
            disabled || isLoading || !discount || !isAuthenticated
          }
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px] shadow-sm"
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
          id="discount-error"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default CartDiscountInput;
