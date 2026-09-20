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
  /**
   * Where the default action link points. Defaults to `/shop` because
   * the storefront home (`/`) is a marketing page and shoppers
   * expect "Start Shopping" to land them on products.
   */
  actionHref?: string;
  /**
   * Custom action handler. When provided, this replaces the default
   * link — the component renders a `<button>` instead of an
   * `<a>`.
   */
  onAction?: () => void;
  /**
   * Optional icon override. Defaults to a shopping bag. Pass any
   * Lucide icon component to change the illustration.
   */
  Icon?: React.ComponentType<{ className?: string }>;
}

export function EmptyCart({
  title = 'Your cart is empty',
  description = 'Browse our products and add items to your cart.',
  actionLabel = 'Start Shopping',
  actionHref = '/shop',
  onAction,
  Icon = ShoppingBag,
}: EmptyCartProps) {
  const actionClasses =
    'inline-flex items-center gap-2 px-6 py-3 ' +
    'bg-gradient-to-r from-orange-500 to-red-500 ' +
    'hover:from-orange-600 hover:to-red-600 ' +
    'text-white rounded-lg font-medium transition-all duration-200 ' +
    'shadow-md hover:shadow-lg ' +
    'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ' +
    'dark:focus:ring-offset-gray-900';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-12 h-12 text-orange-500" />
      </div>

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
        {title}
      </h3>

      <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm mb-6">
        {description}
      </p>

      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className={actionClasses}
        >
          {actionLabel}
          <ArrowRight className="w-4 h-4" />
        </button>
      ) : (
        <Link href={actionHref} className={actionClasses}>
          {actionLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </motion.div>
  );
}

export default EmptyCart;
