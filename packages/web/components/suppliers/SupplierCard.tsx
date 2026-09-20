// D:\Projects\Kalwanga\packages\web\components\suppliers\SupplierCard.tsx

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Truck,
  Mail,
  Phone,
  MapPin,
  User,
  Star,
  StarHalf,
  Edit,
  Trash2,
  Eye,
} from 'lucide-react';
import type { Supplier } from '../../types/supplier';

// ============================================
// TYPES
// ============================================

interface SupplierCardProps {
  supplier: Supplier;
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (supplier: Supplier) => void;
  onView?: (supplier: Supplier) => void;
  showActions?: boolean;
}

// ============================================
// HELPERS
// ============================================

/**
 * Returns a trimmed string, or `undefined` if the value is not a
 * non-empty string. Guards against `null`, `undefined`, `0`, `false`,
 * and `"   "`.
 */
function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Returns a finite number, or `undefined`. Guards against `NaN`,
 * `Infinity`, `null`, `undefined`, and non-numeric strings.
 */
function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Safely read the product count from any of the shapes the backend
 * may return:
 *   - `supplier.productCount`
 *   - `supplier._count.products`
 *   - `supplier.products.length`
 */
function getProductCount(supplier: Supplier): number {
  const s = supplier as any;
  const direct = asFiniteNumber(s?.productCount);
  if (direct !== undefined) return Math.max(0, Math.floor(direct));

  const counted = asFiniteNumber(s?._count?.products);
  if (counted !== undefined) return Math.max(0, Math.floor(counted));

  if (Array.isArray(s?.products)) return s.products.length;

  return 0;
}

/**
 * Determine the "active" state. Defaults to `true` when the field is
 * missing so we don't accidentally badge a valid supplier as inactive.
 */
function isSupplierActive(supplier: Supplier): boolean {
  const s = supplier as any;
  if (typeof s?.isActive === 'boolean') return s.isActive;
  // Some backends expose `status` instead of `isActive`.
  if (typeof s?.status === 'string') {
    return s.status.toUpperCase() === 'ACTIVE';
  }
  return true;
}

// ============================================
// STARS
// ============================================

interface StarRatingProps {
  rating?: number;
  size?: 'sm' | 'md';
}

function StarRating({ rating = 0, size = 'sm' }: StarRatingProps) {
  const safeRating = Math.max(0, Math.min(5, asFiniteNumber(rating) ?? 0));
  const fullStars = Math.floor(safeRating);
  const hasHalfStar = safeRating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${safeRating.toFixed(1)} out of 5`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star
          key={`full-${i}`}
          className={`${iconSize} text-yellow-400 fill-yellow-400`}
          aria-hidden="true"
        />
      ))}
      {hasHalfStar && (
        <StarHalf
          className={`${iconSize} text-yellow-400 fill-yellow-400`}
          aria-hidden="true"
        />
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star
          key={`empty-${i}`}
          className={`${iconSize} text-gray-300 dark:text-gray-600`}
          aria-hidden="true"
        />
      ))}
      {safeRating > 0 && (
        <span className="text-xs text-gray-500 ml-1">
          {safeRating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

// ============================================
// STATUS BADGE
// ============================================

interface StatusBadgeProps {
  isActive: boolean;
  size?: 'sm' | 'md';
}

function StatusBadge({ isActive, size = 'md' }: StatusBadgeProps) {
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2 py-1';
  const base = `${padding} rounded-full text-xs font-medium`;
  return isActive ? (
    <span
      className={`${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300`}
    >
      Active
    </span>
  ) : (
    <span
      className={`${base} bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400`}
    >
      Inactive
    </span>
  );
}

// ============================================
// COMPONENT
// ============================================

export function SupplierCard({
  supplier,
  variant = 'default',
  className = '',
  onEdit,
  onDelete,
  onView,
  showActions = false,
}: SupplierCardProps) {
  // ---- Sanitised values -------------------------------------------
  const name = asNonEmptyString(supplier?.name) ?? 'Unnamed Supplier';
  const email = asNonEmptyString((supplier as any)?.email);
  const phone = asNonEmptyString((supplier as any)?.phone);
  const address = asNonEmptyString((supplier as any)?.address);
  const contactPerson = asNonEmptyString(
    (supplier as any)?.contactPerson
  );
  const rating = asFiniteNumber((supplier as any)?.rating) ?? 0;
  const isActive = isSupplierActive(supplier);
  const productCount = getProductCount(supplier);

  // ---- MINIMAL VARIANT --------------------------------------------
  if (variant === 'minimal') {
    return (
      <div
        className={`flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition-all ${className}`}
      >
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
          <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
          {name}
        </span>
        {!isActive && (
          <span className="text-xs text-gray-400">Inactive</span>
        )}
      </div>
    );
  }

  // ---- COMPACT VARIANT --------------------------------------------
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all ${className}`}
      >
        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
          <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {name}
          </p>
          {email && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {email}
            </p>
          )}
        </div>
        <StatusBadge isActive={isActive} />
      </div>
    );
  }

  // ---- DEFAULT VARIANT --------------------------------------------
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-gray-100 dark:border-gray-700 ${className}`}
    >
      <div className="p-5">
        {/* Header: avatar + name + contact person + actions */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {name}
              </h3>
              {contactPerson && (
                <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <User className="w-3 h-3" />
                  <span className="truncate">{contactPerson}</span>
                </div>
              )}
            </div>
          </div>

          {showActions && (
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              {onView && (
                <button
                  type="button"
                  onClick={() => onView(supplier)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="View"
                  aria-label={`View ${name}`}
                >
                  <Eye className="w-4 h-4 text-gray-500" />
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(supplier)}
                  className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  title="Edit"
                  aria-label={`Edit ${name}`}
                >
                  <Edit className="w-4 h-4 text-blue-600" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(supplier)}
                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title="Delete"
                  aria-label={`Delete ${name}`}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Contact block — each line only renders when the field exists */}
        <div className="mt-4 space-y-2 text-sm">
          {email && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{email}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{phone}</span>
            </div>
          )}
          {address && (
            <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="text-xs truncate">{address}</span>
            </div>
          )}
        </div>

        {/* Footer: rating + product count + status */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <StarRating rating={rating} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {productCount} product{productCount !== 1 ? 's' : ''}
            </span>
            <StatusBadge isActive={isActive} size="sm" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default SupplierCard;
