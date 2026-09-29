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
import { cartService, type Cart } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { toast } from '../../utils/toast-manager';

import CartItemCard from './CartItemCard';
import CartSummary from './CartSummary';
import CartSkeleton from './CartSkeleton';
import EmptyCart from './EmptyCart';

interface CartPageProps {
  className?: string;
}

// ============================================
// ERROR HELPERS
// ============================================

/**
 * Walk the error chain for an HTTP status code. axios, the backend's
 * `AppError`, and wrapped errors all surface the status in different
 * places; this returns the first finite number it finds.
 */
function getErrorStatus(error: any): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const seen = new Set<any>();
  let node: any = error;

  while (node && typeof node === 'object' && !seen.has(node)) {
    seen.add(node);

    const candidates = [
      node.status,
      node.statusCode,
      node.response?.status,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === 'number' &&
        Number.isFinite(candidate) &&
        candidate > 0
      ) {
        return candidate;
      }
    }

    node = node.cause;
  }

  return undefined;
}

/**
 * True when the status + body suggest the session expired and the
 * user should be bounced to login. A bare 401 is always treated as
 * expired; a 403 only when the body mentions "session" or "expired".
 */
function isSessionExpired(error: any): boolean {
  const status = getErrorStatus(error);
  if (status === 401) return true;
  if (status !== 403) return false;

  const message = String(
    error?.response?.data?.message || error?.message || '',
  ).toLowerCase();
  return message.includes('session') || message.includes('expired');
}

// ============================================
// CART ADAPTER
// ============================================
//
// `guestCartService` exposes a *subset* of `cartService`'s methods,
// with different names (`updateItem` vs `updateItemQuantity`), a
// different return shape (`GuestCart | null` vs `Cart`), and no
// support at all for discounts, promotions, or loyalty.
//
// Rather than thread `if (isAuthenticated)` branches through every
// callback, we build a thin adapter at the top of the page that
// presents a single, typed surface. The guest branch fills the
// missing methods with descriptive throws; the page never calls
// those on the guest path because every mutation that uses them is
// already gated by `isAuthenticated`.

interface CartAdapter {
  getCart(): Promise<Cart | null>;
  updateItemQuantity(itemId: string, quantity: number): Promise<Cart>;
  removeItem(itemId: string): Promise<Cart>;
  clearCart(): Promise<Cart>;
  applyDiscount(
    value: number,
    type: 'PERCENTAGE' | 'FIXED',
  ): Promise<Cart>;
  applyPromotion(code: string): Promise<Cart>;
  applyLoyaltyPoints(customerId: string, points: number): Promise<Cart>;
}

/**
 * Normalize a `GuestCart | null` into the `Cart` shape the page
 * expects. `GuestCart` is missing `itemCount` and may be missing
 * other backend-authored fields; we compute what we can and fill the
 * rest with safe defaults.
 */
function normalizeGuestCart(guest: any): Cart | null {
  if (!guest) return null;

  const items = Array.isArray(guest.items) ? guest.items : [];
  const itemCount =
    typeof guest.itemCount === 'number'
      ? guest.itemCount
      : items.reduce(
          (sum: number, item: any) => sum + (item.quantity ?? 0),
          0,
        );

  return {
    id: guest.id ?? '',
    items,
    subtotal: guest.subtotal ?? 0,
    tax: guest.tax ?? 0,
    discount: guest.discount ?? 0,
    total: guest.total ?? 0,
    customerId: guest.customerId,
    customer: guest.customer,
    businessUnitId: guest.businessUnitId ?? '',
    userId: guest.userId ?? '',
    notes: guest.notes,
    status: guest.status ?? 'ACTIVE',
    itemCount,
    discountType: guest.discountType,
    promotionCode: guest.promotionCode,
    promotionDiscount: guest.promotionDiscount,
    loyaltyPointsUsed: guest.loyaltyPointsUsed,
    loyaltyDiscount: guest.loyaltyDiscount,
    createdAt: guest.createdAt ?? new Date().toISOString(),
    updatedAt: guest.updatedAt ?? new Date().toISOString(),
  } as Cart;
}

function makeAuthenticatedAdapter(): CartAdapter {
  return {
    async getCart() {
      return cartService.getCart();
    },
    async updateItemQuantity(itemId, quantity) {
      return cartService.updateItemQuantity(itemId, quantity);
    },
    async removeItem(itemId) {
      return cartService.removeItem(itemId);
    },
    async clearCart() {
      return cartService.clearCart();
    },
    async applyDiscount(value, type) {
      return cartService.applyDiscount(value, type);
    },
    async applyPromotion(code) {
      return cartService.applyPromotion(code);
    },
    async applyLoyaltyPoints(customerId, points) {
      return cartService.applyLoyaltyPoints(customerId, points);
    },
  };
}

function makeGuestAdapter(): CartAdapter {
  return {
    async getCart() {
      const guest = await guestCartService.getCart();
      return normalizeGuestCart(guest);
    },
    async updateItemQuantity(itemId, quantity) {
      const guest = await guestCartService.updateItem(itemId, quantity);
      return normalizeGuestCart(guest) as Cart;
    },
    async removeItem(itemId) {
      const guest = await guestCartService.removeItem(itemId);
      return normalizeGuestCart(guest) as Cart;
    },
    async clearCart() {
      const guest = await guestCartService.clearCart();
      return normalizeGuestCart(guest) as Cart;
    },
    async applyDiscount() {
      throw new Error('Sign in to apply a discount');
    },
    async applyPromotion() {
      throw new Error('Sign in to apply a promotion');
    },
    async applyLoyaltyPoints() {
      throw new Error('Sign in to use loyalty points');
    },
  };
}

// ============================================
// COMPONENT
// ============================================

export function CartPage({ className = '' }: CartPageProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Resolve the active cart adapter.
   *
   * The adapter presents a single typed surface regardless of auth
   * state, so every callback below can call the same method names
   * without a `isAuthenticated` branch at every call site.
   */
  const activeCartService: CartAdapter = useMemo(
    () =>
      isAuthenticated
        ? makeAuthenticatedAdapter()
        : makeGuestAdapter(),
    [isAuthenticated],
  );

  /**
   * Loyalty point balance.
   *
   * We prefer the value the cart itself carries (via its associated
   * customer). Only when the cart does not carry it do we fall back to
   * a locally-tracked value from the last redemption response.
   */
  const [localLoyaltyPoints, setLocalLoyaltyPoints] = useState(0);
  const customerId = cart?.customerId;
  const loyaltyPoints =
    (cart as any)?.customer?.loyaltyPoints ?? localLoyaltyPoints;

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const cartData = await activeCartService.getCart();
      setCart(cartData);

      if (!cartData?.customerId) {
        setLocalLoyaltyPoints(0);
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch cart:', error);
      if (isSessionExpired(error) && isAuthenticated) {
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
        const updatedCart = await activeCartService.updateItemQuantity(
          itemId,
          quantity,
        );
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
        const updatedCart = await activeCartService.removeItem(itemId);
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
      setLocalLoyaltyPoints(0);
      toast.success('Cart cleared');
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } catch (error: any) {
      console.error('❌ Failed to clear cart:', error);
      toast.error(error?.message || 'Failed to clear cart');
    }
  }, [activeCartService]);

  /**
   * Apply a numeric discount. `type` is required — the caller must know
   * whether they hold a percentage or a fixed value.
   *
   * Guests cannot apply discounts; the adapter throws a descriptive
   * error which the parent error handler surfaces.
   */
  const applyDiscountValue = useCallback(
    async (value: number, type: 'PERCENTAGE' | 'FIXED') => {
      try {
        const updatedCart = await activeCartService.applyDiscount(
          value,
          type,
        );
        setCart(updatedCart);
      } catch (error: any) {
        console.error('❌ Failed to apply discount:', error);
        throw error;
      }
    },
    [activeCartService],
  );

  /**
   * Apply a promotion by code. The backend resolves the code
   * server-side. Guests cannot apply promotions; the adapter throws.
   */
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
        // Keep a local mirror in case the cart payload doesn't carry
        // the updated customer balance.
        const serverBalance = (updatedCart as any)?.customer?.loyaltyPoints;
        if (typeof serverBalance !== 'number') {
          setLocalLoyaltyPoints((prev) => Math.max(0, prev - points));
        }
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
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-ring"
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
              onApplyDiscountValue={applyDiscountValue}
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
