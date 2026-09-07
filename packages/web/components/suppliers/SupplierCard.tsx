// D:\Projects\Kalwanga\packages\web\components\suppliers\SupplierCard.tsx

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Truck, Mail, Phone, MapPin, User, Star, StarHalf, Edit, Trash2, Eye } from 'lucide-react';
import { Supplier } from '../../types/supplier';

interface SupplierCardProps {
  supplier: Supplier;
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (supplier: Supplier) => void;
  onView?: (supplier: Supplier) => void;
  showActions?: boolean;
}

export function SupplierCard({
  supplier,
  variant = 'default',
  className = '',
  onEdit,
  onDelete,
  onView,
  showActions = false
}: SupplierCardProps) {
  const renderStars = (rating: number = 0) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
        ))}
        {hasHalfStar && <StarHalf className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="w-3 h-3 text-gray-300 dark:text-gray-600" />
        ))}
        {rating > 0 && (
          <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
        )}
      </div>
    );
  };

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition-all ${className}`}>
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
          <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">{supplier.name}</span>
        {!supplier.isActive && <span className="text-xs text-gray-400">Inactive</span>}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all ${className}`}>
        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
          <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">{supplier.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{supplier.email}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          supplier.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
        }`}>
          {supplier.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-gray-100 dark:border-gray-700 ${className}`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{supplier.name}</h3>
              {supplier.contactPerson && (
                <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <User className="w-3 h-3" />
                  <span>{supplier.contactPerson}</span>
                </div>
              )}
            </div>
          </div>
          {showActions && (
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              {onView && (
                <button onClick={() => onView(supplier)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="View">
                  <Eye className="w-4 h-4 text-gray-500" />
                </button>
              )}
              {onEdit && (
                <button onClick={() => onEdit(supplier)} className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Edit">
                  <Edit className="w-4 h-4 text-blue-600" />
                </button>
              )}
              {onDelete && (
                <button onClick={() => onDelete(supplier)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="truncate">{supplier.email}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Phone className="w-4 h-4 text-gray-400" />
            <span>{supplier.phone}</span>
          </div>
          {supplier.address && (
            <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              <span className="text-xs truncate">{supplier.address}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          {renderStars(supplier.rating || 0)}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {(supplier as any).productCount || (supplier as any)._count?.products || 0} products
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              supplier.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
            }`}>
              {supplier.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
