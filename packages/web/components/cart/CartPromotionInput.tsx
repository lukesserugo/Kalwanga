// D:\Projects\Kalwanga\packages\web\components\cart\CartPromotionInput.tsx

'use client';

import React, { useState } from 'react';
import { Gift, Loader2, X, Check } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';

interface CartPromotionInputProps {
  onPromotionApplied?: (result: any) => void;
  disabled?: boolean;
  className?: string;
}

export function CartPromotionInput({
  onPromotionApplied,
  disabled = false,
  className = '',
}: CartPromotionInputProps) {
  const [promotionCode, setPromotionCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleApplyPromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!promotionCode.trim()) {
      setError('Please enter a promotion code');
      return;
    }

    setError(null);
    setIsLoading(true);
    setIsSuccess(false);

    try {
      const result = await cartService.applyPromotion(promotionCode.trim());
      toast.success(`Promotion "${promotionCode}" applied successfully`);
      setIsSuccess(true);
      setPromotionCode('');
      if (onPromotionApplied) {
        onPromotionApplied(result);
      }
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error: any) {
      setError(error?.message || 'Failed to apply promotion');
      toast.error(error?.message || 'Failed to apply promotion');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setPromotionCode('');
    setError(null);
    setIsSuccess(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <form onSubmit={handleApplyPromotion} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            {isSuccess ? (
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
              setIsSuccess(false);
            }}
            placeholder="Enter promotion code"
            disabled={disabled || isLoading}
            className={`w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-700 border rounded-lg focus:ring-2 focus:outline-none text-gray-900 dark:text-white disabled:opacity-50 ${
              isSuccess 
                ? 'border-green-500 focus:ring-green-500' 
                : error 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            }`}
          />
          {promotionCode && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={disabled || isLoading || !promotionCode.trim() || isSuccess}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Applying...
            </>
          ) : isSuccess ? (
            <>
              <Check className="w-4 h-4" />
              Applied!
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

export default CartPromotionInput;
