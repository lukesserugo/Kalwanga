// packages/web/components/categories/CategoryShowcase.tsx

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Package,
  Star,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import { Category } from '../../types/category';
import { categoryService } from '../../services/categoryService';
import { CategoryAvatar } from './CategoryAvatar';

// ============================================
// TYPES
// ============================================

interface CategoryShowcaseProps {
  /** Optional — public categories endpoint will resolve one if omitted. */
  businessUnitId?: string;
  title?: string;
  subtitle?: string;
  /** Max categories to display. */
  limit?: number;
  /** Only show categories marked as featured. */
  featured?: boolean;
  showViewAll?: boolean;
  className?: string;
  /** Where the "View All" button points. Defaults to `/categories`. */
  viewAllHref?: string;
  /**
   * Tile layout:
   *   'tiles' (default) — colorful gradient tiles, compact
   *   'cards'           — richer cards with description + product count
   *   'avatars'         — minimal avatars-only grid, for tight layouts
   */
  variant?: 'tiles' | 'cards' | 'avatars';
  /** Optional link prefix override — defaults to `/categories`. */
  hrefPrefix?: string;
}

// ============================================
// HELPERS
// ============================================

function productCountOf(c: Category): number {
  return c.productCount ?? c._count?.products ?? 0;
}

function isFeatured(c: Category): boolean {
  return (c as any).featured === true;
}

// ============================================
// COMPONENT
// ============================================

export function CategoryShowcase({
  businessUnitId,
  title = 'Shop by Category',
  subtitle = "Find exactly what you're looking for",
  limit = 6,
  featured = false,
  showViewAll = true,
  className = '',
  viewAllHref = '/categories',
  variant = 'tiles',
  hrefPrefix = '/categories',
}: CategoryShowcaseProps) {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Load ----
  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Public route first — works for anonymous visitors.
      let data = await categoryService.getPublicCategories({
        businessUnitId,
        limit: limit * 3, // fetch extra to cover filtering
        featured: featured || undefined,
      });

      // Fallback for authenticated users if public returned nothing
      if ((!data || data.length === 0)) {
        try {
          const authData = await categoryService.getAllCategories({
            businessUnitId,
            limit: limit * 3,
            isActive: true,
          });
          if (Array.isArray(authData) && authData.length > 0) {
            data = authData;
          }
        } catch {
          // swallow — public result stands
        }
      }

      let list = Array.isArray(data) ? data : [];

      // Client-side featured filter (in case the public route didn't apply it)
      if (featured) {
        list = list.filter(isFeatured);
      }

      // Stable ordering: featured first, then by name
      list = [...list].sort((a, b) => {
        const aFeat = isFeatured(a) ? 0 : 1;
        const bFeat = isFeatured(b) ? 0 : 1;
        if (aFeat !== bFeat) return aFeat - bFeat;
        return a.name.localeCompare(b.name);
      });

      setCategories(list.slice(0, limit));
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      setError('Failed to load categories. Please try again.');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [businessUnitId, limit, featured]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // ---- Nav ----
  const goToCategory = useCallback(
    (category: Category) => {
      const path = category.slug
        ? `${hrefPrefix}/${category.slug}`
        : `${hrefPrefix}/${category.id}`;
      router.push(path);
    },
    [router, hrefPrefix],
  );

  const goToViewAll = useCallback(() => {
    router.push(viewAllHref);
  }, [router, viewAllHref]);

  // ---- Derived ----
  const gridClass = useMemo(() => {
    if (variant === 'avatars') {
      return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3';
    }
    if (variant === 'cards') {
      return 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4';
    }
    return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4';
  }, [variant]);

  // ============================================
  // RENDER — loading
  // ============================================
  if (loading) {
    return (
      <Section className={className}>
        <Header
          title={title}
          subtitle={subtitle}
          featured={featured}
          showViewAll={showViewAll}
          viewAllVisible={false}
          onViewAll={goToViewAll}
        />
        <SkeletonGrid variant={variant} limit={limit} />
      </Section>
    );
  }

  // ============================================
  // RENDER — error
  // ============================================
  if (error) {
    return (
      <Section className={className}>
        <Header
          title={title}
          subtitle={subtitle}
          featured={featured}
          showViewAll={showViewAll}
          viewAllVisible={false}
          onViewAll={goToViewAll}
        />
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            onClick={loadCategories}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        </div>
      </Section>
    );
  }

  // ============================================
  // RENDER — empty
  // ============================================
  if (categories.length === 0) {
    return (
      <Section className={className}>
        <Header
          title={title}
          subtitle={subtitle}
          featured={featured}
          showViewAll={showViewAll}
          viewAllVisible={false}
          onViewAll={goToViewAll}
        />
        <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-8 md:p-12 text-center">
          <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 dark:text-white">
            No categories found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {featured
              ? 'No featured categories available yet.'
              : 'Categories will appear here.'}
          </p>
        </div>
      </Section>
    );
  }

  // ============================================
  // RENDER — main
  // ============================================
  return (
    <Section className={className}>
      <Header
        title={title}
        subtitle={subtitle}
        featured={featured}
        showViewAll={showViewAll}
        viewAllVisible={categories.length > 0}
        onViewAll={goToViewAll}
      />

      <div className={gridClass}>
        {categories.map((category, index) =>
          variant === 'avatars' ? (
            <AvatarTile
              key={category.id}
              category={category}
              index={index}
              onClick={() => goToCategory(category)}
            />
          ) : variant === 'cards' ? (
            <CardTile
              key={category.id}
              category={category}
              index={index}
              onClick={() => goToCategory(category)}
            />
          ) : (
            <GradientTile
              key={category.id}
              category={category}
              index={index}
              onClick={() => goToCategory(category)}
            />
          ),
        )}
      </div>
    </Section>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function Section({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`py-8 md:py-12 bg-white dark:bg-gray-900 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

interface HeaderProps {
  title: string;
  subtitle: string;
  featured: boolean;
  showViewAll: boolean;
  viewAllVisible: boolean;
  onViewAll: () => void;
}

function Header({
  title,
  subtitle,
  featured,
  showViewAll,
  viewAllVisible,
  onViewAll,
}: HeaderProps) {
  return (
    <div className="flex flex-wrap justify-between items-end mb-6 md:mb-8 gap-3">
      <div className="min-w-0">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="truncate">{title}</span>
          {featured && (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
              <Star className="w-3 h-3 fill-current" />
              Featured
            </span>
          )}
        </h2>
        {subtitle && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {showViewAll && (
        <button
          onClick={onViewAll}
          disabled={!viewAllVisible}
          className={`group inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
            viewAllVisible
              ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
              : 'text-gray-400 dark:text-gray-600 cursor-default opacity-60'
          }`}
          aria-label="View all categories"
        >
          View All
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}

// ---------- Gradient tile (compact, decorative) ----------

interface TileProps {
  category: Category;
  index: number;
  onClick: () => void;
}

function GradientTile({ category, index, onClick }: TileProps) {
  const accent = category.color || '#3B82F6';
  const featured = isFeatured(category);
  const productCount = productCountOf(category);

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl p-4 md:p-5 text-center text-white shadow-sm hover:shadow-xl transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
      style={{
        background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)`,
      }}
      aria-label={`Browse ${category.name}`}
    >
      {/* Decorative circles */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300">
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white" />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white" />
      </div>

      {/* Featured star */}
      {featured && (
        <div className="absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 backdrop-blur">
          <Star className="w-3 h-3 fill-white text-white" />
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center">
        {/* Avatar */}
        <div className="mb-2.5">
          <CategoryAvatar
            category={category}
            size="md"
            rounded="xl"
            className="ring-2 ring-white/30 shadow-sm"
          />
        </div>

        <h3 className="font-semibold text-sm md:text-base line-clamp-1">
          {category.name}
        </h3>

        {productCount > 0 && (
          <p className="text-xs text-white/80 mt-0.5">
            {productCount} {productCount === 1 ? 'product' : 'products'}
          </p>
        )}
      </div>
    </motion.button>
  );
}

// ---------- Card tile (richer, description + count) ----------

function CardTile({ category, index, onClick }: TileProps) {
  const accent = category.color || '#3B82F6';
  const featured = isFeatured(category);
  const productCount = productCountOf(category);

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
      aria-label={`Browse ${category.name}`}
    >
      {/* Accent strip */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: accent }}
      />

      {/* Image area */}
      <div
        className="relative h-28 flex items-center justify-center"
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
          <div className="absolute top-2 right-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
            <Star className="w-2.5 h-2.5 fill-current" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5">
        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {category.name}
        </h3>

        {category.description ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 min-h-[2rem]">
            {category.description}
          </p>
        ) : (
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1 italic line-clamp-2 min-h-[2rem]">
            Explore {category.name}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Package className="w-3 h-3" />
            {productCount}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-gray-400 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </motion.button>
  );
}

// ---------- Avatar tile (minimal) ----------

function AvatarTile({ category, index, onClick }: TileProps) {
  const featured = isFeatured(category);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.03, 0.25) }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="group flex flex-col items-center gap-2 p-2 rounded-2xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
      aria-label={`Browse ${category.name}`}
    >
      <div className="relative">
        <CategoryAvatar
          category={category}
          size="lg"
          rounded="full"
          className="ring-2 ring-white dark:ring-gray-800 shadow-sm transition-transform group-hover:scale-105"
        />
        {featured && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-amber-900 shadow">
            <Star className="w-2.5 h-2.5 fill-current" />
          </span>
        )}
      </div>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {category.name}
      </span>
    </motion.button>
  );
}

// ---------- Skeleton ----------

interface SkeletonProps {
  variant: NonNullable<CategoryShowcaseProps['variant']>;
  limit: number;
}

function SkeletonGrid({ variant, limit }: SkeletonProps) {
  const count = Math.min(limit, variant === 'avatars' ? 8 : 6);
  const gridClass =
    variant === 'avatars'
      ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3'
      : variant === 'cards'
        ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4'
        : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4';

  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, i) =>
        variant === 'avatars' ? (
          <div
            key={i}
            className="flex flex-col items-center gap-2 p-2 animate-pulse"
          >
            <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ) : variant === 'cards' ? (
          <div
            key={i}
            className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse"
          >
            <div className="h-1 bg-gray-200 dark:bg-gray-700" />
            <div className="h-28 bg-gray-100 dark:bg-gray-700/50" />
            <div className="p-3.5 space-y-2">
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ) : (
          <div
            key={i}
            className="rounded-2xl bg-gray-100 dark:bg-gray-700/60 h-28 md:h-32 animate-pulse"
          />
        ),
      )}
    </div>
  );
}

export default CategoryShowcase;
