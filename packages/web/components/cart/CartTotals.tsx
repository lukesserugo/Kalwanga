// D:\Projects\Kalwanga\packages\web\components\cart\CartTotals.tsx

'use client';

import React from 'react';
import { formatCurrency } from '../../utils/formatters';

export interface CartTotalsProps {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  /**
   * Shipping cost BEFORE any free-shipping adjustment. The component
   * decides whether to waive it based on `subtotal` vs.
   * `freeShippingThreshold`.
   */
  shippingCost?: number;
  freeShippingThreshold?: number;
  promotionCode?: string;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
  isTaxInclusive?: boolean;
  taxRate?: number;
  /**
   * When true, the shipping line is rendered even when the cost is
   * zero. Defaults to false — most carts hide the shipping row when
   * there is nothing to show.
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
  // ============================================
  // SANITIZE INPUTS
  // ============================================
  //
  // The parent may pass values that came from a partially-populated
  // cart (empty cart → `subtotal` is 0, but `tax` may be `undefined`
  // briefly). Guard every numeric input against NaN/undefined so the
  // rendered amounts never show "$NaN".

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

  // ============================================
  // SHIPPING
  // ============================================
  //
  // Free shipping is decided by the SUBTOTAL, not the total. The
  // subtotal is the amount of merchandise before tax and discounts,
  // which matches how most storefronts advertise "spend $50 for free
  // shipping".
  //
  // When the threshold is 0 or negative, free shipping is disabled
  // and the shipping cost is always charged.

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

  // ============================================
  // GRAND TOTAL
  // ============================================
  //
  // The `total` prop is treated as the FINAL total from the cart
  // service — it already includes tax and all discounts. Shipping is
  // added on top because it is a storefront-level concern that the
  // cart service does not currently model.
  //
  // The old version added `shippingCost` even when the cart's `total`
  // already included it, which double-charged the customer. If your
  // cart service ever starts including shipping, remove the addition
  // below.

  const grandTotal = safeTotal + finalShippingCost;

  const amountUntilFreeShipping =
    freeShippingActive && !isEligibleForFreeShipping
      ? Math.max(0, safeFreeShippingThreshold - safeSubtotal)
      : 0;

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
      {/* Subtotal */}
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>Subtotal</span>
        <span>{formatCurrency(safeSubtotal)}</span>
      </div>

      {/* Tax (only when exclusive) */}
      {!isTaxInclusive && (
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Tax ({safeTaxRate}%)</span>
          <span>{formatCurrency(safeTax)}</span>
        </div>
      )}

      {/* Cart-level discount */}
      {safeDiscount > 0 && (
        <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
          <span>Discount</span>
          <span>-{formatCurrency(safeDiscount)}</span>
        </div>
      )}

      {/* Promotion */}
      {promotionCode && safePromotionDiscount > 0 && (
        <div className="flex justify-between text-sm text-purple-600 dark:text-purple-400">
          <span>Promotion ({promotionCode})</span>
          <span>-{formatCurrency(safePromotionDiscount)}</span>
        </div>
      )}

      {/* Loyalty redemption */}
      {safeLoyaltyPointsUsed > 0 && safeLoyaltyDiscount > 0 && (
        <div className="flex justify-between text-sm text-indigo-600 dark:text-indigo-400">
          <span>Loyalty Points ({safeLoyaltyPointsUsed})</span>
          <span>-{formatCurrency(safeLoyaltyDiscount)}</span>
        </div>
      )}

      {/* Shipping */}
      {showShippingLine && (
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600 pb-2">
          <span>Shipping</span>
          <span>
            {isEligibleForFreeShipping ? (
              <span className="text-green-600 dark:text-green-400">
                Free
              </span>
            ) : (
              formatCurrency(safeShippingCost)
            )}
          </span>
        </div>
      )}

      {/* Grand total */}
      <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2">
        <span>Total</span>
        <span>{formatCurrency(grandTotal)}</span>
      </div>

      {/* Progress hint toward free shipping */}
      {amountUntilFreeShipping > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
          Add {formatCurrency(amountUntilFreeShipping)} more for free
          shipping
        </p>
      )}
    </div>
  );
}

export default CartTotals;
