// packages/web/components/cart/MiniCart.tsx
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
  AlertCircle,
} from 'lucide-react';

import { cartService } from '../../services/cartService';
import type { Cart, CartItem } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

/**
 * Minimum interface the MiniCart needs from whichever cart service
 * is active. Checked at runtime — a guest whose service doesn't
 * implement `removeItem` sees a read-only preview rather than a
 * broken X button.
 */
interface MiniCartService {
  getCart: () => Promise<Cart>;
  removeItem?: (itemId: string) => Promise<Cart>;
}

interface MiniCartProps {
  className?: string;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_PREVIEW_ITEMS = 5;

/**
 * Minimum delay between refetches triggered by `cart:updated`. Other
 * components dispatch the event after every mutation; without a
 * debounce, two rapid dispatches (e.g. ProductCard + CartNotes in
 * the same tick) trigger two concurrent fetches whose responses can
 * land out of order.
 */
const REFETCH_DEBOUNCE_MS = 150;

// ============================================
// HELPERS
// ============================================

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;

  const anyErr = error as any;
  const data = anyErr?.response?.data;

  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: any) => `${e.field ?? 'field'}: ${e.message ?? 'invalid'}`)
        .join(', ');
    }
  }

  if (anyErr?.message) return String(anyErr.message);
  return fallback;
}

/**
 * Defensive read of `cart.items`. The backend always emits an array
 * (see `formatCartResponse`), but a malformed response or a stale
 * cached cart could carry `undefined`.
 */
function safeItems(cart: Cart | null): CartItem[] {
  if (!cart) return [];
  const items = (cart as any).items;
  return Array.isArray(items) ? items : [];
}

// ============================================
// COMPONENT
// ============================================

export function MiniCart({ className = '' }: MiniCartProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Monotonic request id for cart fetches. Guards against a slow
   * earlier fetch overwriting a faster later one.
   */
  const fetchRequestIdRef = useRef(0);

  /**
   * Debounce timer for `cart:updated` events. Multiple components
   * dispatch this event after a single user action (e.g. ProductCard
   * fires it, then CartNotes fires it). Without coalescing, each
   * dispatch triggers a separate fetch.
   */
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Resolve the active cart service ─────────────────────────

  const activeCartService = useMemo<MiniCartService>(
    () =>
      (isAuthenticated ? cartService : guestCartService) as MiniCartService,
    [isAuthenticated],
  );

  const canRemove = useMemo(
    () => typeof activeCartService.removeItem === 'function',
    [activeCartService],
  );

  // ── Lifecycle ───────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
    };
  }, []);

  // ── Fetch ───────────────────────────────────────────────────

  const fetchCart = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;

    try {
      setLoading(true);
      const cartData = await activeCartService.getCart();

      // Drop stale responses.
      if (requestId !== fetchRequestIdRef.current) return;
      if (!isMountedRef.current) return;

      setCart(cartData);
      setLastError(null);
    } catch (error) {
      if (requestId !== fetchRequestIdRef.current) return;
      if (!isMountedRef.current) return;

      // Keep the previous cart visible — a network blip shouldn't
      // wipe the badge count. Surface the error for the panel.
      const message = extractErrorMessage(error, 'Failed to load cart');
      console.error('[MiniCart] fetch failed:', message);
      setLastError(message);
    } finally {
      if (requestId === fetchRequestIdRef.current && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [activeCartService]);

  // ── Initial fetch + on service change ──────────────────────

  useEffect(() => {
    void fetchCart();
  }, [fetchCart]);

  // ── Listen for cross-component cart updates (debounced) ────

  useEffect(() => {
    const handler = () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
      refetchTimerRef.current = setTimeout(() => {
        refetchTimerRef.current = null;
        void fetchCart();
      }, REFETCH_DEBOUNCE_MS);
    };

    window.addEventListener('cart:updated', handler);
    return () => {
      window.removeEventListener('cart:updated', handler);
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
    };
  }, [fetchCart]);

  // ── Refetch when the dropdown opens ────────────────────────

  useEffect(() => {
    if (isOpen) void fetchCart();
  }, [isOpen, fetchCart]);

  // ── Click-outside + Escape to close ────────────────────────

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

  // ── Remove item ────────────────────────────────────────────

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!activeCartService.removeItem) return;
      if (workingId) return; // one removal at a time

      setWorkingId(itemId);
      try {
        const updatedCart = await activeCartService.removeItem(itemId);
        if (!isMountedRef.current) return;

        setCart(updatedCart);
        setLastError(null);
        toast.success('Item removed');

        // Notify other components (badge, cart page) that the cart
        // changed. This component's own `cart:updated` listener is
        // debounced, so the extra fetch is cheap.
        window.dispatchEvent(new CustomEvent('cart:updated'));
      } catch (error) {
        if (!isMountedRef.current) return;

        const message = extractErrorMessage(error, 'Failed to remove item');
        toast.error(message);
      } finally {
        if (isMountedRef.current) setWorkingId(null);
      }
    },
    [activeCartService, workingId],
  );

  // ── Navigation ─────────────────────────────────────────────

  const handleViewCart = useCallback(() => {
    setIsOpen(false);
    router.push('/cart');
  }, [router]);

  /**
   * Sign-in redirect for guests. Awaits the guest-cart merge when the
   * service supports it so the user's items carry through login.
   *
   * If no merge endpoint is wired, the redirect still proceeds — the
   * user may lose the guest cart, but the failure mode is better than
   * blocking checkout.
   */
  const handleCheckout = useCallback(async () => {
    setIsOpen(false);

    if (isAuthenticated) {
      router.push('/checkout');
      return;
    }

    // Try to preserve the guest cart across login. Best-effort.
    const maybeMerge = (guestCartService as any).mergeOnLogin as
      | (() => Promise<unknown>)
      | undefined;

    if (typeof maybeMerge === 'function') {
      try {
        await maybeMerge();
      } catch (err) {
        console.warn(
          '[MiniCart] guest cart merge before login failed:',
          extractErrorMessage(err, 'unknown'),
        );
      }
    }

    router.push(`/login?redirect_url=${encodeURIComponent('/checkout')}`);
  }, [isAuthenticated, router]);

  // ── Derived values ─────────────────────────────────────────

  const items = safeItems(cart);
  const itemCount = cart?.itemCount ?? 0;
  const subtotal = cart?.subtotal ?? 0;
  const hasItems = items.length > 0;

  /**
   * Show the most recently added items first. The backend orders
   * `cart.items` by `createdAt: 'asc'`, so the newest are at the
   * end — reverse for the preview.
   */
  const previewItems = useMemo(
    () => (hasItems ? [...items].reverse().slice(0, MAX_PREVIEW_ITEMS) : []),
    [items, hasItems],
  );

  const hiddenCount = hasItems
    ? Math.max(0, items.length - MAX_PREVIEW_ITEMS)
    : 0;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="relative p-2 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
        aria-label={
          itemCount > 0
            ? `Open cart, ${itemCount} items`
            : 'Open cart'
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="mini-cart-popover"
      >
        <ShoppingCart className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        {itemCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-brand-gradient text-white text-2xs font-bold rounded-full flex items-center justify-center px-1 shadow-brand tabular-nums"
            aria-hidden="true"
          >
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mini-cart-popover"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover border border-gray-200 dark:border-gray-700 z-toast overflow-hidden"
            role="dialog"
            aria-label="Cart preview"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3
                className="font-semibold text-gray-900 dark:text-white"
                aria-live="polite"
              >
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
              {lastError && (
                <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{lastError}</span>
                </div>
              )}

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
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                        {item.product?.images?.[0] ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.product?.name ?? 'Unknown product'}
                        </p>
                        <p className="text-2xs text-gray-500 dark:text-gray-400 truncate tabular-nums">
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                          {item.variant && (
                            <span className="ml-1 text-gray-400">
                              ({item.variant.name})
                            </span>
                          )}
                        </p>
                      </div>
                      {canRemove && (
                        <button
                          type="button"
                          onClick={() => void removeItem(item.id)}
                          disabled={
                            workingId === item.id ||
                            (workingId !== null && workingId !== item.id)
                          }
                          className="p-1 text-gray-400 hover:text-danger-500 transition-colors disabled:opacity-50 focus-ring rounded"
                          aria-label={`Remove ${item.product?.name ?? 'item'}`}
                        >
                          {workingId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                        </button>
                      )}
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
                  onClick={() => void handleCheckout()}
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
