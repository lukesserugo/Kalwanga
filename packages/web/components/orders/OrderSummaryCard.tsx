// D:\Projects\Kalwanga\packages\web\components\orders\OrderSummaryCard.tsx

'use client';

import React from 'react';
import { Receipt } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

export interface OrderSummaryTotals {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  /**
   * Optional line-by-line breakdown of the discount. When present,
   * each entry is rendered as its own row above the total.
   */
  discountLines?: Array<{ label: string; amount: number }>;
  /**
   * Amount tendered by the customer. When provided and greater than
   * `total`, a "Change" row is shown.
   */
  paid?: number;
}

interface OrderSummaryCardProps {
  totals: OrderSummaryTotals;
  title?: string;
  /** Content rendered between totals and the actions slot. */
  children?: React.ReactNode;
  /** Content rendered at the bottom (e.g. a submit button). */
  actions?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

export function OrderSummaryCard({
  totals,
  title = 'Order Summary',
  children,
  actions,
  sticky = true,
  className = '',
}: OrderSummaryCardProps) {
  const change =
    typeof totals.paid === 'number' && totals.paid > totals.total
      ? totals.paid - totals.total
      : 0;

  return (
    <div
      className={`card-brand shadow-soft ${
        sticky ? 'sticky top-6' : ''
      } ${className}`}
    >
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Receipt className="w-4 h-4" />
        {title}
      </h2>

      <div className="space-y-2 text-sm">
        <SummaryRow label="Subtotal" value={totals.subtotal} />
        <SummaryRow label="Tax" value={totals.tax} />

        {totals.discountLines && totals.discountLines.length > 0 ? (
          totals.discountLines.map((line, index) => (
            <SummaryRow
              key={`${line.label}-${index}`}
              label={line.label}
              value={-Math.abs(line.amount)}
              tone="success"
            />
          ))
        ) : (
          totals.discount > 0 && (
            <SummaryRow
              label="Discount"
              value={-Math.abs(totals.discount)}
              tone="success"
            />
          )
        )}

        <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-3 border-t border-gray-200 dark:border-gray-700 text-base">
          <span>Total</span>
          <span className="tabular-nums">
            {formatCurrency(totals.total)}
          </span>
        </div>

        {typeof totals.paid === 'number' && totals.paid > 0 && (
          <>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Paid</span>
              <span className="tabular-nums">
                {formatCurrency(totals.paid)}
              </span>
            </div>

            {change > 0 && (
              <div className="flex justify-between text-success-600 dark:text-success-400">
                <span>Change</span>
                <span className="tabular-nums">
                  {formatCurrency(change)}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {children && <div className="mt-5 space-y-4">{children}</div>}

      {actions && <div className="mt-5">{actions}</div>}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function SummaryRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success-600 dark:text-success-400'
      : tone === 'danger'
        ? 'text-danger-600 dark:text-danger-400'
        : 'text-gray-600 dark:text-gray-400';

  return (
    <div className={`flex justify-between ${toneClass}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}

export default OrderSummaryCard;
