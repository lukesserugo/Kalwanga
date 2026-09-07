// D:\Projects\Kalwanga\packages\web\components\cart\CartItemCard.tsx

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, Plus, Minus, Package, AlertCircle } from 'lucide-react';
import Image from 'next/image';
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
  availableStock: number;
  isInStock: boolean;
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void> | void;
  onRemove: (itemId: string) => Promise<void> | void;
  isUpdating?: boolean;
  disabled?: boolean;
}

export function CartItemCard({
  id,
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
  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > availableStock) return;
    onUpdateQuantity(id, newQuantity);
  };

  const handleRemove = () => {
    if (!disabled) onRemove(id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border ${
        !isInStock ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-700'
      } hover:shadow-md transition-shadow duration-200`}
    >
      {/* Product Image */}
      <div className="flex-shrink-0 w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
        {images.length > 0 ? (
          <Image
            src={images[0]}
            alt={productName}
            width={80}
            height={80}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-8 h-8 text-gray-400" />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 dark:text-white truncate">{productName}</h4>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">SKU: {sku}</span>
          {variantName && (
            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
              {variantName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(unitPrice)}
          </span>
          {!isInStock && (
            <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-3 h-3" />
              Out of Stock
            </span>
          )}
          {availableStock <= 5 && availableStock > 0 && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400">
              Only {availableStock} left
            </span>
          )}
        </div>
      </div>

      {/* Quantity Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleQuantityChange(quantity - 1)}
          disabled={isUpdating || quantity <= 1 || disabled || !isInStock}
          className="w-8 h-8 flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
        </button>
        <span className="w-8 text-center text-sm font-medium text-gray-900 dark:text-white">
          {isUpdating ? '...' : quantity}
        </span>
        <button
          onClick={() => handleQuantityChange(quantity + 1)}
          disabled={isUpdating || quantity >= availableStock || disabled || !isInStock}
          className="w-8 h-8 flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Total & Remove */}
      <div className="flex flex-col items-end min-w-[80px]">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {formatCurrency(total)}
        </span>
        <button
          onClick={handleRemove}
          disabled={isUpdating || disabled}
          className="mt-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Remove
        </button>
      </div>
    </motion.div>
  );
}

// ✅ Keep default export for backwards compatibility
export default CartItemCard;
