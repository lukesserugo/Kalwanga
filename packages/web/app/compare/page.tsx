// D:\Projects\Kalwanga\packages\web\app\compare\page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Scale, X, Package, Star, ShoppingCart, Heart,
  Eye, ChevronLeft, ChevronRight, Plus,
  Check, Minus, AlertCircle, Loader2
} from 'lucide-react';
import PublicNavigation from '../../components/PublicNavigation';
import { productService } from '../../services/productService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency } from '../../utils/formatters';
import { useThemeStore } from '../stores/themeStore';

interface CompareProduct {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  costPrice?: number;
  images?: string[];
  description?: string;
  category?: { id: string; name: string };
  inventory?: Array<{ quantity: number; reserved: number }>;
  rating?: number;
  reviewCount?: number;
  isActive: boolean;
  featured?: boolean;
  isDigital?: boolean;
  weight?: number;
  taxRate?: number;
  attributes?: Record<string, any>;
  tags?: string[];
}

export default function ComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark } = useThemeStore();
  
  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);

  useEffect(() => {
    const ids = searchParams.get('ids');
    if (ids) {
      const productIds = ids.split(',').filter(id => id.trim());
      if (productIds.length >= 2) {
        loadCompareProducts(productIds);
        return;
      }
    }
    // Load from localStorage
    loadFromStorage();
  }, [searchParams]);

  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem('compareList');
      if (stored) {
        const ids = JSON.parse(stored);
        if (ids.length >= 2) {
          loadCompareProducts(ids);
          return;
        }
      }
      setLoading(false);
      setProducts([]);
    } catch (error) {
      console.error('Failed to load from storage:', error);
      setLoading(false);
    }
  };

  const loadCompareProducts = async (ids: string[]) => {
    try {
      setLoading(true);
      setError(null);
      const data = await productService.compareProducts(ids);
      setProducts(data || []);
    } catch (error) {
      console.error('Failed to load compare products:', error);
      setError('Failed to load products for comparison');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const removeFromCompare = (productId: string) => {
    const newList = products.filter(p => p.id !== productId);
    setProducts(newList);
    const ids = newList.map(p => p.id);
    localStorage.setItem('compareList', JSON.stringify(ids));
    
    // Update URL
    const params = new URLSearchParams(searchParams);
    params.set('ids', ids.join(','));
    router.replace(`/compare?${params.toString()}`);
    
    toast.success('Product removed from comparison');
  };

  const clearCompare = () => {
    setProducts([]);
    localStorage.removeItem('compareList');
    router.replace('/compare');
    toast.success('Comparison cleared');
  };

  const renderStars = (rating: number = 0) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= Math.round(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
          />
        ))}
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">({rating.toFixed(1)})</span>
      </div>
    );
  };

  const getStockStatus = (product: CompareProduct) => {
    const inventory = product.inventory?.[0];
    if (!inventory) return { status: 'No Stock', color: 'bg-gray-100 text-gray-600' };
    const available = inventory.quantity - (inventory.reserved || 0);
    if (available <= 0) return { status: 'Out of Stock', color: 'bg-red-100 text-red-700' };
    if (available <= 5) return { status: 'Low Stock', color: 'bg-yellow-100 text-yellow-700' };
    return { status: 'In Stock', color: 'bg-green-100 text-green-700' };
  };

  const getAttributeKeys = () => {
    const keys = new Set<string>();
    products.forEach(product => {
      if (product.attributes) {
        Object.keys(product.attributes).forEach(key => keys.add(key));
      }
    });
    return Array.from(keys);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <PublicNavigation />
        <div className="max-w-7xl mx-auto px-4 pt-24 pb-8">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <PublicNavigation />
        <div className="max-w-7xl mx-auto px-4 pt-24 pb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Error</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">{error}</p>
            <button
              onClick={() => router.push('/shop')}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Browse Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <PublicNavigation />
        <div className="max-w-7xl mx-auto px-4 pt-24 pb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Scale className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">No Products to Compare</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Add at least 2 products to compare their features side by side.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 justify-center">
              <Link
                href="/shop"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Browse Products
              </Link>
              <Link
                href="/wishlist"
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                View Wishlist
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const attributeKeys = getAttributeKeys();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <PublicNavigation />
      
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Scale className="w-8 h-8 text-blue-600" />
              Compare Products
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Comparing {products.length} products
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/shop')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
            {products.length > 0 && (
              <button
                onClick={clearCompare}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Comparison Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="w-32 px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                    Feature
                  </th>
                  {products.map((product) => (
                    <th key={product.id} className="px-4 py-3 text-center min-w-[200px] relative">
                      <button
                        onClick={() => removeFromCompare(product.id)}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="w-20 h-20 mx-auto rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <Link href={`/shop/${product.id}`}>
                        <h3 className="mt-2 font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2">
                          {product.name}
                        </h3>
                      </Link>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{product.sku}</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                        {formatCurrency(product.unitPrice)}
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <Link
                          href={`/shop/${product.id}`}
                          className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {/* Rating */}
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                    Rating
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-3 text-center">
                      {product.rating ? renderStars(product.rating) : 'N/A'}
                    </td>
                  ))}
                </tr>

                {/* Category */}
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                    Category
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                      {product.category?.name || 'N/A'}
                    </td>
                  ))}
                </tr>

                {/* Stock */}
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                    Stock
                  </td>
                  {products.map((product) => {
                    const stock = getStockStatus(product);
                    const inventory = product.inventory?.[0];
                    const available = inventory ? inventory.quantity - (inventory.reserved || 0) : 0;
                    return (
                      <td key={product.id} className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${stock.color}`}>
                          {stock.status}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {available} available
                        </p>
                      </td>
                    );
                  })}
                </tr>

                {/* Status */}
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                    Status
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        product.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Type */}
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                    Type
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                      {product.isDigital ? 'Digital' : 'Physical'}
                    </td>
                  ))}
                </tr>

                {/* Weight */}
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                    Weight
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                      {product.weight ? `${product.weight} kg` : 'N/A'}
                    </td>
                  ))}
                </tr>

                {/* Tax Rate */}
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                    Tax Rate
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                      {product.taxRate ? `${product.taxRate}%` : 'N/A'}
                    </td>
                  ))}
                </tr>

                {/* Custom Attributes */}
                {attributeKeys.map((key) => (
                  <tr key={key}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 capitalize">
                      {key}
                    </td>
                    {products.map((product) => (
                      <td key={product.id} className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                        {product.attributes?.[key] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Tags */}
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                    Tags
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-3 text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {product.tags?.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                            #{tag}
                          </span>
                        ))}
                        {product.tags && product.tags.length > 3 && (
                          <span className="text-xs text-gray-400">+{product.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Description */}
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                    Description
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                      <p className="line-clamp-3">{product.description || 'No description'}</p>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Share Comparison */}
        {products.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => {
                const ids = products.map(p => p.id).join(',');
                const shareUrl = window.location.origin + `/compare?ids=${ids}`;
                navigator.clipboard.writeText(shareUrl);
                toast.success('Comparison link copied!');
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share Comparison
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Import Share2
import { Share2 } from 'lucide-react';
