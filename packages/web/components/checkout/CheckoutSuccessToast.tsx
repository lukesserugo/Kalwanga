// packages/web/components/payment/CheckoutSuccessToast.tsx

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '../../utils/formatters';

// ============================================
// CURRENCY RESOLUTION
// ============================================
//
// `formatCurrency` requires a currency code as its second argument
// by design — the platform invariant is that every amount is
// rendered in a code that came from the backend at request time.
//
// The Sale / Order that fires this toast carries its own `currency`
// column, resolved server-side from the business unit's ledger
// currency. The caller should pass it via the `currency` prop.
//
// When the prop is absent, we fall back to the deployment default
// (`NEXT_PUBLIC_DEFAULT_CURRENCY`) — never a hardcoded `'USD'`.
// If that env var is also unset, we render a bare number so the
// caller sees the missing configuration rather than a fabricated
// symbol.

/**
 * Resolve the currency code for the toast.
 *
 * Priority:
 *   1. The `currency` prop (the row's own code, when the caller
 *      has one).
 *   2. `NEXT_PUBLIC_DEFAULT_CURRENCY` — the deployment default.
 *   3. `''` — an empty string, which `formatCurrency` renders as
 *      a bare number.
 */
function resolveToastCurrency(propCurrency?: string | null): string {
  return (
    propCurrency ||
    process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ||
    ''
  );
}

interface CheckoutSuccessToastProps {
  isOpen: boolean;
  onClose: () => void;
  receiptNumber: string;
  orderId: string;
  total: number;
  /**
   * Ledger currency code for `total`. Read from the Sale / Order
   * row that produced this toast.
   *
   * ⚠ When omitted, the deployment's `NEXT_PUBLIC_DEFAULT_CURRENCY`
   *   is used. Never a hardcoded symbol. When that env is also
   *   unset, the total renders as a bare number.
   */
  currency?: string;
}

export function CheckoutSuccessToast({
  isOpen,
  onClose,
  receiptNumber,
  orderId,
  total,
  currency,
}: CheckoutSuccessToastProps) {
  const formattedTotal = formatCurrency(
    total,
    resolveToastCurrency(currency),
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-4 right-4 z-50 max-w-md w-full"
          role="status"
          aria-live="polite"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-success-600 dark:text-success-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Order Placed!
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums truncate">
                  Order #{receiptNumber} - {formattedTotal}
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/order-confirmation/${orderId}`}
                    className="text-sm px-3 py-1.5 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all focus-ring"
                  >
                    View Order
                  </Link>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 focus-ring"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                aria-label="Close notification"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CheckoutSuccessToast;
