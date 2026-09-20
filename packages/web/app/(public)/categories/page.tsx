// packages/web/app/categories/page.tsx

'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Search,
  Grid3x3,
  List as ListIcon,
  X,
  Star,
  Package,
  Layers,
  ChevronRight,
  FolderTree,
  Sparkles,
  ArrowUpDown,
  Hash,
  SearchX,
} from 'lucide-react';

import { categoryService } from '../../../services/categoryService';
import { cartService } from '../../../services/cartService';
import { CategoryAvatar } from '../../../components/categories/CategoryAvatar';
import { useThemeStore } from '../../stores/themeStore';
import type { Category } from '../../../types/category';

// ============================================
// HELPERS
// ============================================

function productCountOf(c: Category): number {
  return c.productCount ?? c._count?.products ?? 0;
}

function childCountOf(c: Category): number {
  return c.childCount ?? c._count?.children ?? 0;
}

function isFeatured(c: Category): boolean {
  return (c as any).featured === true;
}

// ============================================
// TYPES
// ============================================

type SortKey = 'name' | 'products' | 'featured';
type ViewMode = 'grid' | 'list';

// ============================================
// PAGE
// ============================================

export default function PublicCategoriesPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortKey>('featured');
  const [cartCount, setCartCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ---- Cart count ----
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

  // ---- Load categories (public, no auth) ----
  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await categoryService.getPublicCategories({ limit: 200 });
      setCategories(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      setError('Failed to load categories. Please try again.');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

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

  // ---- Featured spotlight ----
  const featuredCategories = useMemo(
    () => categories.filter(isFeatured).slice(0, 4),
    [categories],
  );

  // ---- Filter + sort ----
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = categories;

    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          (c.description?.toLowerCase().includes(q) ?? false),
      );
    }

    const sorted = [...list];
    switch (sortBy) {
      case 'products':
        sorted.sort((a, b) => productCountOf(b) - productCountOf(a));
        break;
      case 'featured':
        sorted.sort((a, b) => {
          const af = isFeatured(a) ? 1 : 0;
          const bf = isFeatured(b) ? 1 : 0;
          if (bf !== af) return bf - af;
          return a.name.localeCompare(b.name);
        });
        break;
      case 'name':
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [categories, searchQuery, sortBy]);

  const goToCategory = useCallback(
    (category: Category) => {
      const path = category.slug
        ? `/categories/${category.slug}`
        : `/categories/${category.id}`;
      router.push(path);
    },
    [router],
  );

  const isFiltered = searchQuery.trim().length > 0;

  // ============================================
  // RENDER — loading
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Hero categoryCount={0} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <CategoriesSkeleton />
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — main
  // ============================================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Hero categoryCount={categories.length} />

      {/* FEATURED SPOTLIGHT */}
      {featuredCategories.length > 0 && !searchQuery && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Featured categories
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {featuredCategories.map((category, index) => (
              <FeaturedCard
                key={category.id}
                category={category}
                index={index}
                onClick={() => goToCategory(category)}
              />
            ))}
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        {/* SEARCH + CONTROLS */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search categories…  (press / to focus)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 border border-orange-100 dark:border-gray-700 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors hover:bg-orange-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-4 h-4 text-gray-400 hidden sm:block" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="pl-3 pr-8 py-2.5 rounded-xl text-sm font-medium border border-orange-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400/20 appearance-none cursor-pointer shadow-sm"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  backgroundSize: '14px',
                }}
              >
                <option value="featured">Featured first</option>
                <option value="name">Name A–Z</option>
                <option value="products">Most products</option>
              </select>
            </div>

            {/* View toggle */}
            <div className="flex gap-0.5 rounded-xl p-0.5 bg-white dark:bg-gray-800 border border-orange-100 dark:border-gray-700 shadow-sm">
              {(
                [
                  { key: 'grid', icon: Grid3x3, label: 'Grid view' },
                  { key: 'list', icon: ListIcon, label: 'List view' },
                ] as const
              ).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === key
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-700'
                  }`}
                  aria-label={label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RESULT COUNT */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 tabular-nums">
            {filteredCategories.length}{' '}
            categor{filteredCategories.length === 1 ? 'y' : 'ies'}
            {isFiltered && (
              <span className="text-gray-400 dark:text-gray-500">
                {' '}
                of {categories.length}
              </span>
            )}
          </span>
          {isFiltered && (
            <button
              onClick={clearSearch}
              className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium"
            >
              <X className="w-3 h-3" />
              Clear search
            </button>
          )}
        </div>

        {error ? (
          <ErrorState message={error} onRetry={loadCategories} />
        ) : filteredCategories.length === 0 ? (
          <EmptyState
            hasSearch={!!searchQuery}
            hasAny={categories.length > 0}
            onClear={clearSearch}
          />
        ) : viewMode === 'grid' ? (
          <GridView
            categories={filteredCategories}
            onSelect={goToCategory}
          />
        ) : (
          <ListView
            categories={filteredCategories}
            onSelect={goToCategory}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

// ---------- Hero ----------

interface HeroProps {
  categoryCount: number;
}

function Hero({ categoryCount }: HeroProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 text-white pt-16 pb-12">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-yellow-300 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-orange-200 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
            Browse Categories
          </h1>
          <p className="text-base sm:text-lg text-orange-100 max-w-2xl">
            {categoryCount > 0
              ? `Discover products across ${categoryCount} categor${categoryCount === 1 ? 'y' : 'ies'}`
              : 'Explore our product categories'}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// ---------- Featured card ----------

interface FeaturedCardProps {
  category: Category;
  index: number;
  onClick: () => void;
}

function FeaturedCard({ category, index, onClick }: FeaturedCardProps) {
  const accent = category.color || '#F97316';
  const productCount = productCountOf(category);

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.2) }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl p-4 sm:p-5 text-left text-white shadow-sm hover:shadow-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500"
      style={{
        background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)`,
      }}
      aria-label={`Browse ${category.name}`}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity">
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white" />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white" />
      </div>

      <div className="relative z-10 flex items-center gap-3">
        <CategoryAvatar
          category={category}
          size="md"
          rounded="xl"
          className="ring-2 ring-white/30 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm sm:text-base truncate">
              {category.name}
            </h3>
            <Star className="w-3 h-3 fill-white text-white shrink-0" />
          </div>
          {productCount > 0 && (
            <p className="text-xs text-white/80 mt-0.5">
              {productCount} product{productCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-white/70 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </motion.button>
  );
}

// ---------- Grid view ----------

interface ViewProps {
  categories: Category[];
  onSelect: (category: Category) => void;
}

function GridView({ categories, onSelect }: ViewProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
      }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
    >
      {categories.map((category, index) => (
        <motion.div
          key={category.id}
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
          }}
        >
          <GridCard
            category={category}
            index={index}
            onClick={() => onSelect(category)}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

interface GridCardProps {
  category: Category;
  index: number;
  onClick: () => void;
}

function GridCard({ category, onClick }: GridCardProps) {
  const accent = category.color || '#F97316';
  const featured = isFeatured(category);
  const productCount = productCountOf(category);
  const childCount = childCountOf(category);

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-orange-100 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 w-full"
      aria-label={`Browse ${category.name}`}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: accent }}
      />

      <div
        className="relative h-32 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${accent}1A 0%, ${accent}0D 100%)`,
        }}
      >
        <CategoryAvatar
          category={category}
          size="lg"
          rounded="xl"
          className="shadow-md ring-4 ring-white dark:ring-gray-800 transition-transform group-hover:scale-105"
        />

        {featured && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
            <Star className="w-2.5 h-2.5 fill-current" />
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
          {category.name}
        </h3>

        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 font-mono">
          <Hash className="w-2.5 h-2.5" />
          <span className="truncate">{category.slug}</span>
        </div>

        {category.description ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 min-h-[2.5rem]">
            {category.description}
          </p>
        ) : (
          <p className="text-sm italic text-gray-300 dark:text-gray-600 mt-2 line-clamp-2 min-h-[2.5rem]">
            Explore {category.name}
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              {productCount}
            </span>
            {childCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                {childCount}
              </span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </button>
  );
}

// ---------- List view ----------

function ListView({ categories, onSelect }: ViewProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
      }}
      className="space-y-2.5"
    >
      {categories.map((category) => (
        <motion.div
          key={category.id}
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0 },
          }}
        >
          <ListRow category={category} onClick={() => onSelect(category)} />
        </motion.div>
      ))}
    </motion.div>
  );
}

function ListRow({
  category,
  onClick,
}: {
  category: Category;
  onClick: () => void;
}) {
  const accent = category.color || '#F97316';
  const featured = isFeatured(category);
  const productCount = productCountOf(category);
  const childCount = childCountOf(category);

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 w-full p-3 sm:p-4 rounded-2xl bg-white dark:bg-gray-800 border border-orange-100 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500"
      aria-label={`Browse ${category.name}`}
    >
      <span
        className="hidden sm:block w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: accent }}
      />

      <CategoryAvatar
        category={category}
        size="lg"
        rounded="xl"
        className="shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
            {category.name}
          </h3>
          {featured && (
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 font-mono">
          <Hash className="w-2.5 h-2.5" />
          <span className="truncate">{category.slug}</span>
        </div>
        {category.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
            {category.description}
          </p>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 shrink-0">
        <span className="inline-flex items-center gap-1">
          <Package className="w-3.5 h-3.5" />
          {productCount}
        </span>
        {childCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            {childCount}
          </span>
        )}
      </div>

      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}

// ---------- Empty state ----------

interface EmptyStateProps {
  hasSearch: boolean;
  hasAny: boolean;
  onClear: () => void;
}

function EmptyState({ hasSearch, hasAny, onClear }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-orange-100 dark:border-gray-700 p-12 text-center"
    >
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 mb-5">
        {hasSearch ? (
          <SearchX className="w-10 h-10 text-orange-500" />
        ) : (
          <FolderTree className="w-10 h-10 text-orange-500" />
        )}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {hasSearch ? 'No matching categories' : 'No categories yet'}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
        {hasSearch
          ? "We couldn't find any categories matching your search. Try different keywords."
          : hasAny
            ? 'Categories will appear here soon.'
            : 'Check back later — the store is still being set up.'}
      </p>

      {hasSearch && (
        <button
          onClick={onClear}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium hover:from-orange-600 hover:to-red-600 transition-colors shadow-sm"
        >
          <X className="w-4 h-4" />
          Clear search
        </button>
      )}
    </motion.div>
  );
}

// ---------- Error state ----------

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-8 text-center">
      <p className="text-sm text-red-700 dark:text-red-300 mb-3">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium hover:from-orange-600 hover:to-red-600 transition-colors shadow-sm"
      >
        Try again
      </button>
    </div>
  );
}

// ---------- Skeleton ----------

function CategoriesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-orange-100 dark:bg-gray-700/60 animate-pulse"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white dark:bg-gray-800 border border-orange-100 dark:border-gray-700 overflow-hidden animate-pulse"
          >
            <div className="h-1 bg-orange-200 dark:bg-gray-700" />
            <div className="h-32 bg-orange-50 dark:bg-gray-700/50" />
            <div className="p-4 space-y-3">
              <div className="h-4 w-3/4 bg-orange-100 dark:bg-gray-700 rounded" />
              <div className="h-3 w-1/2 bg-orange-100 dark:bg-gray-700 rounded" />
              <div className="space-y-2 pt-1">
                <div className="h-3 bg-orange-100 dark:bg-gray-700 rounded" />
                <div className="h-3 w-5/6 bg-orange-100 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
