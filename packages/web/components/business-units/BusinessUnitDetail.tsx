'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Edit, Trash2, Building, MapPin, Phone, Mail,
  Users, Package, DollarSign, ShoppingBag, Loader2,
  CheckCircle, XCircle, Clock, Calendar,
} from 'lucide-react';
import {
  businessUnitService,
  BusinessUnitStats,
  isValidID,
} from '../../services/businessUnitService';
import { toast } from '../../utils/toast-manager';
import type { BusinessUnitType } from '../../types/businessUnit';

// ============================================
// LOCAL TYPES — describe what the detail endpoint actually returns
// ============================================

/**
 * Shape of a user row as returned inside GET /business-units/:id.
 *
 * ⚠️ This intentionally does NOT extend BusinessUnit's `users` type.
 * BusinessUnit.users is BusinessUnitUser[] (full Prisma shape with
 * businessUnitId/createdAt/updatedAt). The detail endpoint returns a
 * slimmer projection, so we model it as a standalone type instead of
 * trying to narrow an inherited property (which TS forbids).
 */
interface BusinessUnitDetailUser {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  user?: {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  };
}

interface BusinessUnitDetailProduct {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  [key: string]: unknown;
}

interface BusinessUnitDetailCounts {
  products?: number;
  inventory?: number;
  sales?: number;
  userBusinessUnits?: number;
  users?: number;
}

/**
 * Full shape of a business unit as rendered on the detail page.
 * Standalone — does not extend BusinessUnit.
 */
interface BusinessUnitWithDetails {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  companyId: string;
  isActive: boolean;
  type?: BusinessUnitType | string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  company?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };

  users?: BusinessUnitDetailUser[];
  products?: BusinessUnitDetailProduct[];

  _count?: BusinessUnitDetailCounts;
}

interface BusinessUnitDetailProps {
  id: string;
}

// ============================================
// COMPONENT
// ============================================

export function BusinessUnitDetail({ id }: BusinessUnitDetailProps) {
  const router = useRouter();
  const [unit, setUnit] = useState<BusinessUnitWithDetails | null>(null);
  const [stats, setStats] = useState<BusinessUnitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  /**
   * Single source of truth for whether this component should attempt
   * to load data. Uses the same `isValidID` the service layer uses,
   * so "users", "reports", "settings", etc. are rejected here — before
   * any network request is issued.
   */
  const hasValidId = isValidID(id);

  const loadData = useCallback(async () => {
    if (!hasValidId) {
      console.error(
        `❌ BusinessUnitDetail: refusing to load with invalid id="${id}"`
      );
      return;
    }

    try {
      setLoading(true);
      const [unitData, statsData] = await Promise.all([
        businessUnitService.getBusinessUnitById(id),
        businessUnitService.getBusinessUnitStats(id),
      ]);
      setUnit(unitData as unknown as BusinessUnitWithDetails);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load business unit details');
    } finally {
      setLoading(false);
    }
  }, [id, hasValidId]);

  useEffect(() => {
    if (!hasValidId) {
      toast.error('Invalid business unit ID');
      router.push('/admin/business-units');
      setLoading(false);
      return;
    }

    loadData();
  }, [hasValidId, loadData, router]);

  const handleDelete = async () => {
    if (!unit || !hasValidId) return;

    const productCount = unit._count?.products || 0;
    const userCount =
      unit._count?.userBusinessUnits || unit._count?.users || 0;

    const confirmMessage =
      productCount > 0 || userCount > 0
        ? `This business unit has ${productCount} products and ${userCount} users. It will be archived (soft deleted). Continue?`
        : 'Are you sure you want to permanently delete this business unit? This action cannot be undone.';

    if (!window.confirm(confirmMessage)) return;

    try {
      setDeleting(true);
      const result = await businessUnitService.deleteBusinessUnit(id);
      toast.success(result.message || 'Business unit deleted successfully');
      router.push('/admin/business-units');
    } catch (error: any) {
      console.error('Failed to delete:', error);
      toast.error(error?.message || 'Failed to delete business unit');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle className="w-3 h-3" />
        Active
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
        <XCircle className="w-3 h-3" />
        Inactive
      </span>
    );
  };

  const getTypeLabel = (type?: BusinessUnitType | string | null) => {
    if (!type) return 'Not Specified';
    const labels: Record<string, string> = {
      HEADQUARTERS: 'Headquarters',
      BRANCH: 'Branch',
      WAREHOUSE: 'Warehouse',
      STORE: 'Store',
    };
    return labels[type] || type;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  if (!hasValidId) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <Building className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
            Business Unit Not Found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            The business unit you're looking for doesn't exist or has been
            removed.
          </p>
          <button
            onClick={() => router.push('/admin/business-units')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Business Units
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/business-units')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Back to business units"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {unit.name}
              </h1>
              {getStatusBadge(unit.isActive)}
            </div>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-gray-600 dark:text-gray-400">
                Code: <span className="font-mono font-medium">{unit.code}</span>
              </p>
              {unit.type && (
                <p className="text-gray-600 dark:text-gray-400">
                  Type:{' '}
                  <span className="font-medium">{getTypeLabel(unit.type)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/business-units/${unit.id}/edit`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
            Business Unit Information
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-600 dark:text-gray-400">Company:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {unit.company?.name || 'N/A'}
              </span>
            </div>
            {unit.address && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-900 dark:text-white">
                  {unit.address}
                </span>
              </div>
            )}
            {unit.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <a
                  href={`tel:${unit.phone}`}
                  className="text-blue-600 hover:underline"
                >
                  {unit.phone}
                </a>
              </div>
            )}
            {unit.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <a
                  href={`mailto:${unit.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {unit.email}
                </a>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-600 dark:text-gray-400">
                Created:
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(unit.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-600 dark:text-gray-400">
                Last Updated:
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(unit.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
            Quick Statistics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Users</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.totalEmployees ||
                  unit._count?.userBusinessUnits ||
                  unit._count?.users ||
                  0}
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                <Package className="w-4 h-4" />
                <span className="text-sm font-medium">Products</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.products || unit._count?.products || 0}
              </p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                <ShoppingBag className="w-4 h-4" />
                <span className="text-sm font-medium">Sales</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.sales || 0}
              </p>
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">Revenue</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(stats?.totalRevenue || 0)}
              </p>
            </div>
          </div>

          {(stats?.lowStockItems !== undefined ||
            stats?.outOfStockItems !== undefined) && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-3">
              {stats?.lowStockItems !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Low Stock Items:
                  </span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {stats.lowStockItems}
                  </span>
                </div>
              )}
              {stats?.outOfStockItems !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Out of Stock:
                  </span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {stats.outOfStockItems}
                  </span>
                </div>
              )}
            </div>
          )}

          {(stats?.monthlyRevenue !== undefined ||
            stats?.monthlySales !== undefined) && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-3">
              {stats?.monthlyRevenue !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Monthly Revenue:
                  </span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(stats.monthlyRevenue)}
                  </span>
                </div>
              )}
              {stats?.monthlySales !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Monthly Sales:
                  </span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {stats.monthlySales}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Additional Details Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
            Additional Information
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">
                Business Unit ID
              </span>
              <span className="font-mono text-gray-600 dark:text-gray-300">
                {unit.id}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Type</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {getTypeLabel(unit.type)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {unit.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Users
            </h3>
            <Link
              href={`/admin/business-units/${unit.id}/users`}
              className="text-sm text-blue-600 hover:underline"
            >
              View All
            </Link>
          </div>
          {unit.users && unit.users.length > 0 ? (
            <div className="space-y-2">
              {unit.users.slice(0, 5).map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300">
                      {user.user?.firstName?.[0] || user.user?.email?.[0] || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.user
                          ? `${user.user.firstName || ''} ${
                              user.user.lastName || ''
                            }`.trim() || 'Unknown User'
                          : user.userId}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user.role}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      user.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
              {unit.users.length > 5 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center pt-2">
                  +{unit.users.length - 5} more users
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No users assigned to this business unit.
            </p>
          )}
        </div>
      </div>

      {/* Products Preview */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Products
          </h3>
          <Link
            href={`/admin/business-units/${unit.id}/products`}
            className="text-sm text-blue-600 hover:underline"
          >
            View All Products
          </Link>
        </div>
        {unit.products && unit.products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {unit.products.slice(0, 6).map((product) => (
              <div
                key={product.id}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <p className="font-medium text-sm truncate text-gray-900 dark:text-white">
                  {product.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  SKU: {product.sku}
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(product.unitPrice)}
                </p>
              </div>
            ))}
            {unit.products.length > 6 && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  +{unit.products.length - 6} more
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No products in this business unit.
          </p>
        )}
      </div>
    </div>
  );
}

export default BusinessUnitDetail;
