// D:\Projects\Kalwanga\packages\web\components\cart\CartItemCard.tsx

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Trash2,
  Plus,
  Minus,
  Package,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface CartItemCardProps {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  images?: string[];
  variantName?: string;
  /** Live inventory from the backend. */
  availableStock: number;
  isInStock: boolean;
  onUpdateQuantity: (
    itemId: string,
    quantity: number,
  ) => Promise<void> | void;
  onRemove: (itemId: string) => Promise<void> | void;
  isUpdating?: boolean;
  disabled?: boolean;
}

export function CartItemCard({
  id,
  productId,
  productName,
  sku,
  quantity,
  unitPrice,
  total,
  images = [],
  variantName,
  availableStock,
  isInStock,
  onUpdateQuantity,
  onRemove,
  isUpdating = false,
  disabled = false,
}: CartItemCardProps) {
  // Prevent spamming: refuse when there's nothing to change.
  const atMinimum = quantity <= 1;
  const atMaximum =
    availableStock > 0 && quantity >= availableStock;

  const handleQuantityChange = (newQuantity: number) => {
    if (isUpdating || disabled) return;
    if (newQuantity < 1) return;
    if (availableStock > 0 && newQuantity > availableStock) return;
    onUpdateQuantity(id, newQuantity);
  };

  const handleRemove = () => {
    if (!disabled && !isUpdating) onRemove(id);
  };

  const imageSrc = images[0];
  const hasImage = Boolean(imageSrc);

  // ============================================
  // RENDER
  // ============================================

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl border ${
        !isInStock
          ? 'border-red-200 dark:border-red-800'
          : 'border-gray-200 dark:border-gray-700'
      } hover:shadow-md transition-shadow duration-200`}
    >
      {/* Product image */}
      <Link
        href={`/shop/${productId}`}
        className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
      >
        {hasImage ? (
          <img
            src={imageSrc}
            alt={productName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-8 h-8 text-gray-400" />
          </div>
        )}
      </Link>

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/shop/${productId}`}
          className="font-medium text-gray-900 dark:text-white truncate hover:text-orange-600 dark:hover:text-orange-400 transition-colors block"
          title={productName}
        >
          {productName}
        </Link>

        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            SKU: {sku}
          </span>
          {variantName && (
            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
              {variantName}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(unitPrice)}
          </span>

          {!isInStock && (
            <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
              <AlertCircle className="w-3 h-3" />
              Out of Stock
            </span>
          )}

          {isInStock && availableStock > 0 && availableStock <= 5 && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
              Only {availableStock} left
            </span>
          )}
        </div>

        {/* Quantity + total on mobile */}
        <div className="flex items-center justify-between gap-3 mt-2 sm:hidden">
          <QuantityStepper
            quantity={quantity}
            isUpdating={isUpdating}
            atMinimum={atMinimum}
            atMaximum={atMaximum}
            disabled={disabled || !isInStock}
            onChange={handleQuantityChange}
          />
          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {/* Quantity + total + remove (desktop) */}
      <div className="hidden sm:flex items-center gap-3 sm:gap-4 shrink-0">
        <QuantityStepper
          quantity={quantity}
          isUpdating={isUpdating}
          atMinimum={atMinimum}
          atMaximum={atMaximum}
          disabled={disabled || !isInStock}
          onChange={handleQuantityChange}
        />

        <div className="flex flex-col items-end min-w-[80px]">
          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(total)}
          </span>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isUpdating || disabled}
            className="mt-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            aria-label={`Remove ${productName} from cart`}
          >
            <Trash2 className="w-3 h-3" />
            Remove
          </button>
        </div>
      </div>

      {/* Remove button (mobile) */}
      <button
        type="button"
        onClick={handleRemove}
        disabled={isUpdating || disabled}
        className="sm:hidden p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
        aria-label={`Remove ${productName} from cart`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// ============================================
// QUANTITY STEPPER
// ============================================

interface QuantityStepperProps {
  quantity: number;
  isUpdating: boolean;
  atMinimum: boolean;
  atMaximum: boolean;
  disabled: boolean;
  onChange: (next: number) => void;
}

function QuantityStepper({
  quantity,
  isUpdating,
  atMinimum,
  atMaximum,
  disabled,
  onChange,
}: QuantityStepperProps) {
  return (
    <div className="flex items-center bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        disabled={isUpdating || atMinimum || disabled}
        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Decrease quantity"
      >
        <Minus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
      </button>

      <span
        className="w-9 text-center text-sm font-medium text-gray-900 dark:text-white tabular-nums flex items-center justify-center"
        aria-live="polite"
        aria-atomic="true"
      >
        {isUpdating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
        ) : (
          quantity
        )}
      </span>

      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        disabled={isUpdating || atMaximum || disabled}
        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Increase quantity"
      >
        <Plus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
      </button>
    </div>
  );
}

export default CartItemCard;
