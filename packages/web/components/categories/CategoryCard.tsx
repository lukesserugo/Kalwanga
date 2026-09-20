// packages/web/components/categories/CategoryCard.tsx

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Category } from '../../types/category';
import { CategoryAvatar } from './CategoryAvatar';
import {
  Package,
  ChevronRight,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Star,
  StarOff,
  CheckCircle2,
  XCircle,
  Layers,
  Hash,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface CategoryCardProps {
  category: Category;
  variant?: 'default' | 'featured' | 'compact' | 'minimal';
  className?: string;
  onEdit?: (category: Category) => void;
  onDelete?: (category: Category) => void;
  onView?: (category: Category) => void;
  onToggleStatus?: (category: Category) => void;
  showActions?: boolean;
  /** Optional href override — defaults to `/categories/{slug}`. */
  href?: string;
}

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
// COMPONENT
// ============================================

export function CategoryCard({
  category,
  variant = 'default',
  className = '',
  onEdit,
  onDelete,
  onView,
  onToggleStatus,
  showActions = false,
  href,
}: CategoryCardProps) {
  const productCount = productCountOf(category);
  const childCount = childCountOf(category);
  const featured = isFeatured(category);
  const accent = category.color || '#3B82F6';
  const detailHref = href ?? `/categories/${category.slug}`;

  // Shared click handler for the primary action (view details)
  const handlePrimaryAction = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (onView) onView(category);
  };

  // ============================================
  // MINIMAL
  // ============================================
  if (variant === 'minimal') {
    return (
      <button
        onClick={handlePrimaryAction}
        className={`group flex items-center gap-2.5 p-2 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/40 border border-transparent transition-all text-left w-full ${className}`}
      >
        <CategoryAvatar category={category} size="sm" rounded="lg" />
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
          {category.name}
        </span>
        {!category.isActive && (
          <EyeOff className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        )}
        {featured && (
          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
        )}
      </button>
    );
  }

  // ============================================
  // COMPACT
  // ============================================
  if (variant === 'compact') {
    return (
      <motion.button
        whileHover={{ x: 2 }}
        onClick={handlePrimaryAction}
        className={`group flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/40 transition-all w-full text-left ${className}`}
      >
        <CategoryAvatar category={category} size="md" rounded="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {category.name}
            </p>
            {featured && (
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {productCount} {productCount === 1 ? 'product' : 'products'}
            {childCount > 0 && ` · ${childCount} sub`}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </motion.button>
    );
  }

  // ============================================
  // FEATURED
  // ============================================
  if (variant === 'featured') {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`relative overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition-shadow ${className}`}
      >
        <button
          onClick={handlePrimaryAction}
          className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 rounded-2xl"
        >
          {/* Hero area */}
          <div
            className="relative h-48 p-6 text-white overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)`,
            }}
          >
            {/* Subtle pattern overlay */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />

            <div className="relative flex flex-col h-full">
              {/* Avatar */}
              <div className="mb-3">
                <CategoryAvatar
                  category={category}
                  size="lg"
                  rounded="xl"
                  className="ring-2 ring-white/40 shadow-lg"
                />
              </div>

              <div className="flex-1">
                <h3 className="text-xl font-bold text-white line-clamp-1">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-sm text-white/85 mt-1 line-clamp-2">
                    {category.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm text-white/85 mt-3">
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
                <ChevronRight className="w-4 h-4 ml-auto" />
              </div>
            </div>

            {/* Featured badge */}
            {featured && (
              <div className="absolute top-3 right-3 inline-flex items-center gap-1 bg-amber-400 text-amber-900 text-xs px-2 py-1 rounded-full font-semibold shadow-sm">
                <Star className="w-3 h-3 fill-current" />
                Featured
              </div>
            )}

            {/* Inactive badge */}
            {!category.isActive && (
              <div className="absolute top-3 left-3 inline-flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-medium">
                <EyeOff className="w-3 h-3" />
                Inactive
              </div>
            )}
          </div>
        </button>
      </motion.div>
    );
  }

  // ============================================
  // DEFAULT
  // ============================================
  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      className={`group relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 ${className}`}
    >
      {/* Accent strip */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: accent }}
      />

      <button
        onClick={handlePrimaryAction}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        {/* Hero image area */}
        <div
          className="relative h-32 flex items-center justify-center overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${accent}1A 0%, ${accent}0D 100%)`,
          }}
        >
          {/* Background watermark — the avatar, large and faint */}
          <div className="opacity-20 group-hover:opacity-30 transition-opacity">
            <CategoryAvatar
              category={category}
              size="xl"
              rounded="xl"
              className="!w-24 !h-24"
            />
          </div>

          {/* Foreground avatar */}
          <div className="absolute inset-0 flex items-center justify-center">
            <CategoryAvatar
              category={category}
              size="lg"
              rounded="xl"
              className="shadow-md ring-4 ring-white dark:ring-gray-800 transition-transform group-hover:scale-105"
            />
          </div>

          {/* Featured star */}
          {featured && (
            <div className="absolute top-2 left-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              <Star className="w-3 h-3 fill-current" />
            </div>
          )}

          {/* Inactive badge */}
          {!category.isActive && (
            <div className="absolute top-2 right-2 inline-flex items-center gap-1 bg-gray-800/80 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
              <EyeOff className="w-3 h-3" />
              Inactive
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4">
          {/* Name */}
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
            {category.name}
          </h3>

          {/* Slug */}
          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 font-mono">
            <Hash className="w-2.5 h-2.5" />
            <span className="truncate">{category.slug}</span>
          </div>

          {/* Description */}
          {category.description ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 min-h-[2.5rem]">
              {category.description}
            </p>
          ) : (
            <p className="text-sm italic text-gray-300 dark:text-gray-600 mt-2 line-clamp-2 min-h-[2.5rem]">
              No description
            </p>
          )}

          {/* Footer meta */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                <Package className="w-3.5 h-3.5" />
                {productCount}
              </span>
              {childCount > 0 && (
                <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <Layers className="w-3.5 h-3.5" />
                  {childCount}
                </span>
              )}
            </div>

            {/* Status toggle */}
            {onToggleStatus && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleStatus(category);
                }}
                className={`p-1 rounded-full transition-colors ${
                  category.isActive
                    ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={category.isActive ? 'Deactivate' : 'Activate'}
                aria-label={
                  category.isActive ? 'Deactivate category' : 'Activate category'
                }
              >
                {category.isActive ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </button>

      {/* Hover actions overlay */}
      {showActions && (onEdit || onDelete || onView) && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-0.5 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-0.5">
            {onView && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView(category);
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="View details"
                aria-label="View details"
              >
                <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(category);
                }}
                className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                title="Edit"
                aria-label="Edit category"
              >
                <Edit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(category);
                }}
                className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                title="Delete"
                aria-label="Delete category"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default CategoryCard;
