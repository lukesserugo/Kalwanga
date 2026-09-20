// D:\Projects\Kalwanga\packages\web\components\cart\CartSummary.tsx

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
  onApplyDiscount: (code: string) => Promise<void>;
  onApplyPromotion: (code: string) => Promise<void>;
  onApplyLoyalty: (points: number) => Promise<void>;
  onCheckout: () => void;
  loading: boolean;
  customerId?: string;
  loyaltyPoints?: number;
  /**
   * Whether the current viewer is signed in. Loyalty redemption and
   * the customer association flow are only available to authenticated
   * users. Defaults to `true` for backward compatibility with callers
   * that haven't been updated yet.
   */
  isAuthenticated?: boolean;
}

export const CartSummary: React.FC<CartSummaryProps> = ({
  cart,
  onApplyDiscount,
  onApplyPromotion,
  onApplyLoyalty,
  onCheckout,
  loading,
  customerId,
  loyaltyPoints = 0,
  isAuthenticated = true,
}) => {
  const [discountCode, setDiscountCode] = useState('');
  const [promotionCode, setPromotionCode] = useState('');
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [showPromotionInput, setShowPromotionInput] = useState(false);
  const [showLoyaltyInput, setShowLoyaltyInput] = useState(false);
  const [applying, setApplying] = useState(false);

  // ============================================
  // HANDLERS
  // ============================================

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) {
      toast.error('Please enter a discount code');
      return;
    }
    setApplying(true);
    try {
      await onApplyDiscount(discountCode.trim());
      setDiscountCode('');
      setShowDiscountInput(false);
      toast.success('Discount applied successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to apply discount');
    } finally {
      setApplying(false);
    }
  };

  const handleApplyPromotion = async () => {
    if (!promotionCode.trim()) {
      toast.error('Please enter a promotion code');
      return;
    }
    setApplying(true);
    try {
      await onApplyPromotion(promotionCode.trim().toUpperCase());
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
    if (loyaltyPointsToUse <= 0) {
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

  // ============================================
  // DERIVED
  // ============================================

  const hasDiscounts =
    (cart.discount || 0) > 0 ||
    (cart.promotionDiscount || 0) > 0 ||
    (cart.loyaltyDiscount || 0) > 0;

  const isEmpty =
    !cart.items ||
    cart.items.length === 0 ||
    cart.itemCount === 0;

  // Loyalty widget only renders when:
  //  - the user is authenticated, AND
  //  - a customer is associated with the cart, AND
  //  - the customer actually has points to spend
  const canUseLoyalty =
    isAuthenticated && Boolean(customerId) && loyaltyPoints > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sticky top-24">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Order Summary
      </h2>

      {/* Guest notice — why some controls are hidden */}
      {!isAuthenticated && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <LogIn className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 dark:text-blue-300">
            Sign in to unlock loyalty points, saved addresses, and order
            history.
          </p>
        </div>
      )}

      {/* ============================================
          CART TOTALS
          ============================================ */}
      <div className="space-y-3 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Subtotal
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(cart.subtotal)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Tax
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(cart.tax)}
          </span>
        </div>
        {(cart.discount || 0) > 0 && (
          <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
            <span>Discount</span>
            <span>-{formatCurrency(cart.discount)}</span>
          </div>
        )}
        {(cart.promotionDiscount || 0) > 0 && (
          <div className="flex justify-between text-sm text-purple-600 dark:text-purple-400">
            <span>Promotion</span>
            <span>
              -{formatCurrency(cart.promotionDiscount || 0)}
            </span>
          </div>
        )}
        {(cart.loyaltyDiscount || 0) > 0 && (
          <div className="flex justify-between text-sm text-indigo-600 dark:text-indigo-400">
            <span>Loyalty Points</span>
            <span>
              -{formatCurrency(cart.loyaltyDiscount || 0)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-gray-900 dark:text-white">Total</span>
          <span className="text-blue-600 dark:text-blue-400">
            {formatCurrency(cart.total)}
          </span>
        </div>
      </div>

      {/* ============================================
          DISCOUNT / PROMOTION / LOYALTY INPUTS
          ============================================ */}
      <div className="space-y-2 mt-4">
        {/* Discount */}
        <div>
          <button
            type="button"
            onClick={() => setShowDiscountInput(!showDiscountInput)}
            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors w-full justify-between"
            aria-expanded={showDiscountInput}
          >
            <span className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              {(cart.discount || 0) > 0
                ? 'Edit Discount'
                : 'Add Discount Code'}
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
                  type="text"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder="Enter discount code"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                  disabled={applying || loading}
                />
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  disabled={applying || loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
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

        {/* Promotion */}
        <div>
          <button
            type="button"
            onClick={() =>
              setShowPromotionInput(!showPromotionInput)
            }
            className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors w-full justify-between"
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
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm uppercase"
                  disabled={applying || loading}
                />
                <button
                  type="button"
                  onClick={handleApplyPromotion}
                  disabled={applying || loading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
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

        {/* Loyalty Points — gated on authentication + customer + balance */}
        {canUseLoyalty && (
          <div>
            <button
              type="button"
              onClick={() => setShowLoyaltyInput(!showLoyaltyInput)}
              className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors w-full justify-between"
              aria-expanded={showLoyaltyInput}
            >
              <span className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                {(cart.loyaltyPointsUsed || 0) > 0
                  ? 'Edit Loyalty Points'
                  : 'Use Loyalty Points'}
                <span className="text-xs text-gray-500">
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
                    value={loyaltyPointsToUse}
                    onChange={(e) =>
                      setLoyaltyPointsToUse(
                        parseInt(e.target.value) || 0,
                      )
                    }
                    placeholder="Points to use"
                    min="0"
                    max={loyaltyPoints}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                    disabled={applying || loading}
                  />
                  <button
                    type="button"
                    onClick={handleApplyLoyalty}
                    disabled={
                      applying ||
                      loading ||
                      loyaltyPointsToUse <= 0
                    }
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
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

      {/* ============================================
          CHECKOUT BUTTON
          ============================================ */}
      <button
        type="button"
        onClick={onCheckout}
        disabled={loading || isEmpty}
        className={`w-full mt-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
          isAuthenticated
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
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

      {/* Continue Shopping */}
      <Link
        href="/shop"
        className="block text-center mt-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
      >
        Continue Shopping
      </Link>

      {/* ============================================
          FOOTER BADGES
          ============================================ */}
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
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <Sparkles className="w-4 h-4" />
            <span>Savings applied!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartSummary;
