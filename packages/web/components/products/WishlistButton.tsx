'use client';

// D:\Projects\Kalwanga\packages\web\components\products\WishlistButton.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
} from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { productService } from '../../services/productService';
import { guestWishlistService } from '../../services/guestWishlistService';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';

// ============================================
// BACKEND CONTRACT
// ============================================
//
// Authenticated:
//   POST   /products/wishlist/:productId
//     → { success: true, data: { added: boolean, message: string } }
//   GET    /products/wishlist/:productId/check
//     → { success: true, data: boolean }
//   GET    /products/wishlist/count
//     → { success: true, data: number }
//
// Anonymous:
//   POST   /wishlist/guest/:productId
//     → { success: true, data: { added: boolean } }
//   GET    /wishlist/guest/:productId/check
//     → { success: true, data: boolean }
//   GET    /wishlist/guest
//     → { success: true, data: string[] }   (array of product ids)
//   DELETE /wishlist/guest
//     → { success: true }
//
// The guest wishlist is stored on `GuestSession.wishlist` (a JSON
// array of product ids) and keyed by the `guest_session_id` cookie
// set by `guestSessionMiddleware`. There is no count endpoint for
// guests — count is derived client-side if needed.

interface WishlistButtonProps {
  productId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'text' | 'full' | 'minimal';
  onToggle?: (isInWishlist: boolean) => void;
  showCount?: boolean;
  showLabel?: boolean;
  disabled?: boolean;
  autoCheck?: boolean;
}

const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-3',
};

const iconSizes: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-6 h-6',
};

const textSizes: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

// ============================================
// SHARED COUNT CACHE (authenticated only)
// ============================================
//
// `GET /products/wishlist/count` returns a single number per user.
// Without a shared cache, every <WishlistButton showCount /> on a
// page fires its own request. This caches the last value for a short
// TTL and coalesces concurrent fetches.
//
// Guests don't hit this — they have no count endpoint.

let cachedCount: { value: number; at: number } | null = null;
let inflightCount: Promise<number> | null = null;
const COUNT_TTL_MS = 5_000;

async function getSharedWishlistCount(): Promise<number> {
  const now = Date.now();
  if (cachedCount && now - cachedCount.at < COUNT_TTL_MS) {
    return cachedCount.value;
  }
  if (inflightCount) return inflightCount;

  inflightCount = productService
    .getWishlistCount()
    .catch(() => 0)
    .then((n) => {
      cachedCount = { value: n, at: Date.now() };
      inflightCount = null;
      return n;
    });
  return inflightCount;
}

export function invalidateWishlistCountCache(): void {
  cachedCount = null;
  inflightCount = null;
}

// ============================================
// COMPONENT
// ============================================

export const WishlistButton = memo(function WishlistButton({
  productId,
  className = '',
  size = 'md',
  variant = 'icon',
  onToggle,
  showCount = false,
  showLabel = false,
  disabled = false,
  autoCheck = true,
}: WishlistButtonProps) {
  const { isAuthenticated } = useAuth();

  const [isInWishlist, setIsInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [hasChecked, setHasChecked] = useState(false);

  const isMountedRef = useRef(true);
  const requestInProgressRef = useRef(false);

  // ============================================
  // LIFECYCLE
  // ============================================

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset when productId or auth state changes.
  useEffect(() => {
    setHasChecked(false);
    setIsInWishlist(false);
  }, [productId, isAuthenticated]);

  // ============================================
  // CHECK STATUS
  // ============================================
  //
  // ✅ Branches on auth:
  //    • Authenticated → `/products/wishlist/:id/check`
  //    • Anonymous   → `/wishlist/guest/:id/check`

  useEffect(() => {
    if (!autoCheck || !productId) return;
    if (hasChecked) return;

    let cancelled = false;

    (async () => {
      try {
        const status = isAuthenticated
          ? await productService.checkWishlist(productId)
          : await guestWishlistService.check(productId);

        if (!cancelled && isMountedRef.current) {
          setIsInWishlist(status);
          setHasChecked(true);
        }
      } catch {
        // Both services swallow errors and return false, so this
        // branch is defensive only.
        if (!cancelled && isMountedRef.current) {
          setHasChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoCheck, isAuthenticated, productId, hasChecked]);

  // ============================================
  // CHECK COUNT (shared cache, authenticated only)
  // ============================================
  //
  // ✅ Skipped for guests — there's no count endpoint for them.

  useEffect(() => {
    if (!showCount || !isAuthenticated) return;

    let cancelled = false;
    (async () => {
      const n = await getSharedWishlistCount();
      if (!cancelled && isMountedRef.current) {
        setCount(n);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showCount, isAuthenticated]);

  // ============================================
  // TOGGLE
  // ============================================
  //
  // ✅ Guests get the guest wishlist, not a login redirect.

  const handleToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled || requestInProgressRef.current) return;

      requestInProgressRef.current = true;
      setLoading(true);

      // Optimistic flip — the backend's response will confirm or
      // revert this.
      const previous = isInWishlist;
      setIsInWishlist(!previous);

      try {
        const result = isAuthenticated
          ? await productService.toggleWishlist(productId)
          : await guestWishlistService.toggle(productId);

        if (!isMountedRef.current) return;

        // Trust the backend's authoritative answer.
        setIsInWishlist(result.added);

        // Count only updates for authenticated users — guests have no
        // count endpoint.
        if (showCount && isAuthenticated) {
          setCount((prev) => {
            const next = result.added
              ? prev + 1
              : Math.max(0, prev - 1);
            cachedCount = { value: next, at: Date.now() };
            return next;
          });
        }

        onToggle?.(result.added);

        toast.success(
          result.added
            ? 'Added to wishlist ❤️'
            : 'Removed from wishlist',
        );
      } catch (err: any) {
        if (!isMountedRef.current) return;

        // Revert the optimistic flip.
        setIsInWishlist(previous);

        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to update wishlist';
        toast.error(message);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
        requestInProgressRef.current = false;
      }
    },
    [
      disabled,
      isAuthenticated,
      isInWishlist,
      productId,
      showCount,
      onToggle,
    ],
  );

  // ============================================
  // RENDER HELPERS
  // ============================================

  const title = loading
    ? 'Loading...'
    : isInWishlist
    ? 'Remove from wishlist'
    : 'Add to wishlist';

  const activeClasses =
    'bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-900/50 focus:ring-danger-500';
  const inactiveClasses =
    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-gray-400';
  const minimalActive = 'text-danger-600 dark:text-danger-400';
  const minimalInactive =
    'text-gray-500 dark:text-gray-400 hover:text-danger-500 dark:hover:text-danger-400';

  const heartIcon = (
    <Heart
      className={`${iconSizes[size]} transition-all duration-250 ${
        isInWishlist ? 'fill-current' : ''
      }`}
      strokeWidth={2}
    />
  );

  const spinner = (
    <Loader2 className={`${iconSizes[size]} animate-spin`} />
  );

  const countBadge =
    showCount && count > 0 && !loading ? (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute -top-1 -right-1 text-2xs font-medium bg-danger-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-soft tabular-nums"
      >
        {count > 99 ? '99+' : count}
      </motion.span>
    ) : null;

  const label = (
    <span className={textSizes[size]}>
      {isInWishlist ? 'Wishlisted' : 'Wishlist'}
    </span>
  );

  // ============================================
  // RENDER — icon
  // ============================================

  if (variant === 'icon') {
    return (
      <motion.button
        whileHover={{ scale: disabled ? 1 : 1.1 }}
        whileTap={{ scale: disabled ? 1 : 0.9 }}
        type="button"
        onClick={handleToggle}
        disabled={disabled || loading}
        className={`relative inline-flex items-center justify-center rounded-full transition duration-250 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${sizeClasses[size]} ${
          isInWishlist ? activeClasses : inactiveClasses
        } ${className}`}
        aria-label={title}
        title={title}
      >
        {loading ? spinner : heartIcon}
        {showLabel && (
          <span className={`ml-1.5 ${textSizes[size]}`}>
            {isInWishlist ? 'Wishlisted' : 'Wishlist'}
          </span>
        )}
        {countBadge}
      </motion.button>
    );
  }

  // ============================================
  // RENDER — minimal (transparent background)
  // ============================================

  if (variant === 'minimal') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || loading}
        className={`relative inline-flex items-center justify-center gap-1.5 transition duration-250 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-danger-500 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${sizeClasses[size]} ${
          isInWishlist ? minimalActive : minimalInactive
        } ${className}`}
        aria-label={title}
        title={title}
      >
        {loading ? spinner : heartIcon}
        {showLabel && label}
        {countBadge}
      </button>
    );
  }

  // ============================================
  // RENDER — text (label only)
  // ============================================

  if (variant === 'text') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || loading}
        className={`relative inline-flex items-center gap-1.5 font-medium transition duration-250 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-danger-500 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${textSizes[size]} ${
          isInWishlist ? minimalActive : minimalInactive
        } ${className}`}
        aria-label={title}
        title={title}
      >
        {loading ? spinner : heartIcon}
        <span>{isInWishlist ? 'Wishlisted' : 'Add to Wishlist'}</span>
        {countBadge}
      </button>
    );
  }

  // ============================================
  // RENDER — full (bordered button)
  // ============================================

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      type="button"
      onClick={handleToggle}
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition duration-250 focus:outline-none focus:ring-2 focus:ring-offset-2 px-4 py-2 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${textSizes[size]} ${
        isInWishlist
          ? 'border-danger-200 dark:border-danger-900 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-900/50 focus:ring-danger-500'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-400'
      } ${className}`}
      aria-label={title}
      title={title}
    >
      {loading ? spinner : heartIcon}
      <span>{isInWishlist ? 'Wishlisted' : 'Add to Wishlist'}</span>
      {countBadge}
    </motion.button>
  );
});

export default WishlistButton;

// ============================================
// useWishlist HOOK
// ============================================
//
// Standalone hook for consumers that need the state without the
// button. Same backend contract, same guest branch.

export function useWishlist(productId: string) {
  const { isAuthenticated } = useAuth();

  const [isInWishlist, setIsInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setHasChecked(false);
    setIsInWishlist(false);
  }, [productId, isAuthenticated]);

  const checkStatus = useCallback(async () => {
    if (!productId || hasChecked) return;
    try {
      const status = isAuthenticated
        ? await productService.checkWishlist(productId)
        : await guestWishlistService.check(productId);
      if (isMountedRef.current) {
        setIsInWishlist(status);
        setHasChecked(true);
      }
    } catch {
      if (isMountedRef.current) {
        setHasChecked(true);
      }
    }
  }, [isAuthenticated, productId, hasChecked]);

  useEffect(() => {
    if (productId && !hasChecked) {
      checkStatus();
    }
  }, [productId, hasChecked, checkStatus]);

  const toggle = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    const previous = isInWishlist;
    setIsInWishlist(!previous);

    try {
      const result = isAuthenticated
        ? await productService.toggleWishlist(productId)
        : await guestWishlistService.toggle(productId);

      if (isMountedRef.current) {
        setIsInWishlist(result.added);
      }
      toast.success(
        result.added ? 'Added to wishlist ❤️' : 'Removed from wishlist',
      );
      return result.added;
    } catch (err) {
      if (isMountedRef.current) {
        setIsInWishlist(previous);
      }
      toast.error('Failed to update wishlist');
      return false;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, productId, isInWishlist]);

  return { isInWishlist, loading, toggle, checkStatus };
}
