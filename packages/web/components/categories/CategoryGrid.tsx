'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FolderTree, Plus } from 'lucide-react';
import { Category } from '../../types/category';
import { CategoryCard } from './CategoryCard';

interface CategoryGridProps {
  categories: Category[];
  onEdit?: (category: Category) => void;
  onDelete?: (category: Category) => void;
  onView?: (category: Category) => void;
  onToggleStatus?: (category: Category) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  isLoading?: boolean;
  className?: string;
  emptyMessage?: string;
  emptySubMessage?: string;
  columns?: 2 | 3 | 4 | 5;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
  cardVariant?: 'default' | 'featured' | 'compact' | 'minimal';
}

const COLUMN_CLASSES: Record<NonNullable<CategoryGridProps['columns']>, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
};

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
};

export function CategoryGrid({
  categories,
  onEdit,
  onDelete,
  onView,
  onToggleStatus,
  canEdit = true,
  canDelete = true,
  isLoading = false,
  className = '',
  emptyMessage = 'No categories found',
  emptySubMessage = 'Start by creating your first category',
  columns = 4,
  showCreateButton = false,
  onCreateClick,
  cardVariant = 'default',
}: CategoryGridProps) {
  const columnClass = COLUMN_CLASSES[columns];

  if (isLoading) {
    return <CategoryGridSkeleton columns={columns} className={className} />;
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        message={emptyMessage}
        subMessage={emptySubMessage}
        showCreateButton={showCreateButton}
        onCreateClick={onCreateClick}
      />
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={CONTAINER_VARIANTS}
      className={`grid ${columnClass} gap-4 ${className}`}
    >
      {categories.map((category) => (
        <motion.div
          key={category.id}
          variants={ITEM_VARIANTS}
          className="h-full"
        >
          <CategoryCard
            category={category}
            variant={cardVariant}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            onToggleStatus={onToggleStatus}
            showActions={true}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

interface SkeletonProps {
  columns: NonNullable<CategoryGridProps['columns']>;
  className: string;
}

function CategoryGridSkeleton({ columns, className }: SkeletonProps) {
  const columnClass = COLUMN_CLASSES[columns];
  const count = columns * 2;

  return (
    <div className={`grid ${columnClass} gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: Math.min(i * 0.04, 0.3) }}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-pulse"
        >
          <div className="h-1 bg-gray-200 dark:bg-gray-700" />
          <div className="relative h-32 bg-gray-100 dark:bg-gray-700/50" />
          <div className="p-4 space-y-3">
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="space-y-2 pt-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-5/6 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="pt-2 flex items-center justify-between">
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  message: string;
  subMessage: string;
  showCreateButton: boolean;
  onCreateClick?: () => void;
}

function EmptyState({
  message,
  subMessage,
  showCreateButton,
  onCreateClick,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="text-center py-16 px-4"
    >
      <motion.div
        animate={{
          y: [0, -6, 0],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          repeatDelay: 1.6,
          ease: 'easeInOut',
        }}
        className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-100 to-secondary-100 dark:from-brand-900/30 dark:to-secondary-900/30 mb-5"
      >
        <FolderTree className="w-10 h-10 text-brand-600 dark:text-brand-400" />
      </motion.div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {message}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-sm mx-auto">
        {subMessage}
      </p>

      {showCreateButton && onCreateClick && (
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onCreateClick}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-gradient text-white rounded-xl text-sm font-medium shadow-brand hover:shadow-brand-lg transition-all focus-ring"
        >
          <Plus className="w-4 h-4" />
          Create Category
        </motion.button>
      )}
    </motion.div>
  );
}

export default CategoryGrid;
