'use client';

import React from 'react';
import { CreditCard, Loader2, LogIn } from 'lucide-react';

export interface CartCheckoutButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  label?: string;
  loadingLabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  isAuthenticated?: boolean;
}

export function CartCheckoutButton({
  onClick,
  disabled = false,
  isLoading = false,
  label,
  loadingLabel = 'Processing…',
  className = '',
  size = 'md',
  isAuthenticated = true,
}: CartCheckoutButtonProps) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  // Authenticated users get the flat brand color; guests get the
  // gradient as a stronger call-to-action since they need to sign in
  // first.
  const paletteClasses = isAuthenticated
    ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand hover:shadow-brand-lg'
    : 'bg-brand-gradient hover:shadow-brand-lg text-white shadow-brand';

  const resolvedLabel =
    label ?? (isAuthenticated ? 'Proceed to Checkout' : 'Sign in to Checkout');

  const Icon = isAuthenticated ? CreditCard : LogIn;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`w-full inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${paletteClasses} ${className}`}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          <Icon className="w-4 h-4" />
          {resolvedLabel}
        </>
      )}
    </button>
  );
}

export default CartCheckoutButton;
