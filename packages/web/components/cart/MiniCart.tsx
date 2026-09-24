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
import { cartService, type Cart } from '../../services/cartService';
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

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const cartData = await activeCartService.getCart();
      if (!isMountedRef.current) return;
      setCart(cartData);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Failed to fetch cart:', error);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [activeCartService]);

  const removeItem = useCallback(
    async (itemId: string) => {
      setWorkingId(itemId);
      try {
        const updatedCart = await activeCartService.removeItem(itemId);
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

  useEffect(() => {
    if (isOpen) void fetchCart();
  }, [isOpen, fetchCart]);

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

  const itemCount = cart?.itemCount ?? 0;
  const subtotal = cart?.subtotal ?? 0;
  const hasItems = Boolean(cart && cart.items.length > 0);
  const previewItems = hasItems
    ? cart!.items.slice(0, MAX_PREVIEW_ITEMS)
    : [];
  const hiddenCount = hasItems
    ? Math.max(0, cart!.items.length - MAX_PREVIEW_ITEMS)
    : 0;

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

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
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
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-brand-gradient text-white text-2xs font-bold rounded-full flex items-center justify-center px-1 shadow-brand tabular-nums">
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
            className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover border border-gray-200 dark:border-gray-700 z-toast overflow-hidden"
            role="dialog"
            aria-label="Cart preview"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Your Cart
                {itemCount > 0 && (
                  <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400 tabular-nums">
                    ({itemCount}{' '}
                    {itemCount === 1 ? 'item' : 'items'})
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                aria-label="Close cart"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {loading && !cart ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
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
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 focus-ring rounded"
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
                        <p className="text-2xs text-gray-500 dark:text-gray-400 truncate tabular-nums">
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
                        className="p-1 text-gray-400 hover:text-danger-500 transition-colors disabled:opacity-50 focus-ring rounded"
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
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1 tabular-nums">
                      + {hiddenCount} more item
                      {hiddenCount === 1 ? '' : 's'}
                    </p>
                  )}
                </>
              )}
            </div>

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
                  className="w-full bg-gray-100 hover:bg-orange-50 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm focus-ring"
                >
                  View Cart
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleCheckout}
                  className="w-full mt-2 bg-brand-gradient hover:shadow-brand-lg text-white py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm shadow-brand focus-ring"
                >
                  {isAuthenticated ? 'Checkout' : 'Sign in to Checkout'}
                </button>

                {!isAuthenticated && (
                  <p className="mt-2 text-3xs text-center text-gray-500 dark:text-gray-400">
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
