// D:\Projects\Kalwanga\packages\web\components\products\ProductCompare.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Check,
  Minus,
  Package,
  DollarSign,
  Star,
  ShoppingCart,
  Heart,
  Share2,
  Scale,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Eye,
  Layers,
  ImageIcon,
  Link2
} from 'lucide-react';
import { productService, Product } from '../../services/productService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency } from '../../utils/formatters';
import { WishlistButton } from './WishlistButton';

interface CompareProduct extends Product {
  selected?: boolean;
}

interface ProductCompareProps {
  initialProductIds?: string[];
  maxCompare?: number;
  onClose?: () => void;
  className?: string;
}

export function ProductCompare({
  initialProductIds = [],
  maxCompare = 4,
  onClose,
  className = '',
}: ProductCompareProps) {
  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [compareList, setCompareList] = useState<string[]>(initialProductIds);
  const [selectedAttribute, setSelectedAttribute] = useState<string | null>(null);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [selectorSearch, setSelectorSearch] = useState('');

  useEffect(() => {
    if (initialProductIds.length > 0) {
      loadCompareProducts(initialProductIds);
    } else {
      loadFromStorage();
    }
  }, []);

  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem('compareList');
      if (stored) {
        const ids = JSON.parse(stored);
        if (ids.length > 0) {
          loadCompareProducts(ids);
        }
      }
    } catch (error) {
      console.error('Failed to load compare from storage:', error);
    }
  };

  const loadCompareProducts = async (ids: string[]) => {
    if (ids.length < 2) {
      toast.warning('Please select at least 2 products to compare');
      return;
    }

    setLoading(true);
    try {
      const data = await productService.compareProducts(ids);
      // 🔥 Map variants with images
      const mappedProducts = data.map((p: any) => ({
        ...p,
        variants: (p.variants || []).map((v: any) => ({
          ...v,
          images: v.images || [],
          attributes: v.attributes || {},
          barcode: v.barcode || null,
          inventoryId: v.inventoryId || null,
        })),
      }));
      setProducts(mappedProducts);
      setCompareList(ids);
      localStorage.setItem('compareList', JSON.stringify(ids));
    } catch (error) {
      console.error('Failed to load compare products:', error);
      toast.error('Failed to load products for comparison');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 NEW: Load available products for selector
  const loadAvailableProducts = async (search?: string) => {
    setLoadingAvailable(true);
    try {
      const result = await productService.getAllProducts({
        page: 1,
        limit: 20,
        search: search || undefined,
        isActive: true,
      });
      setAvailableProducts(result.data || []);
    } catch (error) {
      console.error('Failed to load available products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoadingAvailable(false);
    }
  };

  const removeFromCompare = (productId: string) => {
    const newList = compareList.filter(id => id !== productId);
    setCompareList(newList);
    setProducts(prev => prev.filter(p => p.id !== productId));
    localStorage.setItem('compareList', JSON.stringify(newList));
    toast.success('Product removed from comparison');
  };

  const clearCompare = () => {
    setCompareList([]);
    setProducts([]);
    localStorage.removeItem('compareList');
    if (onClose) onClose();
  };

  const addToCompare = async (productId: string) => {
    if (compareList.includes(productId)) {
      toast.warning('Product already in comparison');
      return;
    }

    if (compareList.length >= maxCompare) {
      toast.warning(`Maximum ${maxCompare} products can be compared`);
      return;
    }

    const newList = [...compareList, productId];
    await loadCompareProducts(newList);
    setShowProductSelector(false);
  };

  const getUniqueAttributes = () => {
    const attributes = new Set<string>();
    products.forEach(product => {
      if (product.attributes) {
        Object.keys(product.attributes).forEach(key => attributes.add(key));
      }
    });
    return Array.from(attributes);
  };

  // 🔥 NEW: Get total stock including variants
  const getTotalStock = (product: CompareProduct) => {
    const mainStock = product.inventory?.[0]?.quantity || 0;
    const variantStock = (product.variants || []).reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
    return mainStock + variantStock;
  };

  // 🔥 NEW: Get total variant count
  const getVariantCount = (product: CompareProduct) => {
    return product.variants?.length || 0;
  };

  // 🔥 NEW: Check if product has variant images
  const hasVariantImages = (product: CompareProduct) => {
    return (product.variants || []).some((v: any) => v.images && v.images.length > 0);
  };

  // 🔥 NEW: Check if product is inventory linked
  const isInventoryLinked = (product: CompareProduct) => {
    return !!product.inventoryId;
  };

  const renderStars = (rating: number = 0) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= Math.round(rating)
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
        <span className="text-sm text-gray-500 ml-1">({rating.toFixed(1)})</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading comparison...</span>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
        <Scale className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No products to compare</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Add products to compare their features side by side
        </p>
        <Link
          href="/shop"
          className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Compare Products ({products.length})
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {products.length > 0 && (
            <button
              onClick={clearCompare}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
            >
              Clear All
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="overflow-x-auto p-4">
        <div className="min-w-[640px]">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-32 text-left text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                  Feature
                </th>
                {products.map((product) => (
                  <th key={product.id} className="text-center px-4 py-2 min-w-[180px]">
                    <div className="relative group">
                      <button
                        onClick={() => removeFromCompare(product.id)}
                        className="absolute -top-2 -right-2 p-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-24 h-24 mx-auto rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 relative">
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
                        {/* 🔥 NEW: Variant count badge */}
                        {getVariantCount(product) > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 bg-purple-500/80 text-white text-[10px] py-0.5 flex items-center justify-center gap-0.5">
                            <Layers className="w-3 h-3" />
                            {getVariantCount(product)}
                            {hasVariantImages(product) && <ImageIcon className="w-3 h-3" />}
                          </div>
                        )}
                        {/* 🔥 NEW: Inventory linked badge */}
                        {isInventoryLinked(product) && (
                          <div className="absolute top-0 right-0 p-0.5 bg-blue-500/80 text-white rounded-bl-lg">
                            <Link2 className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <Link
                        href={`/shop/${product.id}`}
                        className="block mt-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2"
                      >
                        {product.name}
                      </Link>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(product.unitPrice)}
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <WishlistButton productId={product.id} size="sm" />
                        <Link
                          href={`/shop/${product.id}`}
                          className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </th>
                ))}
                {products.length < maxCompare && (
                  <th className="text-center px-4 py-2 min-w-[120px]">
                    <button
                      onClick={() => {
                        setShowProductSelector(true);
                        loadAvailableProducts();
                      }}
                      className="w-full h-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors flex flex-col items-center justify-center"
                    >
                      <Plus className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-400 mt-2">Add Product</span>
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {/* Basic Info */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">SKU</td>
                {products.map((product) => (
                  <td key={product.id} className="text-center text-sm text-gray-700 dark:text-gray-300 py-2">
                    {product.sku}
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>

              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">Category</td>
                {products.map((product) => (
                  <td key={product.id} className="text-center text-sm text-gray-700 dark:text-gray-300 py-2">
                    {product.category?.name || 'N/A'}
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>

              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">Rating</td>
                {products.map((product) => (
                  <td key={product.id} className="text-center py-2">
                    {product.rating ? renderStars(product.rating) : 'N/A'}
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>

              {/* 🔥 UPDATED: Stock with variant support */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">Stock</td>
                {products.map((product) => {
                  const stock = getTotalStock(product);
                  const variantStock = (product.variants || []).reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
                  return (
                    <td key={product.id} className="text-center py-2">
                      <span className={`text-sm font-medium ${
                        stock > 10 ? 'text-green-600' :
                        stock > 0 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                      </span>
                      {variantStock > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Includes {variantStock} variant stock
                        </p>
                      )}
                    </td>
                  );
                })}
                {products.length < maxCompare && <td />}
              </tr>

              {/* 🔥 NEW: Variants row */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2 flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Variants
                </td>
                {products.map((product) => (
                  <td key={product.id} className="text-center py-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {getVariantCount(product)}
                    </span>
                    {hasVariantImages(product) && (
                      <span className="ml-1 text-xs text-purple-500 flex items-center gap-0.5 justify-center">
                        <ImageIcon className="w-3 h-3" />
                        with images
                      </span>
                    )}
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>

              {/* 🔥 NEW: Inventory Link row */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2 flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  Inventory
                </td>
                {products.map((product) => (
                  <td key={product.id} className="text-center py-2">
                    <span className={`text-sm flex items-center justify-center gap-1 ${
                      isInventoryLinked(product)
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400'
                    }`}>
                      {isInventoryLinked(product) ? (
                        <>
                          <Link2 className="w-3 h-3" />
                          Linked
                        </>
                      ) : (
                        'Not Linked'
                      )}
                    </span>
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>

              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">Status</td>
                {products.map((product) => (
                  <td key={product.id} className="text-center py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      product.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>

              {/* Custom Attributes */}
              {getUniqueAttributes().map((attr) => (
                <tr key={attr}>
                  <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2 capitalize">
                    {attr}
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="text-center text-sm text-gray-700 dark:text-gray-300 py-2">
                      {product.attributes?.[attr] || '-'}
                    </td>
                  ))}
                  {products.length < maxCompare && <td />}
                </tr>
              ))}

              {/* Actions */}
              <tr>
                <td className="text-sm font-medium text-gray-500 dark:text-gray-400 py-2">Actions</td>
                {products.map((product) => (
                  <td key={product.id} className="text-center py-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => removeFromCompare(product.id)}
                        className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Remove from comparison"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/shop/${product.id}`}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                ))}
                {products.length < maxCompare && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      {products.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Comparing {products.length} of {maxCompare} products
            </p>
            <div className="flex gap-2">
              <Link
                href="/shop"
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                Browse More
              </Link>
              <button
                onClick={() => {
                  const shareUrl = window.location.origin + '/compare?ids=' + compareList.join(',');
                  navigator.clipboard.writeText(shareUrl);
                  toast.success('Comparison link copied!');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
              >
                <Share2 className="w-4 h-4" />
                Share Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 NEW: Product Selector Modal */}
      <AnimatePresence>
        {showProductSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowProductSelector(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto"
            >
              <button
                onClick={() => setShowProductSelector(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Select Product to Compare</h3>
              
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={selectorSearch}
                  onChange={(e) => {
                    setSelectorSearch(e.target.value);
                    loadAvailableProducts(e.target.value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              {loadingAvailable ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : availableProducts.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No products found</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {availableProducts
                    .filter(p => !compareList.includes(p.id))
                    .map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addToCompare(product.id)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-100 dark:border-gray-700"
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-full h-full p-2 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {product.sku} • {formatCurrency(product.unitPrice)}
                          </p>
                        </div>
                        <Plus className="w-5 h-5 text-blue-500" />
                      </button>
                    ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
