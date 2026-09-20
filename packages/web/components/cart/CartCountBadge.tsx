// D:\Projects\Kalwanga\packages\web\components\cart\CartCountBadge.tsx

'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { useAuth } from '../../hooks/useAuth';

interface CartCountBadgeProps {
  className?: string;
  showIcon?: boolean;
  /**
   * Optional class overrides for the badge dot. Defaults to the
   * storefront orange/red gradient.
   */
  badgeClassName?: string;
  /**
   * Overrides the default `/cart` link destination.
   */
  href?: string;
  /**
   * Optional icon size override. Defaults to `w-5 h-5`.
   */
  iconClassName?: string;
}

export function CartCountBadge({
  className = '',
  showIcon = true,
  badgeClassName,
  href = '/cart',
  iconClassName = 'w-5 h-5',
}: CartCountBadgeProps) {
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const isMountedRef = useRef(true);
  /**
   * Monotonic request id. Each `fetchCount` call captures the current
   * value before awaiting; if a newer call has incremented the id by
   * the time the response arrives, the older response is discarded.
   * This prevents a slow request for the guest cart from overwriting
   * the user cart's count after a sign-in.
   */
  const requestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchCount = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      // ✅ Branch per-service. `cartService.getCartCount()` returns
      //    `{ count: number }`; `guestCartService.getCount()` returns
      //    a bare `number`. Neither method exists on the other, so
      //    calling through the union triggers TS2339.
      let resolvedCount = 0;

      if (isAuthenticated) {
        const response = await cartService.getCartCount();
        resolvedCount = response?.count ?? 0;
      } else {
        const response = await guestCartService.getCount();
        resolvedCount =
          typeof response === 'number' ? response : 0;
      }

      // Discard if a newer request has already been issued or the
      // component unmounted.
      if (!isMountedRef.current) return;
      if (requestId !== requestIdRef.current) return;

      setCount(resolvedCount);
    } catch {
      if (!isMountedRef.current) return;
      if (requestId !== requestIdRef.current) return;
      // Silent — the badge is best-effort.
      setCount(0);
    } finally {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

  // Fetch on mount, on auth change, and on cross-component update.
  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    const handler = () => {
      void fetchCount();
    };
    window.addEventListener('cart:updated', handler);
    return () => window.removeEventListener('cart:updated', handler);
  }, [fetchCount]);

  const displayCount = count > 99 ? '99+' : String(count);

  const badgeClasses = [
    'absolute -top-1 -right-1 min-w-[18px] h-[18px]',
    'text-[10px] font-bold rounded-full',
    'flex items-center justify-center px-1 shadow-sm',
    badgeClassName ??
      'bg-gradient-to-r from-orange-500 to-red-500 text-white',
  ].join(' ');

  const ariaLabel =
    count > 0
      ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}`
      : 'Cart';

  // Without an icon and with no items, the component has nothing to
  // render. Bail out entirely rather than emit an invisible clickable
  // anchor.
  if (!showIcon && !loading && count === 0) {
    return null;
  }

  // Always render the Link wrapper. The icon is present from the
  // first frame, and the badge pops in once the count resolves. This
  // keeps the DOM structure stable and gives parents a consistent
  // element to style with `a:hover`, `a:focus`, etc.
  return (
    <Link
      href={href}
      className={`relative inline-flex items-center ${className}`}
      aria-label={ariaLabel}
    >
      {showIcon && (
        <ShoppingCart
          className={`${iconClassName} text-gray-600 dark:text-gray-400`}
        />
      )}

      {count > 0 && (
        <span className={badgeClasses} aria-hidden="true">
          {displayCount}
        </span>
      )}
    </Link>
  );
}

export default CartCountBadge;
