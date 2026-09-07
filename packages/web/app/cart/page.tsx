'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, RefreshCw, Trash2, AlertCircle, X,
  ArrowRight, Truck, Shield, RotateCcw, Sparkles
} from 'lucide-react';
import { api } from '../../services/api';
import { toast } from '../../utils/toast-manager';
import { formatCurrency } from '../../utils/formatters';
import { cartService, Cart, CartItem } from '../../services/cartService';
import { useAuth } from '../../hooks/useAuth';
import {
  CartSummary,
  CartSkeleton,
  EmptyCart,
  CartDiscountInput,
  CartPromotionInput,
  CartLoyaltyPoints,
  CartCustomerSelector,
  CartNotes,
  CartActions
} from '../../components/cart';

// ============================================
// TYPES
// ============================================

interface LoyaltyResponse {
  points: number;
  available: number;
  used: number;
  totalEarned: number;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CartPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

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
        // Fetch loyalty points from API
        try {
          const response = await api.get<LoyaltyResponse>(`/customers/${cartData.customerId}/loyalty`);
          if (response && response.points !== undefined) {
            setLoyaltyPoints(response.points);
          }
        } catch (error) {
          console.warn('Failed to fetch loyalty points:', error);
        }
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
      setClearing(true);
      console.log('🛒 Clearing cart');
      const updatedCart = await cartService.clearCart();
      setCart(updatedCart);
      toast.success('Cart cleared');
    } catch (error: any) {
      console.error('❌ Failed to clear cart:', error);
      toast.error(error?.message || 'Failed to clear cart');
    } finally {
      setClearing(false);
    }
  }, []);

  const syncCart = useCallback(async () => {
    try {
      setSyncing(true);
      console.log('🛒 Syncing cart with inventory');
      const result = await cartService.syncCart();
      if (result.valid) {
        toast.success('Cart is in sync with inventory');
      } else {
        toast.warning(`Inventory issues: ${result.issues.join(', ')}`);
      }
      await fetchCart();
    } catch (error: any) {
      console.error('❌ Failed to sync cart:', error);
      toast.error(error?.message || 'Failed to sync cart');
    } finally {
      setSyncing(false);
    }
  }, [fetchCart]);

  const saveCartForLater = useCallback(async () => {
    try {
      setSaving(true);
      console.log('🛒 Saving cart for later');
      const updatedCart = await cartService.saveCartForLater();
      setCart(updatedCart);
      toast.success('Cart saved for later');
    } catch (error: any) {
      console.error('❌ Failed to save cart:', error);
      toast.error(error?.message || 'Failed to save cart');
    } finally {
      setSaving(false);
    }
  }, []);

  // ✅ FIXED: Apply discount using promo code (string)
  const applyDiscount = useCallback(async (code: string) => {
    try {
      console.log(`🛒 Applying discount with code: ${code}`);
      // If CartSummary expects a promo code, we need to handle it
      // The cartService.applyDiscount expects a number, so we need to 
      // either parse the code or use a different approach
      // For now, we'll try to parse the code as a number for fixed discounts
      const discountValue = parseFloat(code);
      if (!isNaN(discountValue) && discountValue > 0) {
        const updatedCart = await cartService.applyDiscount(discountValue, 'FIXED');
        setCart(updatedCart);
        toast.success('Discount applied successfully');
      } else {
        // Try as a promotion code
        const updatedCart = await cartService.applyPromotion(code);
        setCart(updatedCart);
        toast.success('Promotion applied successfully');
      }
    } catch (error: any) {
      console.error('❌ Failed to apply discount:', error);
      toast.error(error?.message || 'Failed to apply discount');
      throw error;
    }
  }, []);

  // ✅ FIXED: Apply promotion with code (string)
  const applyPromotion = useCallback(async (code: string) => {
    try {
      console.log(`🛒 Applying promotion: ${code}`);
      const updatedCart = await cartService.applyPromotion(code);
      setCart(updatedCart);
      toast.success('Promotion applied successfully');
    } catch (error: any) {
      console.error('❌ Failed to apply promotion:', error);
      toast.error(error?.message || 'Failed to apply promotion');
      throw error;
    }
  }, []);

  // ✅ FIXED: Apply loyalty points with customerId and points
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
      toast.success(`${points} loyalty points applied`);
    } catch (error: any) {
      console.error('❌ Failed to apply loyalty points:', error);
      toast.error(error?.message || 'Failed to apply loyalty points');
      throw error;
    }
  }, [customerId]);

  const associateCustomer = useCallback(async (customerId: string) => {
    try {
      console.log(`🛒 Associating customer ${customerId} with cart`);
      const updatedCart = await cartService.associateCustomer(customerId);
      setCart(updatedCart);
      setCustomerId(customerId);
      toast.success('Customer associated with cart');
      // Fetch loyalty points for new customer
      try {
        const response = await api.get<LoyaltyResponse>(`/customers/${customerId}/loyalty`);
        if (response && response.points !== undefined) {
          setLoyaltyPoints(response.points);
        }
      } catch (error) {
        console.warn('Failed to fetch loyalty points:', error);
      }
    } catch (error: any) {
      console.error('❌ Failed to associate customer:', error);
      toast.error(error?.message || 'Failed to associate customer');
      throw error;
    }
  }, []);

  const updateCartNotes = useCallback(async (notes: string) => {
    try {
      console.log(`🛒 Updating cart notes: ${notes}`);
      const updatedCart = await cartService.updateCartNotes(notes);
      setCart(updatedCart);
    } catch (error: any) {
      console.error('❌ Failed to update notes:', error);
      toast.error(error?.message || 'Failed to update notes');
      throw error;
    }
  }, []);

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
  // HELPERS
  // ============================================

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      SAVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      CHECKED_OUT: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
      ABANDONED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: 'Active',
      SAVED: 'Saved',
      CHECKED_OUT: 'Checked Out',
      ABANDONED: 'Abandoned',
    };
    return labels[status] || status;
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <ShoppingCart className="w-7 h-7 text-blue-500" />
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-3xl mx-auto px-4">
          <EmptyCart
            title="Your cart is empty"
            description="Browse our products and add items to your cart."
            actionLabel="Start Shopping"
            actionHref="/"
          />
        </div>
      </div>
    );
  }

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <ShoppingCart className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
              Your Cart
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({itemCount} {itemCount === 1 ? 'item' : 'items'})
              </span>
            </h1>
            {cart.customer && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Customer: {cart.customer.firstName} {cart.customer.lastName}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(cart.status)}`}>
                {getStatusLabel(cart.status)}
              </span>
              {cart.promotionCode && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs font-medium">
                  <Sparkles className="w-3 h-3" />
                  {cart.promotionCode}
                </span>
              )}
            </div>
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
            <CartActions
              onClear={clearCart}
              onSync={syncCart}
              onSaveForLater={saveCartForLater}
              isSyncing={syncing}
              isClearing={clearing}
              isSaving={saving}
              hasItems={cart.items.length > 0}
              disabled={loading}
            />
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {cart.items.map((item) => (
                  <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0 overflow-hidden">
                      {item.product.images?.[0] ? (
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          No image
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {item.product.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        SKU: {item.product.sku}
                      </p>
                      {item.variant && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Variant: {item.variant.name}
                        </p>
                      )}
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {formatCurrency(item.unitPrice)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={updating === item.id || item.quantity <= 1}
                        className="w-8 h-8 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-gray-900 dark:text-white">
                        {updating === item.id ? '...' : item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={updating === item.id || item.quantity >= item.availableStock}
                        className="w-8 h-8 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right min-w-[80px]">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(item.total)}
                      </p>
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={updating === item.id}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart Settings & Extras */}
            <div className="space-y-4">
              {/* Customer Selector */}
              <CartCustomerSelector
                selectedCustomerId={customerId}
                onCustomerSelected={associateCustomer}
                onCustomerCleared={() => {
                  setCustomerId(undefined);
                  setLoyaltyPoints(0);
                }}
                disabled={loading}
              />

              {/* Loyalty Points */}
              {customerId && (
                <CartLoyaltyPoints
                  customerId={customerId}
                  onPointsApplied={() => {
                    fetchCart();
                  }}
                  disabled={loading}
                />
              )}

              {/* Discount Input */}
              <CartDiscountInput
                onDiscountApplied={() => fetchCart()}
                disabled={loading}
              />

              {/* Promotion Input */}
              <CartPromotionInput
                onPromotionApplied={() => fetchCart()}
                disabled={loading}
              />

              {/* Cart Notes */}
              <CartNotes
                initialNotes={cart.notes}
                onNotesUpdated={updateCartNotes}
                disabled={loading}
              />
            </div>
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

        {/* Free Shipping Progress */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Free shipping on orders over $50
            </span>
            <span className="font-medium text-blue-700 dark:text-blue-300">
              ${Math.max(0, 50 - cart.subtotal).toFixed(2)} away
            </span>
          </div>
          <div className="mt-2 w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((cart.subtotal / 50) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-500" />
            Secure Checkout
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="inline-flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-blue-500" />
            Free Shipping
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="inline-flex items-center gap-1.5">
            <RotateCcw className="w-4 h-4 text-orange-500" />
            30-Day Returns
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-500" />
            Loyalty Points Available
          </span>
        </div>
      </div>
    </div>
  );
}
