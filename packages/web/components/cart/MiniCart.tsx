// D:\Projects\Kalwanga\packages\web\components\cart\MiniCart.tsx

'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  X,
  Package,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  cartService,
  type Cart,
  type CartItem,
} from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';

interface MiniCartProps {
  className?: string;
}

const MAX_PREVIEW_ITEMS = 5;

export function MiniCart({ className = '' }: MiniCartProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  /**
   * The active cart service. Guests hit `/cart/guest/*`; authenticated
   * users hit `/cart/*`.
   */
  const activeCartService = useMemo(
    () => (isAuthenticated ? cartService : guestCartService),
    [isAuthenticated],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================
  // FETCH
  // ============================================

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const cartData = await activeCartService.getCart();
      if (!isMountedRef.current) return;
      setCart(cartData);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Failed to fetch cart:', error);
      // Silent — the badge is best-effort, the full cart page is
      // where errors matter.
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [activeCartService]);

  // ============================================
  // REMOVE ITEM
  // ============================================

  const removeItem = useCallback(
    async (itemId: string) => {
      setWorkingId(itemId);
      try {
        const updatedCart =
          await activeCartService.removeItem(itemId);
        if (!isMountedRef.current) return;
        setCart(updatedCart);
        toast.success('Item removed');
        window.dispatchEvent(new CustomEvent('cart:updated'));
      } catch (error: any) {
        toast.error(error?.message || 'Failed to remove item');
      } finally {
        if (isMountedRef.current) setWorkingId(null);
      }
    },
    [activeCartService],
  );

  // ============================================
  // LIFECYCLE
  // ============================================
  //
  // The badge must reflect the current cart count even when the
  // dropdown is closed. We therefore fetch on mount, on auth change,
  // and whenever any other part of the app dispatches `cart:updated`.

  useEffect(() => {
    void fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    const handler = () => {
      void fetchCart();
    };
    window.addEventListener('cart:updated', handler);
    return () => window.removeEventListener('cart:updated', handler);
  }, [fetchCart]);

  // Fetch fresh data every time the panel opens so the preview is
  // never stale.
  useEffect(() => {
    if (isOpen) void fetchCart();
  }, [isOpen, fetchCart]);

  // ============================================
  // OUTSIDE CLICK + ESCAPE
  // ============================================

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // ============================================
  // DERIVED
  // ============================================

  const itemCount = cart?.itemCount ?? 0;
  const subtotal = cart?.subtotal ?? 0;
  const hasItems = Boolean(cart && cart.items.length > 0);
  const previewItems = hasItems
    ? cart!.items.slice(0, MAX_PREVIEW_ITEMS)
    : [];
  const hiddenCount = hasItems
    ? Math.max(0, cart!.items.length - MAX_PREVIEW_ITEMS)
    : 0;

  // ============================================
  // HANDLERS
  // ============================================

  const handleViewCart = () => {
    setIsOpen(false);
    router.push('/cart');
  };

  const handleCheckout = () => {
    setIsOpen(false);
    if (!isAuthenticated) {
      router.push(
        `/login?redirect_url=${encodeURIComponent('/checkout')}`,
      );
      return;
    }
    router.push('/checkout');
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        aria-label={
          itemCount > 0
            ? `Open cart, ${itemCount} items`
            : 'Open cart'
        }
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <ShoppingCart className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
            role="dialog"
            aria-label="Cart preview"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Your Cart
                {itemCount > 0 && (
                  <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({itemCount}{' '}
                    {itemCount === 1 ? 'item' : 'items'})
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close cart"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
              {loading && !cart ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : !hasItems ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Your cart is empty
                  </p>
                  <Link
                    href="/shop"
                    onClick={() => setIsOpen(false)}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
                  >
                    Browse products
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <>
                  {previewItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3"
                    >
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                        {item.product.images?.[0] ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {item.quantity} ×{' '}
                          {formatCurrency(item.unitPrice)}
                          {item.variant && (
                            <span className="ml-1 text-gray-400">
                              ({item.variant.name})
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={workingId === item.id}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        aria-label={`Remove ${item.product.name}`}
                      >
                        {workingId === item.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ))}

                  {hiddenCount > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1">
                      + {hiddenCount} more item
                      {hiddenCount === 1 ? '' : 's'}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {hasItems && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Subtotal
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleViewCart}
                  className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  View Cart
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleCheckout}
                  className="w-full mt-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm shadow-md"
                >
                  {isAuthenticated ? 'Checkout' : 'Sign in to Checkout'}
                </button>

                {!isAuthenticated && (
                  <p className="mt-2 text-[11px] text-center text-gray-500 dark:text-gray-400">
                    You&apos;ll be asked to sign in before paying.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MiniCart;
