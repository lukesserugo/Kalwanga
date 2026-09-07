// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\suppliers\page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Plus, Edit, Trash2, RefreshCw,
  Phone, Mail, MapPin, User, Search,
  Star, StarHalf, Eye, Loader2, Lock,
  Grid, List, ArrowUpDown
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { useAuth } from '../../../../../hooks/useAuth';
import { supplierService } from '../../../../../services/supplierService';
import { toast } from '../../../../../utils/toast-manager';
import { PermissionResource } from '../../../../../types/enums';
import { Supplier } from '../../../../../types/supplier';

export default function SuppliersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete, canManage } = usePermission();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const companyId = user?.companyId || 'default';

  // Permission checks
  const canViewSuppliers = canView(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);
  const canCreateSuppliers = canCreate(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);
  const canEditSuppliers = canEdit(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);
  const canDeleteSuppliers = canDelete(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);

  // Load suppliers
  const loadSuppliers = useCallback(async (showLoading = true) => {
    if (!canViewSuppliers) {
      setLoading(false);
      return;
    }
    
    try {
      if (showLoading) setLoading(true);
      
      const data = await supplierService.getAllSuppliers({
        limit: 100,
        companyId,
        isActive: true,
      });
      
      setSuppliers(data || []);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      toast.error('Failed to load suppliers');
      setSuppliers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, canViewSuppliers]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSuppliers(false);
    toast.success('Suppliers refreshed');
  };

  // Delete handler
  const handleDelete = async () => {
    if (!supplierToDelete) return;
    setDeleting(true);
    try {
      await supplierService.deleteSupplier(supplierToDelete.id, companyId);
      toast.success('Supplier deleted successfully');
      setShowDeleteModal(false);
      setSupplierToDelete(null);
      loadSuppliers(false);
    } catch (error) {
      console.error('Failed to delete supplier:', error);
      toast.error('Failed to delete supplier');
    } finally {
      setDeleting(false);
    }
  };

  // Star rating renderer
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
        <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
      </div>
    );
  };

  // Filter and sort suppliers
  const filteredSuppliers = suppliers
    .filter(s => {
      if (!searchQuery) return true;
      const search = searchQuery.toLowerCase();
      return s.name?.toLowerCase().includes(search) ||
        s.contactPerson?.toLowerCase().includes(search) ||
        s.email?.toLowerCase().includes(search) ||
        s.phone?.toLowerCase().includes(search);
    })
    .sort((a, b) => {
      return sortOrder === 'asc' 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    });

  // Access denied
  if (!canViewSuppliers) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to view suppliers.</p>
      </div>
    );
  }

  // Loading state
  if (loading && suppliers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Truck className="w-8 h-8 text-blue-500" />
            Suppliers
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {suppliers.length} suppliers • Manage your vendor relationships
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
          {canCreateSuppliers && (
            <Link
              href="/admin/suppliers/create"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </Link>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers by name, contact, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Suppliers Display */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
          <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No suppliers found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {searchQuery ? 'Try adjusting your search' : 'Add your first supplier'}
          </p>
          {canCreateSuppliers && !searchQuery && (
            <Link
              href="/admin/suppliers/create"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Add Supplier
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <motion.div
              key={supplier.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <Link href={`/admin/suppliers/${supplier.id}`} className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
                    <Truck className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">{supplier.name}</h4>
                    {supplier.contactPerson && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <User className="w-3 h-3" />
                        <span>{supplier.contactPerson}</span>
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  {canEditSuppliers && (
                    <Link
                      href={`/admin/suppliers/${supplier.id}/edit`}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-gray-500" />
                    </Link>
                  )}
                  {canDeleteSuppliers && (
                    <button
                      onClick={() => {
                        setSupplierToDelete(supplier);
                        setShowDeleteModal(true);
                      }}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{supplier.email}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Phone className="w-3 h-3" />
                  <span>{supplier.phone}</span>
                </div>
                {supplier.address && (
                  <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                    <MapPin className="w-3 h-3 mt-0.5" />
                    <span className="text-xs truncate">{supplier.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                {renderStars(supplier.rating || 0)}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {(supplier as any).productCount || supplier._count?.products || 0} products
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    supplier.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {supplier.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/suppliers/${supplier.id}`} className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-blue-500" />
                        <span className="font-medium">{supplier.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">{supplier.contactPerson || '-'}</td>
                    <td className="px-4 py-3 text-sm">{supplier.email}</td>
                    <td className="px-4 py-3 text-sm">{supplier.phone}</td>
                    <td className="px-4 py-3">{renderStars(supplier.rating || 0)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        supplier.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/suppliers/${supplier.id}`}
                          className="p-1.5 hover:bg-gray-100 rounded"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </Link>
                        {canEditSuppliers && (
                          <Link
                            href={`/admin/suppliers/${supplier.id}/edit`}
                            className="p-1.5 hover:bg-blue-100 rounded"
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
                            className="p-1.5 hover:bg-red-100 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
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
      )}

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && supplierToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <div className="text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Supplier</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete <strong>{supplierToDelete.name}</strong>?
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
