// D:\Projects\Kalwanga\packages\web\components\pos\CartTotalsPreview.tsx

'use client';

import { AlertCircle, Star, Tag } from 'lucide-react';
import { saleService } from '../../services/saleService';
import type { DiscountType } from '../../services/saleService';

interface CartTotalsPreviewProps {
  /** The cart's pre-discount total. */
  total: number;
  /** Fixed promotion discount, if any. */
  promotionDiscount?: number;
  /** Code of the promotion being applied, for display. */
  promotionCode?: string | null;
  /** Discount type label hint. */
  discountType?: DiscountType | null;
  /** Loyalty points the cashier intends to burn. */
  loyaltyPointsToUse?: number;
  /** The customer's current loyalty balance. */
  availableLoyaltyPoints?: number;
  /** Currency symbol. Defaults to `$`. */
  currencySymbol?: string;
  /** Optional class applied to the outer wrapper. */
  className?: string;
}

export function CartTotalsPreview({
  total,
  promotionDiscount,
  promotionCode,
  discountType,
  loyaltyPointsToUse,
  availableLoyaltyPoints,
  currencySymbol = '$',
  className = '',
}: CartTotalsPreviewProps) {
  const preview = saleService.previewDiscount({
    total,
    promotionDiscount,
    promotionCode,
    discountType,
    loyaltyPointsToUse,
    availableLoyaltyPoints,
  });

  const promotionLabel = discountType
    ? saleService.extractBreakdown({ discountType }).discountType
    : null;

  return (
    <div className={`space-y-1.5 text-sm ${className}`}>
      <div className="flex justify-between text-gray-500 dark:text-gray-400">
        <span>Subtotal</span>
        <span className="tabular-nums">
          {currencySymbol}
          {preview.originalTotal.toFixed(2)}
        </span>
      </div>

      {preview.promotionDiscount > 0 && (
        <div className="flex justify-between text-success-600 dark:text-success-400">
          <span className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            {promotionLabel
              ? String(promotionLabel)
              : promotionCode
              ? `Promotion`
              : 'Discount'}
            {promotionCode && (
              <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[11px] font-mono tabular-nums">
                {promotionCode}
              </code>
            )}
          </span>
          <span className="tabular-nums">
            -{currencySymbol}
            {preview.promotionDiscount.toFixed(2)}
          </span>
        </div>
      )}

      {preview.loyaltyDiscount > 0 && (
        <div className="flex justify-between text-success-600 dark:text-success-400">
          <span className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span className="tabular-nums">
              {preview.loyaltyPointsUsed} loyalty points
            </span>
          </span>
          <span className="tabular-nums">
            -{currencySymbol}
            {preview.loyaltyDiscount.toFixed(2)}
          </span>
        </div>
      )}

      <div className="flex justify-between pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-white">
        <span>Total</span>
        <span className="tabular-nums">
          {currencySymbol}
          {preview.finalTotal.toFixed(2)}
        </span>
      </div>

      {preview.warnings.length > 0 && (
        <ul className="pt-2 space-y-1 text-xs text-warning-600 dark:text-warning-400">
          {preview.warnings.map((warning, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CartTotalsPreview;
