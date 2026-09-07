// D:\Projects\Kalwanga\packages\web\components\products\WishlistButton.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Heart, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { productService } from '../../services/productService';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';

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

// ✅ FIXED: Memoized component to prevent unnecessary re-renders
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
  const router = useRouter();
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  // ✅ FIXED: Use refs to prevent duplicate requests and track mounted state
  const hasLoadedRef = useRef(false);
  const isMountedRef = useRef(true);
  const requestInProgressRef = useRef(false);
  const productIdRef = useRef(productId);

  // Update ref when productId changes
  useEffect(() => {
    productIdRef.current = productId;
    // Reset loaded state when productId changes
    hasLoadedRef.current = false;
  }, [productId]);

  const sizeClasses = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
    lg: 'p-3 text-base',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4.5 h-4.5',
    lg: 'w-6 h-6',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  // ✅ FIXED: Stable checkWishlistStatus with proper guards
  const checkWishlistStatus = useCallback(async () => {
    // Skip if already loaded, not authenticated, or request in progress
    if (hasLoadedRef.current || !isAuthenticated || !productIdRef.current || requestInProgressRef.current) {
      return;
    }
    
    requestInProgressRef.current = true;
    
    try {
      setError(null);
      const [isInList, wishlistCount] = await Promise.all([
        productService.checkWishlist(productIdRef.current),
        productService.getWishlistCount().catch(() => 0),
      ]);
      
      if (isMountedRef.current) {
        setIsInWishlist(isInList);
        setCount(wishlistCount || 0);
        hasLoadedRef.current = true;
      }
    } catch (error) {
      console.error('Failed to check wishlist status:', error);
      if (isMountedRef.current) {
        setError('Failed to load wishlist status');
      }
    } finally {
      requestInProgressRef.current = false;
    }
  }, [isAuthenticated]);

  // ✅ FIXED: Single effect with cleanup
  useEffect(() => {
    // Reset mounted ref on mount
    isMountedRef.current = true;
    hasLoadedRef.current = false;
    requestInProgressRef.current = false;
    
    if (autoCheck && isAuthenticated && productId) {
      // Use setTimeout to prevent immediate execution during render
      const timer = setTimeout(() => {
        checkWishlistStatus();
      }, 100);
      return () => clearTimeout(timer);
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [autoCheck, isAuthenticated, productId, checkWishlistStatus]);

  // ✅ FIXED: Stable toggle handler
  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || loading || requestInProgressRef.current) return;

    if (!isAuthenticated) {
      toast.warning('Please sign in to add to wishlist');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
      return;
    }

    requestInProgressRef.current = true;
    setLoading(true);
    setError(null);
    
    // Optimistic update
    const previousState = isInWishlist;
    setIsInWishlist(!previousState);
    
    try {
      const result = await productService.toggleWishlist(productIdRef.current);
      
      if (isMountedRef.current) {
        setIsInWishlist(result.added);
        setCount(prev => result.added ? prev + 1 : Math.max(0, prev - 1));
        hasLoadedRef.current = true;
        
        if (onToggle) {
          onToggle(result.added);
        }

        toast.success(
          result.added 
            ? 'Added to wishlist ❤️' 
            : 'Removed from wishlist',
          {
            duration: 2000,
            position: 'bottom-center',
          }
        );
      }
    } catch (error: any) {
      console.error('Failed to toggle wishlist:', error);
      
      if (isMountedRef.current) {
        setIsInWishlist(previousState);
        const errorMessage = error?.response?.data?.message || 'Failed to update wishlist';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      requestInProgressRef.current = false;
    }
  }, [isAuthenticated, disabled, loading, isInWishlist, onToggle, router]);

  const getButtonTitle = () => {
    if (loading) return 'Loading...';
    if (error) return 'Error - Click to retry';
    return isInWishlist ? 'Remove from wishlist' : 'Add to wishlist';
  };

  // Base button classes
  const baseClasses = `
    relative inline-flex items-center justify-center
    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    ${sizeClasses[size]}
  `;

  const iconClasses = `
    ${iconSizes[size]} 
    transition-all duration-200
    ${isInWishlist ? 'fill-current' : ''}
  `;

  // Render variants...
  // (Keep all the variant rendering code from the original)

  // For icon variant (with optional badge)
  if (variant === 'icon') {
    return (
      <AnimatePresence mode="wait">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={handleToggle}
          disabled={loading || disabled || !isAuthenticated}
          className={`${baseClasses} rounded-full ${className} ${
            isInWishlist 
              ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 focus:ring-red-500' 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-gray-400'
          }`}
          aria-label={getButtonTitle()}
          title={getButtonTitle()}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {loading ? (
            <Loader2 className={`${iconSizes[size]} animate-spin`} />
          ) : (
            <Heart
              className={iconClasses}
              strokeWidth={isHovered && !isInWishlist ? 2.5 : 2}
            />
          )}
          {showCount && count > 0 && !loading && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 text-[10px] font-medium bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-sm"
            >
              {count > 99 ? '99+' : count}
            </motion.span>
          )}
        </motion.button>
      </AnimatePresence>
    );
  }

  // ... rest of variants
});

// Export the hook separately
export function useWishlist(productId: string) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  const checkStatus = useCallback(async () => {
    if (!isAuthenticated || hasLoadedRef.current) return;
    try {
      const status = await productService.checkWishlist(productId);
      setIsInWishlist(status);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error('Failed to check wishlist status:', error);
    }
  }, [isAuthenticated, productId]);

  const toggle = useCallback(async () => {
    if (!isAuthenticated) {
      toast.warning('Please sign in to add to wishlist');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
      return false;
    }

    setLoading(true);
    const previousState = isInWishlist;
    setIsInWishlist(!previousState);
    
    try {
      const result = await productService.toggleWishlist(productId);
      setIsInWishlist(result.added);
      toast.success(result.added ? 'Added to wishlist ❤️' : 'Removed from wishlist');
      return result.added;
    } catch (error) {
      console.error('Failed to toggle wishlist:', error);
      setIsInWishlist(previousState);
      toast.error('Failed to update wishlist');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, productId, router, isInWishlist]);

  useEffect(() => {
    hasLoadedRef.current = false;
    checkStatus();
  }, [checkStatus]);

  return { isInWishlist, loading, toggle, checkStatus };
}
