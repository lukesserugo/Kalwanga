// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\suppliers\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Plus, Edit, Trash2, X, RefreshCw,
  Phone, Mail, MapPin, User, Building, Search,
  Star, StarHalf, Eye, Loader2, Lock,
  AlertCircle, Check, Package,
  Grid, List, ArrowLeft,
  Globe, Database,
} from 'lucide-react';
import { usePermission } from '../../../../hooks/usePermission';
import { supplierService } from '../../../../services/supplierService';
import { toast } from '../../../../utils/toast-manager';
import { PermissionResource } from '../../../../types/enums';
import { useAuth } from '../../../../hooks/useAuth';

// ============================================
// TYPES
// ============================================
//
// The backend is the single source of truth. `Supplier` mirrors the
// shape returned by `GET /suppliers` — the backend's Prisma select
// with `_count` fields flattened onto the row.
//
// IMPORTANT: `companyId` is `string | null` (backend allows null).
// We keep `null` — we do NOT coerce to `undefined` — because that's
// what the backend actually returns. Guards use `?? null` everywhere.
//

interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  rating: number | null;
  isActive: boolean;
  companyId: string | null;
  website: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  creditLimit: number | null;
  createdAt: string;
  updatedAt: string;
  // Flattened by the backend's `enhancedSuppliers` mapper:
  productCount: number;
  purchaseOrderCount: number;
  totalPurchases: number;
  // Optional join data when the backend includes it:
  businessUnit?: { id: string; name: string } | null;
  businessUnitId?: string | null;
  businessUnitName?: string | null;
  companyName?: string | null;
  totalSpent?: number;
  lastOrderDate?: string | null;
}

interface SupplierStats {
  total: number;
  active: number;
  inactive: number;
  withProducts: number;
  averageRating: number;
  totalSpent: number;
}

// ============================================
// HELPERS
// ============================================

/**
 * Normalize a raw supplier row from the backend into the local shape.
 * The backend already flattens `_count.products` → `productCount` and
 * `_count.purchaseOrders` → `purchaseOrderCount`, but we still guard
 * against alternate field names in case the shape evolves.
 */
function normalizeSupplier(raw: any): Supplier {
  const productCount =
    typeof raw.productCount === 'number'
      ? raw.productCount
      : typeof raw._count?.products === 'number'
        ? raw._count.products
        : 0;

  const purchaseOrderCount =
    typeof raw.purchaseOrderCount === 'number'
      ? raw.purchaseOrderCount
      : typeof raw._count?.purchaseOrders === 'number'
        ? raw._count.purchaseOrders
        : 0;

  const totalPurchases =
    typeof raw.totalPurchases === 'number'
      ? raw.totalPurchases
      : typeof raw.totalSpent === 'number'
        ? raw.totalSpent
        : 0;

  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    contactPerson: raw.contactPerson ?? null,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    address: raw.address ?? null,
    taxId: raw.taxId ?? null,
    notes: raw.notes ?? null,
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    isActive: raw.isActive !== false,
    companyId: raw.companyId ?? null,
    website: raw.website ?? null,
    paymentTerms: raw.paymentTerms ?? null,
    deliveryTerms: raw.deliveryTerms ?? null,
    creditLimit:
      typeof raw.creditLimit === 'number' ? raw.creditLimit : null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    productCount,
    purchaseOrderCount,
    totalPurchases,
    businessUnit: raw.businessUnit ?? null,
    businessUnitId: raw.businessUnitId ?? null,
    businessUnitName:
      raw.businessUnit?.name ?? raw.businessUnitName ?? null,
    companyName: raw.companyName ?? raw.company?.name ?? null,
    totalSpent: totalPurchases,
    lastOrderDate: raw.lastOrderDate ?? null,
  };
}

// ============================================
// SUB-COMPONENTS
// ============================================

const SupplierStatsCards: React.FC<{
  stats: SupplierStats;
  loading?: boolean;
}> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-20"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Suppliers',
      value: stats.total,
      icon: Truck,
      color: 'brand',
    },
    {
      label: 'Active',
      value: stats.active,
      icon: Check,
      color: 'success',
    },
    {
      label: 'Inactive',
      value: stats.inactive,
      icon: X,
      color: 'danger',
    },
    {
      label: 'With Products',
      value: stats.withProducts,
      icon: Package,
      color: 'brand-accent',
    },
    {
      label: 'Avg. Rating',
      value:
        stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A',
      icon: Star,
      color: 'warning',
    },
  ];

  const colorClasses: Record<string, string> = {
    brand:
      'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
    'brand-accent':
      'bg-brand-accent-50 dark:bg-brand-accent-900/20 text-brand-accent-600 dark:text-brand-accent-400',
    success:
      'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
    warning:
      'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400',
    danger:
      'bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400',
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="card-brand p-4 hover:shadow-card-hover transition-shadow"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {card.label}
              </p>
              <div
                className={`p-1.5 rounded-lg ${
                  colorClasses[card.color] || colorClasses.brand
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
              {card.value}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
};

const SupplierFilters: React.FC<{
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderToggle: () => void;
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (value: 'all' | 'active' | 'inactive') => void;
  loading?: boolean;
}> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderToggle,
  statusFilter,
  onStatusFilterChange,
  loading,
}) => {
  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'rating', label: 'Rating' },
    { value: 'createdAt', label: 'Created Date' },
    { value: 'productCount', label: 'Product Count' },
  ];

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  return (
    <div className="card-brand p-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers by name, contact, or email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={loading}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 border-0 disabled:opacity-50"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort by {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={onSortOrderToggle}
            disabled={loading}
            className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 focus-ring"
            aria-label={`Sort ${
              sortOrder === 'asc' ? 'descending' : 'ascending'
            }`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  onStatusFilterChange(
                    opt.value as 'all' | 'active' | 'inactive',
                  )
                }
                disabled={loading}
                className={`px-3 py-1 text-xs rounded-lg transition-colors focus-ring ${
                  statusFilter === opt.value
                    ? 'bg-white dark:bg-gray-600 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                } disabled:opacity-50`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SupplierCard: React.FC<{
  supplier: Supplier;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (supplier: Supplier) => void;
  canEdit: boolean;
  canDelete: boolean;
}> = ({ supplier, onView, onEdit, onDelete, canEdit, canDelete }) => {
  const renderStars = (rating: number = 0) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <Star
            key={`full-${i}`}
            className="w-3 h-3 text-warning-400 fill-warning-400"
          />
        ))}
        {hasHalfStar && (
          <StarHalf className="w-3 h-3 text-warning-400 fill-warning-400" />
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star
            key={`empty-${i}`}
            className="w-3 h-3 text-gray-300 dark:text-gray-600"
          />
        ))}
        {rating > 0 && (
          <span className="text-xs text-gray-500 ml-1 tabular-nums">
            {rating.toFixed(1)}
          </span>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className="card-brand p-4 hover:shadow-card-hover transition-all cursor-pointer"
      onClick={() => onView(supplier.id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg flex-shrink-0">
            <Truck className="w-5 h-5 text-brand-500" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {supplier.name}
            </h4>
            {supplier.contactPerson && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <User className="w-3 h-3" />
                <span className="truncate">{supplier.contactPerson}</span>
              </div>
            )}
            {supplier.businessUnitName && (
              <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <Building className="w-3 h-3" />
                <span>{supplier.businessUnitName}</span>
              </div>
            )}
            {supplier.companyName && (
              <div className="flex items-center gap-1 text-xs text-secondary-400 dark:text-secondary-500">
                <Database className="w-3 h-3" />
                <span>{supplier.companyName}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0 ml-2">
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(supplier.id);
              }}
              className="p-1 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded transition-colors focus-ring"
              aria-label="Edit supplier"
            >
              <Edit className="w-4 h-4 text-brand-500" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(supplier);
              }}
              className="p-1 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded transition-colors focus-ring"
              aria-label="Delete supplier"
            >
              <Trash2 className="w-4 h-4 text-danger-500" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        {supplier.email && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{supplier.email}</span>
          </div>
        )}
        {supplier.phone && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span>{supplier.phone}</span>
          </div>
        )}
        {supplier.address && (
          <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="text-xs truncate">{supplier.address}</span>
          </div>
        )}
        {supplier.website && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Globe className="w-3 h-3 flex-shrink-0" />
            <span className="text-xs truncate">{supplier.website}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {renderStars(supplier.rating || 0)}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {typeof supplier.productCount === 'number' && (
            <span className="flex items-center gap-1 tabular-nums">
              <Package className="w-3 h-3" />
              {supplier.productCount}
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded-full ${
              supplier.isActive
                ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
            }`}
          >
            {supplier.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const SupplierTable: React.FC<{
  suppliers: Supplier[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (supplier: Supplier) => void;
  canEdit: boolean;
  canDelete: boolean;
}> = ({ suppliers, onView, onEdit, onDelete, canEdit, canDelete }) => {
  const renderStars = (rating: number = 0) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <Star
            key={`full-${i}`}
            className="w-3 h-3 text-warning-400 fill-warning-400"
          />
        ))}
        {hasHalfStar && (
          <StarHalf className="w-3 h-3 text-warning-400 fill-warning-400" />
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star
            key={`empty-${i}`}
            className="w-3 h-3 text-gray-300 dark:text-gray-600"
          />
        ))}
      </div>
    );
  };

  return (
    <div className="card-brand p-0 overflow-hidden">
      <div className="overflow-x-auto sidebar-scroll">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Supplier
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                Phone
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
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
            {suppliers.map((supplier) => (
              <tr
                key={supplier.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                onClick={() => onView(supplier.id)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {supplier.name}
                      </span>
                      {supplier.contactPerson && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 block sm:hidden">
                          {supplier.contactPerson}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell">
                  {supplier.companyName || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                  {supplier.contactPerson || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell">
                  {supplier.email || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                  {supplier.phone || '-'}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {renderStars(supplier.rating || 0)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      supplier.isActive
                        ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                        : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                    }`}
                  >
                    {supplier.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td
                  className="px-4 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onView(supplier.id)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                      title="View"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => onEdit(supplier.id)}
                        className="p-1 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded transition-colors focus-ring"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-brand-500" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => onDelete(supplier)}
                        className="p-1 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded transition-colors focus-ring"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-danger-500" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function DashboardSuppliersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    canView,
    canManage,
    canEdit,
    canDelete,
    canCreate,
    isLoading: permissionLoading,
  } = usePermission();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
    'name' | 'rating' | 'createdAt' | 'productCount'
  >('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const [stats, setStats] = useState<SupplierStats>({
    total: 0,
    active: 0,
    inactive: 0,
    withProducts: 0,
    averageRating: 0,
    totalSpent: 0,
  });

  const canViewSuppliers =
    canView(PermissionResource.SUPPLIER) ||
    canManage(PermissionResource.SUPPLIER);
  const canEditSuppliers =
    canEdit(PermissionResource.SUPPLIER) ||
    canManage(PermissionResource.SUPPLIER);
  const canDeleteSuppliers =
    canDelete(PermissionResource.SUPPLIER) ||
    canManage(PermissionResource.SUPPLIER);
  const canCreateSuppliers =
    canCreate(PermissionResource.SUPPLIER) ||
    canManage(PermissionResource.SUPPLIER);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadSuppliers = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);
        setError(null);

        // `getPaginatedSuppliers` returns { data, total, page, ... }.
        // We only need the array here. Do NOT pass `companyId` — the
        // backend resolves company scope from the authenticated user.
        const result = await supplierService.getPaginatedSuppliers({
          limit: 100,
        });

        const suppliersData: any[] = Array.isArray(result.data)
          ? result.data
          : [];

        const mappedSuppliers = suppliersData.map(normalizeSupplier);

        setSuppliers(mappedSuppliers);

        const active = mappedSuppliers.filter((s) => s.isActive).length;
        const inactive = mappedSuppliers.filter((s) => !s.isActive).length;
        const withProducts = mappedSuppliers.filter(
          (s) => (s.productCount || 0) > 0,
        ).length;
        const ratings = mappedSuppliers.filter(
          (s) => s.rating && s.rating > 0,
        );
        const averageRating =
          ratings.length > 0
            ? ratings.reduce((sum, s) => sum + (s.rating || 0), 0) /
              ratings.length
            : 0;
        const totalSpent = mappedSuppliers.reduce(
          (sum, s) => sum + (s.totalPurchases || 0),
          0,
        );

        setStats({
          total: mappedSuppliers.length,
          active,
          inactive,
          withProducts,
          averageRating,
          totalSpent,
        });
      } catch (err: any) {
        console.error('Failed to load suppliers:', err);
        const errorMsg =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load suppliers. Please try again.';
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (isClient && canViewSuppliers) {
      loadSuppliers();
    } else if (isClient && !canViewSuppliers) {
      setLoading(false);
    }
  }, [isClient, canViewSuppliers, loadSuppliers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSuppliers(false);
    toast.success('Suppliers refreshed');
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;
    setDeleting(true);
    try {
      await supplierService.deleteSupplier(supplierToDelete.id);
      toast.success('Supplier deleted successfully');
      setShowDeleteModal(false);
      setSupplierToDelete(null);
      await loadSuppliers(false);
    } catch (err: any) {
      console.error('Failed to delete supplier:', err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete supplier';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    const query = searchQuery.toLowerCase();

    const filtered = suppliers.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(query) ||
        (s.contactPerson?.toLowerCase() || '').includes(query) ||
        (s.email?.toLowerCase() || '').includes(query) ||
        (s.companyName?.toLowerCase() || '').includes(query);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && s.isActive) ||
        (statusFilter === 'inactive' && !s.isActive);

      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'rating':
          comparison = (a.rating || 0) - (b.rating || 0);
          break;
        case 'createdAt':
          comparison =
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime();
          break;
        case 'productCount':
          comparison = (a.productCount || 0) - (b.productCount || 0);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [suppliers, searchQuery, sortBy, sortOrder, statusFilter]);

  const goToCreateSupplier = () => {
    router.push('/admin/suppliers/create');
  };

  const goToEditSupplier = (id: string) => {
    router.push(`/admin/suppliers/${id}/edit`);
  };

  const goToViewSupplier = (id: string) => {
    router.push(`/admin/suppliers/${id}`);
  };

  if (permissionLoading || !isClient || (loading && suppliers.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 dark:border-brand-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading suppliers...
          </p>
        </div>
      </div>
    );
  }

  if (!canViewSuppliers) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view suppliers. Please contact your
          administrator.
        </p>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors flex items-center gap-2 focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-brand-500" />
            Suppliers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
            <span>{suppliers.length} suppliers</span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success-500"></span>
              {stats.active} active
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-danger-500"></span>
              {stats.inactive} inactive
            </span>
            {stats.withProducts > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                <span>{stats.withProducts} with products</span>
              </>
            )}
            {stats.averageRating > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-warning-400 fill-warning-400" />
                  {stats.averageRating.toFixed(1)} avg rating
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
            aria-label="Toggle view mode"
          >
            {viewMode === 'grid' ? (
              <List className="w-4 h-4" />
            ) : (
              <Grid className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
            aria-label="Refresh suppliers"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          {canCreateSuppliers && (
            <button
              onClick={goToCreateSupplier}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2 transition-colors focus-ring"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          )}
        </div>
      </div>

      <SupplierStatsCards stats={stats} loading={loading} />

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0" />
          <span className="text-danger-700 dark:text-danger-300">
            {error}
          </span>
          <button
            onClick={() => loadSuppliers(false)}
            className="ml-auto px-3 py-1 bg-danger-100 dark:bg-danger-800/30 text-danger-700 dark:text-danger-300 rounded-lg hover:bg-danger-200 dark:hover:bg-danger-800/50 transition-colors text-sm focus-ring"
          >
            Retry
          </button>
        </div>
      )}

      <SupplierFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortByChange={(value) => setSortBy(value as typeof sortBy)}
        sortOrder={sortOrder}
        onSortOrderToggle={() =>
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        }
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        loading={loading}
      />

      {filteredSuppliers.length === 0 ? (
        <div className="card-brand p-12 text-center">
          <Truck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            No suppliers found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters or search terms'
              : 'Add your first supplier to get started'}
          </p>
          {canCreateSuppliers && !searchQuery && statusFilter === 'all' && (
            <button
              onClick={goToCreateSupplier}
              className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors inline-flex items-center gap-2 focus-ring"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              onView={goToViewSupplier}
              onEdit={goToEditSupplier}
              onDelete={(s) => {
                setSupplierToDelete(s);
                setShowDeleteModal(true);
              }}
              canEdit={canEditSuppliers}
              canDelete={canDeleteSuppliers}
            />
          ))}
        </div>
      ) : (
        <SupplierTable
          suppliers={filteredSuppliers}
          onView={goToViewSupplier}
          onEdit={goToEditSupplier}
          onDelete={(s) => {
            setSupplierToDelete(s);
            setShowDeleteModal(true);
          }}
          canEdit={canEditSuppliers}
          canDelete={canDeleteSuppliers}
        />
      )}

      <AnimatePresence>
        {showDeleteModal && supplierToDelete && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-danger-100 dark:bg-danger-900/30 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-danger-600 dark:text-danger-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Delete Supplier
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete{' '}
                <strong className="text-gray-900 dark:text-white">
                  {supplierToDelete.name}
                </strong>
                ?
                {typeof supplierToDelete.productCount === 'number' &&
                  supplierToDelete.productCount > 0 && (
                    <span className="block mt-2 text-danger-600">
                      ⚠️ This supplier has {supplierToDelete.productCount}{' '}
                      associated product
                      {supplierToDelete.productCount !== 1 ? 's' : ''}.
                    </span>
                  )}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors flex items-center gap-2 disabled:opacity-50 focus-ring"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {deleting ? 'Deleting...' : 'Delete Supplier'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
        <span className="tabular-nums">
          Showing {filteredSuppliers.length} of {suppliers.length} suppliers
          {statusFilter !== 'all' && ` (filtered by ${statusFilter})`}
        </span>
        <span className="tabular-nums">
          Last updated: {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
