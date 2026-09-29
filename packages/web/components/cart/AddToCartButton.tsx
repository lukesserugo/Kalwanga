'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface AddToCartButtonProps {
  productId: string;
  variantId?: string | null;
  quantity?: number;
  className?: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
  showIcon?: boolean;
  disabled?: boolean;
  redirectOnAuthError?: boolean;
}

/**
 * `out_of_stock` is a terminal state: the button stays disabled until
 * the component remounts. It's set when the backend rejects the add
 * with "Insufficient stock". Distinguishing it from a transient error
 * matters because retrying is pointless until inventory changes.
 */
type ButtonState = 'idle' | 'loading' | 'added' | 'out_of_stock';

// ============================================
// ERROR HELPERS
// ============================================

/**
 * Extract a human-readable message from the various shapes the
 * backend can return.
 *
 *   1. `{ error: { message } }`         ← cart validation (the one
 *                                          we actually hit)
 *   2. `{ error: string }`
 *   3. `{ message }`
 *   4. `{ errors: [{ field, message }] }` ← Zod field errors
 *   5. `error.message`                    ← axios / JS
 */
function extractErrorMessage(error: any, fallback: string): string {
  if (!error) return fallback;

  const data = error?.response?.data;
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

  if (error?.message) return String(error.message);
  return fallback;
}

/**
 * Walk the error chain for an HTTP status code. axios, the backend's
 * `AppError`, and wrapped errors all surface the status in different
 * places; this returns the first finite number it finds.
 *
 * Mirrors `getErrorStatusCode` in the backend's
 * `paymentController.ts`.
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
 * True when the backend rejected the request because stock ran out
 * between page load and the click.
 */
function isInsufficientStockError(error: any): boolean {
  return /insufficient stock/i.test(extractErrorMessage(error, ''));
}

/**
 * Pull the "Available: N" figure out of the backend's stock-error
 * message, when present. Returns `null` when the message doesn't
 * carry a number.
 */
function parseAvailableFromStockError(error: any): number | null {
  const match = extractErrorMessage(error, '').match(
    /available:\s*(\d+)/i
  );
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * True when the status + body suggest the session expired and the
 * user should be bounced to login. A bare 401 is always treated as
 * expired; a 403 only when the body mentions "session" or "expired",
 * because 403 is also used for genuine permission denials that
 * shouldn't trigger a redirect loop.
 */
function isSessionExpired(error: any): boolean {
  const status = getErrorStatus(error);
  if (status === 401) return true;
  if (status !== 403) return false;

  const message = extractErrorMessage(error, '').toLowerCase();
  return message.includes('session') || message.includes('expired');
}

// ============================================
// COMPONENT
// ============================================

export function AddToCartButton({
  productId,
  variantId,
  quantity = 1,
  className = '',
  onSuccess,
  onError,
  children,
  size = 'md',
  variant = 'primary',
  showIcon = true,
  disabled = false,
  redirectOnAuthError = true,
}: AddToCartButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<ButtonState>('idle');

  /**
   * Route the add through the correct service.
   *
   *   - Authenticated → `cartService` → `POST /cart/items`. The
   *     backend resolves the cart from the session user +
   *     business-unit header.
   *   - Anonymous → `guestCartService` → `POST /guest-cart/items`.
   *     Backed by the `guest_session_id` cookie set by
   *     `guestSessionMiddleware` on the server. Merged into the
   *     user's cart on login by `POST /cart/merge-guest`.
   *
   * Do not collapse this branch — the two services target different
   * endpoints, and calling the authenticated one while anonymous
   * returns 401 instead of adding to the guest cart.
   */
  const activeCartService = useMemo(
    () => (isAuthenticated ? cartService : guestCartService),
    [isAuthenticated],
  );

  /**
   * The "Added" confirmation resets to idle after 2s. The
   * "Out of stock" state does NOT reset — it's terminal until the
   * component remounts (parent refetches, user navigates, etc.).
   */
  useEffect(() => {
    if (state !== 'added') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary:
      'bg-brand-gradient hover:shadow-brand-lg text-white shadow-brand',
    secondary:
      'bg-gray-800 hover:bg-gray-900 text-white shadow-md hover:shadow-lg',
    outline:
      'border-2 border-brand-500 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20',
  };

  const handleAddToCart = useCallback(async () => {
    if (state === 'loading' || state === 'out_of_stock' || disabled) return;

    if (!productId) {
      toast.error('Product ID is required');
      return;
    }

    setState('loading');

    try {
      await activeCartService.addItem({
        productId,
        // Backend collapses `null` → `undefined` via its own schema
        // refinement, but we send `undefined` directly to keep the wire
        // payload clean and avoid a null-vs-undefined ambiguity.
        variantId: variantId ?? undefined,
        quantity,
      });

      setState('added');
      toast.success('Item added to cart');
      window.dispatchEvent(new CustomEvent('cart:updated'));

      onSuccess?.();
    } catch (err: any) {
      console.error('Failed to add to cart:', err);

      // Session expired mid-flight → bounce to login and stop.
      // No toast here: the redirect is the user feedback.
      if (isSessionExpired(err) && isAuthenticated && redirectOnAuthError) {
        const redirectUrl =
          typeof window !== 'undefined'
            ? window.location.pathname + window.location.search
            : '/';
        router.push(
          `/login?redirect_url=${encodeURIComponent(redirectUrl)}`,
        );
        onError?.(err);
        setState('idle');
        return;
      }

      // Insufficient stock is terminal. Show the specific reason and
      // leave the button in the `out_of_stock` state so subsequent
      // clicks are impossible without a remount.
      if (isInsufficientStockError(err)) {
        setState('out_of_stock');

        const reported = parseAvailableFromStockError(err);
        // `reported === 0` falls through to the generic message on
        // purpose, so the user isn't shown "Only 0 left in stock."
        const message =
          reported !== null && reported > 0
            ? `Only ${reported} left in stock.`
            : 'This item is out of stock.';

        toast.error(message);

        // Notify any listeners (parent list, cart pill) that the
        // optimistic update, if any, should be rolled back.
        window.dispatchEvent(
          new CustomEvent('cart:update-failed', {
            detail: { productId, reason: 'OUT_OF_STOCK' },
          })
        );

        onError?.(err);
        return;
      }

      // Any other error: show the backend's message if we can find
      // one, otherwise fall back to a generic toast.
      const message = extractErrorMessage(err, 'Failed to add to cart');
      toast.error(message);
      onError?.(err);
      setState('idle');
    }
  }, [
    state,
    disabled,
    productId,
    variantId,
    quantity,
    activeCartService,
    isAuthenticated,
    redirectOnAuthError,
    router,
    onSuccess,
    onError,
  ]);

  const isLoading = state === 'loading';
  const isAdded = state === 'added';
  const isOutOfStock = state === 'out_of_stock';
  const isDisabled = disabled || isLoading || isAdded || isOutOfStock;

  const buttonClasses = [
    sizeClasses[size],
    isOutOfStock
      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
      : variantClasses[variant],
    'rounded-lg font-medium transition-all duration-200',
    'inline-flex items-center justify-center gap-2',
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
    isDisabled && !isOutOfStock ? 'opacity-60 cursor-not-allowed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={isDisabled}
      // `aria-disabled` mirrors the native attribute so assistive
      // tech still announces the disabled state when the button is
      // focusable during a state transition.
      aria-disabled={isDisabled}
      aria-live="polite"
      className={buttonClasses}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Adding…
        </>
      ) : isOutOfStock ? (
        <>
          <XCircle className="w-4 h-4" />
          Out of Stock
        </>
      ) : isAdded ? (
        <>
          <CheckCircle className="w-4 h-4" />
          Added
        </>
      ) : (
        <>
          {showIcon && <ShoppingCart className="w-4 h-4" />}
          {children || 'Add to Cart'}
        </>
      )}
    </button>
  );
}

export default AddToCartButton;
