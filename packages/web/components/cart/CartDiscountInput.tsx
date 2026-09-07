// D:\Projects\Kalwanga\packages\web\components\cart\CartDiscountInput.tsx

'use client';

import React, { useState } from 'react';
import { Tag, Loader2, X } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';

interface CartDiscountInputProps {
  onDiscountApplied?: (result: any) => void;
  disabled?: boolean;
  className?: string;
}

export function CartDiscountInput({
  onDiscountApplied,
  disabled = false,
  className = '',
}: CartDiscountInputProps) {
  const [discount, setDiscount] = useState<string>('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApplyDiscount = async (e: React.FormEvent) => {
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

    setError(null);
    setIsLoading(true);

    try {
      const result = await cartService.applyDiscount(discountValue, discountType);
      toast.success(`${discountType === 'PERCENTAGE' ? 'Percentage' : 'Fixed'} discount applied successfully`);
      setDiscount('');
      if (onDiscountApplied) {
        onDiscountApplied(result);
      }
    } catch (error: any) {
      setError(error?.message || 'Failed to apply discount');
      toast.error(error?.message || 'Failed to apply discount');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearDiscount = () => {
    setDiscount('');
    setError(null);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <form onSubmit={handleApplyDiscount} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
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
            placeholder={discountType === 'PERCENTAGE' ? 'Discount %' : 'Discount amount'}
            disabled={disabled || isLoading}
            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white disabled:opacity-50"
          />
          {discount && (
            <button
              type="button"
              onClick={handleClearDiscount}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={discountType}
          onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED')}
          disabled={disabled || isLoading}
          className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white disabled:opacity-50"
        >
          <option value="PERCENTAGE">%</option>
          <option value="FIXED">$</option>
        </select>

        <button
          type="submit"
          disabled={disabled || isLoading || !discount}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Applying...
            </>
          ) : (
            'Apply'
          )}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export default CartDiscountInput;
