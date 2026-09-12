'use client';

import React, { useState } from 'react';
import {
  X,
  DollarSign,
  AlertCircle,
  Check,
  Loader2,
  Percent,
  Calculator
} from 'lucide-react';
import { useToast } from '../../../utils/toast-manager';
import { formatCurrency } from '../../../utils/formatters';

interface PriceOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { productName: string; originalPrice: number; newPrice: number; reason: string }) => void;
}

export function PriceOverrideModal({
  isOpen,
  onClose,
  onConfirm,
}: PriceOverrideModalProps) {
  const { showToast } = useToast();
  const [productName, setProductName] = useState('');
  const [originalPrice, setOriginalPrice] = useState<number>(0);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [overrideType, setOverrideType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePriceChange = (value: number) => {
    setOriginalPrice(value);
    if (overrideType === 'percentage' && discountPercent > 0) {
      setNewPrice(value * (1 - discountPercent / 100));
    }
  };

  const handleDiscountChange = (value: number) => {
    setDiscountPercent(value);
    if (originalPrice > 0) {
      setNewPrice(originalPrice * (1 - value / 100));
    }
  };

  const handleSubmit = () => {
    if (!productName.trim()) {
      showToast('Please enter a product name', 'warning');
      return;
    }
    if (originalPrice <= 0) {
      showToast('Please enter a valid original price', 'warning');
      return;
    }
    if (newPrice <= 0) {
      showToast('Please enter a valid new price', 'warning');
      return;
    }
    if (!reason.trim()) {
      showToast('Please provide a reason for the override', 'warning');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      onConfirm({
        productName: productName.trim(),
        originalPrice,
        newPrice,
        reason: reason.trim(),
      });
      setIsSubmitting(false);
      resetForm();
    }, 500);
  };

  const resetForm = () => {
    setProductName('');
    setOriginalPrice(0);
    setNewPrice(0);
    setReason('');
    setDiscountPercent(0);
    setOverrideType('fixed');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-500" />
              Price Override
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Override product pricing for special circumstances
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter product name"
            />
          </div>

          {/* Price Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Original Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={originalPrice || ''}
                  onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPrice || ''}
                  onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Override Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Override Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setOverrideType('fixed');
                  setDiscountPercent(0);
                }}
                className={`flex-1 px-4 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                  overrideType === 'fixed'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Fixed Amount
              </button>
              <button
                onClick={() => {
                  setOverrideType('percentage');
                  if (originalPrice > 0) {
                    setNewPrice(originalPrice * (1 - discountPercent / 100));
                  }
                }}
                className={`flex-1 px-4 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                  overrideType === 'percentage'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Percent className="w-4 h-4" />
                Percentage
              </button>
            </div>
          </div>

          {/* Discount Percentage (if percentage mode) */}
          {overrideType === 'percentage' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Discount Percentage
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={discountPercent || ''}
                  onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason for Override <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select a reason...</option>
              <option value="price_match">Price Match</option>
              <option value="customer_discount">Customer Discount</option>
              <option value="damaged_item">Damaged Item</option>
              <option value="clearance">Clearance Sale</option>
              <option value="loyalty_discount">Loyalty Discount</option>
              <option value="volume_discount">Volume Discount</option>
              <option value="promotional">Promotional Offer</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Summary */}
          {originalPrice > 0 && newPrice > 0 && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Original Price</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(originalPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">New Price</span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">{formatCurrency(newPrice)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-gray-600 dark:text-gray-400">Total Savings</span>
                <span className="text-green-600 dark:text-green-400">{formatCurrency(originalPrice - newPrice)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isSubmitting ? 'Applying...' : 'Apply Override'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
