// packages/web/app/categories/[id]/page.tsx

'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Package,
  Star,
  Search,
  Grid3x3,
  List as ListIcon,
  Layers,
  Hash,
  ChevronRight,
  Boxes,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  SearchX,
  ShoppingBag,
  ShoppingCart,
  Home,
  User,
  Bell,
  Menu,
  X,
  ArrowUpDown,
} from 'lucide-react';

import PublicNavigation from '../../../../components/PublicNavigation';
import { categoryService } from '../../../../services/categoryService';
import { cartService } from '../../../../services/cartService';
import { CategoryAvatar } from '../../../../components/categories/CategoryAvatar';
import { useThemeStore } from '../../../stores/themeStore';
import { formatCurrency } from '../../../../utils/formatters';
import type {
  Category,
  CategoryCountLike,
  CategoryWithProducts,
  CategoryProductPreview,
} from '../../../../types/category';

// ============================================
// HELPERS
// ============================================

function productCountOf(c: CategoryCountLike | null | undefined): number {
  if (!c) return 0;
  return c.productCount ?? c._count?.products ?? 0;
}

function childCountOf(c: CategoryCountLike | null | undefined): number {
  if (!c) return 0;
  return c.childCount ?? c._count?.children ?? 0;
}

function isFeatured(
  c: Category | CategoryWithProducts | null | undefined,
): boolean {
  if (!c) return false;
  return (c as { featured?: boolean }).featured === true;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

// ============================================
// TYPES
// ============================================

type ViewMode = 'grid' | 'list';

// ============================================
// LINKEDIN-STYLE HEADER
// ============================================
//
// Same shape as / and /categories, but the search field targets the
// page's in-category product search, and the view toggle drives the
// page's grid/list state. Everything below the header remains the
// same as before.

interface LinkedInHeaderProps {
  cartCount: number;
  active?: 'home' | 'categories' | 'shop' | 'cart' | 'alerts' | 'profile';

  // Page-specific controls, hoisted into the header
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;

  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;

  resultCount: number;
  totalCount: number;
  onClearSearch: () => void;

  /** Optional: the current category's name, shown as context. */
  categoryName?: string;
}

function LinkedInHeader({
  cartCount,
  active = 'categories',
  searchQuery,
  setSearchQuery,
  searchInputRef,
  viewMode,
  setViewMode,
  resultCount,
  totalCount,
  onClearSearch,
  categoryName,
}: LinkedInHeaderProps) {
  const { isDark } = useThemeStore();
  const [visible, setVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  const scrollThreshold = 10;

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 60) {
        setVisible(true);
        lastScrollY.current = currentY;
        return;
      }
      const delta = currentY - lastScrollY.current;
      if (Math.abs(delta) < scrollThreshold) return;
      if (delta > 0) setVisible(false);
      else setVisible(true);
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isFiltered = searchQuery.trim().length > 0;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        visible ? 'translate-y-0' : '-translate-y-full'
      } ${
        isDark
          ? 'bg-gray-900/95 border-gray-800'
          : 'bg-white/95 border-orange-100'
      } backdrop-blur-md border-b shadow-sm`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ROW 1 — logo · search · icon rail */}
        <div className="flex items-center justify-between h-14 gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0"
            aria-label="POS Store home"
          >
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-sm">
              <ShoppingBag className="w-4 h-4" />
            </span>
            <span className="hidden sm:inline text-base font-bold text-gray-900 dark:text-white">
              POS Store
            </span>
          </Link>

          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={
                categoryName
                  ? `Search in ${categoryName}…`
                  : 'Search products…'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-9 py-1.5 rounded-md text-sm outline-none transition-colors ${
                isDark
                  ? 'bg-gray-800 text-white placeholder-gray-500'
                  : 'bg-orange-50/60 text-gray-900 placeholder-gray-500'
              } border border-transparent focus:border-orange-400 focus:ring-1 focus:ring-orange-400/40`}
            />
            {searchQuery && (
              <button
                onClick={onClearSearch}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${
                  isDark
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-orange-100 text-gray-500'
                }`}
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-1 shrink-0">
            <HeaderIconItem
              href="/"
              icon={<Home className="w-5 h-5" />}
              label="Home"
              active={active === 'home'}
            />
            <HeaderIconItem
              href="/categories"
              icon={<Layers className="w-5 h-5" />}
              label="Categories"
              active={active === 'categories'}
            />
            <HeaderIconItem
              href="/shop"
              icon={<ShoppingBag className="w-5 h-5" />}
              label="Shop"
              active={active === 'shop'}
            />
            <HeaderIconItem
              href="/cart"
              icon={<ShoppingCart className="w-5 h-5" />}
              label="Cart"
              badge={cartCount > 0 ? cartCount : undefined}
              active={active === 'cart'}
            />
            <HeaderIconItem
              href="/notifications"
              icon={<Bell className="w-5 h-5" />}
              label="Alerts"
              active={active === 'alerts'}
            />
            <HeaderIconItem
              href="/profile"
              icon={<User className="w-5 h-5" />}
              label="Me"
              active={active === 'profile'}
            />
          </nav>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className={`md:hidden p-2 rounded-md transition-colors ${
              isDark
                ? 'hover:bg-gray-800 text-gray-300'
                : 'hover:bg-orange-50 text-gray-700'
            }`}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* ROW 2 — count + clear · view toggle */}
        <div
          className={`hidden sm:flex items-center justify-between gap-3 pb-2 -mt-1 border-t ${
            isDark ? 'border-gray-800' : 'border-orange-50'
          } pt-2`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 tabular-nums">
              {resultCount} product{resultCount === 1 ? '' : 's'}
              {isFiltered && (
                <span className="text-gray-400 dark:text-gray-500">
                  {' '}
                  of {totalCount}
                </span>
              )}
            </span>
            {isFiltered && (
              <button
                onClick={onClearSearch}
                className="inline-flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400 hover:underline font-medium"
              >
                <X className="w-3 h-3" />
                Clear search
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`flex gap-0.5 rounded-md p-0.5 ${
                isDark ? 'bg-gray-800' : 'bg-orange-50'
              }`}
            >
              {(
                [
                  { key: 'grid', icon: Grid3x3, label: 'Grid view' },
                  { key: 'list', icon: ListIcon, label: 'List view' },
                ] as const
              ).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`p-1 rounded transition-all ${
                    viewMode === key
                      ? isDark
                        ? 'bg-gray-900 shadow-sm text-orange-400'
                        : 'bg-white shadow-sm text-orange-600'
                      : isDark
                        ? 'text-gray-400 hover:bg-gray-700'
                        : 'text-gray-500 hover:bg-orange-100'
                  }`}
                  aria-label={label}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile dropdown — nav + count + view toggle + search hint */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden border-t ${
            isDark
              ? 'border-gray-800 bg-gray-900'
              : 'border-orange-100 bg-white'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3">
            <div className="flex flex-col">
              {[
                { href: '/', label: 'Home', icon: Home, key: 'home' as const },
                {
                  href: '/categories',
                  label: 'Categories',
                  icon: Layers,
                  key: 'categories' as const,
                },
                {
                  href: '/shop',
                  label: 'Shop',
                  icon: ShoppingBag,
                  key: 'shop' as const,
                },
                {
                  href: '/cart',
                  label: 'Cart',
                  icon: ShoppingCart,
                  key: 'cart' as const,
                  badge: cartCount,
                },
                {
                  href: '/notifications',
                  label: 'Alerts',
                  icon: Bell,
                  key: 'alerts' as const,
                },
                {
                  href: '/profile',
                  label: 'Me',
                  icon: User,
                  key: 'profile' as const,
                },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? isDark
                          ? 'text-orange-400 bg-orange-950/30'
                          : 'text-orange-600 bg-orange-50'
                        : isDark
                          ? 'text-gray-300 hover:bg-gray-800'
                          : 'text-gray-700 hover:bg-orange-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>

            <div
              className={`border-t ${
                isDark ? 'border-gray-800' : 'border-orange-100'
              }`}
            />

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 tabular-nums">
                {resultCount} product{resultCount === 1 ? '' : 's'}
                {isFiltered && (
                  <span className="text-gray-400 dark:text-gray-500">
                    {' '}
                    of {totalCount}
                  </span>
                )}
              </span>
              {isFiltered && (
                <button
                  onClick={onClearSearch}
                  className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium"
                >
                  <X className="w-3 h-3" />
                  Clear search
                </button>
              )}
            </div>

            <div
              className={`flex gap-0.5 rounded-md p-0.5 self-start ${
                isDark ? 'bg-gray-800' : 'bg-orange-50'
              }`}
            >
              {(
                [
                  { key: 'grid', icon: Grid3x3, label: 'Grid view' },
                  { key: 'list', icon: ListIcon, label: 'List view' },
                ] as const
              ).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`p-1.5 rounded transition-all ${
                    viewMode === key
                      ? isDark
                        ? 'bg-gray-900 shadow-sm text-orange-400'
                        : 'bg-white shadow-sm text-orange-600'
                      : isDark
                        ? 'text-gray-400 hover:bg-gray-700'
                        : 'text-gray-500 hover:bg-orange-100'
                  }`}
                  aria-label={label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

interface HeaderIconItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
}

function HeaderIconItem({
  href,
  icon,
  label,
  active,
  badge,
}: HeaderIconItemProps) {
  const { isDark } = useThemeStore();
  return (
    <Link
      href={href}
      className={`relative flex flex-col items-center justify-center px-2.5 py-1.5 rounded-md transition-colors min-w-[52px] ${
        isDark
          ? 'text-gray-400 hover:text-white hover:bg-gray-800'
          : 'text-gray-500 hover:text-gray-900 hover:bg-orange-50'
      } ${active ? (isDark ? 'text-white' : 'text-gray-900') : ''}`}
    >
      <span className="relative">
        {icon}
        {badge && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium mt-0.5 leading-tight">
        {label}
      </span>
      {active && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500" />
      )}
    </Link>
  );
}

// ============================================
// PAGE
// ============================================

export default function PublicCategoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawParam = typeof params?.id === 'string' ? params.id : '';

  const [category, setCategory] = useState<CategoryWithProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [cartCount, setCartCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ---- Cart count for the header badge ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await cartService.getCartCount();
        if (!cancelled) setCartCount(response.count || 0);
      } catch {
        /* silent */
      }
    })();
    const handler = () => {
      cartService
        .getCartCount()
        .then((r) => !cancelled && setCartCount(r.count || 0))
        .catch(() => {});
    };
    window.addEventListener('cart:updated', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('cart:updated', handler);
    };
  }, []);

  // ---- Load category ----
  const loadCategory = useCallback(async () => {
    if (!rawParam) {
      setError('Category not specified');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let data: CategoryWithProducts | null = null;

      // Try slug first
      try {
        const bySlug = await categoryService.getCategoryBySlug(rawParam);
        if (bySlug?.id) {
          data = await categoryService.getPublicCategoryWithProducts(
            bySlug.id,
            { productLimit: 200 },
          );
        }
      } catch {
        /* fall through */
      }

      // Fall back to id
      if (!data) {
        data = await categoryService.getPublicCategoryWithProducts(rawParam, {
          productLimit: 200,
        });
      }

      if (!data) {
        setCategory(null);
        setError('Category not found');
      } else {
        setCategory(data);
      }
    } catch (err: any) {
      console.error('Failed to load category:', err);
      setCategory(null);
      setError(
        err?.response?.data?.message ??
          err?.message ??
          'Failed to load category',
      );
    } finally {
      setLoading(false);
    }
  }, [rawParam]);

  useEffect(() => {
    loadCategory();
  }, [loadCategory]);

  // ---- `/` focuses search ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const clearSearch = useCallback(() => setSearchQuery(''), []);

  // ---- Filter products ----
  const filteredProducts = useMemo<CategoryProductPreview[]>(() => {
    if (!category?.products) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return category.products;
    return category.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q) ?? false),
    );
  }, [category?.products, searchQuery]);

  const hasAnyProducts = (category?.products?.length ?? 0) > 0;
  const hasVisibleProducts = filteredProducts.length > 0;
  const isSearching = searchQuery.trim().length > 0;

  // ---- Header props (shared across all render branches) ----
  const headerProps: LinkedInHeaderProps = {
    cartCount,
    active: 'categories',
    searchQuery,
    setSearchQuery,
    searchInputRef,
    viewMode,
    setViewMode,
    resultCount: filteredProducts.length,
    totalCount: category?.products?.length ?? 0,
    onClearSearch: clearSearch,
    categoryName: category?.name,
  };

  // ============================================
  // RENDER — loading
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <LinkedInHeader {...headerProps} />
        <DetailSkeleton />
      </div>
    );
  }

  // ============================================
  // RENDER — not found / error
  // ============================================
  if (error || !category) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <LinkedInHeader {...headerProps} />
        <div className="max-w-3xl mx-auto px-4 pt-32 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 mb-5"
          >
            <FolderTree className="w-10 h-10 text-orange-500" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {error === 'Category not found'
              ? 'Category not found'
              : 'Something went wrong'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
            {error === 'Category not found'
              ? "The category you're looking for doesn't exist or is no longer available."
              : error}
          </p>
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium hover:from-orange-600 hover:to-red-600 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Categories
          </Link>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — main
  // ============================================
  const accent = category.color || '#F97316';
  const productCount = category.productCount ?? category.products.length;
  const childCount = childCountOf(category);
  const featured = isFeatured(category);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <LinkedInHeader {...headerProps} />

      {/* HERO */}
      <div
        className="relative overflow-hidden text-white pt-28 pb-12"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)`,
        }}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 text-white/85 hover:text-white text-sm font-medium mb-5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Categories
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex items-start gap-5 sm:gap-6"
          >
            <CategoryAvatar
              category={category}
              size="xl"
              rounded="xl"
              className="ring-4 ring-white/30 shadow-lg shrink-0"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold truncate">
                  {category.name}
                </h1>
                {featured && (
                  <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-medium">
                    <Star className="w-3 h-3 fill-current" />
                    Featured
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-white/80 font-mono mb-3">
                <Hash className="w-3.5 h-3.5" />
                <span>{category.slug}</span>
              </div>

              {category.description && (
                <p className="text-base text-white/90 max-w-3xl">
                  {category.description}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mt-4 text-sm">
                <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <Package className="w-3.5 h-3.5" />
                  {productCount} product{productCount === 1 ? '' : 's'}
                </span>
                {childCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    {childCount} subcategor{childCount === 1 ? 'y' : 'ies'}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* INVENTORY ROLLUP */}
      {productCount > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <RollupCard
              icon={<Boxes className="w-4 h-4" />}
              label="Total stock"
              value={category.totalStock.toLocaleString()}
              tone="emerald"
            />
            <RollupCard
              icon={<DollarSign className="w-4 h-4" />}
              label="Inventory value"
              value={formatCurrency(category.totalInventoryValue)}
              tone="indigo"
            />
            <RollupCard
              icon={<CheckCircle2 className="w-4 h-4" />}
              label="In stock"
              value={`${category.inStockCount} / ${productCount}`}
              tone="blue"
            />
            <RollupCard
              icon={
                category.outOfStockCount > 0 ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )
              }
              label={
                category.outOfStockCount > 0
                  ? 'Out of stock'
                  : 'Availability'
              }
              value={
                category.outOfStockCount > 0
                  ? category.outOfStockCount.toString()
                  : 'All available'
              }
              tone={category.outOfStockCount > 0 ? 'amber' : 'emerald'}
            />
          </div>
        </div>
      )}

      {/* SUBCATEGORIES */}
      {category.children && category.children.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Subcategories
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({category.children.length})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {category.children.map((subcat, index) => (
              <motion.div
                key={subcat.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.24) }}
                whileHover={{ y: -3 }}
              >
                <Link
                  href={
                    subcat.slug
                      ? `/categories/${subcat.slug}`
                      : `/categories/${subcat.id}`
                  }
                  className="group flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-orange-100 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition-all"
                >
                  <CategoryAvatar
                    category={subcat}
                    size="md"
                    rounded="lg"
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      {subcat.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {productCountOf(subcat)} product
                      {productCountOf(subcat) === 1 ? '' : 's'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* PRODUCTS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        {/* Toolbar — count only; search + view toggle live in the header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Products
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              ({filteredProducts.length}
              {isSearching && ` of ${productCount}`})
            </span>
          </div>
          {isSearching && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Searching for &quot;
              <span className="text-orange-600 dark:text-orange-400 font-medium">
                {searchQuery}
              </span>
              &quot;
            </span>
          )}
        </div>

        {/* Empty states */}
        {!hasAnyProducts ? (
          <EmptyProducts
            variant="empty-category"
            onBrowse={() => router.push('/shop')}
          />
        ) : !hasVisibleProducts ? (
          <EmptyProducts
            variant="no-matches"
            query={searchQuery}
            onClear={clearSearch}
          />
        ) : viewMode === 'grid' ? (
          <ProductGrid products={filteredProducts} />
        ) : (
          <ProductList products={filteredProducts} />
        )}
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

// ---------- Rollup card (unchanged tones) ----------

interface RollupCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: 'blue' | 'emerald' | 'amber' | 'indigo';
}

const ROLLUP_TONES: Record<
  RollupCardProps['tone'],
  { bg: string; text: string; iconBg: string }
> = {
  blue: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-300',
    iconBg: 'bg-orange-100 dark:bg-orange-900/40',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    text: 'text-indigo-700 dark:text-indigo-300',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
  },
};

function RollupCard({ icon, label, value, tone }: RollupCardProps) {
  const t = ROLLUP_TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${t.bg} rounded-2xl p-3.5 sm:p-4 border border-transparent shadow-sm`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${t.iconBg} ${t.text}`}
        >
          {icon}
        </span>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {label}
        </span>
      </div>
      <p
        className={`text-xl sm:text-2xl font-bold ${t.text} tabular-nums truncate`}
      >
        {value}
      </p>
    </motion.div>
  );
}

// ---------- Product grid ----------

function ProductGrid({ products }: { products: CategoryProductPreview[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {products.map((product, index) => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index * 0.03, 0.3) }}
        >
          <ProductCard product={product} />
        </motion.div>
      ))}
    </div>
  );
}

// ---------- Product list ----------

function ProductList({ products }: { products: CategoryProductPreview[] }) {
  return (
    <div className="space-y-3">
      {products.map((product, index) => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index * 0.02, 0.2) }}
        >
          <ProductRow product={product} />
        </motion.div>
      ))}
    </div>
  );
}

// ---------- Product card ----------

function ProductCard({ product }: { product: CategoryProductPreview }) {
  const image = product.image || product.images?.[0]?.url || null;
  const href = product.id ? `/shop/${product.id}` : '#';

  return (
    <Link
      href={href}
      className="group block bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg border border-orange-100 dark:border-gray-700 overflow-hidden transition-all"
    >
      <div className="relative aspect-square bg-orange-50 dark:bg-gray-700/50 overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl font-semibold text-orange-300 dark:text-gray-600">
              {initialsOf(product.name)}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
          {product.name}
        </h3>
        {product.sku && (
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
            {product.sku}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="font-bold text-orange-600 dark:text-orange-400 tabular-nums">
            {formatCurrency(product.unitPrice)}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

// ---------- Product row ----------

function ProductRow({ product }: { product: CategoryProductPreview }) {
  const image = product.image || product.images?.[0]?.url || null;
  const href = product.id ? `/shop/${product.id}` : '#';

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 p-3 rounded-2xl bg-white dark:bg-gray-800 border border-orange-100 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50/40 dark:hover:bg-orange-900/10 transition-all"
    >
      <div className="w-16 h-16 rounded-xl bg-orange-50 dark:bg-gray-700 overflow-hidden shrink-0 flex items-center justify-center">
        {image ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-lg font-semibold text-orange-300 dark:text-gray-500">
            {initialsOf(product.name)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
          {product.name}
        </h3>
        {product.sku && (
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
            {product.sku}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="font-bold text-orange-600 dark:text-orange-400 tabular-nums">
          {formatCurrency(product.unitPrice)}
        </span>
        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

// ---------- Empty products ----------

interface EmptyProductsProps {
  variant: 'empty-category' | 'no-matches';
  query?: string;
  onClear?: () => void;
  onBrowse?: () => void;
}

function EmptyProducts({
  variant,
  query,
  onClear,
  onBrowse,
}: EmptyProductsProps) {
  const isNoMatch = variant === 'no-matches';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-2xl border border-orange-100 dark:border-gray-700 p-12 text-center"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 mb-4">
        {isNoMatch ? (
          <SearchX className="w-8 h-8 text-orange-500" />
        ) : (
          <Package className="w-8 h-8 text-orange-500" />
        )}
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
        {isNoMatch ? 'No products match your search' : 'No products yet'}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
        {isNoMatch
          ? `Nothing matches "${query}". Try a different keyword.`
          : 'This category doesn\u2019t have any products yet. Check back soon or browse the full shop.'}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        {isNoMatch && onClear && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-orange-200 dark:border-gray-600 text-sm font-medium text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
          >
            <SearchX className="w-4 h-4" />
            Clear search
          </button>
        )}
        {!isNoMatch && onBrowse && (
          <button
            onClick={onBrowse}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium hover:from-orange-600 hover:to-red-600 transition-colors shadow-sm"
          >
            <Package className="w-4 h-4" />
            Browse shop
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ---------- Skeleton ----------

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Hero */}
      <div className="bg-orange-100 dark:bg-gray-800 pt-28 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-4 w-32 bg-orange-200 dark:bg-gray-700 rounded mb-5" />
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-orange-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-64 bg-orange-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-40 bg-orange-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-full max-w-lg bg-orange-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Rollups */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-white dark:bg-gray-800 border border-orange-100 dark:border-gray-700"
            />
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white dark:bg-gray-800 border border-orange-100 dark:border-gray-700 overflow-hidden"
            >
              <div className="aspect-square bg-orange-50 dark:bg-gray-700/50" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-3/4 bg-orange-100 dark:bg-gray-700 rounded" />
                <div className="h-3 w-1/2 bg-orange-100 dark:bg-gray-700 rounded" />
                <div className="h-5 w-1/3 bg-orange-100 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
