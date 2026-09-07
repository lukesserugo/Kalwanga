// D:\Projects\Kalwanga\packages\web\components\cart\CartPage.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, RefreshCw, Trash2, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cartService, Cart } from '../../services/cartService';
import { toast } from '../../utils/toast-manager';
// ✅ Fix: Use default imports since components export default
import CartItemCard from './CartItemCard';
import CartSummary from './CartSummary';
import CartSkeleton from './CartSkeleton';
import EmptyCart from './EmptyCart';

interface CartPageProps {
  className?: string;
}

export function CartPage({ className = '' }: CartPageProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);

  // ============================================
  // FETCH CART
  // ============================================

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🛒 Fetching cart...');
      
      const cartData = await cartService.getCart();
      console.log('📥 Cart data:', cartData);
      
      setCart(cartData);
      
      if (cartData.customerId) {
        setCustomerId(cartData.customerId);
        // TODO: Fetch loyalty points from API
        setLoyaltyPoints(100);
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch cart:', error);
      if (error?.response?.status === 401) {
        router.push('/login?redirect=/cart');
      } else {
        setError(error?.message || 'Failed to load cart');
        toast.error('Failed to load cart');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  // ============================================
  // CART OPERATIONS
  // ============================================

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    
    setUpdating(itemId);
    try {
      console.log(`🛒 Updating item ${itemId} quantity to ${quantity}`);
      const updatedCart = await cartService.updateItemQuantity(itemId, quantity);
      setCart(updatedCart);
    } catch (error: any) {
      console.error('❌ Failed to update quantity:', error);
      toast.error(error?.message || 'Failed to update quantity');
      await fetchCart();
    } finally {
      setUpdating(null);
    }
  }, [fetchCart]);

  const removeItem = useCallback(async (itemId: string) => {
    setUpdating(itemId);
    try {
      console.log(`🛒 Removing item ${itemId} from cart`);
      const updatedCart = await cartService.removeItem(itemId);
      setCart(updatedCart);
      toast.success('Item removed from cart');
    } catch (error: any) {
      console.error('❌ Failed to remove item:', error);
      toast.error(error?.message || 'Failed to remove item');
      await fetchCart();
    } finally {
      setUpdating(null);
    }
  }, [fetchCart]);

  const clearCart = useCallback(async () => {
    if (!window.confirm('Are you sure you want to clear your entire cart?')) return;
    
    try {
      console.log('🛒 Clearing cart');
      const updatedCart = await cartService.clearCart();
      setCart(updatedCart);
      toast.success('Cart cleared');
    } catch (error: any) {
      console.error('❌ Failed to clear cart:', error);
      toast.error(error?.message || 'Failed to clear cart');
    }
  }, []);

  const applyDiscount = useCallback(async (code: string) => {
    try {
      console.log(`🛒 Applying discount: ${code}`);
      const updatedCart = await cartService.applyDiscount(parseFloat(code));
      setCart(updatedCart);
    } catch (error: any) {
      console.error('❌ Failed to apply discount:', error);
      throw error;
    }
  }, []);

  const applyPromotion = useCallback(async (code: string) => {
    try {
      console.log(`🛒 Applying promotion: ${code}`);
      const updatedCart = await cartService.applyPromotion(code);
      setCart(updatedCart);
    } catch (error: any) {
      console.error('❌ Failed to apply promotion:', error);
      throw error;
    }
  }, []);

  const applyLoyaltyPoints = useCallback(async (points: number) => {
    if (!customerId) {
      toast.error('Please associate a customer with this cart');
      return;
    }
    try {
      console.log(`🛒 Applying ${points} loyalty points`);
      const updatedCart = await cartService.applyLoyaltyPoints(customerId, points);
      setCart(updatedCart);
      setLoyaltyPoints(prev => prev - points);
    } catch (error: any) {
      console.error('❌ Failed to apply loyalty points:', error);
      throw error;
    }
  }, [customerId]);

  const proceedToCheckout = useCallback(() => {
    if (!cart || cart.items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    router.push('/checkout');
  }, [cart, router]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    } else {
      router.push('/login?redirect=/cart');
    }
  }, [isAuthenticated, fetchCart, router]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 py-12 ${className}`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Your Cart</h1>
          </div>
          <CartSkeleton />
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 py-12 ${className}`}>
        <div className="max-w-3xl mx-auto px-4">
          <EmptyCart />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 py-8 sm:py-12 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <ShoppingCart className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
              Your Cart
              {cart.itemCount > 0 && (
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'})
                </span>
              )}
            </h1>
            {cart.customer && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Customer: {cart.customer.firstName} {cart.customer.lastName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchCart();
                toast.success('Cart refreshed');
              }}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="Refresh cart"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={clearCart}
              className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Clear Cart
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 p-1"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Cart Items */}
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

          {/* Cart Summary */}
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ Keep default export for backwards compatibility
export default CartPage;
