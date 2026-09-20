'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiService } from '../services/api';
import { formatCurrency } from '../utils/helpers';

interface Product {
  id: string;
  name: string;
  unitPrice: number;
  images: string[];
}

export default function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  const fetchFeaturedProducts = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/products', {
        params: { limit: 4, isActive: true, featured: true }
      });

      if (response.data.success) {
        setProducts(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching featured products:', error);
      // Fallback to regular products
      try {
        const fallbackResponse = await apiService.get('/products', {
          params: { limit: 4, isActive: true }
        });
        if (fallbackResponse.data.success) {
          setProducts(fallbackResponse.data.data || []);
        }
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Featured Products
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 h-80 animate-pulse"
              >
                <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-t-xl"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="py-16 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
          Featured Products
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-soft hover:shadow-card-hover border border-gray-200 dark:border-gray-700 transition-shadow duration-350 overflow-hidden"
            >
              <Link href={`/product/${product.id}`}>
                <div className="aspect-square bg-gray-100 dark:bg-gray-700">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-350"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {product.name}
                  </h3>
                  <p className="text-lg font-bold text-brand-600 dark:text-brand-400 mt-1 tabular-nums">
                    {formatCurrency(product.unitPrice)}
                  </p>
                  <span className="mt-2 inline-block text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 text-sm font-medium transition-colors duration-350">
                    View Details →
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
