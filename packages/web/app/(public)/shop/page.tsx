// D:\Projects\Kalwanga\packages\web\app\shop\page.tsx

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  List,
  ChevronDown,
  X,
  Star,
  Package,
  ShoppingBag,
  SlidersHorizontal,
  Loader2,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Layers,
  Flame,
  Crown,
  Zap,
  Link2,
  Barcode,
  CheckCircle2,
  LayoutGrid,
  ShoppingCart,
  DollarSign,
  CreditCard,
  Shield,
  Sparkles,
} from 'lucide-react';
import { productService } from '../../../services/productService';
import { ProductCard } from '../../../components/products/ProductCard';
import { formatCurrency } from '../../../utils/formatters';
import { toast } from '../../../utils/toast-manager';
import { useThemeStore } from '../../stores/themeStore';
import { useAuth } from '../../../hooks/useAuth';
import { cartService } from '../../../services/cartService';
import { guestCartService } from '../../../services/guestCartService';

// ============================================
// BACKEND CONTRACT
// ============================================
//
// The shop page is public. It calls `GET /products/public` and
// `GET /products/public/categories`, which are registered BEFORE
// `requireAuth` in `routes/products.ts`.
//
// Backend `validSortFields` for `getAllProducts`:
//   name | sku | unitPrice | createdAt | updatedAt | rating
//
// `Product.inventory` and `ProductVariant.inventory` are SINGULAR.
// `productService.getProductStock()` is the canonical stock helper.
//
// Cart endpoints branch on auth:
//   Authenticated → /cart/*
//   Guest         → /cart/guest/*
//
// Checkout endpoint (canonical):
//   POST /checkout   (with idempotencyKey to prevent duplicates)

interface Category {
  id: string;
  name: string;
  _count?: { products?: number; children?: number };
  productCount?: number;
}

interface PriceRange {
  min: number;
  max: number;
}

interface PaginationInfo {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

const LIMIT = 12;
const MAX_PRICE = 5000;

// ============================================
// LAYOUT CONSTANTS
// ============================================

const SIZES = {
  container:
    'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12',
};

const COLORS = {
  gradient: {
    hero: 'from-orange-600 via-red-500 to-rose-600',
  },
};

// ============================================
// COMPONENT
// ============================================

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isDark } = useThemeStore();
  const { isAuthenticated } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
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

  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<PriceRange>({
    min: 0,
    max: MAX_PRICE,
  });
  const [inStockOnly, setInStockOnly] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [hasBarcodeFilter, setHasBarcodeFilter] = useState<boolean | null>(
    null,
  );
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showHero, setShowHero] = useState(false);
  const [showCartPill, setShowCartPill] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(
    new Set(['categories', 'price']),
  );
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);

  const filterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================
  // CART HANDLERS
  // ============================================

  /**
   * Fetch the active cart from whichever service matches the current
   * auth state. The two services hit different endpoints:
   *
   *   cartService       → /cart/*
   *   guestCartService  → /cart/guest/*
   *
   * Both return the same `Cart` shape so the rest of this component
   * doesn't branch on auth.
   */
  const fetchCartData = useCallback(async () => {
    try {
      const cart = isAuthenticated ? cartService : guestCartService;
      const response = await cart.getCart();
      if (!isMountedRef.current) return;
      if (response) {
        setCartCount(response.items?.length || 0);
        setCartTotal(response.total || 0);
      } else {
        setCartCount(0);
        setCartTotal(0);
      }
    } catch {
      if (!isMountedRef.current) return;
      setCartCount(0);
      setCartTotal(0);
    }
  }, [isAuthenticated]);

  /**
   * Add item to cart. No price is sent — the server looks it up.
   * A 401 on an authenticated cart means the session expired; the
   * shopper is redirected to login. A 401 on the guest cart should
   * never happen, so we surface it as a normal error.
   */
  const handleAddToCart = useCallback(
    async (
      productId: string,
      variantId?: string,
      quantity: number = 1,
    ) => {
      if (!productId) {
        toast.error('Product ID is required');
        return;
      }

      try {
        const cart = isAuthenticated ? cartService : guestCartService;
        await cart.addItem({ productId, variantId, quantity });

        toast.success('Item added to cart!');
        await fetchCartData();
        window.dispatchEvent(new CustomEvent('cart:updated'));
      } catch (err: any) {
        console.error('Failed to add to cart:', err);

        if (err?.response?.status === 401 && isAuthenticated) {
          router.push('/login?redirect_url=/shop');
          return;
        }

        toast.error(
          err?.response?.data?.message || 'Failed to add to cart',
        );
      }
    },
    [fetchCartData, isAuthenticated, router],
  );

  /**
   * Quick checkout. Guests are sent to login first — the guest cart
   * is not yet checkoutable from the shop page. Authenticated users
   * go straight to /checkout.
   */
  const handleQuickPay = useCallback(() => {
    if (cartCount === 0) {
      toast.warning('Your cart is empty');
      return;
    }

    if (!isAuthenticated) {
      router.push('/login?redirect_url=/checkout');
      return;
    }

    router.push('/checkout');
  }, [cartCount, isAuthenticated, router]);

  const handleViewCart = useCallback(() => {
    router.push('/cart');
  }, [router]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    const category = searchParams.get('category');
    setSelectedCategory(category || '');
    const search = searchParams.get('search');
    setSearchQuery(search || '');
  }, [searchParams]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
      setShowCartPill(window.scrollY > 220);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchCartData();
  }, [fetchCartData]);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchCategories = useCallback(async () => {
    try {
      const data = await productService.getPublicCategories();
      if (!isMountedRef.current) return;
      setCategories((data as Category[]) || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      if (!isMountedRef.current) return;
      setCategories([]);
    }
  }, []);

  const buildQueryParams = useCallback((): Record<string, any> => {
    const params: Record<string, any> = {
      page: pagination.page,
      limit: LIMIT,
    };

    if (selectedCategory) params.categoryId = selectedCategory;
    if (searchQuery) params.search = searchQuery;
    if (inStockOnly) params.inStock = true;
    if (ratingFilter) params.minRating = ratingFilter;
    if (hasBarcodeFilter !== null) params.hasBarcode = hasBarcodeFilter;

    if (priceRange.min > 0) params.minPrice = priceRange.min;
    if (priceRange.max < MAX_PRICE) params.maxPrice = priceRange.max;

    switch (sortBy) {
      case 'price-low':
        params.sortBy = 'unitPrice';
        params.sortOrder = 'asc';
        break;
      case 'price-high':
        params.sortBy = 'unitPrice';
        params.sortOrder = 'desc';
        break;
      case 'rating':
        params.sortBy = 'rating';
        params.sortOrder = 'desc';
        break;
      case 'newest':
      default:
        params.sortBy = 'createdAt';
        params.sortOrder = 'desc';
        break;
    }

    return params;
  }, [
    pagination.page,
    sortBy,
    selectedCategory,
    searchQuery,
    priceRange,
    inStockOnly,
    ratingFilter,
    hasBarcodeFilter,
  ]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setIsFiltering(true);

      const params = buildQueryParams();
      const response = await productService.getPublicProducts(params);
      if (!isMountedRef.current) return;

      setProducts(response.data || []);
      setPagination({
        total: response.total || 0,
        page: response.page || pagination.page,
        totalPages: response.totalPages || 1,
        limit: response.limit || LIMIT,
      });
    } catch (err) {
      console.error('Error fetching products:', err);
      if (!isMountedRef.current) return;
      toast.error('Failed to load products');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setIsFiltering(false);
      }
    }
  }, [buildQueryParams, pagination.page]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);

    filterTimeoutRef.current = setTimeout(() => {
      fetchProducts();
    }, 300);

    return () => {
      if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    };
  }, [
    pagination.page,
    sortBy,
    selectedCategory,
    searchQuery,
    priceRange,
    inStockOnly,
    ratingFilter,
    hasBarcodeFilter,
    fetchProducts,
  ]);

  // ============================================
  // HANDLERS
  // ============================================

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= pagination.totalPages) {
        setPagination((prev) => ({ ...prev, page }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [pagination.totalPages],
  );

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSortBy(e.target.value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    [],
  );

  const handleCategoryChange = useCallback(
    (categoryId: string) => {
      const next = selectedCategory === categoryId ? '' : categoryId;
      setSelectedCategory(next);
      setPagination((prev) => ({ ...prev, page: 1 }));

      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set('category', next);
      } else {
        params.delete('category');
      }
      const qs = params.toString();
      router.push(qs ? `/shop?${qs}` : '/shop', { scroll: false });
    },
    [searchParams, selectedCategory, router],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setPagination((prev) => ({ ...prev, page: 1 }));

      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set('search', value);
      } else {
        params.delete('search');
      }
      const qs = params.toString();
      router.replace(qs ? `/shop?${qs}` : '/shop', { scroll: false });
    },
    [searchParams, router],
  );

  const toggleFilterSection = (section: string) => {
    setExpandedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const clearFilters = useCallback(() => {
    setSelectedCategory('');
    setSearchQuery('');
    setSortBy('newest');
    setPriceRange({ min: 0, max: MAX_PRICE });
    setInStockOnly(false);
    setRatingFilter(null);
    setHasBarcodeFilter(null);
    setPagination((prev) => ({ ...prev, page: 1 }));
    router.push('/shop', { scroll: false });
    toast.success('Filters cleared');
  }, [router]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ============================================
  // DERIVED
  // ============================================

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        selectedCategory ||
          searchQuery ||
          sortBy !== 'newest' ||
          priceRange.min > 0 ||
          priceRange.max < MAX_PRICE ||
          inStockOnly ||
          ratingFilter ||
          hasBarcodeFilter !== null,
      ),
    [
      selectedCategory,
      searchQuery,
      sortBy,
      priceRange,
      inStockOnly,
      ratingFilter,
      hasBarcodeFilter,
    ],
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (selectedCategory) n++;
    if (searchQuery) n++;
    if (priceRange.min > 0 || priceRange.max < MAX_PRICE) n++;
    if (inStockOnly) n++;
    if (ratingFilter) n++;
    if (hasBarcodeFilter !== null) n++;
    return n;
  }, [
    selectedCategory,
    searchQuery,
    priceRange,
    inStockOnly,
    ratingFilter,
    hasBarcodeFilter,
  ]);

  const inStockCount = useMemo(
    () =>
      products.filter(
        (p) => productService.getProductStock(p).isInStock,
      ).length,
    [products],
  );

  const barcodeCount = useMemo(
    () => products.filter((p) => p.barcode).length,
    [products],
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  // ============================================
  // SHARED — filters panel content
  // ============================================

  const filterPanel = (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Search Products
        </label>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, barcode..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent outline-none bg-orange-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
          />
        </div>
      </div>

      {/* Categories */}
      <div>
        <button
          onClick={() => toggleFilterSection('categories')}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-500" />
            Categories
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              expandedFilters.has('categories') ? 'rotate-180' : ''
            }`}
          />
        </button>
        {expandedFilters.has('categories') && (
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
            <button
              onClick={() => handleCategoryChange('')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                !selectedCategory
                  ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 text-orange-600 dark:text-orange-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-800'
              }`}
            >
              All Categories
            </button>
            {categories.map((category) => {
              const count =
                category._count?.products ?? category.productCount;
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryChange(category.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    selectedCategory === category.id
                      ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 text-orange-600 dark:text-orange-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{category.name}</span>
                    {typeof count === 'number' && (
                      <span className="text-[11px] px-2 py-0.5 bg-orange-100 dark:bg-gray-800 rounded-full text-orange-600 dark:text-orange-400 shrink-0">
                        {count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {categories.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-2">
                No categories found
              </p>
            )}
          </div>
        )}
      </div>

      {/* Price Range */}
      <div>
        <button
          onClick={() => toggleFilterSection('price')}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"
        >
          <span className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            Price Range
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              expandedFilters.has('price') ? 'rotate-180' : ''
            }`}
          />
        </button>
        {expandedFilters.has('price') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">
                  $
                </span>
                <input
                  type="number"
                  value={priceRange.min}
                  onChange={(e) =>
                    setPriceRange({
                      ...priceRange,
                      min: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full pl-7 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent outline-none bg-orange-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200"
                  placeholder="Min"
                  min="0"
                />
              </div>
              <span className="text-gray-400 text-xs font-medium">—</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">
                  $
                </span>
                <input
                  type="number"
                  value={priceRange.max}
                  onChange={(e) =>
                    setPriceRange({
                      ...priceRange,
                      max: parseInt(e.target.value) || MAX_PRICE,
                    })
                  }
                  className="w-full pl-7 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent outline-none bg-orange-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200"
                  placeholder="Max"
                  min="0"
                />
              </div>
            </div>
            <input
              type="range"
              min="0"
              max={MAX_PRICE}
              value={priceRange.max}
              onChange={(e) =>
                setPriceRange({
                  ...priceRange,
                  max: parseInt(e.target.value),
                })
              }
              className="w-full h-1.5 bg-orange-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <div className="flex justify-between text-[11px] text-gray-500">
              <span>$0</span>
              <span>${MAX_PRICE.toLocaleString()}+</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Filters */}
      <label className="flex items-center gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => setInStockOnly(e.target.checked)}
          className="w-4 h-4 text-orange-500 border-gray-300 dark:border-gray-600 rounded focus:ring-orange-500 dark:focus:ring-orange-400 bg-white dark:bg-gray-800"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
          In Stock Only
        </span>
      </label>

      {/* Barcode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Barcode Status
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              setHasBarcodeFilter(hasBarcodeFilter === true ? null : true)
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              hasBarcodeFilter === true
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Barcode className="w-3.5 h-3.5" />
            Has Barcode
          </button>
          <button
            onClick={() =>
              setHasBarcodeFilter(
                hasBarcodeFilter === false ? null : false,
              )
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              hasBarcodeFilter === false
                ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            No Barcode
          </button>
        </div>
      </div>

      {/* Rating */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Minimum Rating
        </label>
        <div className="flex flex-wrap gap-2">
          {[4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              onClick={() =>
                setRatingFilter(ratingFilter === rating ? null : rating)
              }
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                ratingFilter === rating
                  ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              {rating}+
            </button>
          ))}
        </div>
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full px-4 py-2 border border-orange-200 dark:border-gray-700 rounded-lg text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );

  // ============================================
  // RENDER — loading skeleton
  // ============================================

  if (loading && products.length === 0) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-orange-50'
        } transition-colors duration-300`}
      >
        <div className={`${SIZES.container} pt-24 md:pt-28 pb-16`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm h-80 animate-pulse"
              >
                <div className="h-48 bg-orange-100 dark:bg-gray-800 rounded-t-2xl" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-orange-100 dark:bg-gray-800 rounded-lg w-3/4" />
                  <div className="h-3 bg-orange-100 dark:bg-gray-800 rounded-lg w-1/2" />
                  <div className="h-6 bg-orange-100 dark:bg-gray-800 rounded-lg w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — main
  // ============================================

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? 'dark bg-gray-950'
          : 'bg-gradient-to-b from-orange-50 via-white to-amber-50'
      } transition-colors duration-300`}
    >
      {/* ============================================
          COMPACT HERO STRIP
          ============================================ */}
      <div
        className={`relative overflow-hidden bg-gradient-to-br ${COLORS.gradient.hero} pt-24 md:pt-28`}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-yellow-300 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-200 rounded-full blur-3xl" />
        </div>

        <div className={`relative ${SIZES.container}`}>
          <div className="flex items-center justify-between gap-4 pb-5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 shrink-0">
                <ShoppingBag className="w-5 h-5 text-yellow-300" />
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl md:text-2xl font-bold text-white truncate">
                  Shop &amp; Save Today
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-orange-100 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-yellow-300" />
                    {pagination.total} products
                  </span>
                  <span className="opacity-50">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-yellow-300" />
                    {categories.length} categories
                  </span>
                  {cartCount > 0 && (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="inline-flex items-center gap-1">
                        <ShoppingCart className="w-3.5 h-3.5 text-yellow-300" />
                        {cartCount} in cart
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {cartCount > 0 && (
                <button
                  onClick={handleQuickPay}
                  className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-md"
                >
                  <CreditCard className="w-4 h-4" />
                  Quick Checkout
                </button>
              )}

              <button
                onClick={() => setShowHero((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl text-white text-xs font-medium hover:bg-white/30 transition-all duration-200"
                aria-expanded={showHero}
                aria-label="Toggle hero details"
              >
                <Sparkles className="w-4 h-4" />
                {showHero ? 'Hide' : 'Details'}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    showHero ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Expandable hero — collapses by default. */}
          <AnimatePresence initial={false}>
            {showHero && (
              <motion.div
                key="hero"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="pb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-400/20 backdrop-blur-md rounded-full mb-4 border border-yellow-300/30">
                    <Flame className="w-4 h-4 text-yellow-300 animate-pulse" />
                    <span className="text-xs font-semibold text-yellow-100">
                      Hot Deals Available!
                    </span>
                  </div>

                  <p className="text-base md:text-lg text-orange-100 mb-4 max-w-2xl">
                    Discover amazing products at unbeatable prices.
                  </p>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      {
                        label: 'Total Products',
                        value: pagination.total,
                        icon: <Package className="w-4 h-4" />,
                        color: 'from-emerald-500 to-green-600',
                      },
                      {
                        label: 'Categories',
                        value: categories.length,
                        icon: <Layers className="w-4 h-4" />,
                        color: 'from-blue-500 to-sky-600',
                      },
                      {
                        label: 'Available Now',
                        value: inStockCount,
                        icon: <CheckCircle2 className="w-4 h-4" />,
                        color: 'from-orange-500 to-amber-600',
                      },
                      {
                        label: 'With Barcode',
                        value: barcodeCount,
                        icon: <Barcode className="w-4 h-4" />,
                        color: 'from-yellow-400 to-orange-500',
                      },
                    ].map((stat, index) => (
                      <div
                        key={index}
                        className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${stat.color} text-white shadow-sm`}
                          >
                            {stat.icon}
                          </span>
                        </div>
                        <p className="text-xl font-bold text-white tabular-nums">
                          {stat.value}
                        </p>
                        <p className="text-[11px] text-white/70">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom decorative accent */}
          <div className="pb-6" />
        </div>
      </div>

      {/* ============================================
          TOOLBAR — flows with the page
          ============================================ */}
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className={`${SIZES.container} py-2.5`}>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filters trigger */}
            <button
              onClick={() => setShowMobileFilters(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-medium shadow-sm hover:shadow transition-all duration-200 shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white/25 text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Search (compact) */}
            <div className="relative flex-1 min-w-[160px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              )}
            </div>

            {/* Result count */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 px-2 shrink-0">
              {isFiltering ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
              ) : (
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span className="tabular-nums font-medium text-gray-900 dark:text-white">
                {pagination.total}
              </span>
              <span>found</span>
            </div>

            {/* Sort */}
            <select
              id="sort"
              value={sortBy}
              onChange={handleSortChange}
              className="px-2.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none text-xs font-medium text-gray-900 dark:text-white shrink-0"
            >
              <option value="newest">🆕 Newest</option>
              <option value="price-low">💵 Price ↑</option>
              <option value="price-high">💎 Price ↓</option>
              <option value="rating">⭐ Rated</option>
            </select>

            {/* View toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-orange-500'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-orange-500'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category chip row */}
          {categories.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 -mb-0.5 custom-scrollbar">
              <button
                onClick={() => handleCategoryChange('')}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                  !selectedCategory
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ============================================
          MAIN CONTENT
          ============================================ */}
      <div className={`${SIZES.container} py-6 md:py-8 xl:py-10`}>
        <main>
          {products.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-12 xl:p-16 text-center"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 rounded-full mb-5">
                <Package className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                No Products Found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Try adjusting your filters or search criteria to find what
                you&apos;re looking for.
              </p>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-medium transition-all duration-200 shadow-lg"
              >
                <Filter className="w-4 h-4" />
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
                className={`grid gap-5 md:gap-6 ${
                  viewMode === 'grid'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                    : 'grid-cols-1'
                }`}
              >
                {products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    variants={itemVariants}
                    className="h-full"
                  >
                    <ProductCard
                      product={{
                        ...product,
                        images: product.images || [],
                      }}
                      index={index}
                      orientation={
                        viewMode === 'grid' ? 'vertical' : 'horizontal'
                      }
                      variant="default"
                      showWishlist={true}
                      showAddToCart={true}
                      showQuickView={true}
                      onAddToCart={(productId, variantId, quantity) =>
                        handleAddToCart(productId, variantId, quantity)
                      }
                    />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-10">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-orange-200 dark:border-gray-700 rounded-xl text-sm font-medium hover:bg-orange-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-gray-700 dark:text-gray-300"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from(
                  { length: Math.min(pagination.totalPages, 5) },
                  (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (
                      pagination.page >=
                      pagination.totalPages - 2
                    ) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-10 h-10 rounded-xl text-sm font-medium transition-all duration-200 ${
                          pagination.page === pageNum
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg scale-105'
                            : 'hover:bg-orange-50 dark:hover:bg-gray-800 border border-orange-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  },
                )}
              </div>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-orange-200 dark:border-gray-700 rounded-xl text-sm font-medium hover:bg-orange-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-gray-700 dark:text-gray-300"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ============================================
          FLOATING CART PILL
          ============================================ */}
      <AnimatePresence>
        {cartCount > 0 && showCartPill && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-40 group"
          >
            <div className="relative">
              <button
                onClick={handleViewCart}
                className="flex items-center gap-2 pl-3 pr-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full shadow-2xl hover:shadow-3xl transition-all duration-200 group-hover:opacity-0 group-hover:pointer-events-none"
                aria-label="View cart"
              >
                <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
                  <ShoppingBag className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-orange-600 text-[10px] font-bold flex items-center justify-center">
                    {cartCount}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(cartTotal)}
                </span>
              </button>

              <div className="absolute bottom-0 right-0 flex items-center gap-1 pl-1 pr-1 py-1 bg-white dark:bg-gray-900 rounded-full shadow-2xl border border-orange-200 dark:border-gray-700 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:scale-100 group-focus-within:pointer-events-auto transition-all duration-200 origin-bottom-right">
                <button
                  onClick={handleViewCart}
                  className="px-3 py-2 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  View Cart
                </button>
                <button
                  onClick={handleQuickPay}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full text-xs font-semibold shadow-sm whitespace-nowrap"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Checkout
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={scrollToTop}
            className="fixed bottom-6 left-6 z-40 p-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full shadow-2xl transition-all duration-200"
            aria-label="Back to top"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ============================================
          FILTER DRAWER
          ============================================ */}
      <AnimatePresence>
        {showMobileFilters && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <div
              className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm"
              onClick={() => setShowMobileFilters(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 300,
              }}
              className="fixed inset-y-0 left-0 w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white">
                    <Filter className="w-4 h-4" />
                  </span>
                  Filters
                </h2>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Close filters"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">{filterPanel}</div>

              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                <button
                  onClick={clearFilters}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-lg"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
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
