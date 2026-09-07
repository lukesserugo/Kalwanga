// D:\Projects\Kalwanga\packages\web\components\cart\AddToCartButton.tsx

'use client';

import React, { useState } from 'react';
import { ShoppingCart, Loader2, CheckCircle } from 'lucide-react';
import { cartService } from '../../services/cartService';
import { toast } from '../../utils/toast-manager';

interface AddToCartButtonProps {
  productId: string;
  variantId?: string;
  quantity?: number;
  className?: string;
  onSuccess?: () => void;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
  showIcon?: boolean;
}

export function AddToCartButton({
  productId,
  variantId,
  quantity = 1,
  className = '',
  onSuccess,
  children,
  size = 'md',
  variant = 'primary',
  showIcon = true,
}: AddToCartButtonProps) {
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20',
  };

  const handleAddToCart = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const cart = await cartService.addItem({
        productId,
        variantId,
        quantity,
      });
      
      setAdded(true);
      toast.success('Item added to cart');
      
      if (onSuccess) {
        onSuccess();
      }
      
      setTimeout(() => setAdded(false), 2000);
    } catch (error: any) {
      console.error('Failed to add to cart:', error);
      toast.error(error?.message || 'Failed to add to cart');
    } finally {
      setLoading(false);
    }
  };

  const buttonClasses = `
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    rounded-lg font-medium transition-all duration-200
    flex items-center justify-center gap-2
    ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}
    ${className}
  `;

  return (
    <button
      onClick={handleAddToCart}
      disabled={loading}
      className={buttonClasses}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Adding...
        </>
      ) : added ? (
        <>
          <CheckCircle className="w-4 h-4" />
          Added!
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

// ✅ Keep default export for backwards compatibility
export default AddToCartButton;
