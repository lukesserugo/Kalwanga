'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '../../utils/formatters';

interface CheckoutSuccessToastProps {
  isOpen: boolean;
  onClose: () => void;
  receiptNumber: string;
  orderId: string;
  total: number;
}

export function CheckoutSuccessToast({
  isOpen,
  onClose,
  receiptNumber,
  orderId,
  total,
}: CheckoutSuccessToastProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-4 right-4 z-toast max-w-md w-full"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-success-600 dark:text-success-400" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Order Placed!
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                  Order #{receiptNumber} - {formatCurrency(total)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/order-confirmation/${orderId}`}
                    className="text-sm px-3 py-1.5 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all focus-ring"
                  >
                    View Order
                  </Link>
                  <button
                    onClick={onClose}
                    className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 focus-ring"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
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
