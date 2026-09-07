// D:\Projects\Kalwanga\packages\web\app\shop\page.tsx

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, Grid, List, ChevronDown, X,
  Star, Package, ShoppingBag, Heart, Eye,
  SlidersHorizontal, Loader2, AlertCircle,
  ArrowUp, ChevronLeft, ChevronRight, Tag,
  DollarSign, Clock, TrendingUp, Sparkles,
  Shield, Truck, Award, Gift, Zap, Coffee,
  Barcode, QrCode, Scan, Link2, LayoutGrid,
  CheckCircle2, Circle, Layers, Boxes, Sliders,
  Flame, BadgeCheck, Crown, ImageIcon,
  ShoppingCart, Plus, Minus, CreditCard,
  Wallet, Smartphone, Building, Landmark
} from 'lucide-react';
import PublicNavigation from '../../components/PublicNavigation';
import { productService, Product as ServiceProduct } from '../../services/productService';
import { categoryService } from '../../services/categoryService';
import { ProductCard } from '../../components/products/ProductCard';
import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';
import { useThemeStore } from '../stores/themeStore';
import { cartService } from '../../services/cartService';
import { paymentService } from '../../services/paymentService';
import { AddToCartButton } from '../../components/cart/AddToCartButton';
import { CartCountBadge } from '../../components/cart/CartCountBadge';

// ============================================
// INTERFACES
// ============================================

interface Category {
  id: string;
  name: string;
  productCount?: number;
}

interface Variant {
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
}

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  unitPrice: number;
  costPrice?: number | null;
  images: string[];
  category?: { id: string; name: string } | null;
  categoryId?: string | null;
  inventory?: { id: string; quantity: number; reserved: number; available?: number } | null;
  variants?: Variant[] | null;
  isActive: boolean;
  isDigital?: boolean;
  weight?: number | null;
  taxRate?: number | null;
  minStock?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  tags?: string[] | null;
  featured?: boolean;
  inventoryId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

interface PriceRange {
  min: number;
  max: number;
}

const LIMIT = 12;

// ============================================
// CONSTANTS
// ============================================

const SIZES = {
  container: 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16',
  headerHeight: 'pt-24 md:pt-28 lg:pt-32',
  spacing: {
    section: 'py-8 md:py-12 lg:py-16',
    grid: 'gap-5 md:gap-6 lg:gap-8 xl:gap-10',
  },
  borderRadius: {
    card: 'rounded-2xl xl:rounded-3xl',
    button: 'rounded-xl xl:rounded-2xl',
    input: 'rounded-xl xl:rounded-2xl',
  },
  shadows: {
    card: 'shadow-sm hover:shadow-xl xl:hover:shadow-2xl',
    sticky: 'shadow-lg shadow-orange-100/50 dark:shadow-gray-900/50',
    modal: 'shadow-2xl xl:shadow-3xl',
  },
};

const COLORS = {
  gradient: {
    primary: 'from-orange-500 via-red-500 to-rose-500',
    hero: 'from-orange-600 via-red-500 to-rose-600',
  },
  solid: {
    primary: 'bg-orange-500',
    primaryHover: 'hover:bg-orange-600',
    urgency: 'bg-red-500',
    success: 'bg-emerald-500',
  },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isDark } = useThemeStore();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    totalPages: 1,
    limit: LIMIT,
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const [sortBy, setSortBy] = useState('featured');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 5000 });
  const [inStockOnly, setInStockOnly] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [hasBarcodeFilter, setHasBarcodeFilter] = useState<boolean | null>(null);
  const [linkedToInventoryFilter, setLinkedToInventoryFilter] = useState<boolean | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set(['categories', 'price']));
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [showQuickPay, setShowQuickPay] = useState(false);

  const filterTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // CART HANDLERS
  // ============================================

  const fetchCartData = useCallback(async () => {
    try {
      const response = await cartService.getCart();
      if (response) {
        setCartCount(response.items?.length || 0);
        setCartTotal(response.total || 0);
      }
    } catch (error) {
      // Silently fail - cart data is not critical
    }
  }, []);

  const handleAddToCart = useCallback(async (productId: string, variantId?: string, quantity: number = 1) => {
    if (!productId) {
      toast.error('Product ID is required');
      return;
    }

    try {
      await cartService.addItem({ productId, variantId, quantity });
      toast.success('Item added to cart!');
      await fetchCartData();
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } catch (error: any) {
      console.error('Failed to add to cart:', error);
      toast.error(error?.response?.data?.message || 'Failed to add to cart');
    }
  }, [fetchCartData]);

  // ============================================
  // PAYMENT HANDLERS
  // ============================================

  const handleQuickPay = useCallback(() => {
    if (cartCount === 0) {
      toast.warning('Your cart is empty');
      return;
    }
    router.push('/checkout');
  }, [cartCount, router]);

  const handleViewCart = useCallback(() => {
    router.push('/cart');
  }, [router]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    const category = searchParams.get('category');
    if (category) {
      setSelectedCategory(category);
    }
    const search = searchParams.get('search');
    if (search) {
      setSearchQuery(search);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchCartData();
  }, [fetchCartData]);

  useEffect(() => {
    if (filterTimeoutRef.current) {
      clearTimeout(filterTimeoutRef.current);
    }

    filterTimeoutRef.current = setTimeout(() => {
      fetchProducts();
    }, 300);

    return () => {
      if (filterTimeoutRef.current) {
        clearTimeout(filterTimeoutRef.current);
      }
    };
  }, [pagination.page, sortBy, selectedCategory, searchQuery, priceRange, inStockOnly, ratingFilter, hasBarcodeFilter, linkedToInventoryFilter]);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoryService.getAllCategories({ limit: 100, isActive: true });
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  }, []);

  const buildQueryParams = useCallback(() => {
    const params: Record<string, any> = {
      page: pagination.page,
      limit: LIMIT,
      isActive: true,
    };

    if (selectedCategory) {
      params.categoryId = selectedCategory;
    }

    if (searchQuery) {
      params.search = searchQuery;
    }

    if (inStockOnly) {
      params.inStock = true;
    }

    if (ratingFilter) {
      params.minRating = ratingFilter;
    }

    if (hasBarcodeFilter !== null) {
      params.hasBarcode = hasBarcodeFilter;
    }

    if (priceRange.min > 0) {
      params.minPrice = priceRange.min;
    }
    if (priceRange.max < 5000) {
      params.maxPrice = priceRange.max;
    }

    switch (sortBy) {
      case 'price-low':
        params.sortBy = 'unitPrice';
        params.sortOrder = 'asc';
        break;
      case 'price-high':
        params.sortBy = 'unitPrice';
        params.sortOrder = 'desc';
        break;
      case 'newest':
        params.sortBy = 'createdAt';
        params.sortOrder = 'desc';
        break;
      case 'popular':
        params.sortBy = 'saleItems';
        params.sortOrder = 'desc';
        break;
      case 'rating':
        params.sortBy = 'rating';
        params.sortOrder = 'desc';
        break;
      default:
        params.sortBy = 'featured';
        params.sortOrder = 'desc';
        break;
    }

    return params;
  }, [pagination.page, sortBy, selectedCategory, searchQuery, priceRange, inStockOnly, ratingFilter, hasBarcodeFilter]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setIsFiltering(true);
      
      const params = buildQueryParams();
      const response = await productService.getAllProducts(params);
      
      const mappedProducts: Product[] = (response.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        unitPrice: p.unitPrice,
        costPrice: p.costPrice ?? undefined,
        images: p.images || [],
        category: p.category,
        categoryId: p.categoryId,
        inventory: p.inventory ? {
          id: p.inventory.id,
          quantity: p.inventory.quantity || 0,
          reserved: p.inventory.reserved || 0,
          available: (p.inventory.quantity || 0) - (p.inventory.reserved || 0),
        } : null,
        variants: p.variants ? p.variants.map((v: any) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price,
          stock: v.stock || 0,
          isActive: v.isActive !== undefined ? v.isActive : true,
          images: v.images || [],
          attributes: v.attributes || {},
          barcode: v.barcode || null,
          inventoryId: v.inventoryId || null,
        })) : null,
        isActive: p.isActive,
        isDigital: p.isDigital || false,
        weight: p.weight,
        taxRate: p.taxRate || 0,
        minStock: p.minStock || 5,
        rating: p.rating,
        reviewCount: p.reviewCount || 0,
        tags: p.tags || null,
        featured: p.featured || false,
        inventoryId: p.inventoryId || null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
      
      setProducts(mappedProducts);
      setPagination({
        total: response.total || 0,
        page: response.page || pagination.page,
        totalPages: response.totalPages || 1,
        limit: response.limit || LIMIT,
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  }, [buildQueryParams, pagination.page]);

  // ============================================
  // HANDLERS
  // ============================================

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pagination.totalPages]);

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const handleCategoryChange = useCallback((categoryId: string) => {
    setSelectedCategory(prev => prev === categoryId ? '' : categoryId);
    setPagination(prev => ({ ...prev, page: 1 }));
    
    const params = new URLSearchParams(searchParams);
    if (categoryId && categoryId !== selectedCategory) {
      params.set('category', categoryId);
    } else {
      params.delete('category');
    }
    router.push(`/shop?${params.toString()}`, { scroll: false });
  }, [searchParams, selectedCategory, router]);

  const toggleFilterSection = (section: string) => {
    setExpandedFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const clearFilters = useCallback(() => {
    setSelectedCategory('');
    setSearchQuery('');
    setSortBy('featured');
    setPriceRange({ min: 0, max: 5000 });
    setInStockOnly(false);
    setRatingFilter(null);
    setHasBarcodeFilter(null);
    setLinkedToInventoryFilter(null);
    setPagination(prev => ({ ...prev, page: 1 }));
    router.push('/shop', { scroll: false });
    toast.success('Filters cleared');
  }, [router]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ============================================
  // HELPERS
  // ============================================

  const getAvailableStock = useCallback((product: Product) => {
    const mainStock = product.inventory 
      ? Math.max(0, product.inventory.quantity - (product.inventory.reserved || 0)) 
      : 0;
    
    const variantStock = product.variants 
      ? product.variants.reduce((sum, v) => sum + (v.stock || 0), 0) 
      : 0;
    
    return mainStock + variantStock;
  }, []);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      selectedCategory ||
      searchQuery ||
      sortBy !== 'featured' ||
      priceRange.min > 0 ||
      priceRange.max < 5000 ||
      inStockOnly ||
      ratingFilter ||
      hasBarcodeFilter !== null ||
      linkedToInventoryFilter !== null
    );
  }, [selectedCategory, searchQuery, sortBy, priceRange, inStockOnly, ratingFilter, hasBarcodeFilter, linkedToInventoryFilter]);

  const getProductBadges = useCallback((product: Product) => {
    const badges: Array<{ label: string; color: string; icon?: React.ReactNode }> = [];
    
    if (product.featured) {
      badges.push({ label: 'Featured', color: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white', icon: <Crown className="w-3 h-3 xl:w-4 xl:h-4" /> });
    }
    
    if (product.isDigital) {
      badges.push({ label: 'Digital', color: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white', icon: <Zap className="w-3 h-3 xl:w-4 xl:h-4" /> });
    }
    
    if (product.inventoryId) {
      badges.push({ label: 'Linked', color: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white', icon: <Link2 className="w-3 h-3 xl:w-4 xl:h-4" /> });
    }
    
    if (product.barcode) {
      badges.push({ label: 'Barcoded', color: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white', icon: <Barcode className="w-3 h-3 xl:w-4 xl:h-4" /> });
    }
    
    if (product.variants && product.variants.length > 0) {
      badges.push({ 
        label: `${product.variants.length} Variants`, 
        color: 'bg-gradient-to-r from-purple-500 to-violet-500 text-white', 
        icon: <Layers className="w-3 h-3 xl:w-4 xl:h-4" /> 
      });
    }
    
    const stock = getAvailableStock(product);
    if (stock === 0) {
      badges.push({ label: 'Out of Stock', color: 'bg-gradient-to-r from-red-600 to-rose-600 text-white', icon: <AlertCircle className="w-3 h-3 xl:w-4 xl:h-4" /> });
    } else if (stock <= (product.minStock || 5)) {
      badges.push({ label: `Only ${stock} Left!`, color: 'bg-gradient-to-r from-red-500 to-orange-500 text-white', icon: <Flame className="w-3 h-3 xl:w-4 xl:h-4" /> });
    } else {
      badges.push({ label: 'In Stock', color: 'bg-gradient-to-r from-emerald-500 to-green-500 text-white', icon: <CheckCircle2 className="w-3 h-3 xl:w-4 xl:h-4" /> });
    }
    
    return badges;
  }, [getAvailableStock]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: 'spring' as const,
        stiffness: 100, 
        damping: 15 
      }
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading && products.length === 0) {
    return (
      <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-orange-50'} transition-colors duration-300`}>
        <PublicNavigation />
        <div className={`${SIZES.container} ${SIZES.headerHeight} pb-16`}>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-6 animate-pulse h-[600px]"></div>
            </div>
            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm h-80 animate-pulse">
                    <div className="h-48 bg-orange-100 dark:bg-gray-800 rounded-t-2xl"></div>
                    <div className="p-5 space-y-3">
                      <div className="h-4 bg-orange-100 dark:bg-gray-800 rounded-lg w-3/4"></div>
                      <div className="h-3 bg-orange-100 dark:bg-gray-800 rounded-lg w-1/2"></div>
                      <div className="h-6 bg-orange-100 dark:bg-gray-800 rounded-lg w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gradient-to-b from-orange-50 via-white to-amber-50'} transition-colors duration-300`}>
      <PublicNavigation />

      {/* Hero Header */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${COLORS.gradient.hero} ${SIZES.headerHeight} pb-16 md:pb-20 xl:pb-24`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] xl:w-[700px] xl:h-[700px] bg-yellow-300 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] xl:w-[800px] xl:h-[800px] bg-orange-200 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] xl:w-[600px] xl:h-[600px] bg-red-300 rounded-full blur-3xl"></div>
        </div>
        
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}></div>

        <div className={`relative ${SIZES.container}`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 xl:gap-12">
            <div className="max-w-2xl xl:max-w-3xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 xl:px-6 xl:py-3 bg-yellow-400/20 backdrop-blur-md rounded-full mb-6 xl:mb-8 border border-yellow-300/30">
                  <Flame className="w-4 h-4 xl:w-5 xl:h-5 text-yellow-300 animate-pulse" />
                  <span className="text-sm xl:text-base font-semibold text-yellow-100">Hot Deals Available!</span>
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl 2xl:text-7xl font-bold text-white mb-4 xl:mb-6 flex items-center gap-4">
                  <ShoppingBag className="w-12 h-12 md:w-16 md:h-16 xl:w-20 xl:h-20 text-yellow-300" />
                  Shop & Save Today
                </h1>
                <p className="text-lg md:text-xl lg:text-2xl text-orange-100 mb-6 xl:mb-8">
                  Discover amazing products at unbeatable prices!
                </p>
                <div className="flex flex-wrap items-center gap-3 xl:gap-4 text-white">
                  <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 xl:px-6 xl:py-3 rounded-lg xl:rounded-xl border border-white/30">
                    <Package className="w-4 h-4 xl:w-5 xl:h-5 text-yellow-300" />
                    <span className="text-sm xl:text-base font-medium">{pagination.total} Products</span>
                  </span>
                  <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 xl:px-6 xl:py-3 rounded-lg xl:rounded-xl border border-white/30">
                    <Layers className="w-4 h-4 xl:w-5 xl:h-5 text-yellow-300" />
                    <span className="text-sm xl:text-base font-medium">{categories.length} Categories</span>
                  </span>
                  <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 xl:px-6 xl:py-3 rounded-lg xl:rounded-xl border border-white/30">
                    <ShoppingCart className="w-4 h-4 xl:w-5 xl:h-5 text-yellow-300" />
                    <span className="text-sm xl:text-base font-medium">{cartCount} in Cart</span>
                  </span>
                  {cartTotal > 0 && (
                    <span className="inline-flex items-center gap-2 bg-emerald-400/20 backdrop-blur-md px-4 py-2 xl:px-6 xl:py-3 rounded-lg xl:rounded-xl border border-emerald-300/30 text-emerald-100">
                      <DollarSign className="w-4 h-4 xl:w-5 xl:h-5" />
                      <span className="text-sm xl:text-base font-medium">Total: {formatCurrency(cartTotal)}</span>
                    </span>
                  )}
                  {hasActiveFilters && (
                    <span className="inline-flex items-center gap-2 bg-yellow-400/20 backdrop-blur-md px-4 py-2 xl:px-6 xl:py-3 rounded-lg xl:rounded-xl text-yellow-100 border border-yellow-300/30">
                      <Filter className="w-4 h-4 xl:w-5 xl:h-5" />
                      <span className="text-sm xl:text-base font-medium">Filters Active</span>
                    </span>
                  )}
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex items-center gap-3 xl:gap-4"
            >
              {/* ✅ Quick Checkout Button */}
              {cartCount > 0 && (
                <button
                  onClick={handleQuickPay}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <CreditCard className="w-5 h-5" />
                  Quick Checkout
                </button>
              )}
              <button
                onClick={() => setShowMobileFilters(true)}
                className="lg:hidden inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white/30 transition-all duration-200 border border-white/30"
              >
                <SlidersHorizontal className="w-5 h-5" />
                Filters
              </button>
              <div className="flex bg-white/20 backdrop-blur-md rounded-xl p-1.5 border border-white/30">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-3 xl:p-4 rounded-lg transition-all duration-200 ${viewMode === 'grid' ? 'bg-white/40 shadow-lg' : 'hover:bg-white/20'}`}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="w-5 h-5 xl:w-6 xl:h-6 text-white" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-3 xl:p-4 rounded-lg transition-all duration-200 ${viewMode === 'list' ? 'bg-white/40 shadow-lg' : 'hover:bg-white/20'}`}
                  aria-label="List view"
                >
                  <List className="w-5 h-5 xl:w-6 xl:h-6 text-white" />
                </button>
              </div>
            </motion.div>
          </div>

          {/* Quick Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-6 mt-12 xl:mt-16"
          >
            {[
              { label: 'Total Products', value: pagination.total, icon: <Package className="w-5 h-5 xl:w-6 xl:h-6" />, color: 'from-emerald-500 to-green-600', badge: 'In Stock' },
              { label: 'Categories', value: categories.length, icon: <Layers className="w-5 h-5 xl:w-6 xl:h-6" />, color: 'from-blue-500 to-sky-600', badge: 'Variety' },
              { label: 'Available Now', value: products.filter(p => getAvailableStock(p) > 0).length, icon: <CheckCircle2 className="w-5 h-5 xl:w-6 xl:h-6" />, color: 'from-orange-500 to-amber-600', badge: 'Ready' },
              { label: 'With Barcode', value: products.filter(p => p.barcode).length, icon: <Barcode className="w-5 h-5 xl:w-6 xl:h-6" />, color: 'from-yellow-400 to-orange-500', badge: 'Tracked' },
            ].map((stat, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.02 }}
                className="bg-white/10 backdrop-blur-md rounded-2xl xl:rounded-3xl p-5 xl:p-6 border border-white/20 hover:bg-white/20 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-3 xl:mb-4">
                  <span className={`inline-flex items-center justify-center w-10 h-10 xl:w-12 xl:h-12 rounded-xl xl:rounded-2xl bg-gradient-to-br ${stat.color} text-white shadow-lg`}>
                    {stat.icon}
                  </span>
                  <span className="text-xs text-white/70 font-medium">{stat.badge}</span>
                </div>
                <p className="text-3xl xl:text-4xl font-bold text-white">{stat.value}</p>
                <p className="text-sm xl:text-base text-white/70 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ✅ Quick Payment Bar */}
      {cartCount > 0 && (
        <div className="sticky top-20 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className={`${SIZES.container} py-3 flex flex-wrap items-center justify-between gap-3`}>
            <div className="flex items-center gap-4">
              <ShoppingBag className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {cartCount} item{cartCount > 1 ? 's' : ''} in cart
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(cartTotal)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleViewCart}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                View Cart
              </button>
              <button
                onClick={handleQuickPay}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-medium transition-all duration-200 shadow-md flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Checkout Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`${SIZES.container} py-8 md:py-12 xl:py-16`}>
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[380px_1fr] gap-8 xl:gap-12">
          {/* Sidebar Filters */}
          <aside className="hidden lg:block">
            <div className={`bg-white dark:bg-gray-900 rounded-2xl xl:rounded-3xl shadow-sm hover:shadow-xl xl:hover:shadow-2xl p-6 xl:p-8 sticky top-24 xl:top-28 transition-all duration-300 border border-orange-100 dark:border-gray-700`}>
              <div className="flex items-center justify-between mb-8 xl:mb-10">
                <h3 className="text-lg xl:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 xl:w-12 xl:h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white">
                    <Filter className="w-5 h-5 xl:w-6 xl:h-6" />
                  </span>
                  Filters
                </h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm xl:text-base font-medium text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="mb-8 xl:mb-10">
                <label className="block text-sm xl:text-base font-medium text-gray-700 dark:text-gray-300 mb-3">Search Products</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, SKU, barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-12 pr-4 py-3.5 xl:py-4 border border-gray-200 dark:border-gray-700 rounded-xl xl:rounded-2xl focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent outline-none bg-orange-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200`}
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="mb-8 xl:mb-10">
                <button
                  onClick={() => toggleFilterSection('categories')}
                  className="w-full flex items-center justify-between text-sm xl:text-base font-medium text-gray-700 dark:text-gray-300 mb-4"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 xl:w-5 xl:h-5 text-orange-500" />
                    Categories
                  </span>
                  <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${expandedFilters.has('categories') ? 'rotate-180' : ''}`} />
                </button>
                {expandedFilters.has('categories') && (
                  <div className="space-y-1.5 max-h-64 xl:max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    <button
                      onClick={() => handleCategoryChange('')}
                      className={`w-full text-left px-4 py-2.5 xl:py-3 rounded-lg text-sm xl:text-base transition-all duration-200 ${
                        !selectedCategory 
                          ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 text-orange-600 dark:text-orange-400 font-medium' 
                          : 'text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      All Categories
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleCategoryChange(category.id)}
                        className={`w-full text-left px-4 py-2.5 xl:py-3 rounded-lg text-sm xl:text-base transition-all duration-200 ${
                          selectedCategory === category.id 
                            ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 text-orange-600 dark:text-orange-400 font-medium' 
                            : 'text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{category.name}</span>
                          {category.productCount !== undefined && (
                            <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-gray-800 rounded-full text-orange-600 dark:text-orange-400">
                              {category.productCount}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                    {categories.length === 0 && (
                      <p className="text-sm text-gray-400 px-4 py-2">No categories found</p>
                    )}
                  </div>
                )}
              </div>

              {/* Price Range */}
              <div className="mb-8 xl:mb-10">
                <button
                  onClick={() => toggleFilterSection('price')}
                  className="w-full flex items-center justify-between text-sm xl:text-base font-medium text-gray-700 dark:text-gray-300 mb-4"
                >
                  <span className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 xl:w-5 xl:h-5 text-emerald-500" />
                    Price Range
                  </span>
                  <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${expandedFilters.has('price') ? 'rotate-180' : ''}`} />
                </button>
                {expandedFilters.has('price') && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                        <input
                          type="number"
                          value={priceRange.min}
                          onChange={(e) => setPriceRange({ ...priceRange, min: parseInt(e.target.value) || 0 })}
                          className="w-full pl-8 pr-3 py-2.5 xl:py-3 border border-gray-200 dark:border-gray-700 rounded-lg text-sm xl:text-base focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent outline-none bg-orange-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200"
                          placeholder="Min"
                          min="0"
                        />
                      </div>
                      <span className="text-gray-400 font-medium">—</span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                        <input
                          type="number"
                          value={priceRange.max}
                          onChange={(e) => setPriceRange({ ...priceRange, max: parseInt(e.target.value) || 5000 })}
                          className="w-full pl-8 pr-3 py-2.5 xl:py-3 border border-gray-200 dark:border-gray-700 rounded-lg text-sm xl:text-base focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent outline-none bg-orange-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200"
                          placeholder="Max"
                          min="0"
                        />
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5000"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({ ...priceRange, max: parseInt(e.target.value) })}
                      className="w-full h-2 bg-orange-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>$0</span>
                      <span>$5,000+</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Filters */}
              <div className="space-y-4 mb-8 xl:mb-10">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-5 h-5 xl:w-6 xl:h-6 text-orange-500 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-orange-500 dark:focus:ring-orange-400 bg-white dark:bg-gray-800 transition-all duration-200"
                  />
                  <span className="text-sm xl:text-base text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    In Stock Only
                  </span>
                </label>
              </div>

              {/* Barcode Filter */}
              <div className="mb-8 xl:mb-10">
                <label className="block text-sm xl:text-base font-medium text-gray-700 dark:text-gray-300 mb-3">Barcode Status</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setHasBarcodeFilter(hasBarcodeFilter === true ? null : true)}
                    className={`px-4 py-2 xl:px-5 xl:py-2.5 rounded-lg text-sm xl:text-base font-medium transition-all duration-200 ${
                      hasBarcodeFilter === true
                        ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Barcode className="w-4 h-4 xl:w-5 xl:h-5 inline mr-2" />
                    Has Barcode
                  </button>
                  <button
                    onClick={() => setHasBarcodeFilter(hasBarcodeFilter === false ? null : false)}
                    className={`px-4 py-2 xl:px-5 xl:py-2.5 rounded-lg text-sm xl:text-base font-medium transition-all duration-200 ${
                      hasBarcodeFilter === false
                        ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    No Barcode
                  </button>
                </div>
              </div>

              {/* Inventory Link Filter */}
              <div className="mb-8 xl:mb-10">
                <label className="block text-sm xl:text-base font-medium text-gray-700 dark:text-gray-300 mb-3">Inventory Status</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setLinkedToInventoryFilter(linkedToInventoryFilter === true ? null : true)}
                    className={`px-4 py-2 xl:px-5 xl:py-2.5 rounded-lg text-sm xl:text-base font-medium transition-all duration-200 ${
                      linkedToInventoryFilter === true
                        ? 'bg-gradient-to-r from-blue-500 to-sky-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Link2 className="w-4 h-4 xl:w-5 xl:h-5 inline mr-2" />
                    Linked
                  </button>
                  <button
                    onClick={() => setLinkedToInventoryFilter(linkedToInventoryFilter === false ? null : false)}
                    className={`px-4 py-2 xl:px-5 xl:py-2.5 rounded-lg text-sm xl:text-base font-medium transition-all duration-200 ${
                      linkedToInventoryFilter === false
                        ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    Not Linked
                  </button>
                </div>
              </div>

              {/* Rating Filter */}
              <div className="mb-4">
                <label className="block text-sm xl:text-base font-medium text-gray-700 dark:text-gray-300 mb-3">Minimum Rating</label>
                <div className="flex flex-wrap gap-2">
                  {[4, 3, 2, 1].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setRatingFilter(ratingFilter === rating ? null : rating)}
                      className={`px-4 py-2 xl:px-5 xl:py-2.5 rounded-lg text-sm xl:text-base font-medium transition-all duration-200 ${
                        ratingFilter === rating
                          ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Star className="w-4 h-4 xl:w-5 xl:h-5 inline mr-1 fill-current" />
                      {rating}+
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Products Section */}
          <main>
            {/* Toolbar */}
            <div className={`bg-white dark:bg-gray-900 rounded-2xl xl:rounded-3xl shadow-sm p-4 xl:p-6 mb-8 xl:mb-10 transition-all duration-300 border border-emerald-100 dark:border-gray-700`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 text-emerald-600">
                    <Shield className="w-5 h-5" />
                    <span className="text-sm font-medium">100% Secure Shopping</span>
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className="text-lg xl:text-xl font-semibold text-gray-900 dark:text-white">
                    {pagination.total}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm xl:text-base">Products Found</span>
                  {isFiltering && (
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  )}
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs xl:text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 font-medium"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor="sort" className="text-sm xl:text-base font-medium text-gray-600 dark:text-gray-400">
                    Sort by:
                  </label>
                  <select
                    id="sort"
                    value={sortBy}
                    onChange={handleSortChange}
                    className={`px-4 py-2.5 xl:px-5 xl:py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm xl:text-base font-medium focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent outline-none bg-orange-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200`}
                  >
                    <option value="featured">⭐ Featured</option>
                    <option value="newest">🆕 Newest Arrivals</option>
                    <option value="price-low">💵 Price: Low to High</option>
                    <option value="price-high">💎 Price: High to Low</option>
                    <option value="popular">🔥 Most Popular</option>
                    <option value="rating">⭐ Highest Rated</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Products Grid */}
            {products.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-gray-900 rounded-2xl xl:rounded-3xl shadow-sm p-16 xl:p-20 text-center`}
              >
                <div className="inline-flex items-center justify-center w-24 h-24 xl:w-32 xl:h-32 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 rounded-full mb-6 xl:mb-8">
                  <Package className="w-12 h-12 xl:w-16 xl:h-16 text-orange-500" />
                </div>
                <h3 className="text-2xl xl:text-3xl font-bold text-gray-900 dark:text-white mb-3">No Products Found</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 xl:mb-8 text-base xl:text-lg">
                  Try adjusting your filters or search criteria to find what you're looking for.
                </p>
                <button
                  onClick={clearFilters}
                  className={`inline-flex items-center gap-2 px-8 py-3 xl:px-10 xl:py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-medium transition-all duration-200 shadow-lg`}
                >
                  <Filter className="w-5 h-5" />
                  Clear All Filters
                </button>
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={viewMode + pagination.page}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className={`grid gap-5 md:gap-6 xl:gap-8 ${
                    viewMode === 'grid'
                      ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                      : 'grid-cols-1'
                  }`}
                >
                  {products.map((product, index) => {
                    const availableStock = getAvailableStock(product);
                    const badges = getProductBadges(product);
                    return (
                      <motion.div 
                        key={product.id} 
                        variants={itemVariants}
                        className="h-full"
                      >
                        <ProductCard
                          product={{
                            ...product,
                            images: product.images || [],
                            inventory: product.inventory ? [{
                              quantity: product.inventory.quantity || 0,
                              reserved: product.inventory.reserved || 0,
                            }] : [{ quantity: 0, reserved: 0 }],
                          }}
                          index={index}
                          orientation={viewMode === 'grid' ? 'vertical' : 'horizontal'}
                          variant="default"
                          showWishlist={true}
                          showAddToCart={true}
                          showQuickView={true}
                          onAddToCart={(productId, variantId, quantity) => 
                            handleAddToCart(productId, variantId, quantity)
                          }
                        />
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-3 xl:gap-4 mt-12 xl:mt-16">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="inline-flex items-center gap-2 px-6 py-3 xl:px-8 xl:py-4 border border-orange-200 dark:border-gray-700 rounded-xl text-sm xl:text-base font-medium hover:bg-orange-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-gray-700 dark:text-gray-300"
                >
                  <ChevronLeft className="w-5 h-5 xl:w-6 xl:h-6" />
                  Previous
                </button>
                <div className="flex items-center gap-2 xl:gap-3">
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-12 h-12 xl:w-14 xl:h-14 rounded-xl text-sm xl:text-base font-medium transition-all duration-200 ${
                          pagination.page === pageNum
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg scale-110'
                            : 'hover:bg-orange-50 dark:hover:bg-gray-800 border border-orange-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="inline-flex items-center gap-2 px-6 py-3 xl:px-8 xl:py-4 border border-orange-200 dark:border-gray-700 rounded-xl text-sm xl:text-base font-medium hover:bg-orange-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-gray-700 dark:text-gray-300"
                >
                  Next
                  <ChevronRight className="w-5 h-5 xl:w-6 xl:h-6" />
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Back to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 xl:bottom-10 xl:right-10 z-40 p-4 xl:p-5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full shadow-2xl transition-all duration-200"
            aria-label="Back to top"
          >
            <ArrowUp className="w-6 h-6 xl:w-7 xl:h-7" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile Filters Modal */}
      <AnimatePresence>
        {showMobileFilters && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <div 
              className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" 
              onClick={() => setShowMobileFilters(false)} 
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white">
                    <Filter className="w-5 h-5" />
                  </span>
                  Filters
                </h2>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent outline-none bg-orange-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categories</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent outline-none bg-orange-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Price Range</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange({ ...priceRange, min: parseInt(e.target.value) || 0 })}
                      className="w-1/2 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent outline-none bg-orange-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200"
                      placeholder="Min"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({ ...priceRange, max: parseInt(e.target.value) || 5000 })}
                      className="w-1/2 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent outline-none bg-orange-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200"
                      placeholder="Max"
                    />
                  </div>
                </div>

                {/* Stock Filter */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-5 h-5 text-orange-500 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-orange-500 dark:focus:ring-orange-400 bg-white dark:bg-gray-800"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">In Stock Only</span>
                </label>

                {/* Barcode Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Barcode Status</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setHasBarcodeFilter(hasBarcodeFilter === true ? null : true)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        hasBarcodeFilter === true
                          ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Has Barcode
                    </button>
                    <button
                      onClick={() => setHasBarcodeFilter(hasBarcodeFilter === false ? null : false)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        hasBarcodeFilter === false
                          ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      No Barcode
                    </button>
                  </div>
                </div>

                {/* Inventory Link Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Inventory Status</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setLinkedToInventoryFilter(linkedToInventoryFilter === true ? null : true)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        linkedToInventoryFilter === true
                          ? 'bg-gradient-to-r from-blue-500 to-sky-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Linked
                    </button>
                    <button
                      onClick={() => setLinkedToInventoryFilter(linkedToInventoryFilter === false ? null : false)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        linkedToInventoryFilter === false
                          ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Not Linked
                    </button>
                  </div>
                </div>

                {/* Rating Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Minimum Rating</label>
                  <div className="flex flex-wrap gap-2">
                    {[4, 3, 2, 1].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setRatingFilter(ratingFilter === rating ? null : rating)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          ratingFilter === rating
                            ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {rating}+ ⭐
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-3">
                  <button
                    onClick={clearFilters}
                    className="flex-1 px-6 py-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 font-medium text-gray-700 dark:text-gray-300"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl transition-all duration-200 font-medium shadow-lg"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #fbbf24;
          border-radius: 3px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #b45309;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f59e0b;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d97706;
        }
      `}</style>
    </div>
  );
}
