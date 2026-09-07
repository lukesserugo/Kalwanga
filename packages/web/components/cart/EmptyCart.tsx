// D:\Projects\Kalwanga\packages\web\components\cart\EmptyCart.tsx

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ShoppingBag, ArrowRight } from 'lucide-react';

interface EmptyCartProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyCart({
  title = 'Your cart is empty',
  description = 'Browse our products and add items to your cart.',
  actionLabel = 'Start Shopping',
  actionHref = '/',
  onAction,
}: EmptyCartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
        <ShoppingBag className="w-12 h-12 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm mb-6">{description}</p>
      {onAction ? (
        <button
          onClick={onAction}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          {actionLabel}
          <ArrowRight className="w-4 h-4" />
        </button>
      ) : (
        <Link
          href={actionHref}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          {actionLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </motion.div>
  );
}

// ✅ Keep default export for backwards compatibility
export default EmptyCart;
