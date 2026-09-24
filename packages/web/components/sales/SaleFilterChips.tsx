// D:\Projects\Kalwanga\packages\web\components\sales\SaleFilterChips.tsx

'use client';

import { Sparkles } from 'lucide-react';

export type SaleFilterMode = 'all' | 'discounted';

interface SaleFilterChipsProps {
  value: SaleFilterMode;
  onChange: (next: SaleFilterMode) => void;
  /** Optional count of discounted sales in the current page. */
  discountedCount?: number;
  className?: string;
}

export function SaleFilterChips({
  value,
  onChange,
  discountedCount,
  className = '',
}: SaleFilterChipsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus-ring ${
          value === 'all'
            ? 'bg-brand-gradient text-white shadow-brand'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        All
      </button>

      <button
        type="button"
        onClick={() => onChange('discounted')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus-ring ${
          value === 'discounted'
            ? 'bg-brand-gradient text-white shadow-brand'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Discounted
        {typeof discountedCount === 'number' && discountedCount > 0 && (
          <span
            className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums ${
              value === 'discounted'
                ? 'bg-white/25 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400'
            }`}
          >
            {discountedCount > 99 ? '99+' : discountedCount}
          </span>
        )}
      </button>
    </div>
  );
}

export default SaleFilterChips;
