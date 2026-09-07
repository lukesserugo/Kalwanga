// D:\Projects\Kalwanga\packages\web\components\categories\CategoryGrid.tsx

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Category } from '../../types/category';
import { CategoryCard } from './CategoryCard';

interface CategoryGridProps {
  categories: Category[];
  onEdit?: (category: Category) => void;
  onDelete?: (category: Category) => void;
  onView?: (category: Category) => void;
  onToggleStatus?: (category: Category) => void;
  isLoading?: boolean;
  className?: string;
  emptyMessage?: string;
  emptySubMessage?: string;
  columns?: 2 | 3 | 4 | 5;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
}

export function CategoryGrid({
  categories,
  onEdit,
  onDelete,
  onView,
  onToggleStatus,
  isLoading = false,
  className = '',
  emptyMessage = 'No categories found',
  emptySubMessage = 'Start by creating your first category',
  columns = 4,
  showCreateButton = false,
  onCreateClick,
}: CategoryGridProps) {
  const columnClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut',
      },
    },
  };

  if (isLoading) {
    return (
      <div className={`grid ${columnClasses[columns]} gap-4 ${className}`}>
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-gray-100 dark:bg-gray-700 rounded-xl h-48 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center py-12"
      >
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
            rotate: [0, -5, 5, 0]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3
          }}
          className="text-6xl mb-4"
        >
          📂
        </motion.div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{emptyMessage}</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">{emptySubMessage}</p>
        {showCreateButton && onCreateClick && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCreateClick}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <span>+</span>
            Create Category
          </motion.button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={`grid ${columnClasses[columns]} gap-4 ${className}`}
    >
      {categories.map((category) => (
        <motion.div
          key={category.id}
          variants={itemVariants}
          whileHover={{ y: -4 }}
          className="h-full"
        >
          <CategoryCard
            category={category}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            onToggleStatus={onToggleStatus}
            showActions={true}
            variant="default"
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

export default CategoryGrid;
