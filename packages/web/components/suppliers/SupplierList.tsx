// D:\Projects\Kalwanga\packages\web\components\suppliers\SupplierList.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, Edit, Trash2, Eye, Truck,
  Mail, Phone, MapPin, Filter, Download,
  Package, Loader2, X, AlertCircle
} from 'lucide-react';
import { supplierService } from '../../services/supplierService';
import { toast } from '../../utils/toast-manager';
import { Supplier } from '../../types/supplier';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

interface SupplierListProps {
  companyId?: string;
  onSupplierSelect?: (supplier: Supplier) => void;
  selectable?: boolean;
  maxHeight?: string;
}

export function SupplierList({ companyId, onSupplierSelect, selectable = false, maxHeight }: SupplierListProps) {
  const router = useRouter();
  const { canView, canEdit, canDelete, canCreate } = usePermission();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canViewSuppliers = canView(PermissionResource.SUPPLIER);
  const canEditSuppliers = canEdit(PermissionResource.SUPPLIER);
  const canDeleteSuppliers = canDelete(PermissionResource.SUPPLIER);
  const canCreateSuppliers = canCreate(PermissionResource.SUPPLIER);

  useEffect(() => {
    if (canViewSuppliers) {
      loadSuppliers();
    }
  }, [companyId, canViewSuppliers]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supplierService.getAllSuppliers({
        limit: 100,
        companyId,
        isActive: true,
      });
      setSuppliers(data || []);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      setError('Failed to load suppliers. Please try again.');
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;
    setDeleting(true);
    try {
      await supplierService.deleteSupplier(supplierToDelete.id, companyId);
      toast.success('Supplier deleted successfully');
      setShowDeleteModal(false);
      setSupplierToDelete(null);
      loadSuppliers();
    } catch (error: any) {
      console.error('Failed to delete supplier:', error);
      toast.error(error?.response?.data?.message || 'Failed to delete supplier');
    } finally {
      setDeleting(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!canViewSuppliers) {
    return (
      <div className="p-8 text-center text-gray-500">
        You don't have permission to view suppliers.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        {canCreateSuppliers && (
          <Link
            href="/admin/suppliers/create"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </Link>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
          <button
            onClick={loadSuppliers}
            className="ml-auto px-3 py-1 bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Suppliers Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className={`overflow-x-auto ${maxHeight ? `max-h-${maxHeight}` : ''}`}>
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {selectable && (
                  <th className="px-4 py-3 text-left w-10">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  {selectable && (
                    <td className="px-4 py-3">
                      <input
                        type="radio"
                        checked={selectedSupplierId === supplier.id}
                        onChange={() => {
                          setSelectedSupplierId(supplier.id);
                          if (onSupplierSelect) onSupplierSelect(supplier);
                        }}
                        className="w-4 h-4 text-blue-600 rounded-full"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">{supplier.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{supplier.contactPerson || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{supplier.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{supplier.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      supplier.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400'
                    }`}>
                      {supplier.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/suppliers/${supplier.id}`}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </Link>
                      {canEditSuppliers && (
                        <Link
                          href={`/admin/suppliers/${supplier.id}/edit`}
                          className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </Link>
                      )}
                      {canDeleteSuppliers && (
                        <button
                          onClick={() => {
                            setSupplierToDelete(supplier);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'No suppliers match your search' : 'No suppliers found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && supplierToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Supplier</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{supplierToDelete.name}</strong>?
              {supplierToDelete.productCount && supplierToDelete.productCount > 0 && (
                <span className="block mt-2 text-red-600">
                  ⚠️ This supplier has {supplierToDelete.productCount} associated products.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Deleting...' : 'Delete Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
