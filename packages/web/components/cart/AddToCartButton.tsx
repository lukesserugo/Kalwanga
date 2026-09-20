// D:\Projects\Kalwanga\packages\web\components\cart\AddToCartButton.tsx

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Loader2, CheckCircle } from 'lucide-react';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../utils/toast-manager';

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
  /**
   * When true (default), a 401 on an authenticated add-to-cart request
   * redirects the user to login with a redirect_url back to the
   * current page. Set to false if the caller wants to handle 401s
   * itself.
   */
  redirectOnAuthError?: boolean;
}

type ButtonState = 'idle' | 'loading' | 'added';

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

  const activeCartService = useMemo(
    () => (isAuthenticated ? cartService : guestCartService),
    [isAuthenticated],
  );

  // Reset the transient "Added!" confirmation after a short delay.
  // Uses an effect so unmount during the timeout is safe.
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
      'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md hover:shadow-lg',
    secondary:
      'bg-gray-800 hover:bg-gray-900 text-white shadow-md hover:shadow-lg',
    outline:
      'border-2 border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20',
  };

  const handleAddToCart = useCallback(async () => {
    if (state === 'loading' || disabled) return;
    if (!productId) {
      toast.error('Product ID is required');
      return;
    }

    setState('loading');

    try {
      await activeCartService.addItem({
        productId,
        variantId: variantId ?? undefined,
        quantity,
      });

      setState('added');
      toast.success('Item added to cart');
      window.dispatchEvent(new CustomEvent('cart:updated'));

      onSuccess?.();
    } catch (err: any) {
      console.error('Failed to add to cart:', err);

      // Session expiry on an authenticated cart. Guests never get 401
      // from the guest cart endpoint, so a 401 always means the
      // session has gone away.
      if (
        err?.response?.status === 401 &&
        isAuthenticated &&
        redirectOnAuthError
      ) {
        const redirectUrl =
          typeof window !== 'undefined'
            ? window.location.pathname + window.location.search
            : '/';
        router.push(
          `/login?redirect_url=${encodeURIComponent(redirectUrl)}`,
        );
        onError?.(err);
        return;
      }

      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to add to cart';
      toast.error(message);
      onError?.(err);
    } finally {
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
  const isDisabled = disabled || isLoading || isAdded;

  const buttonClasses = [
    sizeClasses[size],
    variantClasses[variant],
    'rounded-lg font-medium transition-all duration-200',
    'inline-flex items-center justify-center gap-2',
    'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
    isDisabled ? 'opacity-60 cursor-not-allowed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={isDisabled}
      aria-live="polite"
      className={buttonClasses}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Adding…
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
