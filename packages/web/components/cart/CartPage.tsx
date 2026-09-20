'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  RefreshCw,
  Trash2,
  AlertCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cartService, Cart } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { toast } from '../../utils/toast-manager';

import CartItemCard from './CartItemCard';
import CartSummary from './CartSummary';
import CartSkeleton from './CartSkeleton';
import EmptyCart from './EmptyCart';

interface CartPageProps {
  className?: string;
}

export function CartPage({ className = '' }: CartPageProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | undefined>(
    undefined,
  );
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);

  const activeCartService = useMemo(
    () => (isAuthenticated ? cartService : guestCartService),
    [isAuthenticated],
  );

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const cartData = await activeCartService.getCart();
      setCart(cartData);

      if (cartData.customerId) {
        setCustomerId(cartData.customerId);
      } else {
        setCustomerId(undefined);
        setLoyaltyPoints(0);
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch cart:', error);
      if (error?.response?.status === 401 && isAuthenticated) {
        router.push(
          `/login?redirect_url=${encodeURIComponent('/cart')}`,
        );
      } else {
        setError(error?.message || 'Failed to load cart');
        toast.error('Failed to load cart');
      }
    } finally {
      setLoading(false);
    }
  }, [activeCartService, isAuthenticated, router]);

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (quantity < 1) return;

      setUpdating(itemId);
      try {
        const updatedCart =
          await activeCartService.updateItemQuantity(itemId, quantity);
        setCart(updatedCart);
      } catch (error: any) {
        console.error('❌ Failed to update quantity:', error);
        toast.error(error?.message || 'Failed to update quantity');
        await fetchCart();
      } finally {
        setUpdating(null);
      }
    },
    [activeCartService, fetchCart],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      setUpdating(itemId);
      try {
        const updatedCart =
          await activeCartService.removeItem(itemId);
        setCart(updatedCart);
        toast.success('Item removed from cart');
        window.dispatchEvent(new CustomEvent('cart:updated'));
      } catch (error: any) {
        console.error('❌ Failed to remove item:', error);
        toast.error(error?.message || 'Failed to remove item');
        await fetchCart();
      } finally {
        setUpdating(null);
      }
    },
    [activeCartService, fetchCart],
  );

  const clearCart = useCallback(async () => {
    if (
      !window.confirm(
        'Are you sure you want to clear your entire cart?',
      )
    )
      return;

    try {
      const updatedCart = await activeCartService.clearCart();
      setCart(updatedCart);
      toast.success('Cart cleared');
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } catch (error: any) {
      console.error('❌ Failed to clear cart:', error);
      toast.error(error?.message || 'Failed to clear cart');
    }
  }, [activeCartService]);

  const applyDiscount = useCallback(
    async (code: string) => {
      try {
        const discountValue = parseFloat(code);
        if (!isNaN(discountValue) && discountValue > 0) {
          const updatedCart = await activeCartService.applyDiscount(
            discountValue,
            'FIXED',
          );
          setCart(updatedCart);
        } else {
          const updatedCart =
            await activeCartService.applyPromotion(code);
          setCart(updatedCart);
        }
      } catch (error: any) {
        console.error('❌ Failed to apply discount:', error);
        throw error;
      }
    },
    [activeCartService],
  );

  const applyPromotion = useCallback(
    async (code: string) => {
      try {
        const updatedCart = await activeCartService.applyPromotion(code);
        setCart(updatedCart);
      } catch (error: any) {
        console.error('❌ Failed to apply promotion:', error);
        throw error;
      }
    },
    [activeCartService],
  );

  const applyLoyaltyPoints = useCallback(
    async (points: number) => {
      if (!isAuthenticated) {
        toast.info('Sign in to use loyalty points');
        return;
      }
      if (!customerId) {
        toast.error('Please associate a customer with this cart');
        return;
      }
      try {
        const updatedCart = await cartService.applyLoyaltyPoints(
          customerId,
          points,
        );
        setCart(updatedCart);
        setLoyaltyPoints((prev) => Math.max(0, prev - points));
      } catch (error: any) {
        console.error('❌ Failed to apply loyalty points:', error);
        throw error;
      }
    },
    [customerId, isAuthenticated],
  );

  const proceedToCheckout = useCallback(() => {
    if (!cart || cart.items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    if (!isAuthenticated) {
      router.push(
        `/login?redirect_url=${encodeURIComponent('/checkout')}`,
      );
      return;
    }

    router.push('/checkout');
  }, [cart, isAuthenticated, router]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  if (loading) {
    return (
      <div
        className={`min-h-screen bg-gray-50 dark:bg-gray-900 py-12 ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Your Cart
            </h1>
          </div>
          <CartSkeleton />
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div
        className={`min-h-screen bg-gray-50 dark:bg-gray-900 py-12 ${className}`}
      >
        <div className="max-w-3xl mx-auto px-4">
          <EmptyCart />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-gray-50 dark:bg-gray-900 py-8 sm:py-12 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <ShoppingCart className="w-7 h-7 sm:w-8 sm:h-8 text-brand-500" />
              Your Cart
              {cart.itemCount > 0 && (
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 tabular-nums">
                  ({cart.itemCount}{' '}
                  {cart.itemCount === 1 ? 'item' : 'items'})
                </span>
              )}
            </h1>
            {cart.customer && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Customer: {cart.customer.firstName}{' '}
                {cart.customer.lastName}
              </p>
            )}
            {!isAuthenticated && (
              <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-2xs font-medium bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
                Guest cart
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchCart();
                toast.success('Cart refreshed');
              }}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring"
              aria-label="Refresh cart"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={clearCart}
              className="px-3 py-2 text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors text-sm flex items-center gap-1 focus-ring"
            >
              <Trash2 className="w-4 h-4" />
              Clear Cart
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-2xl p-4 flex items-start gap-3 animate-slide-down">
            <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-danger-800 dark:text-danger-200">
                {error}
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-danger-600 hover:text-danger-800 dark:text-danger-400 p-1 focus-ring rounded"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="popLayout">
              {cart.items.map((item) => (
                <CartItemCard
                  key={item.id}
                  id={item.id}
                  productId={item.productId}
                  productName={item.product.name}
                  sku={item.product.sku}
                  quantity={item.quantity}
                  unitPrice={item.unitPrice}
                  total={item.total}
                  images={item.product.images}
                  variantName={item.variant?.name}
                  availableStock={item.availableStock}
                  isInStock={item.isInStock}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                  isUpdating={updating === item.id}
                />
              ))}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-1">
            <CartSummary
              cart={cart}
              onApplyDiscount={applyDiscount}
              onApplyPromotion={applyPromotion}
              onApplyLoyalty={applyLoyaltyPoints}
              onCheckout={proceedToCheckout}
              loading={loading}
              customerId={customerId}
              loyaltyPoints={loyaltyPoints}
              isAuthenticated={isAuthenticated}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CartPage;
