// D:\Projects\Kalwanga\packages\web\components\sales\SaleRow.tsx

'use client';

import Link from 'next/link';
import { Receipt, User } from 'lucide-react';
import { SaleBreakdownPanel } from './SaleBreakdownPanel';
import { formatCurrency } from '../../utils/formatters';
import type { Sale } from '../../types/sale';

interface SaleRowProps {
  sale: Sale;
  /** Optional href to a sale detail page. Defaults to nothing. */
  href?: string;
  /** Optional class applied to the outer wrapper. */
  className?: string;
}

export function SaleRow({ sale, href, className = '' }: SaleRowProps) {
  const content = (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-brand-300 dark:hover:border-brand-700 transition-colors ${className}`}
    >
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 shrink-0">
        <Receipt className="w-5 h-5" />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {sale.receiptNumber}
          </p>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {new Date(sale.saleDate).toLocaleDateString()}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {sale.customer
              ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim()
              : 'Guest'}
          </span>
          <SaleBreakdownPanel source={sale} compact />
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="font-semibold tabular-nums text-gray-900 dark:text-white">
          {formatCurrency(sale.total)}
        </p>
        {(sale.discount ?? 0) > 0 && (
          <p className="text-xs text-success-600 dark:text-success-400 tabular-nums">
            -{formatCurrency(sale.discount)}
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-ring rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}

export default SaleRow;
