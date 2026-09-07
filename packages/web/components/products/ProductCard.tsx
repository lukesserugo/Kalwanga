// D:\Projects\Kalwanga\packages\web\components\products\ProductCard.tsx

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Package, Star, Heart, ShoppingCart, Eye,
  Edit, Trash2, Clock, TrendingUp, Check,
  X, AlertCircle, Loader2, Layers, ImageIcon, Link2
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';
import { WishlistButton } from './WishlistButton';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';
import { useThemeStore } from '../../app/stores/themeStore';
import { cartService } from '../../services/cartService';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    costPrice?: number;
    images?: string[];
    description?: string;
    category?: { id: string; name: string };
    inventory?: Array<{ quantity: number; reserved: number }>;
    minStock?: number;
    rating?: number;
    reviewCount?: number;
    isActive: boolean;
    featured?: boolean;
    isDigital?: boolean;
    tags?: string[];
    createdAt?: string;
    variants?: Array<{
      id: string;
      name: string;
      sku: string;
      price: number;
      stock: number;
      isActive: boolean;
      images?: string[];
      attributes?: Record<string, any>;
      barcode?: string | null;
      inventoryId?: string | null;
    }>;
    inventoryId?: string | null;
  };
  variant?: 'default' | 'compact' | 'featured' | 'minimal';
  orientation?: 'vertical' | 'horizontal';
  showWishlist?: boolean;
  showAddToCart?: boolean;
  showQuickView?: boolean;
  showAdminActions?: boolean;
  onAddToCart?: (productId: string, variantId?: string, quantity?: number) => Promise<void> | void;
  onQuickView?: (product: any) => void;
  onEdit?: (productId: string) => void;
  onDelete?: (productId: string) => void;
  className?: string;
  index?: number;
}

export function ProductCard({
  product,
  variant = 'default',
  orientation = 'vertical',
  showWishlist = true,
  showAddToCart = true,
  showQuickView = true,
  showAdminActions = false,
  onAddToCart,
  onQuickView,
  onEdit,
  onDelete,
  className = '',
  index = 0,
}: ProductCardProps) {
  const router = useRouter();
  let isDark = false;
  try {
    const themeStore = useThemeStore();
    isDark = themeStore?.isDark ?? false;
  } catch {
    isDark = false;
  }
  
  const { canEdit, canDelete, canManage } = usePermission();
  const [isHovered, setIsHovered] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const canEditProduct = canEdit(PermissionResource.PRODUCT) || canManage(PermissionResource.PRODUCT);
  const canDeleteProduct = canDelete(PermissionResource.PRODUCT) || canManage(PermissionResource.PRODUCT);

  // ✅ Validate product has an ID
  const productId = product?.id;
  const hasValidProductId = productId && typeof productId === 'string' && productId.trim().length > 0;

  // Calculate stock status with variant support
  const inventory = product.inventory?.[0];
  const mainStock = inventory ? inventory.quantity - (inventory.reserved || 0) : 0;
  const variantStock = (product.variants || []).reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
  const available = mainStock + variantStock;
  const isOutOfStock = available <= 0;
  const isLowStock = available > 0 && available <= (product.minStock || 5);
  const hasVariants = (product.variants?.length || 0) > 0;
  const totalVariantCount = product.variants?.length || 0;
  const hasVariantImages = (product.variants || []).some((v: any) => v.images && v.images.length > 0);
  const isInventoryLinked = !!product.inventoryId;

  // Get selected variant price
  const selectedVariant = selectedVariantId 
    ? (product.variants || []).find((v: any) => v.id === selectedVariantId)
    : null;
  const displayPrice = selectedVariant ? selectedVariant.price : product.unitPrice;

  const getStockStatus = () => {
    if (isOutOfStock) return { label: 'Out of Stock', color: 'bg-red-500' };
    if (isLowStock) return { label: `Only ${available} left`, color: 'bg-yellow-500' };
    return { label: 'In Stock', color: 'bg-green-500' };
  };

  const stockStatus = getStockStatus();

  const renderStars = (rating: number = 0) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= Math.round(rating)
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
        {rating > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
            ({rating.toFixed(1)})
          </span>
        )}
      </div>
    );
  };

  // ✅ FIXED: Enhanced add to cart handler with proper validation
  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // ✅ Validate product has an ID
    if (!hasValidProductId) {
      console.error('❌ ProductCard: Invalid product ID', { productId });
      toast.error('Product ID is invalid');
      return;
    }

    if (isOutOfStock) {
      toast.warning('This product is out of stock');
      return;
    }

    // ✅ Prevent duplicate requests
    if (addingToCart) {
      return;
    }

    setAddingToCart(true);
    try {
      // Get the variant ID if selected, otherwise undefined
      const variantId = selectedVariantId || undefined;
      
      // ✅ Ensure product ID is a clean string
      const cleanProductId = String(productId).trim();
      
      console.log('🛒 ProductCard adding to cart:', { 
        productId: cleanProductId, 
        variantId, 
        quantity: 1 
      });

      // If onAddToCart is provided by parent, use it with all parameters
      if (onAddToCart) {
        await onAddToCart(cleanProductId, variantId, 1);
      } else {
        // Otherwise use the cartService directly
        await cartService.addItem({ 
          productId: cleanProductId, 
          variantId, 
          quantity: 1 
        });
        toast.success(`${product.name} added to cart`);
        // Dispatch cart update event
        window.dispatchEvent(new CustomEvent('cart:updated'));
      }
    } catch (error: any) {
      console.error('❌ Failed to add to cart:', error);
      // ✅ Better error message extraction
      let errorMessage = 'Failed to add to cart';
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.errors) {
        const errors = error.response.data.errors;
        if (Array.isArray(errors) && errors.length > 0) {
          errorMessage = errors.map((e: any) => `${e.field}: ${e.message}`).join(', ');
        }
      }
      toast.error(errorMessage);
    } finally {
      setAddingToCart(false);
    }
  };

  // Handle variant selection
  const handleVariantSelect = (variantId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedVariantId(selectedVariantId === variantId ? null : variantId);
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onQuickView) {
      onQuickView(product);
    } else {
      router.push(`/shop/${product.id}`);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEdit) {
      onEdit(product.id);
    } else {
      router.push(`/admin/catalog/edit/${product.id}`);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete(product.id);
    } else {
      if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
        toast.success('Product deleted');
      }
    }
  };

  // If product has no ID, render a fallback
  if (!hasValidProductId) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-4 text-center ${className}`}>
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-gray-600 dark:text-gray-400">Invalid product data</p>
        <p className="text-xs text-gray-400">Product ID is missing</p>
      </div>
    );
  }

  // Horizontal variant
  if (orientation === 'horizontal') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 group ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-col sm:flex-row">
          <Link href={`/shop/${product.id}`} className="sm:w-48 flex-shrink-0">
            <div className="aspect-square sm:aspect-auto sm:h-full bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
              {product.images?.[0] && !imageError ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-gray-300 dark:text-gray-600" />
                </div>
              )}
              {product.featured && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  Featured
                </div>
              )}
              {isOutOfStock && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded">
                  Out of Stock
                </div>
              )}
              {hasVariants && (
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-purple-500/80 text-white text-xs rounded flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {totalVariantCount}
                  {hasVariantImages && <ImageIcon className="w-3 h-3" />}
                </div>
              )}
              {isInventoryLinked && (
                <div className="absolute top-12 left-2 px-2 py-1 bg-blue-500/80 text-white text-xs rounded flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                </div>
              )}
              {showWishlist && (
                <div className="absolute top-2 right-2">
                  <WishlistButton productId={product.id} size="sm" />
                </div>
              )}
            </div>
          </Link>

          <div className="flex-1 p-4 flex flex-col">
            <div className="flex-1">
              <Link href={`/shop/${product.id}`}>
                <h3 className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  {product.name}
                </h3>
              </Link>
              {product.category && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{product.category.name}</p>
              )}
              {product.rating && product.rating > 0 && (
                <div className="mt-1">{renderStars(product.rating)}</div>
              )}
              {product.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                  {product.description}
                </p>
              )}
              {hasVariants && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(product.variants || []).slice(0, 3).map((v: any) => (
                    <button
                      key={v.id}
                      onClick={(e) => handleVariantSelect(v.id, e)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                        selectedVariantId === v.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                      }`}
                    >
                      {v.images?.[0] && (
                        <img src={v.images[0]} alt={v.name} className="w-3 h-3 rounded-full object-cover" />
                      )}
                      {v.name}
                      <span className="text-purple-400">•</span>
                      {formatCurrency(v.price)}
                    </button>
                  ))}
                  {totalVariantCount > 3 && (
                    <span className="text-xs text-gray-400">+{totalVariantCount - 3} more</span>
                  )}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {product.tags?.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(displayPrice)}
                  </span>
                  {product.costPrice && product.costPrice > displayPrice && (
                    <span className="text-sm text-gray-400 line-through ml-2">
                      {formatCurrency(product.costPrice)}
                    </span>
                  )}
                  {selectedVariant && selectedVariant.price !== product.unitPrice && (
                    <span className="text-xs text-gray-400 line-through ml-1">
                      {formatCurrency(product.unitPrice)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {showAddToCart && (
                    <button
                      onClick={handleAddToCart}
                      disabled={isOutOfStock || addingToCart}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                        isOutOfStock
                          ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {addingToCart ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="w-4 h-4" />
                      )}
                      <span>{addingToCart ? 'Adding...' : 'Add'}</span>
                    </button>
                  )}
                  {showAdminActions && canEditProduct && (
                    <button
                      onClick={handleEdit}
                      className="p-1.5 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  {showAdminActions && canDeleteProduct && (
                    <button
                      onClick={handleDelete}
                      className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${stockStatus.color}`}>
                  {stockStatus.label}
                </span>
                {variantStock > 0 && (
                  <span className="text-xs text-gray-400">+{variantStock} variant stock</span>
                )}
                {product.isDigital && (
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs">
                    Digital
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 group ${className}`}
      >
        <Link href={`/shop/${product.id}`} className="block">
          <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
            {product.images?.[0] && !imageError ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              </div>
            )}
            {isOutOfStock && (
              <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-red-600 text-white text-[10px] rounded">
                Out of Stock
              </div>
            )}
            {hasVariants && (
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-purple-500/80 text-white text-[10px] rounded flex items-center gap-0.5">
                <Layers className="w-2.5 h-2.5" />
                {totalVariantCount}
              </div>
            )}
          </div>
        </Link>
        <div className="p-3">
          <Link href={`/shop/${product.id}`}>
            <h4 className="font-medium text-gray-900 dark:text-white truncate text-sm">
              {product.name}
            </h4>
          </Link>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(displayPrice)}
            </span>
            {showWishlist && (
              <WishlistButton productId={product.id} size="sm" />
            )}
          </div>
          {product.rating && product.rating > 0 && (
            <div className="mt-1">{renderStars(product.rating)}</div>
          )}
          {showAddToCart && !isOutOfStock && (
            <button
              onClick={handleAddToCart}
              disabled={addingToCart}
              className="mt-2 w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {addingToCart ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ShoppingCart className="w-3 h-3" />
              )}
              {addingToCart ? 'Adding...' : 'Add to Cart'}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // Minimal variant
  if (variant === 'minimal') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.05 }}
        className={`flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors ${className}`}
      >
        <Link href={`/shop/${product.id}`} className="flex-shrink-0">
          <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden">
            {product.images?.[0] && !imageError ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-gray-300" />
              </div>
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/shop/${product.id}`}>
            <p className="font-medium text-gray-900 dark:text-white truncate text-sm">
              {product.name}
            </p>
          </Link>
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {formatCurrency(displayPrice)}
          </p>
          {hasVariants && (
            <p className="text-xs text-purple-500 flex items-center gap-0.5">
              <Layers className="w-3 h-3" />
              {totalVariantCount} variants
            </p>
          )}
        </div>
        {showWishlist && (
          <WishlistButton productId={product.id} size="sm" />
        )}
        {showAddToCart && !isOutOfStock && (
          <button
            onClick={handleAddToCart}
            disabled={addingToCart}
            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            title="Add to cart"
          >
            {addingToCart ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ShoppingCart className="w-3 h-3" />
            )}
          </button>
        )}
      </motion.div>
    );
  }

  // Featured variant
  if (variant === 'featured') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden group ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Link href={`/shop/${product.id}`} className="block">
          <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
            {product.images?.[0] && !imageError ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-24 h-24 text-gray-300 dark:text-gray-600" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <h3 className="font-bold text-lg">{product.name}</h3>
              <p className="text-white/80 text-sm">{formatCurrency(displayPrice)}</p>
              {hasVariants && (
                <p className="text-white/60 text-xs flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {totalVariantCount} variants
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                {showAddToCart && (
                  <button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock || addingToCart}
                    className="px-4 py-1.5 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {addingToCart ? 'Adding...' : 'Add to Cart'}
                  </button>
                )}
                {showQuickView && (
                  <button
                    onClick={handleQuickView}
                    className="px-4 py-1.5 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-colors text-sm font-medium"
                  >
                    Quick View
                  </button>
                )}
              </div>
            </div>
          </div>
        </Link>
        {product.featured && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-yellow-500 text-white text-xs rounded flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" />
            Featured
          </div>
        )}
        {showWishlist && (
          <div className="absolute top-3 right-3">
            <WishlistButton productId={product.id} size="sm" className="shadow-lg" />
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute bottom-3 right-3 px-2 py-1 bg-red-600 text-white text-xs rounded">
            Out of Stock
          </div>
        )}
      </motion.div>
    );
  }

  // Default variant (grid)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <Link href={`/shop/${product.id}`} className="block">
        <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
          {product.images?.[0] && !imageError ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-16 h-16 text-gray-300 dark:text-gray-600" />
            </div>
          )}
          
          {/* Badges */}
          {product.featured && (
            <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" />
              Featured
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded">
              Out of Stock
            </div>
          )}
          {isLowStock && !isOutOfStock && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded">
              Low Stock
            </div>
          )}
          {product.isDigital && (
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-purple-600 text-white text-xs rounded">
              Digital
            </div>
          )}
          {hasVariants && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-purple-500/80 text-white text-xs rounded flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {totalVariantCount}
              {hasVariantImages && <ImageIcon className="w-3 h-3" />}
            </div>
          )}
          {isInventoryLinked && (
            <div className="absolute top-12 left-2 px-2 py-1 bg-blue-500/80 text-white text-xs rounded flex items-center gap-1">
              <Link2 className="w-3 h-3" />
            </div>
          )}
          
          {/* Wishlist */}
          {showWishlist && (
            <div className="absolute top-2 right-2">
              <WishlistButton productId={product.id} size="sm" />
            </div>
          )}

          {/* Quick Actions Overlay */}
          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center gap-2 transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}>
            {showQuickView && (
              <button
                onClick={handleQuickView}
                className="p-2 bg-white/90 hover:bg-white text-gray-800 rounded-full transition-colors"
                title="Quick View"
              >
                <Eye className="w-5 h-5" />
              </button>
            )}
            {showAddToCart && !isOutOfStock && (
              <button
                onClick={handleAddToCart}
                disabled={addingToCart}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors disabled:opacity-50"
                title="Add to Cart"
              >
                {addingToCart ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ShoppingCart className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <Link href={`/shop/${product.id}`}>
          <h3 className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1">
            {product.name}
          </h3>
        </Link>
        {product.category && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{product.category.name}</p>
        )}
        {product.rating && product.rating > 0 && (
          <div className="mt-1">{renderStars(product.rating)}</div>
        )}
        
        {/* Variant Quick Select */}
        {hasVariants && totalVariantCount <= 3 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {(product.variants || []).filter((v: any) => v.isActive).map((v: any) => (
              <button
                key={v.id}
                onClick={(e) => handleVariantSelect(v.id, e)}
                className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                  selectedVariantId === v.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(displayPrice)}
            </span>
            {product.costPrice && product.costPrice > displayPrice && (
              <span className="text-xs text-gray-400 line-through ml-1.5">
                {formatCurrency(product.costPrice)}
              </span>
            )}
            {selectedVariant && selectedVariant.price !== product.unitPrice && (
              <span className="text-xs text-gray-400 line-through ml-1">
                {formatCurrency(product.unitPrice)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {showAdminActions && canEditProduct && (
              <button
                onClick={handleEdit}
                className="p-1 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {showAdminActions && canDeleteProduct && (
              <button
                onClick={handleDelete}
                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${stockStatus.color}`}>
            {stockStatus.label}
          </span>
          {variantStock > 0 && (
            <span className="text-xs text-gray-400">+{variantStock} variant stock</span>
          )}
        </div>
        
        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {product.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-[10px]"
              >
                #{tag}
              </span>
            ))}
            {product.tags.length > 2 && (
              <span className="text-[10px] text-gray-400">+{product.tags.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ProductCard;
