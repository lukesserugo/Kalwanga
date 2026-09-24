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
  /**
   * When `false` (the default), this component trusts `total` as the
   * authoritative grand total. The backend `Cart.total` already
   * includes tax and applies all discounts, and no shipping is
   * modelled server-side.
   *
   * When `true`, `shippingCost` is added on top of `total` to produce a
   * client-only estimated grand total. This exists for preview screens
   * that want to show a shipping estimate — it is NOT the final
   * checkout amount.
   */
  alwaysShowShipping?: boolean;
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
  alwaysShowShipping = false,
}: CartTotalsProps) {
  const safeSubtotal = Number.isFinite(subtotal) ? subtotal : 0;
  const safeTax = Number.isFinite(tax) ? tax : 0;
  const safeDiscount = Number.isFinite(discount) ? discount : 0;
  const safeTotal = Number.isFinite(total) ? total : 0;
  const safeShippingCost = Number.isFinite(shippingCost)
    ? shippingCost
    : 0;
  const safePromotionDiscount = Number.isFinite(promotionDiscount)
    ? promotionDiscount
    : 0;
  const safeLoyaltyDiscount = Number.isFinite(loyaltyDiscount)
    ? loyaltyDiscount
    : 0;
  const safeLoyaltyPointsUsed = Number.isFinite(loyaltyPointsUsed)
    ? loyaltyPointsUsed
    : 0;
  const safeFreeShippingThreshold = Number.isFinite(
    freeShippingThreshold,
  )
    ? freeShippingThreshold
    : 0;
  const safeTaxRate = Number.isFinite(taxRate) ? taxRate : 0;

  const freeShippingActive = safeFreeShippingThreshold > 0;
  const isEligibleForFreeShipping =
    freeShippingActive && safeSubtotal >= safeFreeShippingThreshold;
  const finalShippingCost = isEligibleForFreeShipping
    ? 0
    : safeShippingCost;

  const showShippingLine =
    alwaysShowShipping ||
    finalShippingCost > 0 ||
    (freeShippingActive && !isEligibleForFreeShipping);

  // `Cart.total` is the server-authoritative grand total. Only add
  // shipping when the caller explicitly opts into a client-side
  // estimate — otherwise we'd double-count.
  const grandTotal = alwaysShowShipping
    ? safeTotal + finalShippingCost
    : safeTotal;

  const amountUntilFreeShipping =
    freeShippingActive && !isEligibleForFreeShipping
      ? Math.max(0, safeFreeShippingThreshold - safeSubtotal)
      : 0;

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>Subtotal</span>
        <span className="tabular-nums">
          {formatCurrency(safeSubtotal)}
        </span>
      </div>

      {!isTaxInclusive && (
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Tax ({safeTaxRate}%)</span>
          <span className="tabular-nums">{formatCurrency(safeTax)}</span>
        </div>
      )}

      {safeDiscount > 0 && (
        <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
          <span>Discount</span>
          <span className="tabular-nums">
            -{formatCurrency(safeDiscount)}
          </span>
        </div>
      )}

      {promotionCode && safePromotionDiscount > 0 && (
        <div className="flex justify-between text-sm text-secondary-600 dark:text-secondary-400">
          <span>Promotion ({promotionCode})</span>
          <span className="tabular-nums">
            -{formatCurrency(safePromotionDiscount)}
          </span>
        </div>
      )}

      {safeLoyaltyPointsUsed > 0 && safeLoyaltyDiscount > 0 && (
        <div className="flex justify-between text-sm text-secondary-600 dark:text-secondary-400">
          <span>Loyalty Points ({safeLoyaltyPointsUsed})</span>
          <span className="tabular-nums">
            -{formatCurrency(safeLoyaltyDiscount)}
          </span>
        </div>
      )}

      {showShippingLine && (
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600 pb-2">
          <span>
            Shipping
            {alwaysShowShipping && (
              <span className="text-2xs text-gray-400 ml-1">
                (estimate)
              </span>
            )}
          </span>
          <span className="tabular-nums">
            {isEligibleForFreeShipping ? (
              <span className="text-success-600 dark:text-success-400">
                Free
              </span>
            ) : (
              formatCurrency(safeShippingCost)
            )}
          </span>
        </div>
      )}

      <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2">
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
      </div>

      {amountUntilFreeShipping > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2 tabular-nums">
          Add {formatCurrency(amountUntilFreeShipping)} more for free
          shipping
        </p>
      )}
    </div>
  );
}

export default CartTotals;
