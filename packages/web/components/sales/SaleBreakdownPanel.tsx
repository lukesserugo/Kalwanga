// D:\Projects\Kalwanga\packages\web\components\sales\SaleBreakdownPanel.tsx

'use client';

import { Tag, Star, Sparkles } from 'lucide-react';
import {
  saleService,
  DISCOUNT_TYPE_LABELS,
} from '../../services/saleService';
import type { DiscountType } from '../../services/saleService';

interface SaleBreakdownPanelProps {
  /** Any object carrying the five breakdown fields — a `Sale`, a
   *  receipt, a POS transaction row, or the raw response body. */
  source: unknown;
  /** Currency symbol used when formatting amounts. Defaults to `$`. */
  currencySymbol?: string;
  /** Optional class applied to the outer wrapper. */
  className?: string;
  /** When `true`, renders a compact single-line summary instead of
   *  the expanded panel. Useful inside table cells and list rows. */
  compact?: boolean;
}

export function SaleBreakdownPanel({
  source,
  currencySymbol = '$',
  className = '',
  compact = false,
}: SaleBreakdownPanelProps) {
  if (!saleService.hasBreakdown(source)) return null;

  const breakdown = saleService.extractBreakdown(source);

  const promotionLabel = breakdown.discountType
    ? DISCOUNT_TYPE_LABELS[breakdown.discountType as DiscountType] ??
      String(breakdown.discountType)
    : 'Discount';

  const hasPromotion = (breakdown.promotionDiscount ?? 0) > 0;
  const hasLoyalty = (breakdown.loyaltyPointsUsed ?? 0) > 0;

  // ── Compact mode ─────────────────────────────────────────────
  // One line, suitable for table cells and list rows. Uses the
  // same describe helper the receipt footer uses so wording is
  // consistent everywhere.
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 ${className}`}
        title={saleService.describeBreakdown(source)}
      >
        {hasPromotion && <Tag className="w-3 h-3 text-brand-500 shrink-0" />}
        {hasLoyalty && (
          <Star className="w-3 h-3 text-warning-500 fill-current shrink-0" />
        )}
        <span className="truncate">
          {saleService.describeBreakdown(source)}
        </span>
      </span>
    );
  }

  // ── Expanded mode ────────────────────────────────────────────
  return (
    <section
      className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2 ${className}`}
      aria-label="Discount breakdown"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-brand-500" />
        Discount breakdown
      </h3>

      {hasPromotion && (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Tag className="w-3.5 h-3.5" />
            <span>{promotionLabel}</span>
            {breakdown.promotionCode && (
              <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[11px] font-mono tabular-nums">
                {breakdown.promotionCode}
              </code>
            )}
          </span>
          <span className="tabular-nums font-medium text-success-600 dark:text-success-400">
            -{currencySymbol}
            {(breakdown.promotionDiscount ?? 0).toFixed(2)}
          </span>
        </div>
      )}

      {hasLoyalty && (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Star className="w-3.5 h-3.5 text-warning-500 fill-current" />
            <span className="tabular-nums">
              {breakdown.loyaltyPointsUsed} loyalty points
            </span>
          </span>
          <span className="tabular-nums font-medium text-success-600 dark:text-success-400">
            -{currencySymbol}
            {(breakdown.loyaltyDiscount ?? 0).toFixed(2)}
          </span>
        </div>
      )}
    </section>
  );
}

export default SaleBreakdownPanel;
