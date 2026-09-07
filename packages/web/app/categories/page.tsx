'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Grid, List, ArrowUpDown, Star, Package,
  FolderTree, ChevronRight, RefreshCw, Loader2
} from 'lucide-react';
import PublicNavigation from '../../components/PublicNavigation';
import { categoryService } from '../../services/categoryService';
import { productService } from '../../services/productService';
import { toast } from '../../utils/toast-manager';
import { useThemeStore } from '../stores/themeStore';
import { Category } from '../../types/category';

const colors = [
  'from-blue-400 to-blue-600',
  'from-green-400 to-green-600',
  'from-purple-400 to-purple-600',
  'from-yellow-400 to-yellow-600',
  'from-pink-400 to-pink-600',
  'from-indigo-400 to-indigo-600',
  'from-orange-400 to-orange-600',
  'from-teal-400 to-teal-600',
  'from-red-400 to-red-600',
  'from-cyan-400 to-cyan-600',
  'from-rose-400 to-rose-600',
  'from-amber-400 to-amber-600',
];

const icons = ['📱', '👕', '📚', '🏠', '⚽', '🧸', '💄', '🍕', '🚗', '💊', '🌿', '👶'];

export default function PublicCategoriesPage() {
  const router = useRouter();
  const { isDark } = useThemeStore();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'products' | 'featured'>('name');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await categoryService.getAllCategories({
        limit: 100,
        isActive: true,
      });
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const loadCategoryProducts = async (categoryId: string) => {
    try {
      setLoadingProducts(true);
      const data = await categoryService.getCategoryWithProducts(categoryId);
      setCategoryProducts(data?.products || []);
    } catch (error) {
      console.error('Failed to load category products:', error);
      setCategoryProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleCategoryClick = async (category: Category) => {
    setSelectedCategory(category);
    await loadCategoryProducts(category.id);
  };

  const filteredCategories = useMemo(() => {
    let filtered = categories;
    
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      filtered = filtered.filter(cat =>
        cat.name.toLowerCase().includes(search) ||
        cat.description?.toLowerCase().includes(search)
      );
    }
    
    switch (sortBy) {
      case 'name':
        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'products':
        filtered = [...filtered].sort((a, b) => ((b as any).productCount || 0) - ((a as any).productCount || 0));
        break;
      case 'featured':
        filtered = [...filtered].sort((a, b) => ((b as any).featured ? 1 : 0) - ((a as any).featured ? 1 : 0));
        break;
    }
    
    return filtered;
  }, [categories, searchQuery, sortBy]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        <PublicNavigation />
        <div className="max-w-7xl mx-auto px-4 pt-24 pb-8">
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
      <PublicNavigation />

      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white pt-24 pb-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Browse Categories
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl">
              {categories.length > 0 
                ? `Discover products across ${categories.length} categories`
                : 'Explore our product categories'
              }
            </p>

            {/* Search Bar */}
            <div className="mt-6 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/70" />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-12 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-3.5 text-white/70 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {filteredCategories.length} categories
          </span>
          <div className="flex items-center gap-4">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow' : 'hover:bg-gray-200'}`}
                aria-label="Grid view"
              >
                <Grid className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow' : 'hover:bg-gray-200'}`}
                aria-label="List view"
              >
                <List className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
              >
                <option value="name">Name</option>
                <option value="products">Most Products</option>
                <option value="featured">Featured</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        {filteredCategories.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
            <div className="text-6xl mb-4">📂</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No categories found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try adjusting your search</p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={`grid gap-6 ${
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1'
            }`}
          >
            {filteredCategories.map((category, index) => (
              <motion.div
                key={category.id}
                variants={itemVariants}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  href={`/categories/${category.id}`}
                  className={`block ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden'
                      : 'bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all p-4 flex items-center gap-6'
                  }`}
                >
                  {viewMode === 'grid' ? (
                    <>
                      <div className={`h-32 bg-gradient-to-r ${colors[index % colors.length]} flex items-center justify-center text-5xl group-hover:scale-110 transition-transform`}>
                        {(category as any).image || icons[index % icons.length]}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {category.name}
                          </h3>
                          {(category as any).featured && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {category.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {category.description}
                          </p>
                        )}
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {(category as any).productCount || 0} products
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`w-24 h-24 rounded-xl bg-gradient-to-r ${colors[index % colors.length]} flex items-center justify-center text-4xl flex-shrink-0`}>
                        {(category as any).image || icons[index % icons.length]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{category.name}</h3>
                          {(category as any).featured && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {category.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
                        )}
                        <div className="mt-2 flex items-center gap-4">
                          <span className="text-sm text-blue-600 dark:text-blue-400">
                            {(category as any).productCount || 0} products
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </>
                  )}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
