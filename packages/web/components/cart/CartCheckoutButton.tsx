'use client';

import React from 'react';
import { CreditCard, Loader2 } from 'lucide-react';

// ✅ FIXED: Added 'export' keyword to make the interface available
export interface CartCheckoutButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  label?: string;
  loadingLabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CartCheckoutButton({
  onClick,
  disabled = false,
  isLoading = false,
  label = 'Proceed to Checkout',
  loadingLabel = 'Processing...',
  className = '',
  size = 'md',
}: CartCheckoutButtonProps) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4" />
          {label}
        </>
      )}
    </button>
  );
}

export default CartCheckoutButton;
