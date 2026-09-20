'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Building,
  MapPin,
  Phone,
  Mail,
  Users,
  Package,
  DollarSign,
  ShoppingBag,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
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
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-medium bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300">
        <CheckCircle className="w-3 h-3" />
        Active
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
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
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
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
            className="mt-4 px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
          >
            Back to Business Units
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/business-units')}
            className="p-2 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
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
                Code:{' '}
                <span className="font-mono font-medium tabular-nums">
                  {unit.code}
                </span>
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
            className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all flex items-center gap-2 focus-ring"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 focus-ring"
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
        <div className="card-brand">
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
                  className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
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
                  className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
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
              <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                {new Date(unit.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-600 dark:text-gray-400">
                Last Updated:
              </span>
              <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                {new Date(unit.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="card-brand">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
            Quick Statistics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Users</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {stats?.totalEmployees ||
                  unit._count?.userBusinessUnits ||
                  unit._count?.users ||
                  0}
              </p>
            </div>
            <div className="p-3 bg-success-50 dark:bg-success-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-success-600 dark:text-success-400 mb-1">
                <Package className="w-4 h-4" />
                <span className="text-sm font-medium">Products</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {stats?.products || unit._count?.products || 0}
              </p>
            </div>
            <div className="p-3 bg-secondary-50 dark:bg-secondary-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-secondary-600 dark:text-secondary-400 mb-1">
                <ShoppingBag className="w-4 h-4" />
                <span className="text-sm font-medium">Sales</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {stats?.sales || 0}
              </p>
            </div>
            <div className="p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-warning-600 dark:text-warning-400 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">Revenue</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
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
                  <span className="font-medium text-brand-600 dark:text-brand-400 tabular-nums">
                    {stats.lowStockItems}
                  </span>
                </div>
              )}
              {stats?.outOfStockItems !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Out of Stock:
                  </span>
                  <span className="font-medium text-danger-600 dark:text-danger-400 tabular-nums">
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
                  <span className="font-medium text-success-600 dark:text-success-400 tabular-nums">
                    {formatCurrency(stats.monthlyRevenue)}
                  </span>
                </div>
              )}
              {stats?.monthlySales !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Monthly Sales:
                  </span>
                  <span className="font-medium text-brand-600 dark:text-brand-400 tabular-nums">
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
        <div className="card-brand">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
            Additional Information
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">
                Business Unit ID
              </span>
              <span className="font-mono text-gray-600 dark:text-gray-300 tabular-nums">
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

        <div className="card-brand">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Users
            </h3>
            <Link
              href={`/admin/business-units/${unit.id}/users`}
              className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors focus-ring rounded"
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
                      <p className="text-2xs text-gray-500 dark:text-gray-400">
                        {user.role}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-2xs px-2 py-0.5 rounded-full ${
                      user.isActive
                        ? 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
              {unit.users.length > 5 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center pt-2 tabular-nums">
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
      <div className="mt-6 card-brand">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Products
          </h3>
          <Link
            href={`/admin/business-units/${unit.id}/products`}
            className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors focus-ring rounded"
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
                <p className="text-2xs text-gray-500 dark:text-gray-400 font-mono">
                  SKU: {product.sku}
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1 tabular-nums">
                  {formatCurrency(product.unitPrice)}
                </p>
              </div>
            ))}
            {unit.products.length > 6 && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
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
