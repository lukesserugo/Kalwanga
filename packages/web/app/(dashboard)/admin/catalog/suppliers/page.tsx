// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\catalog\suppliers\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Plus, Edit, Trash2, X, Save, RefreshCw,
  Phone, Mail, MapPin, User, Building, Search,
  Star, StarHalf, StarOff, Eye, Loader2, Lock,
  AlertCircle, Check, TrendingUp, Package,
  Grid, List, AlertTriangle, Filter
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { supplierService } from '../../../../../services/supplierService';
import { toast } from '../../../../../utils/toast-manager';
import { PermissionResource } from '../../../../../types/enums';

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  email: string;
  phone: string;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  rating?: number | null;
  isActive: boolean;
  businessUnitId: string;
  productCount?: number;
  totalSpent?: number;
  lastOrderDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardSuppliersPage() {
  const router = useRouter();
  const { 
    canView, 
    canManage, 
    canEdit,
    canDelete,
    canCreate,
    isLoading: permissionLoading
  } = usePermission();
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    notes: '',
    isActive: true,
  });
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'createdAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Permission checks using PermissionResource enum
  const canViewSuppliers = canView(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);
  const canManageSuppliers = canManage(PermissionResource.SUPPLIER);
  const canEditSuppliers = canEdit(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);
  const canDeleteSuppliers = canDelete(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);
  const canCreateSuppliers = canCreate(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);

  // Set isClient to true once component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load suppliers - only on client side and if user has permission
  useEffect(() => {
    if (isClient && canViewSuppliers) {
      loadSuppliers();
    } else if (isClient && !canViewSuppliers) {
      setLoading(false);
    }
  }, [isClient, canViewSuppliers]);

  const loadSuppliers = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const result = await supplierService.getAllSuppliers({ limit: 100 });
      
      let suppliersData: any[] = [];
      if (result && typeof result === 'object') {
        if ('data' in result && Array.isArray(result.data)) {
          suppliersData = result.data;
        } else if (Array.isArray(result)) {
          suppliersData = result;
        }
      }
      
      const mappedSuppliers: Supplier[] = suppliersData.map((item: any) => ({
        id: item.id || '',
        name: item.name || '',
        contactPerson: item.contactPerson || null,
        email: item.email || '',
        phone: item.phone || '',
        address: item.address || null,
        taxId: item.taxId || null,
        notes: item.notes || null,
        rating: item.rating || 0,
        isActive: item.isActive !== undefined ? item.isActive : true,
        businessUnitId: item.businessUnitId || 'default',
        productCount: item.productCount || 0,
        totalSpent: item.totalSpent || 0,
        lastOrderDate: item.lastOrderDate || null,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
      }));
      setSuppliers(mappedSuppliers);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      setError('Failed to load suppliers. Please try again.');
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSuppliers(false);
    toast.success('Suppliers refreshed');
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Validate phone format (basic)
    const phoneRegex = /^[\+\d\s\-\(\)]{7,20}$/;
    if (!phoneRegex.test(formData.phone)) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setSubmitting(true);
    try {
      if (editingSupplier) {
        // ✅ FIX: Only include fields that have values (filter out null/undefined)
        const updateData: Record<string, any> = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          isActive: formData.isActive,
        };
        
        // Only add optional fields if they have values
        if (formData.address && formData.address.trim() !== '') {
          updateData.address = formData.address;
        }
        if (formData.contactPerson && formData.contactPerson.trim() !== '') {
          updateData.contactPerson = formData.contactPerson;
        }
        if (formData.taxId && formData.taxId.trim() !== '') {
          updateData.taxId = formData.taxId;
        }
        if (formData.notes && formData.notes.trim() !== '') {
          updateData.notes = formData.notes;
        }
        if (rating > 0) {
          updateData.rating = rating;
        }
        
        await supplierService.updateSupplier(editingSupplier.id, updateData);
        toast.success('Supplier updated successfully');
      } else {
        // ✅ FIX: Only include fields that have values
        const createData: Record<string, any> = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          isActive: formData.isActive,
          companyId: 'default',
          userId: 'default',
        };
        
        // Only add optional fields if they have values
        if (formData.address && formData.address.trim() !== '') {
          createData.address = formData.address;
        }
        if (formData.contactPerson && formData.contactPerson.trim() !== '') {
          createData.contactPerson = formData.contactPerson;
        }
        if (formData.taxId && formData.taxId.trim() !== '') {
          createData.taxId = formData.taxId;
        }
        if (formData.notes && formData.notes.trim() !== '') {
          createData.notes = formData.notes;
        }
        if (rating > 0) {
          createData.rating = rating;
        }
        
        await supplierService.createSupplier(createData);
        toast.success('Supplier created successfully');
      }
      setShowAddModal(false);
      setEditingSupplier(null);
      resetForm();
      await loadSuppliers(false);
    } catch (error: any) {
      console.error('Failed to save supplier:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to save supplier';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      taxId: '',
      notes: '',
      isActive: true,
    });
    setRating(0);
    setHoverRating(0);
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;
    try {
      await supplierService.deleteSupplier(supplierToDelete.id);
      toast.success('Supplier deleted successfully');
      setShowDeleteModal(false);
      setSupplierToDelete(null);
      await loadSuppliers(false);
    } catch (error: any) {
      console.error('Failed to delete supplier:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete supplier';
      toast.error(errorMessage);
    }
  };

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

  const renderRatingInput = () => {
    return (
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(star)}
            className="p-1 hover:scale-110 transition-transform focus:outline-none"
            aria-label={`Rate ${star} stars`}
          >
            <Star
              className={`w-6 h-6 ${
                star <= (hoverRating || rating)
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300 dark:text-gray-600'
              } transition-colors`}
            />
          </button>
        ))}
        <span className="text-sm text-gray-500 ml-2">
          {rating > 0 ? `${rating} star${rating > 1 ? 's' : ''}` : 'No rating'}
        </span>
      </div>
    );
  };

  // Filter and sort suppliers
  const filteredSuppliers = useMemo(() => {
    let filtered = suppliers.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort
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
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [suppliers, searchQuery, sortBy, sortOrder]);

  // Loading state
  if (permissionLoading || !isClient || (loading && suppliers.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Permission check AFTER all hooks
  if (!canViewSuppliers) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view suppliers. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-500" />
            Suppliers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {suppliers.length} suppliers • Manage your product suppliers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle view mode"
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label="Refresh suppliers"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {canCreateSuppliers && (
            <button
              onClick={() => {
                setEditingSupplier(null);
                resetForm();
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
          <button
            onClick={() => loadSuppliers(false)}
            className="ml-auto px-3 py-1 bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers by name, contact, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'rating' | 'createdAt')}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border-0"
            >
              <option value="name">Sort by Name</option>
              <option value="rating">Sort by Rating</option>
              <option value="createdAt">Sort by Date</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Suppliers Grid/List */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No suppliers found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {searchQuery ? 'Try adjusting your search' : 'Add your first supplier to get started'}
          </p>
          {canCreateSuppliers && !searchQuery && (
            <button
              onClick={() => {
                setEditingSupplier(null);
                resetForm();
                setShowAddModal(true);
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <motion.div
              key={supplier.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ y: -4 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
                    <Truck className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">{supplier.name}</h4>
                    {supplier.contactPerson && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <User className="w-3 h-3" />
                        <span className="truncate">{supplier.contactPerson}</span>
                      </div>
                    )}
                  </div>
                </div>
                {(canEditSuppliers || canDeleteSuppliers) && (
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    {canEditSuppliers && (
                      <button
                        onClick={() => {
                          setEditingSupplier(supplier);
                          setFormData({
                            name: supplier.name,
                            contactPerson: supplier.contactPerson || '',
                            email: supplier.email,
                            phone: supplier.phone,
                            address: supplier.address || '',
                            taxId: supplier.taxId || '',
                            notes: supplier.notes || '',
                            isActive: supplier.isActive,
                          });
                          setRating(supplier.rating || 0);
                          setShowAddModal(true);
                        }}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        aria-label="Edit supplier"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                    {canDeleteSuppliers && (
                      <button
                        onClick={() => {
                          setSupplierToDelete(supplier);
                          setShowDeleteModal(true);
                        }}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        aria-label="Delete supplier"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{supplier.email}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  <span>{supplier.phone}</span>
                </div>
                {supplier.address && (
                  <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span className="text-xs truncate">{supplier.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  {renderStars(supplier.rating || 0)}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {supplier.productCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {supplier.productCount}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full ${
                    supplier.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
                  }`}>
                    {supplier.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">{supplier.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{supplier.contactPerson || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{supplier.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{supplier.phone}</td>
                    <td className="px-4 py-3">{renderStars(supplier.rating || 0)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        supplier.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEditSuppliers && (
                          <button
                            onClick={() => {
                              setEditingSupplier(supplier);
                              setFormData({
                                name: supplier.name,
                                contactPerson: supplier.contactPerson || '',
                                email: supplier.email,
                                phone: supplier.phone,
                                address: supplier.address || '',
                                taxId: supplier.taxId || '',
                                notes: supplier.notes || '',
                                isActive: supplier.isActive,
                              });
                              setRating(supplier.rating || 0);
                              setShowAddModal(true);
                            }}
                            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                          >
                            <Edit className="w-4 h-4 text-blue-500" />
                          </button>
                        )}
                        {canDeleteSuppliers && (
                          <button
                            onClick={() => {
                              setSupplierToDelete(supplier);
                              setShowDeleteModal(true);
                            }}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
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
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredSuppliers.length} of {suppliers.length} suppliers
            </span>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setEditingSupplier(null); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            >
              <button
                onClick={() => { setShowAddModal(false); setEditingSupplier(null); }}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Supplier Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Enter supplier name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Enter email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Enter contact person"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Enter address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tax ID
                  </label>
                  <input
                    type="text"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Enter tax ID"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Additional notes about the supplier"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rating
                  </label>
                  {renderRatingInput()}
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => { setShowAddModal(false); setEditingSupplier(null); }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingSupplier ? 'Update' : 'Create'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && supplierToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
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
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Supplier
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
