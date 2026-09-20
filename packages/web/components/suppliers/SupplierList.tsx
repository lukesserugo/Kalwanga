// D:\Projects\Kalwanga\packages\web\components\suppliers\SupplierList.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, Edit, Trash2, Eye, Truck,
  Mail, Phone, MapPin, Filter, Download,
  Package, Loader2, X, AlertCircle,
} from 'lucide-react';
import { supplierService } from '../../services/supplierService';
import { toast } from '../../utils/toast-manager';
import type { Supplier } from '../../types/supplier';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

// ============================================
// TYPES
// ============================================

interface SupplierListProps {
  companyId?: string;
  onSupplierSelect?: (supplier: Supplier) => void;
  selectable?: boolean;
  maxHeight?: string;
}

// ============================================
// HELPERS
// ============================================

/**
 * Returns a lower-cased trimmed string, or `''`. Guards against
 * `null`, `undefined`, and non-string values so `.toLowerCase()` in
 * the search filter never throws.
 */
function searchable(value: unknown): string {
  if (typeof value === 'string') return value.toLowerCase();
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
}

/**
 * Returns a trimmed string, or `'-'` for empty display fields.
 */
function displayOr(value: unknown, fallback = '-'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Returns `true` when `value` is a usable supplier object.
 */
function isValidSupplier(value: unknown): value is Supplier {
  if (!value || typeof value !== 'object') return false;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && id.trim().length > 0;
}

/**
 * Returns the product count from any of the shapes the backend may
 * return, or `undefined` when none is available.
 */
function getProductCount(supplier: Supplier): number | undefined {
  const s = supplier as any;
  const direct = s?.productCount;
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;

  const counted = s?._count?.products;
  if (typeof counted === 'number' && Number.isFinite(counted)) return counted;

  if (Array.isArray(s?.products)) return s.products.length;

  return undefined;
}

// ============================================
// COMPONENT
// ============================================

export function SupplierList({
  companyId,
  onSupplierSelect,
  selectable = false,
  maxHeight,
}: SupplierListProps) {
  const router = useRouter();
  const { canView, canEdit, canDelete, canCreate } = usePermission();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Permission flags -------------------------------------------
  const canViewSuppliers = canView(PermissionResource.SUPPLIER);
  const canEditSuppliers = canEdit(PermissionResource.SUPPLIER);
  const canDeleteSuppliers = canDelete(PermissionResource.SUPPLIER);
  const canCreateSuppliers = canCreate(PermissionResource.SUPPLIER);

  // ============================================
  // LOAD SUPPLIERS
  // ============================================

  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await supplierService.getAllSuppliers({
        limit: 100,
        companyId,
        isActive: true,
      });

      // Defensive: only keep entries with a usable shape.
      const list = Array.isArray(data) ? data.filter(isValidSupplier) : [];
      setSuppliers(list);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      setError('Failed to load suppliers. Please try again.');
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (canViewSuppliers) {
      loadSuppliers();
    }
  }, [canViewSuppliers, loadSuppliers]);

  // ============================================
  // DELETE
  // ============================================

  const handleDelete = async () => {
    if (!supplierToDelete) return;

    setDeleting(true);
    try {
      await supplierService.deleteSupplier(supplierToDelete.id, companyId);
      toast.success('Supplier deleted successfully');
      setShowDeleteModal(false);
      setSupplierToDelete(null);
      await loadSuppliers();
    } catch (err: any) {
      console.error('Failed to delete supplier:', err);

      // SupplierValidationError is thrown for local guard failures.
      const message =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to delete supplier';

      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteModal = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setShowDeleteModal(false);
    setSupplierToDelete(null);
  };

  // ============================================
  // SEARCH / FILTER
  // ============================================

  const filteredSuppliers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return suppliers;

    return suppliers.filter((s) => {
      const haystack = [
        searchable(s.name),
        searchable((s as any).contactPerson),
        searchable((s as any).email),
        searchable((s as any).phone),
      ].join(' ');

      return haystack.includes(query);
    });
  }, [suppliers, searchQuery]);

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!canViewSuppliers) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        You don't have permission to view suppliers.
      </div>
    );
  }

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500 dark:text-brand-400" />
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  const productCountForDelete = supplierToDelete
    ? getProductCount(supplierToDelete)
    : undefined;

  return (
    <div className="space-y-4">
      {/* SEARCH + ADD BUTTON */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus-visible:ring-2 focus-visible:ring-brand-500 focus:border-transparent focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors duration-250"
          />
        </div>
        {canCreateSuppliers && (
          <Link
            href="/admin/suppliers/create"
            className="btn-brand shadow-brand focus-ring px-4 py-2 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </Link>
        )}
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="bg-danger-50 dark:bg-danger-950/30 border border-danger-200 dark:border-danger-900 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" />
          <span className="text-danger-700 dark:text-danger-300">{error}</span>
          <button
            onClick={loadSuppliers}
            className="ml-auto px-3 py-1 bg-danger-100 dark:bg-danger-950/40 text-danger-700 dark:text-danger-300 rounded-lg hover:bg-danger-200 dark:hover:bg-danger-950/60 transition-colors duration-250 text-2xs focus-ring"
          >
            Retry
          </button>
        </div>
      )}

      {/* SUPPLIERS TABLE */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div
          className="overflow-x-auto"
          style={maxHeight ? { maxHeight } : undefined}
        >
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {selectable && (
                  <th className="px-4 py-3 text-left w-10">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                <th className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSuppliers.map((supplier) => {
                const isActive =
                  typeof (supplier as any).isActive === 'boolean'
                    ? (supplier as any).isActive
                    : true;

                return (
                  <tr
                    key={supplier.id}
                    className="hover:bg-brand-50/40 dark:hover:bg-gray-700/50 transition-colors duration-250"
                  >
                    {selectable && (
                      <td className="px-4 py-3">
                        <input
                          type="radio"
                          name="supplier-selection"
                          checked={selectedSupplierId === supplier.id}
                          onChange={() => {
                            setSelectedSupplierId(supplier.id);
                            if (onSupplierSelect) {
                              onSupplierSelect(supplier);
                            }
                          }}
                          className="w-4 h-4 text-brand-600 rounded-full focus-ring"
                          aria-label={`Select ${supplier.name}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {displayOr(supplier.name, 'Unnamed Supplier')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {displayOr((supplier as any).contactPerson)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {displayOr((supplier as any).email)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 tabular-nums">
                      {displayOr((supplier as any).phone)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-2xs font-medium ${
                          isActive
                            ? 'bg-success-100 text-success-700 dark:bg-success-950/40 dark:text-success-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/suppliers/${supplier.id}`}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-250 focus-ring"
                          title="View"
                          aria-label={`View ${supplier.name}`}
                        >
                          <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </Link>
                        {canEditSuppliers && (
                          <Link
                            href={`/admin/suppliers/${supplier.id}/edit`}
                            className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-950/40 rounded-lg transition-colors duration-250 focus-ring"
                            title="Edit"
                            aria-label={`Edit ${supplier.name}`}
                          >
                            <Edit className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                          </Link>
                        )}
                        {canDeleteSuppliers && (
                          <button
                            type="button"
                            onClick={() => openDeleteModal(supplier)}
                            className="p-1.5 hover:bg-danger-100 dark:hover:bg-danger-950/40 rounded-lg transition-colors duration-250 focus-ring"
                            title="Delete"
                            aria-label={`Delete ${supplier.name}`}
                          >
                            <Trash2 className="w-4 h-4 text-danger-600 dark:text-danger-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredSuppliers.length === 0 && (
                <tr>
                  <td
                    colSpan={selectable ? 7 : 6}
                    className="px-4 py-8 text-center text-2xs text-gray-500 dark:text-gray-400"
                  >
                    {searchQuery
                      ? 'No suppliers match your search'
                      : 'No suppliers found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DELETE MODAL */}
      {showDeleteModal && supplierToDelete && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-supplier-title"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeDeleteModal}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
            <button
              type="button"
              onClick={closeDeleteModal}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors duration-250 focus-ring"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-danger-100 dark:bg-danger-950/40 rounded-lg">
                <AlertCircle className="w-6 h-6 text-danger-600 dark:text-danger-400" />
              </div>
              <div>
                <h3
                  id="delete-supplier-title"
                  className="text-lg font-bold text-gray-900 dark:text-white"
                >
                  Delete Supplier
                </h3>
                <p className="text-2xs text-gray-500 dark:text-gray-400">
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
              {typeof productCountForDelete === 'number' &&
                productCountForDelete > 0 && (
                  <span className="block mt-2 text-danger-600 dark:text-danger-400">
                    ⚠️ This supplier has {productCountForDelete} associated
                    product{productCountForDelete === 1 ? '' : 's'}.
                  </span>
                )}
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-250 disabled:opacity-50 focus-ring"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors duration-250 focus-ring"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deleting ? 'Deleting...' : 'Delete Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupplierList;
