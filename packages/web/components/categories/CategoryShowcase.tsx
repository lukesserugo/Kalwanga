// D:\Projects\Kalwanga\packages\web\components\categories\CategoryShowcase.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Category } from '../../types/category';
import { categoryService } from '../../services/categoryService';
import { ArrowRight, Loader2, Package, Star } from 'lucide-react';

interface CategoryShowcaseProps {
  businessUnitId?: string;
  title?: string;
  subtitle?: string;
  limit?: number;
  featured?: boolean;
  showViewAll?: boolean;
  className?: string;
}

export function CategoryShowcase({
  businessUnitId = '',
  title = 'Shop by Category',
  subtitle = 'Find exactly what you\'re looking for',
  limit = 6,
  featured = false,
  showViewAll = true,
  className = '',
}: CategoryShowcaseProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = { 
        limit: limit * 2, // Fetch more to filter featured if needed
        isActive: true 
      };
      if (businessUnitId) params.businessUnitId = businessUnitId;
      
      const data = await categoryService.getAllCategories(params);
      
      // Filter featured if requested
      let filteredData = data || [];
      if (featured) {
        filteredData = filteredData.filter((cat: any) => cat.featured === true);
      }
      
      // Sort by name
      filteredData = filteredData.sort((a: Category, b: Category) => 
        a.name.localeCompare(b.name)
      );
      
      // Limit results
      setCategories(filteredData.slice(0, limit));
    } catch (error) {
      console.error('Failed to load categories:', error);
      setError('Failed to load categories. Please try again.');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [businessUnitId, limit, featured]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const colors = [
    'from-blue-500 to-blue-600',
    'from-green-500 to-green-600',
    'from-purple-500 to-purple-600',
    'from-yellow-500 to-yellow-600',
    'from-pink-500 to-pink-600',
    'from-indigo-500 to-indigo-600',
    'from-orange-500 to-orange-600',
    'from-teal-500 to-teal-600',
    'from-red-500 to-red-600',
    'from-cyan-500 to-cyan-600',
    'from-rose-500 to-rose-600',
    'from-amber-500 to-amber-600',
  ];

  const icons = ['📱', '👕', '📚', '🏠', '⚽', '🧸', '💄', '🍕', '🚗', '💊', '🌿', '👶'];

  const getColorIndex = (id: string) => {
    return parseInt(id.slice(0, 2), 16) % colors.length;
  };

  const getIconIndex = (id: string) => {
    return parseInt(id.slice(0, 2), 16) % icons.length;
  };

  if (loading) {
    return (
      <section className={`py-8 md:py-12 bg-white dark:bg-gray-800 ${className}`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center mb-6 md:mb-8">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
            </div>
            {showViewAll && (
              <div className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 opacity-50">
                View All
                <ArrowRight className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
            {[...Array(Math.min(limit, 6))].map((_, i) => (
              <div key={i} className="bg-gray-100 dark:bg-gray-700 rounded-xl h-28 md:h-32 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={`py-8 md:py-12 bg-white dark:bg-gray-800 ${className}`}>
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => loadCategories()}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (categories.length === 0) {
    return (
      <section className={`py-8 md:py-12 bg-white dark:bg-gray-800 ${className}`}>
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-8 md:p-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No categories found</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {featured ? 'No featured categories available' : 'Categories will appear here'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`py-8 md:py-12 bg-white dark:bg-gray-800 ${className}`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-wrap justify-between items-center mb-6 md:mb-8 gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {title}
              {featured && (
                <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">
                  <Star className="w-3 h-3 fill-yellow-500" />
                  Featured
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
          </div>
          {showViewAll && categories.length > 0 && (
            <button
              onClick={() => router.push('/categories')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1 group transition-colors text-sm"
            >
              View All
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
          {categories.map((category, index) => {
            const colorIndex = getColorIndex(category.id);
            const iconIndex = getIconIndex(category.id);
            
            return (
              <motion.button
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ 
                  scale: 1.05,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(`/categories/${category.id}`)}
                className={`bg-gradient-to-br ${colors[colorIndex]} rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-4 md:p-6 text-center text-white relative overflow-hidden group`}
              >
                {/* Decorative background pattern */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300">
                  <div className="absolute -top-10 -right-10 w-20 h-20 rounded-full bg-white/20" />
                  <div className="absolute -bottom-10 -left-10 w-20 h-20 rounded-full bg-white/20" />
                </div>
                
                <div className="relative z-10">
                  <div className="text-3xl md:text-4xl mb-2">{icons[iconIndex]}</div>
                  <h3 className="font-semibold text-sm md:text-base line-clamp-1">{category.name}</h3>
                  {category.description && (
                    <p className="text-xs text-white/80 mt-1 line-clamp-1 hidden sm:block">
                      {category.description}
                    </p>
                  )}
                  {(category as any).productCount > 0 && (
                    <p className="text-xs text-white/70 mt-1">
                      {(category as any).productCount} products
                    </p>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
