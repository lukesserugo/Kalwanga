// D:\Projects\Kalwanga\packages\web\components\products\RecentlyViewed.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Eye, Package, ChevronRight } from 'lucide-react';
import { productService, Product } from '../../services/productService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { WishlistButton } from './WishlistButton';

interface RecentlyViewedProps {
  limit?: number;
  title?: string;
  showTitle?: boolean;
  className?: string;
  onProductClick?: (productId: string) => void;
}

export function RecentlyViewed({
  limit = 6,
  title = 'Recently Viewed',
  showTitle = true,
  className = '',
  onProductClick,
}: RecentlyViewedProps) {
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadRecentlyViewed();
    } else {
      // For non-authenticated users, use localStorage
      loadFromLocalStorage();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Check if component is in viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const el = document.getElementById('recently-viewed-section');
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  const loadRecentlyViewed = async () => {
    try {
      setLoading(true);
      const data = await productService.getRecentlyViewed(limit);
      setProducts(data || []);
    } catch (error) {
      console.error('Failed to load recently viewed:', error);
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem('recentlyViewed');
      if (stored) {
        const ids = JSON.parse(stored);
        // For non-authenticated, we just show placeholder or empty
        setProducts([]);
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (productId: string) => {
    if (onProductClick) {
      onProductClick(productId);
    }
  };

  if (loading) {
    return (
      <div className={`${className}`} id="recently-viewed-section">
        {showTitle && (
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-700 rounded-lg h-32 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <motion.div
      id="recently-viewed-section"
      initial={{ opacity: 0, y: 20 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
      className={`${className}`}
    >
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
          </div>
          {products.length > limit && (
            <Link
              href="/recently-viewed"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {products.slice(0, limit).map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group relative bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden border border-gray-200 dark:border-gray-700"
          >
            <Link
              href={`/shop/${product.id}`}
              onClick={() => handleProductClick(product.id)}
              className="block"
            >
              <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                {product.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <WishlistButton
                    productId={product.id}
                    size="sm"
                    className="shadow-md"
                  />
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {product.name}
                </p>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {formatCurrency(product.unitPrice)}
                </p>
                <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                  <Eye className="w-3 h-3" />
                  <span>Recently viewed</span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
