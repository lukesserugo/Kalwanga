// D:\Projects\Kalwanga\packages\web\components\categories\CategoryCard.tsx

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Category } from '../../types/category';
import { 
  Package, 
  ChevronRight, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Star, 
  StarOff,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface CategoryCardProps {
  category: Category;
  variant?: 'default' | 'featured' | 'compact' | 'minimal';
  className?: string;
  onEdit?: (category: Category) => void;
  onDelete?: (category: Category) => void;
  onView?: (category: Category) => void;
  onToggleStatus?: (category: Category) => void;
  showActions?: boolean;
}

const colorClasses = [
  'from-blue-400 to-blue-600',
  'from-green-400 to-green-600',
  'from-purple-400 to-purple-600',
  'from-yellow-400 to-yellow-600',
  'from-pink-400 to-pink-600',
  'from-indigo-400 to-indigo-600',
  'from-orange-400 to-orange-600',
  'from-teal-400 to-teal-600',
  'from-red-400 to-red-600',
  'from-cyan-400 to-cyan-600',
  'from-rose-400 to-rose-600',
  'from-amber-400 to-amber-600',
];

const icons = ['📱', '👕', '📚', '🏠', '⚽', '🧸', '💄', '🍕', '🚗', '💊', '🌿', '👶'];

export function CategoryCard({
  category,
  variant = 'default',
  className = '',
  onEdit,
  onDelete,
  onView,
  onToggleStatus,
  showActions = false
}: CategoryCardProps) {
  const colorIndex = parseInt(category.id.slice(0, 2), 16) % colorClasses.length;
  const iconIndex = parseInt(category.id.slice(0, 2), 16) % icons.length;
  const productCount = (category as any).productCount || 0;
  const featured = (category as any).featured || false;

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition-all ${className}`}>
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${colorClasses[colorIndex]} flex items-center justify-center text-sm flex-shrink-0`}>
          {icons[iconIndex]}
        </div>
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">{category.name}</span>
        {!category.isActive && <EyeOff className="w-3 h-3 text-gray-400" />}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={() => onView?.(category)}
        className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all hover:scale-105 w-full text-left ${className}`}
      >
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${colorClasses[colorIndex]} flex items-center justify-center text-xl flex-shrink-0`}>
          {icons[iconIndex]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">{category.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{productCount} products</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>
    );
  }

  if (variant === 'featured') {
    return (
      <motion.div
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
        className={`relative overflow-hidden rounded-2xl ${className}`}
      >
        <button onClick={() => onView?.(category)} className="block w-full text-left">
          <div className={`h-48 bg-gradient-to-r ${colorClasses[colorIndex]} p-6 text-white`}>
            <div className="text-5xl mb-3">{icons[iconIndex]}</div>
            <h3 className="text-xl font-bold">{category.name}</h3>
            {category.description && (
              <p className="text-sm text-white/80 mt-1 line-clamp-2">{category.description}</p>
            )}
            <div className="mt-3 flex items-center gap-2 text-sm text-white/80">
              <span>{productCount} products</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
          {featured && (
            <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-xs px-2 py-1 rounded-full font-medium">
              ⭐ Featured
            </div>
          )}
          {!category.isActive && (
            <div className="absolute top-3 left-3 bg-gray-800/80 text-white text-xs px-2 py-1 rounded-full font-medium">
              <EyeOff className="w-3 h-3 inline mr-1" />
              Inactive
            </div>
          )}
        </button>
      </motion.div>
    );
  }

  // Default variant
  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 ${className}`}
    >
      <button onClick={() => onView?.(category)} className="block w-full text-left">
        <div className={`h-32 bg-gradient-to-r ${colorClasses[colorIndex]} flex items-center justify-center text-5xl relative`}>
          {icons[iconIndex]}
          {!category.isActive && (
            <div className="absolute top-2 right-2 bg-gray-800/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <EyeOff className="w-3 h-3" />
              Inactive
            </div>
          )}
          {featured && (
            <div className="absolute top-2 left-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                {category.name}
              </h3>
              {category.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {category.description}
                </p>
              )}
            </div>
            {onToggleStatus && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStatus(category);
                }}
                className={`p-1 rounded-full transition-colors ${
                  category.isActive 
                    ? 'text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30' 
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={category.isActive ? 'Deactivate' : 'Activate'}
              >
                {category.isActive ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Package className="w-3 h-3" />
              {productCount} products
            </span>
            {showActions && (
              <div className="flex items-center gap-1">
                {onView && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onView(category);
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(category);
                    }}
                    className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4 text-blue-600" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(category);
                    }}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </button>
    </motion.div>
  );
}
