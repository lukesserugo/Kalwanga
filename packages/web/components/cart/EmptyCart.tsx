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
    'bg-brand-gradient ' +
    'hover:shadow-brand-lg ' +
    'text-white rounded-lg font-medium transition-all duration-200 ' +
    'shadow-brand ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ' +
    'dark:focus:ring-offset-gray-900';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      <div className="w-24 h-24 bg-gradient-to-br from-brand-100 to-warning-100 dark:from-brand-900/20 dark:to-warning-900/20 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-12 h-12 text-brand-500" />
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
