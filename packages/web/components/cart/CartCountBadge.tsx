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
  badgeClassName?: string;
  href?: string;
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
      let resolvedCount = 0;

      if (isAuthenticated) {
        const response = await cartService.getCartCount();
        resolvedCount = response?.count ?? 0;
      } else {
        const response = await guestCartService.getCount();
        resolvedCount = typeof response === 'number' ? response : 0;
      }

      if (!isMountedRef.current) return;
      if (requestId !== requestIdRef.current) return;

      setCount(resolvedCount);
    } catch {
      if (!isMountedRef.current) return;
      if (requestId !== requestIdRef.current) return;
      setCount(0);
    } finally {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

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
    'text-2xs font-bold rounded-full tabular-nums',
    'flex items-center justify-center px-1 shadow-brand',
    badgeClassName ??
      'bg-brand-gradient text-white',
  ].join(' ');

  const ariaLabel =
    count > 0
      ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}`
      : 'Cart';

  if (!showIcon && !loading && count === 0) {
    return null;
  }

  return (
    <Link
      href={href}
      className={`relative inline-flex items-center focus-ring rounded ${className}`}
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
