// D:\Projects\Kalwanga\packages\web\components\products\ProductGrid.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, Heart, ShoppingCart, Eye, Star, 
  ChevronDown, Filter, Grid, List, Search,
  X, Loader2, AlertCircle, Layers, ImageIcon, Link2
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { productService } from '../../services/productService';
import { formatCurrency } from '../../utils/helpers';
import { WishlistButton } from './WishlistButton';
import { useThemeStore } from '../../app/stores/themeStore';
import { useAuth } from '../../hooks/useAuth';
import { Product, ProductSearchParams } from '../../types/product';
import { SortOrder, ProductSortField } from '../../types/enums';

interface ProductGridProps {
  limit?: number;
  categoryId?: string;
  featured?: boolean;
  searchQuery?: string;
  showFilters?: boolean;
  showWishlist?: boolean;
  showAddToCart?: boolean;
  columns?: 2 | 3 | 4;
  className?: string;
}

export default function ProductGrid({
  limit = 12,
  categoryId = '',
  featured = false,
  searchQuery = '',
  showFilters = true,
  showWishlist = true,
  showAddToCart = true,
  columns = 4,
  className = '',
}: ProductGridProps) {
  const { user, isAuthenticated } = useAuth();
  const { isDark } = useThemeStore();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: searchQuery || '',
    categoryId: categoryId || '',
    minPrice: '',
    maxPrice: '',
    inStock: false,
    sortBy: 'newest',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: limit || 12,
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [addingToCart, setAddingToCart] = useState<Record<string, boolean>>({});

  const columnClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  useEffect(() => {
    fetchProducts();
  }, [filters, pagination.page]);

  const getAvailableStock = (product: Product): number => {
    if (!product.inventory || product.inventory.length === 0) return 0;
    const inventory = product.inventory[0];
    const mainStock = inventory.quantity - (inventory.reserved || 0);
    
    // 🔥 Include variant stock
    let variantStock = 0;
    if (product.variants && product.variants.length > 0) {
      variantStock = product.variants.reduce((sum, v: any) => sum + (v.stock || 0), 0);
    }
    
    return mainStock + variantStock;
  };

  // Helper function to transform service product to type product
  const transformProduct = (serviceProduct: any): Product => {
    return {
      id: serviceProduct.id || '',
      name: serviceProduct.name || '',
      description: serviceProduct.description || '',
      sku: serviceProduct.sku || '',
      barcode: serviceProduct.barcode,
      unitPrice: serviceProduct.unitPrice || 0,
      costPrice: serviceProduct.costPrice,
      taxRate: serviceProduct.taxRate || 0,
      minStock: serviceProduct.minStock ?? 5,
      maxStock: serviceProduct.maxStock,
      isActive: serviceProduct.isActive !== undefined ? serviceProduct.isActive : true,
      isDigital: serviceProduct.isDigital || false,
      featured: serviceProduct.featured || false,
      weight: serviceProduct.weight,
      dimensions: serviceProduct.dimensions,
      images: serviceProduct.images || [],
      attributes: serviceProduct.attributes,
      notes: serviceProduct.notes,
      rating: serviceProduct.rating || 0,
      reviewCount: serviceProduct.reviewCount || 0,
      categoryId: serviceProduct.categoryId,
      category: serviceProduct.category,
      businessUnitId: serviceProduct.businessUnitId || '',
      businessUnit: serviceProduct.businessUnit,
      supplierId: serviceProduct.supplierId,
      supplier: serviceProduct.supplier,
      inventory: serviceProduct.inventory || [],
      // 🔥 Map variants with images
      variants: (serviceProduct.variants || []).map((v: any) => ({
        ...v,
        images: v.images || [],
        attributes: v.attributes || {},
        barcode: v.barcode || null,
        inventoryId: v.inventoryId || null,
      })),
      reviews: serviceProduct.reviews || [],
      tags: serviceProduct.tags || [],
      seo: serviceProduct.seo,
      createdBy: serviceProduct.createdBy,
      updatedBy: serviceProduct.updatedBy,
      createdAt: serviceProduct.createdAt || new Date().toISOString(),
      updatedAt: serviceProduct.updatedAt || new Date().toISOString(),
    };
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: ProductSearchParams = {
        page: pagination.page,
        limit: pagination.limit || limit,
        isActive: true,
        search: filters.search || undefined,
        categoryId: filters.categoryId || undefined,
        featured: featured || undefined,
        inStock: filters.inStock || undefined,
        minPrice: filters.minPrice ? parseFloat(filters.minPrice) : undefined,
        maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
      };

      // Sort options
      switch (filters.sortBy) {
        case 'price-low':
          params.sort = ProductSortField.PRICE;
          params.order = SortOrder.ASC;
          break;
        case 'price-high':
          params.sort = ProductSortField.PRICE;
          params.order = SortOrder.DESC;
          break;
        case 'rating':
          params.sort = ProductSortField.RATING;
          params.order = SortOrder.DESC;
          break;
        case 'popular':
          params.sort = ProductSortField.POPULARITY;
          params.order = SortOrder.DESC;
          break;
        case 'newest':
        default:
          params.sort = ProductSortField.CREATED_AT;
          params.order = SortOrder.DESC;
          break;
      }

      const response = await productService.getAllProducts(params);
      
      // Transform the data to match the Product type
      const transformedProducts = (response.data || []).map(transformProduct);
      
      setProducts(transformedProducts);
      setPagination({
        ...pagination,
        total: response.total || 0,
        totalPages: response.totalPages || 1,
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products. Please try again.');
      if (showToast) {
        showToast('Failed to load products', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (productId: string) => {
    if (!isAuthenticated) {
      router.push('/login?redirect_url=/shop');
      return;
    }

    setAddingToCart(prev => ({ ...prev, [productId]: true }));
    try {
      // Add to cart logic here
      showToast('Product added to cart!', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to add to cart', 'error');
    } finally {
      setAddingToCart(prev => ({ ...prev, [productId]: false }));
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      categoryId: '',
      minPrice: '',
      maxPrice: '',
      inStock: false,
      sortBy: 'newest',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'sortBy') return value !== 'newest';
      return value !== '' && value !== false;
    });
  }, [filters]);

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

  const renderProductCard = (product: Product) => {
    const available = getAvailableStock(product);
    const isOutOfStock = available <= 0;
    const variantCount = product.variants?.length || 0;
    const hasVariantImages = product.variants?.some((v: any) => v.images && v.images.length > 0) || false;
    const isInventoryLinked = !!product.inventory?.[0]?.productId || false;

    return (
      <motion.div
        key={product.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3 }}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 group ${
          viewMode === 'list' ? 'flex flex-col sm:flex-row' : ''
        }`}
      >
        <Link
          href={`/shop/${product.id}`}
          className={viewMode === 'list' ? 'sm:w-48 flex-shrink-0' : 'block'}
        >
          <div className={`${viewMode === 'list' ? 'h-48 sm:h-full' : 'aspect-square'} bg-gray-100 dark:bg-gray-700 relative overflow-hidden`}>
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-16 h-16 text-gray-300 dark:text-gray-600" />
              </div>
            )}
            {isOutOfStock && (
              <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded">
                Out of Stock
              </div>
            )}
            {product.featured && (
              <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" />
                Featured
              </div>
            )}
            {/* 🔥 NEW: Variant indicators */}
            {variantCount > 0 && (
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-purple-500/80 text-white text-xs rounded flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {variantCount}
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

        <div className="p-4 flex-1 flex flex-col">
          <Link href={`/shop/${product.id}`}>
            <h3 className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1">
              {product.name}
            </h3>
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">SKU: {product.sku}</p>
          {product.category && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{product.category.name}</p>
          )}
          {product.rating && product.rating > 0 && (
            <div className="mt-1">{renderStars(product.rating)}</div>
          )}
          {viewMode === 'list' && product.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
              {product.description}
            </p>
          )}
          {/* 🔥 NEW: Variant summary in list view */}
          {viewMode === 'list' && variantCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {product.variants?.slice(0, 3).map((variant: any) => (
                <span key={variant.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-xs">
                  {variant.images?.[0] && (
                    <img src={variant.images[0]} alt={variant.name} className="w-3 h-3 rounded-full object-cover" />
                  )}
                  {variant.name}
                  <span className="text-purple-400">•</span>
                  {formatCurrency(variant.price)}
                </span>
              ))}
              {variantCount > 3 && (
                <span className="text-xs text-gray-400">+{variantCount - 3} more</span>
              )}
            </div>
          )}
          <div className="mt-auto pt-3 flex items-center justify-between">
            <div>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(product.unitPrice)}
              </span>
              {isOutOfStock && (
                <p className="text-xs text-red-600 dark:text-red-400">Out of stock</p>
              )}
              {!isOutOfStock && available <= 5 && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Only {available} left
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/shop/${product.id}`}
                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                title="View Details"
              >
                <Eye className="w-4 h-4" />
              </Link>
              {showAddToCart && (
                <button
                  onClick={() => handleAddToCart(product.id)}
                  disabled={isOutOfStock || addingToCart[product.id]}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    isOutOfStock
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {addingToCart[product.id] ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-4 h-4" />
                  )}
                  <span>{addingToCart[product.id] ? 'Adding...' : 'Add'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading && products.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-700 rounded-xl h-72 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
        <button
          onClick={fetchProducts}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No products found</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          {hasActiveFilters ? 'Try adjusting your filters' : 'Check back later for new products'}
        </p>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Filters Bar */}
      {showFilters && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition-colors duration-200">
          <div className="flex items-center gap-4 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search products..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
            >
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low → High</option>
              <option value="price-high">Price: High → Low</option>
              <option value="rating">Highest Rated</option>
              <option value="popular">Most Popular</option>
            </select>

            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="lg:hidden p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>

            <div className="hidden lg:flex items-center gap-3">
              <input
                type="number"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
              />
              <span className="text-gray-500 dark:text-gray-400">-</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
              />
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={filters.inStock}
                  onChange={(e) => handleFilterChange('inStock', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                />
                In Stock
              </label>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filters Modal */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Price
                </label>
                <input
                  type="number"
                  value={filters.minPrice}
                  onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                  placeholder="Min"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Price
                </label>
                <input
                  type="number"
                  value={filters.maxPrice}
                  onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                  placeholder="Max"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={filters.inStock}
                  onChange={(e) => handleFilterChange('inStock', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                />
                In Stock Only
              </label>
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={clearFilters}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className={viewMode === 'grid' ? `grid ${columnClasses[columns as keyof typeof columnClasses]} gap-6` : 'space-y-4'}>
        <AnimatePresence mode="wait">
          {products.map((product) => renderProductCard(product))}
        </AnimatePresence>
      </div>

      {/* Load More / Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.totalPages}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {pagination.page === pagination.totalPages ? (
              'No More Products'
            ) : (
              <>
                <span>Load More</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
