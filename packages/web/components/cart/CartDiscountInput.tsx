'use client';

import React, { useCallback, useState } from 'react';
import { Tag, Loader2, X } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatters';

interface CartDiscountInputProps {
  onDiscountApplied?: (result: unknown) => void;
  currentDiscount?: number;
  currentDiscountType?: 'PERCENTAGE' | 'FIXED';
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

  const handleClearDiscount = useCallback(() => {
    setDiscount('');
    setError(null);
  }, []);

  const handleRemoveApplied = useCallback(() => {
    setError(null);
    onDiscountRemoved?.();
  }, [onDiscountRemoved]);

  return (
    <div className={`space-y-2 ${className}`}>
      {hasApplied && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800">
          <div className="flex items-center gap-2 min-w-0">
            <Tag className="w-4 h-4 text-success-600 dark:text-success-400 shrink-0" />
            <span className="text-sm font-medium text-success-700 dark:text-success-300 tabular-nums">
              {formatCurrency(currentDiscount)}
            </span>
            <span className="text-xs text-success-500 dark:text-success-400">
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
              className="shrink-0 p-1 rounded-md text-success-600 hover:bg-success-100 dark:text-success-400 dark:hover:bg-success-900/40 transition-colors disabled:opacity-50 focus-ring"
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
            className={`w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-700 border rounded-lg focus:ring-2 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 transition-colors tabular-nums ${
              error
                ? 'border-danger-500 focus:ring-danger-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-success-500'
            }`}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'discount-error' : undefined}
          />
          {discount && (
            <button
              type="button"
              onClick={handleClearDiscount}
              disabled={disabled || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-orange-50 dark:hover:bg-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 focus-ring"
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
          <option value="FIXED">$</option>
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
          id="discount-error"
          className="text-sm text-danger-600 dark:text-danger-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default CartDiscountInput;
