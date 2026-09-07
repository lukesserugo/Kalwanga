// D:\Projects\Kalwanga\packages\web\components\cart\CartTotals.tsx

'use client';

import React from 'react';
import { formatCurrency } from '../../utils/formatters';

export interface CartTotalsProps {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  shippingCost?: number;
  freeShippingThreshold?: number;
  promotionCode?: string;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
  isTaxInclusive?: boolean;
  taxRate?: number;
}

export function CartTotals({
  subtotal,
  tax,
  discount,
  total,
  shippingCost = 0,
  freeShippingThreshold = 50,
  promotionCode,
  promotionDiscount = 0,
  loyaltyPointsUsed = 0,
  loyaltyDiscount = 0,
  isTaxInclusive = false,
  taxRate = 10,
}: CartTotalsProps) {
  const isEligibleForFreeShipping = subtotal >= freeShippingThreshold;
  const finalShippingCost = isEligibleForFreeShipping ? 0 : shippingCost;
  const finalTotal = total + finalShippingCost;

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>Subtotal</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>

      {!isTaxInclusive && (
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Tax ({taxRate}%)</span>
          <span>{formatCurrency(tax)}</span>
        </div>
      )}

      {discount > 0 && (
        <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
          <span>Discount</span>
          <span>-{formatCurrency(discount)}</span>
        </div>
      )}

      {promotionCode && promotionDiscount > 0 && (
        <div className="flex justify-between text-sm text-purple-600 dark:text-purple-400">
          <span>Promotion ({promotionCode})</span>
          <span>-{formatCurrency(promotionDiscount)}</span>
        </div>
      )}

      {loyaltyPointsUsed > 0 && loyaltyDiscount > 0 && (
        <div className="flex justify-between text-sm text-indigo-600 dark:text-indigo-400">
          <span>Loyalty Points ({loyaltyPointsUsed})</span>
          <span>-{formatCurrency(loyaltyDiscount)}</span>
        </div>
      )}

      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600 pb-2">
        <span>Shipping</span>
        <span>
          {isEligibleForFreeShipping ? (
            <span className="text-green-600 dark:text-green-400">Free</span>
          ) : (
            formatCurrency(shippingCost)
          )}
        </span>
      </div>

      <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2">
        <span>Total</span>
        <span>{formatCurrency(finalTotal)}</span>
      </div>

      {!isEligibleForFreeShipping && freeShippingThreshold > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
          Add {formatCurrency(freeShippingThreshold - subtotal)} more for free shipping
        </p>
      )}
    </div>
  );
}

// ✅ This is the key - default export
export default CartTotals;
