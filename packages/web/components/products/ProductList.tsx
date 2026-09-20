// D:\Projects\Kalwanga\packages\web\components\products\ProductList.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Edit,
  Trash2,
  Package,
  Barcode,
  Grid,
  List,
  Star,
  Eye,
  RefreshCw,
  X,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Sparkles,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Tag,
  Layers,
  Link2,
  ImageIcon,
} from 'lucide-react';
import { productService } from '../../services/productService';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency } from '../../utils/formatters';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../hooks/useAuth';
import { PermissionResource } from '../../types/enums';
import { WishlistButton } from './WishlistButton';
import { useThemeStore } from '../../app/stores/themeStore';

// ============================================
// TYPES
// ============================================
//
// These mirror the backend's normalized wire shapes. The critical
// change vs. the previous version: `inventory` is SINGULAR on both
// `Product` and `ProductVariant`. Prisma's `inventoryId String? @unique`
// is a one-to-one relation, and `normalizeProduct` / `normalizeVariant`
// on the backend emit a single object or null — never an array.

interface Inventory {
  id: string;
  businessUnitId: string;
  locationId?: string | null;
  quantity: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number;
  location?: string | null;
  shelfNumber?: string | null;
  supplier?: string | null;
  notes?: string | null;
  status: string;
  images: string[];
  description?: string | null;
  weight?: number | null;
  taxRate?: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
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
  /** Singular — matches the backend's normalized `ProductVariant.inventory`. */
  inventory?: Inventory | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
  unitPrice: number;
  costPrice?: number | null;
  barcode?: string | null;
  images: string[];
  category?: { id: string; name: string } | null;
  categoryId?: string | null;
  supplier?: { id: string; name: string } | null;
  /** Singular — matches backend. */
  inventory?: Inventory | null;
  variants?: Variant[] | null;
  isActive: boolean;
  isDigital?: boolean;
  weight?: number | null;
  taxRate?: number | null;
  minStock?: number | null;
  maxStock?: number | null;
  attributes?: Record<string, any> | null;
  rating?: number | null;
  reviewCount?: number | null;
  tags?: string[] | null;
  featured?: boolean;
  seo?: any;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  inventoryId?: string | null;
}

interface Category {
  id: string;
  name: string;
  /** Backend returns Prisma's `_count: { products, children }`. */
  _count?: { products?: number; children?: number };
}

interface ProductListProps {
  isAdmin?: boolean;
  showFilters?: boolean;
  showWishlist?: boolean;
  showAddToCart?: boolean;
  showBarcode?: boolean;
  initialFilters?: {
    categoryId?: string;
    search?: string;
    featured?: boolean;
    businessUnitId?: string;
  };
  onProductSelect?: (product: Product) => void;
  onProductEdit?: (product: Product) => void;
  onProductDelete?: (productId: string) => void;
}

interface FilterState {
  search: string;
  categoryId: string;
  status: 'all' | 'active' | 'inactive';
  minPrice: string;
  maxPrice: string;
  featured: boolean;
  inStock: boolean;
  minRating: string;
  hasBarcode: 'all' | 'yes' | 'no';
  hasVariants: 'all' | 'yes' | 'no';
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// ============================================
// BUSINESS UNIT RESOLUTION
// ============================================
//
// Mirrors `productService.ts`'s resolver. `'default'` is rejected as
// a placeholder — it would cause products to save to (or filter by) a
// non-existent BU id.

const BU_STORAGE_KEYS = [
  'selectedBusinessUnitId',
  'businessUnitId',
] as const;

const PLACEHOLDER_BU_VALUES = new Set([
  '',
  'default',
  'default-business-unit',
  'undefined',
  'null',
]);

function isRealBusinessUnitId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return !PLACEHOLDER_BU_VALUES.has(trimmed.toLowerCase());
}

function resolveBusinessUnitId(): string | null {
  if (typeof window === 'undefined') return null;

  for (const key of BU_STORAGE_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (isRealBusinessUnitId(value)) return value.trim();
    } catch {
      /* ignore */
    }
  }

  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const fromUser =
        user?.businessUnitId ||
        user?.businessUnits?.[0]?.businessUnitId ||
        user?.businessUnits?.[0]?.id;
      if (isRealBusinessUnitId(fromUser)) return fromUser.trim();
    }
  } catch {
    /* ignore */
  }

  return null;
}

// ============================================
// STOCK HELPERS
// ============================================
//
// The backend's `computeStockAggregates` is not applied on the list
// endpoint (`getAllProducts` / `getPublicProducts` only call
// `normalizeProduct`), so we reproduce its logic here against the
// singular inventory shape.

interface StockSummary {
  available: number;
  totalStock: number;
  totalReserved: number;
  productAvailable: number;
  variantAvailable: number;
}

function summariseProductStock(product: Product): StockSummary {
  const inv = product.inventory;
  const productQuantity = inv?.quantity ?? 0;
  const productReserved = inv?.reserved ?? 0;
  const productAvailable = productQuantity - productReserved;

  let variantTotalStock = 0;
  let variantReserved = 0;
  let variantAvailable = 0;

  for (const v of product.variants ?? []) {
    if (v.inventory) {
      variantTotalStock += v.inventory.quantity ?? 0;
      variantReserved += v.inventory.reserved ?? 0;
      variantAvailable +=
        (v.inventory.quantity ?? 0) - (v.inventory.reserved ?? 0);
    } else {
      variantTotalStock += v.stock ?? 0;
      variantAvailable += v.stock ?? 0;
    }
  }

  return {
    available: Math.max(0, productAvailable + variantAvailable),
    totalStock: productQuantity + variantTotalStock,
    totalReserved: productReserved + variantReserved,
    productAvailable,
    variantAvailable,
  };
}

function getStockStatus(product: Product) {
  const { available } = summariseProductStock(product);
  const threshold = product.minStock ?? 5;

  if (available <= 0) {
    return {
      status: 'Out of Stock',
      color:
        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      icon: XCircle,
    };
  }
  if (available <= threshold) {
    return {
      status: 'Low Stock',
      color:
        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      icon: AlertTriangle,
    };
  }
  return {
    status: 'In Stock',
    color:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    icon: CheckCircle,
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ProductList({
  isAdmin = false,
  showFilters = true,
  showWishlist = true,
  showAddToCart = false,
  showBarcode = false,
  initialFilters = {},
  onProductSelect,
  onProductEdit,
  onProductDelete,
}: ProductListProps) {
  const router = useRouter();
  const { canView, canEdit, canDelete, canManage, canCreate } = usePermission();
  const { isDark } = useThemeStore();
  const { isAuthenticated } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string>('');
  const [addingToCart, setAddingToCart] = useState<Record<string, boolean>>({});

  const [filters, setFilters] = useState<FilterState>({
    search: initialFilters.search || '',
    categoryId: initialFilters.categoryId || '',
    status: 'all',
    minPrice: '',
    maxPrice: '',
    featured: initialFilters.featured || false,
    inStock: false,
    minRating: '',
    hasBarcode: 'all',
    hasVariants: 'all',
  });

  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 12,
  });

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('newest');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [searchInput, setSearchInput] = useState(initialFilters.search || '');

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const canViewProducts =
    canView(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canManageProducts = canManage(PermissionResource.PRODUCT);
  const canEditProducts =
    canEdit(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canDeleteProducts =
    canDelete(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canCreateProducts =
    canCreate(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);

  const handleImageError = useCallback((imageUrl: string) => {
    setImageErrors((prev) => ({ ...prev, [imageUrl]: true }));
  }, []);

  const getValidImage = useCallback(
    (imageUrl: string | undefined): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (imageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [imageErrors],
  );

  // ============================================
  // LOADERS
  // ============================================
  //
  // Admin callers hit the authenticated `/products` and
  // `/products/categories` routes. Storefront callers hit
  // `/products/public` and `/products/public/categories` so anonymous
  // visitors can browse.

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setImageErrors({});

      // Guests can't send `businessUnitId` as a filter — the public
      // route resolves the BU server-side. Only pass it for admins.
      const businessUnitId = isAdmin
        ? initialFilters.businessUnitId || resolveBusinessUnitId() || undefined
        : undefined;

      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search || undefined,
        categoryId: filters.categoryId || undefined,
        minPrice: filters.minPrice
          ? parseFloat(filters.minPrice)
          : undefined,
        maxPrice: filters.maxPrice
          ? parseFloat(filters.maxPrice)
          : undefined,
        featured: filters.featured || undefined,
      };

      // Admin-only filters. The public route doesn't honour these —
      // it auto-hides out-of-stock and inactive products already.
      if (isAdmin) {
        params.businessUnitId = businessUnitId;
        params.isActive =
          filters.status === 'active'
            ? true
            : filters.status === 'inactive'
            ? false
            : undefined;
        params.inStock = filters.inStock || undefined;
        params.minRating = filters.minRating
          ? parseFloat(filters.minRating)
          : undefined;
        params.hasBarcode =
          filters.hasBarcode === 'yes'
            ? true
            : filters.hasBarcode === 'no'
            ? false
            : undefined;
        params.hasVariants =
          filters.hasVariants === 'yes'
            ? true
            : filters.hasVariants === 'no'
            ? false
            : undefined;
      }

      // Backend `validSortFields`:
      //   name, sku, unitPrice, createdAt, updatedAt, rating
      // Anything else falls back to `createdAt desc`.
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

      // ✅ Route branch.
      const result = isAdmin
        ? await productService.getAllProducts(params)
        : await productService.getPublicProducts(params);

      if (!isMountedRef.current) return;

      const mappedProducts: Product[] = (result.data || []).map(
        (p: any): Product => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          description: p.description,
          unitPrice: p.unitPrice,
          costPrice: p.costPrice,
          barcode: p.barcode,
          images: p.images || [],
          category: p.category,
          categoryId: p.categoryId,
          supplier: p.supplier,
          inventory: p.inventory ?? null,
          variants: p.variants
            ? p.variants.map(
                (v: any): Variant => ({
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
                  inventory: v.inventory ?? null,
                }),
              )
            : null,
          isActive: p.isActive,
          isDigital: p.isDigital,
          weight: p.weight,
          taxRate: p.taxRate,
          minStock: p.minStock,
          maxStock: p.maxStock,
          attributes: p.attributes,
          rating: p.rating,
          reviewCount: p.reviewCount,
          tags: p.tags,
          featured: p.featured,
          seo: p.seo,
          createdBy: p.createdBy,
          updatedBy: p.updatedBy,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          deletedAt: p.deletedAt,
          inventoryId: p.inventoryId || null,
        }),
      );

      setProducts(mappedProducts);
      setPagination((prev) => ({
        ...prev,
        total: result.total || 0,
        totalPages: result.totalPages || 1,
      }));
    } catch (error) {
      console.error('Failed to load products:', error);
      if (!isMountedRef.current) return;
      toast.error('Failed to load products');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    isAdmin,
    initialFilters.businessUnitId,
    pagination.page,
    pagination.limit,
    filters.search,
    filters.categoryId,
    filters.minPrice,
    filters.maxPrice,
    filters.featured,
    filters.status,
    filters.inStock,
    filters.minRating,
    filters.hasBarcode,
    filters.hasVariants,
    sortBy,
  ]);

  const loadCategories = useCallback(async () => {
    try {
      // ✅ Admin → authenticated route. Storefront → public route.
      const data = isAdmin
        ? await productService.getCategories()
        : await productService.getPublicCategories();
      if (!isMountedRef.current) return;
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      if (!isMountedRef.current) return;
      setCategories([]);
    }
  }, [isAdmin]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    // Admin without permission → don't fetch.
    // Storefront (isAdmin === false) → always fetch.
    if (isAdmin && !canViewProducts) return;
    loadProducts();
  }, [isAdmin, canViewProducts, loadProducts]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters((prev) => ({ ...prev, search: searchInput }));
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search]);

  // ============================================
  // CART / ACTIONS
  // ============================================

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    toast.success('Products refreshed');
  };

  const handleAddToCart = useCallback(
    async (productId: string, productName: string) => {
      setAddingToCart((prev) => ({ ...prev, [productId]: true }));
      try {
        // ✅ Authenticated → authenticated cart. Anonymous → guest cart.
        const cart = isAuthenticated ? cartService : guestCartService;
        await cart.addItem({ productId, quantity: 1 });

        toast.success(`${productName} added to cart`);
        window.dispatchEvent(new CustomEvent('cart:updated'));
      } catch (err: any) {
        if (err?.response?.status === 401) {
          router.push('/login?redirect_url=/shop');
          return;
        }
        toast.error(
          err?.response?.data?.message || 'Failed to add to cart',
        );
      } finally {
        if (isMountedRef.current) {
          setAddingToCart((prev) => ({ ...prev, [productId]: false }));
        }
      }
    },
    [isAuthenticated, router],
  );

  const handleDelete = async (id: string) => {
    if (!canDeleteProducts) {
      toast.error("You don't have permission to delete products");
      return;
    }

    try {
      await productService.deleteProduct(id);
      toast.success('Product deleted successfully');
      if (onProductDelete) onProductDelete(id);
      await loadProducts();
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const handleBulkDelete = async () => {
    if (!canDeleteProducts) {
      toast.error("You don't have permission to delete products");
      return;
    }

    try {
      const results = await Promise.all(
        selectedProducts.map(async (id) => {
          try {
            await productService.deleteProduct(id);
            return true;
          } catch {
            return false;
          }
        }),
      );

      const successCount = results.filter(Boolean).length;
      toast.success(`${successCount} products deleted successfully`);
      setSelectedProducts([]);
      await loadProducts();
    } catch {
      toast.error('Failed to delete products');
    }
  };

  const handleBulkActivate = async () => {
    try {
      await productService.bulkActivateProducts(selectedProducts);
      toast.success(`${selectedProducts.length} products activated`);
      setSelectedProducts([]);
      await loadProducts();
    } catch {
      toast.error('Failed to activate products');
    }
  };

  const handleBulkDeactivate = async () => {
    try {
      await productService.bulkDeactivateProducts(selectedProducts);
      toast.success(`${selectedProducts.length} products deactivated`);
      setSelectedProducts([]);
      await loadProducts();
    } catch {
      toast.error('Failed to deactivate products');
    }
  };

  const handleBulkGenerateBarcodes = async () => {
    try {
      const result = await productService.bulkGenerateBarcodes(
        selectedProducts,
      );
      const successCount = result.results?.length || 0;
      const errorCount = result.errors?.length || 0;

      if (errorCount > 0) {
        toast.warning(
          `${successCount} barcodes generated, ${errorCount} failed`,
        );
      } else {
        toast.success(`${successCount} barcodes generated successfully`);
      }

      setSelectedProducts([]);
      await loadProducts();
    } catch {
      toast.error('Failed to generate barcodes');
    }
  };

  const renderStars = (rating: number = 0) => (
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

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      categoryId: '',
      status: 'all',
      minPrice: '',
      maxPrice: '',
      featured: false,
      inStock: false,
      minRating: '',
      hasBarcode: 'all',
      hasVariants: 'all',
    });
    setSearchInput('');
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSortBy('newest');
  };

  const hasActiveFilters = useMemo(
    () =>
      Object.values(filters).some(
        (v) => v !== '' && v !== false && v !== 'all',
      ),
    [filters],
  );

  const toggleAllSelection = () => {
    if (
      selectedProducts.length === products.length &&
      products.length > 0
    ) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map((p) => p.id));
    }
  };

  // ============================================
  // LOADING SKELETON
  // ============================================

  if (loading && products.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-64 bg-gray-200 dark:bg-gray-700 rounded"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition-colors duration-200">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, SKU, or barcode..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
              />
            </div>

            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="lg:hidden flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </button>

            <div className="hidden lg:flex flex-wrap items-center gap-3">
              <select
                value={filters.categoryId}
                onChange={(e) => updateFilter('categoryId', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                    {cat._count?.products !== undefined
                      ? ` (${cat._count.products})`
                      : ''}
                  </option>
                ))}
              </select>

              {isAdmin && (
                <>
                  <select
                    value={filters.status}
                    onChange={(e) =>
                      updateFilter(
                        'status',
                        e.target.value as FilterState['status'],
                      )
                    }
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>

                  <select
                    value={filters.hasBarcode}
                    onChange={(e) =>
                      updateFilter(
                        'hasBarcode',
                        e.target.value as FilterState['hasBarcode'],
                      )
                    }
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                  >
                    <option value="all">All Barcodes</option>
                    <option value="yes">Has Barcode</option>
                    <option value="no">No Barcode</option>
                  </select>

                  <select
                    value={filters.hasVariants}
                    onChange={(e) =>
                      updateFilter(
                        'hasVariants',
                        e.target.value as FilterState['hasVariants'],
                      )
                    }
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                  >
                    <option value="all">All Products</option>
                    <option value="yes">Has Variants</option>
                    <option value="no">No Variants</option>
                  </select>
                </>
              )}

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
              >
                <option value="newest">🆕 Newest</option>
                <option value="price-low">💵 Price: Low → High</option>
                <option value="price-high">💵 Price: High → Low</option>
                <option value="rating">⭐ Highest Rated</option>
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min $"
                  value={filters.minPrice}
                  onChange={(e) => updateFilter('minPrice', e.target.value)}
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                />
                <span className="text-gray-500 dark:text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max $"
                  value={filters.maxPrice}
                  onChange={(e) => updateFilter('maxPrice', e.target.value)}
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                />
              </div>

              <div className="flex gap-3">
                <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.inStock}
                    onChange={(e) =>
                      updateFilter('inStock', e.target.checked)
                    }
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                  />
                  In Stock
                </label>
                <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.featured}
                    onChange={(e) =>
                      updateFilter('featured', e.target.checked)
                    }
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-yellow-500 focus:ring-yellow-500 bg-white dark:bg-gray-700"
                  />
                  ⭐ Featured
                </label>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 ml-auto">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
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
                onClick={handleRefresh}
                disabled={refreshing}
                className={`p-1.5 rounded-md transition-colors ${
                  refreshing
                    ? 'text-blue-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Refresh"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

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
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
              onClick={() => setShowMobileFilters(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-800 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Filters
                </h2>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={filters.categoryId}
                    onChange={(e) =>
                      updateFilter('categoryId', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                {isAdmin && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Status
                      </label>
                      <select
                        value={filters.status}
                        onChange={(e) =>
                          updateFilter(
                            'status',
                            e.target.value as FilterState['status'],
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Barcode
                      </label>
                      <select
                        value={filters.hasBarcode}
                        onChange={(e) =>
                          updateFilter(
                            'hasBarcode',
                            e.target.value as FilterState['hasBarcode'],
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="all">All</option>
                        <option value="yes">Has Barcode</option>
                        <option value="no">No Barcode</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Variants
                      </label>
                      <select
                        value={filters.hasVariants}
                        onChange={(e) =>
                          updateFilter(
                            'hasVariants',
                            e.target.value as FilterState['hasVariants'],
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="all">All</option>
                        <option value="yes">Has Variants</option>
                        <option value="no">No Variants</option>
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Price Range
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.minPrice}
                      onChange={(e) =>
                        updateFilter('minPrice', e.target.value)
                      }
                      className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.maxPrice}
                      onChange={(e) =>
                        updateFilter('maxPrice', e.target.value)
                      }
                      className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.inStock}
                      onChange={(e) =>
                        updateFilter('inStock', e.target.checked)
                      }
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    In Stock
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.featured}
                      onChange={(e) =>
                        updateFilter('featured', e.target.checked)
                      }
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-yellow-500 focus:ring-yellow-500"
                    />
                    Featured
                  </label>
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                <button
                  onClick={clearFilters}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Actions */}
      <AnimatePresence>
        {selectedProducts.length > 0 && canDeleteProducts && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2"
          >
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {selectedProducts.length} products selected
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {showBarcode && (
                <button
                  onClick={handleBulkGenerateBarcodes}
                  className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors flex items-center gap-1"
                >
                  <Barcode className="w-3 h-3" />
                  Generate Barcodes
                </button>
              )}
              <button
                onClick={handleBulkActivate}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Activate
              </button>
              <button
                onClick={handleBulkDeactivate}
                className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
              >
                Deactivate
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedProducts([])}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Products Display — Table */}
      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {canDeleteProducts && isAdmin && (
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedProducts.length === products.length &&
                          products.length > 0
                        }
                        onChange={toggleAllSelection}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    SKU
                  </th>
                  {showBarcode && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Barcode
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showBarcode ? 10 : 9}
                      className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-lg font-medium">No products found</p>
                      <p className="text-sm">Try adjusting your filters</p>
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const stock = getStockStatus(product);
                    const summary = summariseProductStock(product);
                    const hasBarcode = !!product.barcode;
                    const hasVariantImages = (product.variants || []).some(
                      (v) => v.images && v.images.length > 0,
                    );

                    return (
                      <tr
                        key={product.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        {canDeleteProducts && isAdmin && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(product.id)}
                              onChange={() => {
                                if (selectedProducts.includes(product.id)) {
                                  setSelectedProducts(
                                    selectedProducts.filter(
                                      (id) => id !== product.id,
                                    ),
                                  );
                                } else {
                                  setSelectedProducts([
                                    ...selectedProducts,
                                    product.id,
                                  ]);
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {product.images?.[0] ? (
                                <img
                                  src={getValidImage(product.images[0])}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  onError={() =>
                                    handleImageError(product.images[0])
                                  }
                                />
                              ) : (
                                <Package className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {product.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-1">
                                {product.featured && (
                                  <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                    ⭐ Featured
                                  </span>
                                )}
                                {product.variants &&
                                  product.variants.length > 0 && (
                                    <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                                      <Layers className="w-3 h-3" />
                                      {product.variants.length} variants
                                      {hasVariantImages && (
                                        <ImageIcon className="w-3 h-3 text-blue-500" />
                                      )}
                                    </span>
                                  )}
                                {product.inventoryId && (
                                  <span className="text-xs text-blue-500 flex items-center gap-0.5">
                                    <Link2 className="w-3 h-3" />
                                    Inventory
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                          {product.sku}
                        </td>
                        {showBarcode && (
                          <td className="px-4 py-3">
                            {hasBarcode ? (
                              <span className="text-xs font-mono text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                <Barcode className="w-3 h-3 text-green-500" />
                                {product.barcode}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">
                                No barcode
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {product.category?.name || '-'}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {formatCurrency(product.unitPrice)}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${stock.color}`}
                            >
                              {stock.status}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {summary.available} available
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {product.rating ? (
                            <div className="flex items-center gap-1">
                              {renderStars(product.rating)}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500">
                              N/A
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              product.isActive
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }`}
                          >
                            {product.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {showWishlist && !isAdmin && (
                              <WishlistButton
                                productId={product.id}
                                size="sm"
                              />
                            )}
                            <Link
                              href={
                                isAdmin
                                  ? `/admin/catalog/${product.id}`
                                  : `/shop/${product.id}`
                              }
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="View"
                              onClick={() =>
                                onProductSelect && onProductSelect(product)
                              }
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            {canEditProducts && isAdmin && (
                              <Link
                                href={`/admin/catalog/edit/${product.id}`}
                                className="p-1.5 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
                                title="Edit"
                                onClick={() =>
                                  onProductEdit && onProductEdit(product)
                                }
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                            )}
                            {canDeleteProducts && isAdmin && (
                              <button
                                onClick={() => {
                                  setSelectedProductId(product.id);
                                  setSelectedProductName(product.name);
                                  setShowDeleteModal(true);
                                }}
                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {showAddToCart && !isAdmin && (
                              <button
                                onClick={() =>
                                  handleAddToCart(product.id, product.name)
                                }
                                disabled={
                                  summary.available <= 0 ||
                                  addingToCart[product.id]
                                }
                                className={`p-1.5 rounded-lg transition-colors ${
                                  summary.available <= 0
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
                                }`}
                                title="Add to Cart"
                              >
                                {addingToCart[product.id] ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <ShoppingCart className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(
                  pagination.page * pagination.limit,
                  pagination.total,
                )}{' '}
                of {pagination.total} results
              </p>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: prev.page - 1,
                    }))
                  }
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
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
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            page: pageNum,
                          }))
                        }
                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                          pagination.page === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  },
                )}
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: prev.page + 1,
                    }))
                  }
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Grid View */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {products.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                No products found
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Try adjusting your filters or search terms.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            products.map((product, index) => {
              const stock = getStockStatus(product);
              const summary = summariseProductStock(product);
              const available = summary.available;
              const hasVariantImages = (product.variants || []).some(
                (v) => v.images && v.images.length > 0,
              );

              return (
                <motion.div
                  key={product.id}
                  variants={itemVariants}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 group"
                >
                  <Link
                    href={
                      isAdmin
                        ? `/admin/catalog/${product.id}`
                        : `/shop/${product.id}`
                    }
                  >
                    <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                      {product.images?.[0] ? (
                        <img
                          src={getValidImage(product.images[0])}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          onError={() =>
                            handleImageError(product.images[0])
                          }
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Package className="w-16 h-16 text-gray-300 dark:text-gray-600" />
                        </div>
                      )}
                      {!product.isActive && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded">
                          Inactive
                        </div>
                      )}
                      {product.featured && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Featured
                        </div>
                      )}
                      {available <= 0 && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded">
                          Out of Stock
                        </div>
                      )}
                      {available > 0 && available <= 5 && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded">
                          Only {available} left
                        </div>
                      )}
                      {showBarcode && product.barcode && (
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500/80 text-white text-xs rounded flex items-center gap-1">
                          <Barcode className="w-3 h-3" />
                          {product.barcode.slice(0, 8)}
                        </div>
                      )}
                      {showWishlist && !isAdmin && (
                        <div className="absolute top-2 right-2">
                          <WishlistButton
                            productId={product.id}
                            size="sm"
                          />
                        </div>
                      )}
                      {product.variants &&
                        product.variants.length > 0 && (
                          <div className="absolute top-12 right-2 px-2 py-1 bg-purple-500/80 text-white text-xs rounded flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            {product.variants.length}
                            {hasVariantImages && (
                              <ImageIcon className="w-3 h-3 text-blue-300" />
                            )}
                          </div>
                        )}
                      {product.inventoryId && (
                        <div className="absolute top-12 left-2 px-2 py-1 bg-blue-500/80 text-white text-xs rounded flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-4">
                    <Link
                      href={
                        isAdmin
                          ? `/admin/catalog/${product.id}`
                          : `/shop/${product.id}`
                      }
                    >
                      <h3 className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
                        {product.name}
                      </h3>
                    </Link>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      SKU: {product.sku}
                    </p>
                    {product.rating && product.rating > 0 && (
                      <div className="mt-1">{renderStars(product.rating)}</div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(product.unitPrice)}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${stock.color} flex items-center gap-0.5`}
                      >
                        <stock.icon className="w-3 h-3" />
                        {stock.status}
                      </span>
                    </div>
                    {product.category && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {product.category.name}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Link
                        href={
                          isAdmin
                            ? `/admin/catalog/${product.id}`
                            : `/shop/${product.id}`
                        }
                        className="flex-1 text-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={() =>
                          onProductSelect && onProductSelect(product)
                        }
                      >
                        View
                      </Link>
                      {canEditProducts && isAdmin && (
                        <Link
                          href={`/admin/catalog/edit/${product.id}`}
                          className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors"
                          onClick={() =>
                            onProductEdit && onProductEdit(product)
                          }
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      )}
                      {showAddToCart && !isAdmin && available > 0 && (
                        <button
                          onClick={() =>
                            handleAddToCart(product.id, product.name)
                          }
                          disabled={addingToCart[product.id]}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {addingToCart[product.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ShoppingCart className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      )}

      {/* Load More for Grid View */}
      {viewMode === 'grid' &&
        pagination.totalPages > 1 &&
        products.length > 0 && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
              }
              disabled={
                pagination.page === pagination.totalPages || loading
              }
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Load More
                </>
              )}
            </button>
          </div>
        )}

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && selectedProductId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Delete Product
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete{' '}
                <strong className="text-gray-900 dark:text-white">
                  {selectedProductName || 'this product'}
                </strong>
                ? This will permanently remove it and all associated data,
                including variants and inventory.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedProductId(null);
                    setSelectedProductName('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedProductId) {
                      handleDelete(selectedProductId);
                    }
                    setShowDeleteModal(false);
                    setSelectedProductId(null);
                    setSelectedProductName('');
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProductList;
