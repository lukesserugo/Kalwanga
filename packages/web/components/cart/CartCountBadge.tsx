// D:\Projects\Kalwanga\packages\web\components\cart\CartCountBadge.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { cartService } from '../../services/cartService';
import Link from 'next/link';

interface CartCountBadgeProps {
  className?: string;
  showIcon?: boolean;
}

export function CartCountBadge({
  className = '',
  showIcon = true,
}: CartCountBadgeProps) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await cartService.getCartCount();
        setCount(response.count);
      } catch (error) {
        console.error('Failed to fetch cart count:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();

    // Listen for cart updates
    const handleCartUpdate = () => {
      fetchCount();
    };

    window.addEventListener('cart:updated', handleCartUpdate);
    return () => window.removeEventListener('cart:updated', handleCartUpdate);
  }, []);

  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <ShoppingCart className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </div>
    );
  }

  return (
    <Link href="/cart" className={`relative inline-flex items-center ${className}`}>
      {showIcon && <ShoppingCart className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

// ✅ Keep default export for backwards compatibility
export default CartCountBadge;
