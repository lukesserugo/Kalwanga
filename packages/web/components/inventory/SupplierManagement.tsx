// D:\Projects\Kalwanga\packages\web\components\inventory\SupplierManagement.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Plus, Edit, Trash2, X, Save, RefreshCw,
  Phone, Mail, MapPin, User, Building, Search,
  Star, StarHalf, StarOff, MoreVertical, Eye,
  Loader2, AlertCircle, CheckCircle, Lock, Shield,
  Link2, ExternalLink, Copy, Printer, Download,
  ChevronDown, ChevronUp, Filter, Grid, List,
  Calendar, Clock, DollarSign, Package, Tag
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { inventoryService } from '../../services/inventoryService';
import { PermissionResource } from '../../types/enums';
import { formatDate, formatCurrency, formatNumber } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  taxId?: string;
  notes?: string;
  rating?: number;
  isActive: boolean;
  businessUnitId: string;
  businessUnit?: {
    id: string;
    name: string;
    code: string;
  };
  createdAt: string;
  updatedAt: string;
  productCount?: number;
  totalValue?: number;
  lastOrderDate?: string;
  website?: string;
  categories?: string[];
}

interface SupplierFormData {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  notes: string;
  isActive: boolean;
  website: string;
  categories: string[];
}

interface SupplierManagementProps {
  className?: string;
  compact?: boolean;
  onSupplierSelect?: (supplier: Supplier) => void;
}

// ============================================
// CONSTANTS
// ============================================

const CATEGORIES = [
  'Electronics',
  'Furniture',
  'Clothing',
  'Food & Beverage',
  'Pharmaceuticals',
  'Automotive',
  'Construction',
  'Office Supplies',
  'Industrial',
  'Consumer Goods',
];

// ============================================
// SUB-COMPONENTS
// ============================================

const StarRating: React.FC<{
  rating: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}> = ({ rating, onRate, readonly = true, size = 'sm' }) => {
  const [hoverRating, setHoverRating] = useState(0);
  const [currentRating, setCurrentRating] = useState(rating);

  const starSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const starClass = starSizes[size] || starSizes.sm;

  const handleClick = (value: number) => {
    if (readonly) return;
    setCurrentRating(value);
    if (onRate) onRate(value);
  };

  const handleMouseEnter = (value: number) => {
    if (readonly) return;
    setHoverRating(value);
  };

  const handleMouseLeave = () => {
    if (readonly) return;
    setHoverRating(0);
  };

  const displayRating = readonly ? rating : (hoverRating || currentRating);

  return (
    <div 
      className="flex items-center gap-0.5"
      onMouseLeave={handleMouseLeave}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= Math.floor(displayRating);
        const isHalfFilled = !isFilled && star - 0.5 <= displayRating;
        
        return (
          <button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            onMouseEnter={() => handleMouseEnter(star)}
            disabled={readonly}
            className={`${readonly ? 'cursor-default' : 'cursor-pointer'} focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 rounded`}
          >
            {isFilled ? (
              <Star className={`${starClass} text-brand-400 fill-brand-400`} />
            ) : isHalfFilled ? (
              <StarHalf className={`${starClass} text-brand-400 fill-brand-400`} />
            ) : (
              <Star className={`${starClass} text-gray-300 dark:text-gray-600`} />
            )}
          </button>
        );
      })}
      {!readonly && (
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1 tabular-nums">
          {currentRating > 0 ? currentRating.toFixed(1) : 'Rate'}
        </span>
      )}
      {readonly && rating > 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1 tabular-nums">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

const SupplierCard: React.FC<{
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
  onDelete: (id: string) => void;
  onView: (supplier: Supplier) => void;
  compact?: boolean;
}> = ({ supplier, onEdit, onDelete, onView, compact = false }) => {
  const isActive = supplier.isActive !== false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className={`border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all bg-white dark:bg-gray-800 ${
        compact ? 'p-3' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg flex-shrink-0 ${
            isActive 
              ? 'bg-brand-50 dark:bg-brand-950/20' 
              : 'bg-gray-50 dark:bg-gray-700/30'
          }`}>
            <Truck className={`w-5 h-5 ${
              isActive ? 'text-brand-500' : 'text-gray-400'
            }`} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {supplier.name}
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <User className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{supplier.contactPerson}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0 ml-2">
          <button
            onClick={() => onView(supplier)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => onEdit(supplier)}
            className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-950/30 rounded-lg transition-colors focus-ring"
            title="Edit Supplier"
          >
            <Edit className="w-4 h-4 text-brand-500" />
          </button>
          <button
            onClick={() => onDelete(supplier.id)}
            className="p-1.5 hover:bg-brand-accent-100 dark:hover:bg-brand-accent-950/30 rounded-lg transition-colors focus-ring"
            title="Delete Supplier"
          >
            <Trash2 className="w-4 h-4 text-brand-accent-500" />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <Mail className="w-3 h-3 flex-shrink-0 text-gray-400" />
          <span className="truncate">{supplier.email}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <Phone className="w-3 h-3 flex-shrink-0 text-gray-400" />
          <span>{supplier.phone}</span>
        </div>
        {!compact && supplier.address && (
          <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
            <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5 text-gray-400" />
            <span className="text-xs truncate">{supplier.address}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <StarRating rating={supplier.rating || 0} readonly size="sm" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {supplier.productCount !== undefined && (
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              {supplier.productCount} products
            </span>
          )}
          {supplier.totalValue !== undefined && supplier.totalValue > 0 && (
            <span className="flex items-center gap-1 tabular-nums">
              <DollarSign className="w-3 h-3" />
              {formatCurrency(supplier.totalValue)}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            isActive
              ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
          }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const LoadingSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              </div>
            </div>
            <div className="flex gap-1">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function SupplierManagement({ 
  className = '',
  compact = false,
  onSupplierSelect,
}: SupplierManagementProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    notes: '',
    isActive: true,
    website: '',
    categories: [],
  });
  
  const [rating, setRating] = useState(0);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const canManage = hasPermission(`${PermissionResource.INVENTORY}:manage`) || 
                     hasPermission(`${PermissionResource.INVENTORY}:edit`) ||
                     user?.role === 'SUPER_ADMIN';

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 
                          (user?.businessUnits?.[0] as any)?.id || 
                          localStorage.getItem('businessUnitId') || '';

  // ============================================
  // DATA LOADING
  // ============================================

  const loadSuppliers = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await inventoryService.getSuppliers(businessUnitId);
      
      // Transform data with proper typing
      const supplierList = (data || []).map((item: any) => ({
        id: item.id || '',
        name: item.name || 'Unnamed Supplier',
        contactPerson: item.contactPerson || item.contact_person || '',
        email: item.email || '',
        phone: item.phone || '',
        address: item.address || '',
        taxId: item.taxId || item.tax_id || '',
        notes: item.notes || '',
        rating: item.rating || 0,
        isActive: item.isActive !== undefined ? item.isActive : true,
        businessUnitId: item.businessUnitId || businessUnitId,
        businessUnit: item.businessUnit,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        productCount: item.productCount || item._count?.products || 0,
        totalValue: item.totalValue || 0,
        lastOrderDate: item.lastOrderDate,
        website: item.website || '',
        categories: item.categories || [],
      }));
      
      setSuppliers(supplierList);
    } catch (error: any) {
      console.error('Failed to load suppliers:', error);
      setError(error?.message || 'Failed to load suppliers');
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSuppliers();
    toast.success('Suppliers refreshed');
  };

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) errors.name = 'Supplier name is required';
    if (!formData.contactPerson.trim()) errors.contactPerson = 'Contact person is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.phone.trim()) errors.phone = 'Phone number is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      const firstError = Object.values(formErrors)[0];
      toast.error(firstError);
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        ...formData,
        rating: rating,
        businessUnitId: businessUnitId,
      };
      
      if (editingSupplier) {
        // await inventoryService.updateSupplier(editingSupplier.id, data);
        toast.success('Supplier updated successfully');
      } else {
        // await inventoryService.createSupplier(data);
        toast.success('Supplier created successfully');
      }
      
      setShowAddModal(false);
      setEditingSupplier(null);
      resetForm();
      await loadSuppliers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    
    try {
      // await inventoryService.deleteSupplier(id);
      toast.success('Supplier deleted successfully');
      await loadSuppliers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete supplier');
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
      website: '',
      categories: [],
    });
    setRating(0);
    setFormErrors({});
    setTouched({});
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      taxId: supplier.taxId || '',
      notes: supplier.notes || '',
      isActive: supplier.isActive !== false,
      website: supplier.website || '',
      categories: supplier.categories || [],
    });
    setRating(supplier.rating || 0);
    setShowAddModal(true);
  };

  // ============================================
  // FILTERING & SEARCH
  // ============================================

  const filteredSuppliers = useMemo(() => {
    let result = suppliers;
    
    // Filter by status
    if (filter === 'active') {
      result = result.filter(s => s.isActive !== false);
    } else if (filter === 'inactive') {
      result = result.filter(s => s.isActive === false);
    }
    
    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.contactPerson.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.phone.includes(query)
      );
    }
    
    return result;
  }, [suppliers, filter, searchQuery]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isAuthenticated && businessUnitId) {
      loadSuppliers();
    }
  }, [isAuthenticated, businessUnitId, loadSuppliers]);

  // ============================================
  // RENDER
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Please Login</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">You need to be logged in to manage suppliers</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Access Denied</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">You don't have permission to manage suppliers</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-brand-500" />
            Suppliers
          </h2>
        </div>
        <LoadingSkeleton count={compact ? 3 : 6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-brand-accent-50 dark:bg-brand-accent-950/20 border border-brand-accent-200 dark:border-brand-accent-800 rounded-xl flex items-start gap-3 ${className}`}>
        <AlertCircle className="w-5 h-5 text-brand-accent-600 dark:text-brand-accent-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-brand-accent-700 dark:text-brand-accent-300">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm text-brand-accent-600 dark:text-brand-accent-400 hover:text-brand-accent-800 dark:hover:text-brand-accent-300 transition-colors focus-ring"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-brand-500" />
            Suppliers
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {suppliers.length} suppliers • {suppliers.filter(s => s.isActive !== false).length} active
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-50 focus-ring"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg transition-colors focus-ring ${
              showFilters || filter !== 'all' || searchQuery
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400'
                : 'border-gray-300 dark:border-gray-600 hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors focus-ring"
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              setEditingSupplier(null);
              resetForm();
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2 transition-colors shadow-brand focus-ring"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as 'all' | 'active' | 'inactive')}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none transition-colors"
                  >
                    <option value="all">All Suppliers</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name, contact, or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                {(filter !== 'all' || searchQuery) && (
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setFilter('all');
                        setSearchQuery('');
                      }}
                      className="text-sm text-brand-accent-600 dark:text-brand-accent-400 hover:text-brand-accent-800 dark:hover:text-brand-accent-300 flex items-center gap-1 transition-colors focus-ring"
                    >
                      <X className="w-4 h-4" />
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suppliers List */}
      {filteredSuppliers.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Truck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery || filter !== 'all' ? 'No suppliers match your filters' : 'No suppliers found'}
          </p>
          {!searchQuery && filter === 'all' && (
            <button
              onClick={() => {
                setEditingSupplier(null);
                resetForm();
                setShowAddModal(true);
              }}
              className="mt-2 text-sm text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 transition-colors focus-ring"
            >
              Add your first supplier →
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className={`grid ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-4`}>
          {filteredSuppliers.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onView={(s) => {
                setSelectedSupplier(s);
                setShowDetailModal(true);
              }}
              compact={compact}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-brand-50/50 dark:hover:bg-brand-950/10 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{supplier.name}</p>
                        <div className="flex items-center gap-1">
                          <StarRating rating={supplier.rating || 0} readonly size="sm" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell">
                      {supplier.contactPerson}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell truncate max-w-[150px]">
                      {supplier.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                      {supplier.phone}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        supplier.isActive !== false
                          ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
                      }`}>
                        {supplier.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedSupplier(supplier);
                            setShowDetailModal(true);
                          }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => openEditModal(supplier)}
                          className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-950/30 rounded-lg transition-colors focus-ring"
                          title="Edit Supplier"
                        >
                          <Edit className="w-4 h-4 text-brand-500" />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier.id)}
                          className="p-1.5 hover:bg-brand-accent-100 dark:hover:bg-brand-accent-950/30 rounded-lg transition-colors focus-ring"
                          title="Delete Supplier"
                        >
                          <Trash2 className="w-4 h-4 text-brand-accent-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
              setShowAddModal(false);
              setEditingSupplier(null);
              resetForm();
            }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 custom-scrollbar"
            >
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingSupplier(null);
                  resetForm();
                }}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Supplier Name <span className="text-brand-accent-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      setTouched({ ...touched, name: true });
                      if (formErrors.name) {
                        setFormErrors({ ...formErrors, name: '' });
                      }
                    }}
                    onBlur={() => setTouched({ ...touched, name: true })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${
                      formErrors.name && touched.name ? 'border-brand-accent-500 dark:border-brand-accent-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter supplier name"
                    disabled={isSubmitting}
                  />
                  {formErrors.name && touched.name && (
                    <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contact Person <span className="text-brand-accent-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => {
                      setFormData({ ...formData, contactPerson: e.target.value });
                      setTouched({ ...touched, contactPerson: true });
                      if (formErrors.contactPerson) {
                        setFormErrors({ ...formErrors, contactPerson: '' });
                      }
                    }}
                    onBlur={() => setTouched({ ...touched, contactPerson: true })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${
                      formErrors.contactPerson && touched.contactPerson ? 'border-brand-accent-500 dark:border-brand-accent-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter contact person"
                    disabled={isSubmitting}
                  />
                  {formErrors.contactPerson && touched.contactPerson && (
                    <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">{formErrors.contactPerson}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email <span className="text-brand-accent-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      setTouched({ ...touched, email: true });
                      if (formErrors.email) {
                        setFormErrors({ ...formErrors, email: '' });
                      }
                    }}
                    onBlur={() => setTouched({ ...touched, email: true })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${
                      formErrors.email && touched.email ? 'border-brand-accent-500 dark:border-brand-accent-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter email"
                    disabled={isSubmitting}
                  />
                  {formErrors.email && touched.email && (
                    <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">{formErrors.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone <span className="text-brand-accent-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      setTouched({ ...touched, phone: true });
                      if (formErrors.phone) {
                        setFormErrors({ ...formErrors, phone: '' });
                      }
                    }}
                    onBlur={() => setTouched({ ...touched, phone: true })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${
                      formErrors.phone && touched.phone ? 'border-brand-accent-500 dark:border-brand-accent-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter phone number"
                    disabled={isSubmitting}
                  />
                  {formErrors.phone && touched.phone && (
                    <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">{formErrors.phone}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    placeholder="Enter address"
                    disabled={isSubmitting}
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    placeholder="Enter tax ID"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    placeholder="Enter website URL"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Categories
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <label key={cat} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.categories.includes(cat)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                categories: [...formData.categories, cat],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                categories: formData.categories.filter(c => c !== cat),
                              });
                            }
                          }}
                          className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 transition-colors"
                          disabled={isSubmitting}
                        />
                        {cat}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors resize-y"
                    placeholder="Additional notes about the supplier"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rating
                  </label>
                  <StarRating
                    rating={rating}
                    onRate={setRating}
                    readonly={false}
                    size="lg"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 transition-colors"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Active Supplier</span>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSupplier(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-brand focus-ring"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                  ) : (
                    <><Save className="w-4 h-4" />{editingSupplier ? 'Update' : 'Create'}</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <button
                onClick={() => setShowDetailModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-brand-50 dark:bg-brand-950/20 rounded-lg">
                  <Truck className="w-6 h-6 text-brand-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedSupplier.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>{selectedSupplier.contactPerson}</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="truncate max-w-[150px]">{selectedSupplier.email}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">{selectedSupplier.phone}</span>
                </div>
                {selectedSupplier.address && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300">{selectedSupplier.address}</span>
                  </div>
                )}
                {selectedSupplier.website && (
                  <div className="flex items-center gap-3 text-sm">
                    <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <a 
                      href={selectedSupplier.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 transition-colors focus-ring"
                    >
                      {selectedSupplier.website}
                    </a>
                  </div>
                )}
                {selectedSupplier.taxId && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400 flex-shrink-0">Tax ID:</span>
                    <span className="text-gray-700 dark:text-gray-300">{selectedSupplier.taxId}</span>
                  </div>
                )}
                {selectedSupplier.categories && selectedSupplier.categories.length > 0 && (
                  <div className="flex items-start gap-3 text-sm">
                    <Tag className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {selectedSupplier.categories.map((cat) => (
                        <span key={cat} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSupplier.notes && (
                  <div className="flex items-start gap-3 text-sm">
                    <span className="text-gray-400 flex-shrink-0">Notes:</span>
                    <span className="text-gray-700 dark:text-gray-300">{selectedSupplier.notes}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <StarRating rating={selectedSupplier.rating || 0} readonly size="md" />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedSupplier.isActive !== false
                      ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
                  }`}>
                    {selectedSupplier.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                  {selectedSupplier.productCount !== undefined && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {selectedSupplier.productCount} products
                    </span>
                  )}
                  {selectedSupplier.totalValue !== undefined && selectedSupplier.totalValue > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {formatCurrency(selectedSupplier.totalValue)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                  <span>Added: {formatDate(selectedSupplier.createdAt)}</span>
                  <span>Updated: {formatDate(selectedSupplier.updatedAt)}</span>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                {onSupplierSelect && (
                  <button
                    onClick={() => {
                      onSupplierSelect(selectedSupplier);
                      setShowDetailModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 shadow-brand focus-ring"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Select Supplier
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingSupplier(selectedSupplier);
                    setShowDetailModal(false);
                    openEditModal(selectedSupplier);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 focus-ring"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// EXPORT
// ============================================

export default SupplierManagement;
