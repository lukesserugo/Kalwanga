'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Package, Star, ChevronRight, Search,
  Grid, List, Loader2
} from 'lucide-react';
import PublicNavigation from '../../../components/PublicNavigation';
import { categoryService } from '../../../services/categoryService';
import { productService } from '../../../services/productService';
import { formatCurrency } from '../../../utils/formatters';
import { useThemeStore } from '../../stores/themeStore';
import { Category } from '../../../types/category';

const colors = [
  'from-blue-400 to-blue-600',
  'from-green-400 to-green-600',
  'from-purple-400 to-purple-600',
  'from-yellow-400 to-yellow-600',
];

export default function PublicCategoryDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { isDark } = useThemeStore();
  
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadCategory();
  }, [id]);

  const loadCategory = async () => {
    try {
      setLoading(true);
      const [catData, catWithProducts, subCats] = await Promise.all([
        categoryService.getCategoryById(id),
        categoryService.getCategoryWithProducts(id),
        categoryService.getSubcategories(id),
      ]);
      setCategory(catData);
      setProducts(catWithProducts?.products || []);
      setSubcategories(subCats || []);
    } catch (error) {
      console.error('Failed to load category:', error);
      setCategory(null);
      setProducts([]);
      setSubcategories([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        <PublicNavigation />
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className={`min-h-screen ${isDark ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        <PublicNavigation />
        <div className="max-w-7xl mx-auto px-4 pt-24 pb-8 text-center">
          <div className="text-6xl mb-4">📂</div>
          <h2 className="text-2xl font-bold text-gray-700">Category not found</h2>
          <Link href="/categories" className="mt-4 inline-block text-blue-600">
            Back to Categories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <PublicNavigation />

      {/* Category Header */}
      <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4">
          <Link href="/categories" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-5 h-5" />
            All Categories
          </Link>
          <h1 className="text-4xl font-bold mb-2">{category.name}</h1>
          {category.description && (
            <p className="text-lg text-blue-100">{category.description}</p>
          )}
          <p className="text-sm text-blue-200 mt-2">
            {products.length} products
          </p>
        </div>
      </div>

      {/* Subcategories */}
      {subcategories.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Subcategories</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {subcategories.map((subcat, index) => (
              <Link
                key={subcat.id}
                href={`/categories/${subcat.id}`}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center hover:shadow-md transition-all"
              >
                <div className={`w-12 h-12 mx-auto rounded-lg bg-gradient-to-r ${colors[index % colors.length]} flex items-center justify-center text-2xl mb-2`}>
                  📁
                </div>
                <p className="font-medium text-gray-900 dark:text-white">{subcat.name}</p>
                <p className="text-sm text-gray-500">{(subcat as any).productCount || 0} products</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search and View Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products in this category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No products in this category</p>
          </div>
        ) : (
          <div className={`grid gap-6 ${
            viewMode === 'grid'
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'grid-cols-1'
          }`}>
            {filteredProducts.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
              >
                <Link
                  href={`/shop/${product.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden"
                >
                  <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-16 h-16 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-500">{product.sku}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(product.unitPrice)}
                      </span>
                      {product.rating > 0 && (
                        <span className="flex items-center gap-1 text-sm">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          {product.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
