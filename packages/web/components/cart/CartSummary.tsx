'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Percent,
  Gift,
  Wallet,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Truck,
  Sparkles,
  LogIn,
} from 'lucide-react';
import type { Cart } from '../../services/cartService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency } from '../../utils/formatters';

interface CartSummaryProps {
  cart: Cart;
  /**
   * Apply a numeric discount. The `type` is explicit — this component
   * no longer guesses between PERCENTAGE and FIXED from the raw input.
   */
  onApplyDiscountValue: (
    value: number,
    type: 'PERCENTAGE' | 'FIXED',
  ) => Promise<void>;
  onApplyPromotion: (code: string) => Promise<void>;
  onApplyLoyalty: (points: number) => Promise<void>;
  onCheckout: () => void;
  loading: boolean;
  customerId?: string;
  loyaltyPoints?: number;
  isAuthenticated?: boolean;
}

export const CartSummary: React.FC<CartSummaryProps> = ({
  cart,
  onApplyDiscountValue,
  onApplyPromotion,
  onApplyLoyalty,
  onCheckout,
  loading,
  customerId,
  loyaltyPoints = 0,
  isAuthenticated = true,
}) => {
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState<
    'PERCENTAGE' | 'FIXED'
  >('FIXED');
  const [promotionCode, setPromotionCode] = useState('');
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [showPromotionInput, setShowPromotionInput] = useState(false);
  const [showLoyaltyInput, setShowLoyaltyInput] = useState(false);
  const [applying, setApplying] = useState(false);

  const handleApplyDiscount = async () => {
    const parsed = parseFloat(discountValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('Please enter a valid discount');
      return;
    }
    if (discountType === 'PERCENTAGE' && parsed > 100) {
      toast.error('Percentage cannot exceed 100%');
      return;
    }

    setApplying(true);
    try {
      await onApplyDiscountValue(parsed, discountType);
      setDiscountValue('');
      setShowDiscountInput(false);
      toast.success('Discount applied successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to apply discount');
    } finally {
      setApplying(false);
    }
  };

  const handleApplyPromotion = async () => {
    const code = promotionCode.trim().toUpperCase();
    if (!code) {
      toast.error('Please enter a promotion code');
      return;
    }
    setApplying(true);
    try {
      await onApplyPromotion(code);
      setPromotionCode('');
      setShowPromotionInput(false);
      toast.success('Promotion applied successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to apply promotion');
    } finally {
      setApplying(false);
    }
  };

  const handleApplyLoyalty = async () => {
    if (!isAuthenticated) {
      toast.info('Sign in to use loyalty points');
      return;
    }
    if (!Number.isFinite(loyaltyPointsToUse) || loyaltyPointsToUse <= 0) {
      toast.error('Please enter valid points');
      return;
    }
    if (loyaltyPointsToUse > loyaltyPoints) {
      toast.error('Insufficient loyalty points');
      return;
    }
    setApplying(true);
    try {
      await onApplyLoyalty(loyaltyPointsToUse);
      setLoyaltyPointsToUse(0);
      setShowLoyaltyInput(false);
      toast.success('Loyalty points applied');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to apply loyalty points');
    } finally {
      setApplying(false);
    }
  };

  const hasDiscounts =
    (cart.discount || 0) > 0 ||
    (cart.promotionDiscount || 0) > 0 ||
    (cart.loyaltyDiscount || 0) > 0;

  const isEmpty =
    !cart.items || cart.items.length === 0 || cart.itemCount === 0;

  const canUseLoyalty =
    isAuthenticated && Boolean(customerId) && loyaltyPoints > 0;

  return (
    <div className="card-brand sticky top-24">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Order Summary
      </h2>

      {!isAuthenticated && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
          <LogIn className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
          <p className="text-xs text-brand-800 dark:text-brand-300">
            Sign in to unlock loyalty points, saved addresses, and order
            history.
          </p>
        </div>
      )}

      <div className="space-y-3 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Subtotal
          </span>
          <span className="font-medium text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(cart.subtotal)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Tax</span>
          <span className="font-medium text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(cart.tax)}
          </span>
        </div>
        {(cart.discount || 0) > 0 && (
          <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
            <span>Discount</span>
            <span className="tabular-nums">
              -{formatCurrency(cart.discount)}
            </span>
          </div>
        )}
        {(cart.promotionDiscount || 0) > 0 && (
          <div className="flex justify-between text-sm text-secondary-600 dark:text-secondary-400">
            <span>Promotion</span>
            <span className="tabular-nums">
              -{formatCurrency(cart.promotionDiscount || 0)}
            </span>
          </div>
        )}
        {(cart.loyaltyDiscount || 0) > 0 && (
          <div className="flex justify-between text-sm text-secondary-600 dark:text-secondary-400">
            <span>Loyalty Points</span>
            <span className="tabular-nums">
              -{formatCurrency(cart.loyaltyDiscount || 0)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-gray-900 dark:text-white">Total</span>
          <span className="text-brand-600 dark:text-brand-400 tabular-nums">
            {formatCurrency(cart.total)}
          </span>
        </div>
      </div>

      <div className="space-y-2 mt-4">
        {/* Discount (numeric) */}
        <div>
          <button
            type="button"
            onClick={() => setShowDiscountInput(!showDiscountInput)}
            className="flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors w-full justify-between focus-ring rounded"
            aria-expanded={showDiscountInput}
          >
            <span className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              {(cart.discount || 0) > 0
                ? 'Edit Discount'
                : 'Add Discount'}
            </span>
            {showDiscountInput ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <AnimatePresence initial={false}>
            {showDiscountInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex gap-2"
              >
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={discountType === 'PERCENTAGE' ? 100 : undefined}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={
                    discountType === 'PERCENTAGE'
                      ? 'Discount %'
                      : 'Discount amount'
                  }
                  inputMode="decimal"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm tabular-nums"
                  disabled={applying || loading}
                />
                <select
                  value={discountType}
                  onChange={(e) =>
                    setDiscountType(
                      e.target.value as 'PERCENTAGE' | 'FIXED',
                    )
                  }
                  disabled={applying || loading}
                  className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  aria-label="Discount type"
                >
                  <option value="FIXED">$</option>
                  <option value="PERCENTAGE">%</option>
                </select>
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  disabled={applying || loading || !discountValue}
                  className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all disabled:opacity-50 text-sm whitespace-nowrap focus-ring"
                >
                  {applying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Apply'
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Promotion (string code) */}
        <div>
          <button
            type="button"
            onClick={() => setShowPromotionInput(!showPromotionInput)}
            className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 transition-colors w-full justify-between focus-ring rounded"
            aria-expanded={showPromotionInput}
          >
            <span className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              {cart.promotionCode
                ? 'Edit Promotion'
                : 'Add Promotion Code'}
            </span>
            {showPromotionInput ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <AnimatePresence initial={false}>
            {showPromotionInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex gap-2"
              >
                <input
                  type="text"
                  value={promotionCode}
                  onChange={(e) =>
                    setPromotionCode(e.target.value.toUpperCase())
                  }
                  placeholder="Enter promotion code"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm uppercase font-mono"
                  disabled={applying || loading}
                />
                <button
                  type="button"
                  onClick={handleApplyPromotion}
                  disabled={applying || loading || !promotionCode.trim()}
                  className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm whitespace-nowrap focus-ring"
                >
                  {applying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Apply'
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Loyalty */}
        {canUseLoyalty && (
          <div>
            <button
              type="button"
              onClick={() => setShowLoyaltyInput(!showLoyaltyInput)}
              className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 transition-colors w-full justify-between focus-ring rounded"
              aria-expanded={showLoyaltyInput}
            >
              <span className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                {(cart.loyaltyPointsUsed || 0) > 0
                  ? 'Edit Loyalty Points'
                  : 'Use Loyalty Points'}
                <span className="text-xs text-gray-500 tabular-nums">
                  ({loyaltyPoints} available)
                </span>
              </span>
              {showLoyaltyInput ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            <AnimatePresence initial={false}>
              {showLoyaltyInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 flex gap-2"
                >
                  <input
                    type="number"
                    value={Number.isFinite(loyaltyPointsToUse) ? loyaltyPointsToUse : ''}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      setLoyaltyPointsToUse(
                        Number.isFinite(parsed) ? parsed : 0,
                      );
                    }}
                    placeholder="Points to use"
                    min="0"
                    max={loyaltyPoints}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm tabular-nums"
                    disabled={applying || loading}
                  />
                  <button
                    type="button"
                    onClick={handleApplyLoyalty}
                    disabled={
                      applying || loading || loyaltyPointsToUse <= 0
                    }
                    className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm whitespace-nowrap focus-ring"
                  >
                    {applying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Apply'
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={loading || isEmpty}
        className={`w-full mt-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-ring ${
          isAuthenticated
            ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand hover:shadow-brand-lg'
            : 'bg-brand-gradient hover:shadow-brand-lg text-white shadow-brand'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : isAuthenticated ? (
          <>
            Proceed to Checkout
            <ArrowRight className="w-5 h-5" />
          </>
        ) : (
          <>
            Sign in to Checkout
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>

      <Link
        href="/shop"
        className="block text-center mt-4 text-sm text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors focus-ring rounded"
      >
        Continue Shopping
      </Link>

      <div className="mt-4 flex flex-col items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-4 h-4" />
          <span>Secure checkout</span>
        </div>
        <div className="flex items-center gap-1">
          <Truck className="w-4 h-4" />
          <span>Free shipping on orders over $50</span>
        </div>
        {hasDiscounts && (
          <div className="flex items-center gap-1 text-success-600 dark:text-success-400">
            <Sparkles className="w-4 h-4" />
            <span>Savings applied!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartSummary;
