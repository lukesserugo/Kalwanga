// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\suppliers\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Plus, Edit, Trash2, RefreshCw,
  Phone, Mail, MapPin, User, Search,
  Star, StarHalf, Eye, Loader2, Lock,
  Grid, List, ArrowUpDown, Filter, X,
  AlertCircle, CheckCircle, Building2,
  Calendar, Clock, DollarSign, Package,
  Globe, Link2, ExternalLink, Copy,
  ChevronDown, ChevronUp, MoreVertical,
  Award, TrendingUp, TrendingDown, Users,
  FileText, Printer, Download, Shield
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { useAuth } from '../../../../../hooks/useAuth';
import { supplierService } from '../../../../../services/supplierService';
import { inventoryService } from '../../../../../services/inventoryService';
import { toast } from '../../../../../utils/toast-manager';
import { formatDate, formatCurrency, formatNumber } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';
import { Supplier } from '../../../../../types/supplier';

// ============================================
// TYPES
// ============================================

interface SupplierWithStats extends Supplier {
  productCount?: number;
  totalValue?: number;
  lastOrderDate?: string;
  categories?: string[];
  businessUnitName?: string;
}

interface SupplierFilters {
  search: string;
  status: 'all' | 'active' | 'inactive';
  category: string;
  location: string;
  minRating: number;
}

// ============================================
// CONSTANTS
// ============================================

const RATING_OPTIONS = [
  { value: 0, label: 'All Ratings' },
  { value: 1, label: '1 Star & Up' },
  { value: 2, label: '2 Stars & Up' },
  { value: 3, label: '3 Stars & Up' },
  { value: 4, label: '4 Stars & Up' },
  { value: 5, label: '5 Stars' },
];

// ============================================
// SUB-COMPONENTS
// ============================================

const StarRating: React.FC<{ rating: number; size?: 'sm' | 'md' | 'lg' }> = ({ rating, size = 'sm' }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  const sizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };
  
  const starClass = sizes[size] || sizes.sm;
  
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} className={`${starClass} text-brand-400 fill-brand-400`} />
      ))}
      {hasHalfStar && <StarHalf className={`${starClass} text-brand-400 fill-brand-400`} />}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} className={`${starClass} text-gray-300 dark:text-gray-600`} />
      ))}
      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 tabular-nums">{rating.toFixed(1)}</span>
    </div>
  );
};

const StatusBadge: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      isActive
        ? 'bg-success-100 text-success-700 dark:bg-success-950/30 dark:text-success-300'
        : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
    }`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtext?: string;
}> = ({ label, value, icon: Icon, color, subtext }) => {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    brand: { bg: 'bg-brand-50 dark:bg-brand-950/20', text: 'text-brand-600 dark:text-brand-400' },
    success: { bg: 'bg-success-50 dark:bg-success-950/20', text: 'text-success-600 dark:text-success-400' },
    warning: { bg: 'bg-warning-50 dark:bg-warning-950/20', text: 'text-warning-600 dark:text-warning-400' },
    danger: { bg: 'bg-brand-accent-50 dark:bg-brand-accent-950/20', text: 'text-brand-accent-600 dark:text-brand-accent-400' },
    secondary: { bg: 'bg-secondary-50 dark:bg-secondary-950/20', text: 'text-secondary-600 dark:text-secondary-400' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-600 dark:text-indigo-400' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-950/20', text: 'text-teal-600 dark:text-teal-400' },
    orange: { bg: 'bg-brand-50 dark:bg-brand-950/20', text: 'text-brand-600 dark:text-brand-400' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${colorClasses[color]?.bg || colorClasses.brand.bg} rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${colorClasses[color]?.text || colorClasses.brand.text} mt-1 tabular-nums`}>
            {value}
          </p>
          {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-white dark:bg-gray-700/50`}>
          <Icon className={`w-5 h-5 ${colorClasses[color]?.text || colorClasses.brand.text}`} />
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SuppliersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { canView, canCreate, canEdit, canDelete, canManage } = usePermission();
  
  const canViewSuppliers = canView(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);
  const canCreateSuppliers = canCreate(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);
  const canEditSuppliers = canEdit(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);
  const canDeleteSuppliers = canDelete(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);

  const initialLoadRef = useRef(false);
  const loadDataRef = useRef(false);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierWithStats[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<SupplierWithStats[]>([]);
  const [filters, setFilters] = useState<SupplierFilters>({
    search: '',
    status: 'all',
    category: '',
    location: '',
    minRating: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortField, setSortField] = useState<'name' | 'rating' | 'productCount' | 'createdAt'>('name');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithStats | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const companyId = user?.companyId || 'default';
  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 
                          (user?.businessUnits?.[0] as any)?.id || 
                          localStorage.getItem('businessUnitId') || '';

  const loadSuppliers = useCallback(async (showLoading = true) => {
    if (loadDataRef.current) {
      console.log('⏭️ Skipping load - already loading');
      return;
    }
    
    if (!canViewSuppliers) {
      setLoading(false);
      return;
    }
    
    loadDataRef.current = true;
    
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      const data = await supplierService.getAllSuppliers({
        limit: 100,
        companyId,
        isActive: true,
      });
      
      const suppliersWithStats = await Promise.all(
        (data || []).map(async (supplier: Supplier) => {
          try {
            let productCount = 0;
            let totalValue = 0;
            
            try {
              const products = await inventoryService.searchProducts({
                query: supplier.name || '',
                businessUnitId: businessUnitId,
              });
              
              if (products && Array.isArray(products)) {
                const supplierProducts = products.filter((p: any) => 
                  p.supplier?.id === supplier.id || 
                  p.supplierId === supplier.id ||
                  p.supplier?.name?.toLowerCase() === supplier.name?.toLowerCase()
                );
                productCount = supplierProducts.length;
                totalValue = supplierProducts.reduce((sum: number, p: any) => 
                  sum + ((p.quantity || 0) * (p.unitPrice || 0)), 0
                );
              }
            } catch (searchError) {
              console.warn(`Search failed for supplier ${supplier.id}:`, searchError);
            }
            
            return {
              ...supplier,
              productCount,
              totalValue,
              businessUnitName: supplier.businessUnitId ? 
                `BU ${supplier.businessUnitId.slice(0, 8)}` : 
                'Unknown',
            };
          } catch (err) {
            console.warn(`Failed to get stats for supplier ${supplier.id}:`, err);
            return {
              ...supplier,
              productCount: 0,
              totalValue: 0,
              businessUnitName: 'Unknown',
            };
          }
        })
      );
      
      setSuppliers(suppliersWithStats);
      setFilteredSuppliers(suppliersWithStats);
      initialLoadRef.current = true;
      
    } catch (error: any) {
      console.error('Failed to load suppliers:', error);
      const errorMsg = error?.message || 'Failed to load suppliers';
      setError(errorMsg);
      toast.error(errorMsg);
      setSuppliers([]);
      setFilteredSuppliers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadDataRef.current = false;
    }
  }, [companyId, businessUnitId, canViewSuppliers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSuppliers(false);
    toast.success('Suppliers refreshed');
  };

  const applyFilters = useCallback(() => {
    let filtered = [...suppliers];

    if (filters.search.trim()) {
      const query = filters.search.toLowerCase().trim();
      filtered = filtered.filter(s =>
        s.name?.toLowerCase().includes(query) ||
        s.contactPerson?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.phone?.toLowerCase().includes(query) ||
        s.address?.toLowerCase().includes(query)
      );
    }

    if (filters.status === 'active') {
      filtered = filtered.filter(s => s.isActive !== false);
    } else if (filters.status === 'inactive') {
      filtered = filtered.filter(s => s.isActive === false);
    }

    if (filters.minRating > 0) {
      filtered = filtered.filter(s => (s.rating || 0) >= filters.minRating);
    }

    if (filters.category) {
      filtered = filtered.filter(s =>
        s.categories?.some(c => c.toLowerCase().includes(filters.category.toLowerCase()))
      );
    }

    if (filters.location) {
      filtered = filtered.filter(s =>
        s.address?.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      if (aVal === undefined || aVal === null) aVal = 0;
      if (bVal === undefined || bVal === null) bVal = 0;
      
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      return sortOrder === 'asc' 
        ? (aVal || 0) - (bVal || 0) 
        : (bVal || 0) - (aVal || 0);
    });

    setFilteredSuppliers(filtered);
  }, [suppliers, filters, sortField, sortOrder]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleDelete = async () => {
    if (!supplierToDelete) return;
    
    setDeleting(true);
    setError(null);
    try {
      await supplierService.deleteSupplier(supplierToDelete.id, companyId);
      toast.success('Supplier deleted successfully');
      setShowDeleteModal(false);
      setSupplierToDelete(null);
      await loadSuppliers(false);
    } catch (error: any) {
      console.error('Failed to delete supplier:', error);
      const errorMsg = error?.message || 'Failed to delete supplier';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (supplier: SupplierWithStats) => {
    router.push(`/admin/suppliers/${supplier.id}/edit`);
  };

  const handleView = (supplier: SupplierWithStats) => {
    setSelectedSupplier(supplier);
    setShowDetailModal(true);
  };

  useEffect(() => {
    if (isAuthenticated && canViewSuppliers) {
      loadSuppliers();
    }
  }, [isAuthenticated, canViewSuppliers, loadSuppliers]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Please Login</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You need to be logged in to manage suppliers.</p>
      </div>
    );
  }

  if (!canViewSuppliers) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
            You don't have permission to view suppliers. Please contact your administrator.
          </p>
          <button
            onClick={() => router.push('/admin/inventory')}
            className="mt-4 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-brand focus-ring"
          >
            Back to Inventory
          </button>
        </motion.div>
      </div>
    );
  }

  if (loading && suppliers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const stats = {
    total: suppliers.length,
    active: suppliers.filter(s => s.isActive !== false).length,
    inactive: suppliers.filter(s => s.isActive === false).length,
    avgRating: suppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / (suppliers.length || 1),
    totalProducts: suppliers.reduce((sum, s) => sum + (s.productCount || 0), 0),
    totalValue: suppliers.reduce((sum, s) => sum + (s.totalValue || 0), 0),
  };

  const hasActiveFilters = filters.search || filters.status !== 'all' || filters.minRating > 0 || filters.category || filters.location;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {error && (
        <div className="p-4 bg-brand-accent-50 dark:bg-brand-accent-950/20 border border-brand-accent-200 dark:border-brand-accent-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-brand-accent-600 dark:text-brand-accent-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-brand-accent-700 dark:text-brand-accent-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-brand-accent-100 dark:hover:bg-brand-accent-800/30 rounded transition focus-ring"
          >
            <X className="w-4 h-4 text-brand-accent-600 dark:text-brand-accent-400" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Truck className="w-7 h-7 sm:w-8 sm:h-8 text-brand-500" />
            Suppliers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
            {stats.total} suppliers • {stats.active} active • {formatCurrency(stats.totalValue)} total value
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg transition-colors focus-ring ${
              showFilters || hasActiveFilters
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400'
                : 'border-gray-300 dark:border-gray-600 hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-50 focus-ring"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors focus-ring ${
                viewMode === 'grid' 
                  ? 'bg-brand-600 text-white' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors focus-ring ${
                viewMode === 'list' 
                  ? 'bg-brand-600 text-white' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors focus-ring"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
          {canCreateSuppliers && (
            <Link
              href="/admin/suppliers/create"
              className="px-3 sm:px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-1 sm:gap-2 transition-colors text-sm shadow-brand focus-ring"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Supplier</span>
            </Link>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Suppliers" value={stats.total} icon={Truck} color="brand" />
        <StatCard label="Active" value={stats.active} icon={CheckCircle} color="success" />
        <StatCard label="Inactive" value={stats.inactive} icon={AlertCircle} color="danger" />
        <StatCard
          label="Avg Rating"
          value={stats.avgRating.toFixed(1) + ' ★'}
          icon={Star}
          color="warning"
          subtext={`${stats.totalProducts} products total`}
        />
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
            />
          </div>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          >
            <option value="name">Sort by Name</option>
            <option value="rating">Sort by Rating</option>
            <option value="productCount">Sort by Products</option>
            <option value="createdAt">Sort by Created Date</option>
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilters({
                  search: '',
                  status: 'all',
                  category: '',
                  location: '',
                  minRating: 0,
                });
              }}
              className="text-sm text-brand-accent-600 dark:text-brand-accent-400 hover:text-brand-accent-800 flex items-center gap-1 focus-ring transition-colors"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value as 'all' | 'active' | 'inactive' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Rating</label>
                  <select
                    value={filters.minRating}
                    onChange={(e) => setFilters({ ...filters, minRating: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  >
                    {RATING_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    placeholder="Filter by category..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                  <input
                    type="text"
                    value={filters.location}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                    placeholder="Filter by location..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Suppliers Display */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Truck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {suppliers.length === 0 ? 'No suppliers found' : 'No suppliers match your filters'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {suppliers.length === 0 ? 'Add your first supplier' : 'Try adjusting your filters'}
          </p>
          {suppliers.length === 0 && canCreateSuppliers && (
            <Link
              href="/admin/suppliers/create"
              className="mt-4 inline-block px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-brand focus-ring"
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
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all"
            >
              <div className="flex items-start justify-between">
                <button
                  onClick={() => handleView(supplier)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <div className="p-2 bg-brand-50 dark:bg-brand-950/20 rounded-lg flex-shrink-0">
                    <Truck className="w-5 h-5 text-brand-500" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">{supplier.name}</h4>
                    {supplier.contactPerson && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <User className="w-3.5 h-3.5" />
                        <span className="truncate">{supplier.contactPerson}</span>
                      </div>
                    )}
                  </div>
                </button>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={() => handleView(supplier)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                    title="View"
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
                  </button>
                  {canEditSuppliers && (
                    <button
                      onClick={() => handleEdit(supplier)}
                      className="p-1 hover:bg-brand-100 dark:hover:bg-brand-950/30 rounded transition-colors focus-ring"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-brand-500" />
                    </button>
                  )}
                  {canDeleteSuppliers && (
                    <button
                      onClick={() => {
                        setSupplierToDelete(supplier);
                        setShowDeleteModal(true);
                      }}
                      className="p-1 hover:bg-brand-accent-100 dark:hover:bg-brand-accent-950/30 rounded transition-colors focus-ring"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-brand-accent-500" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 truncate">
                  <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{supplier.email}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span>{supplier.phone}</span>
                </div>
                {supplier.address && (
                  <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs truncate">{supplier.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
                <StarRating rating={supplier.rating || 0} size="sm" />
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {supplier.productCount !== undefined && (
                    <span className="flex items-center gap-1 tabular-nums">
                      <Package className="w-3 h-3" />
                      {supplier.productCount}
                    </span>
                  )}
                  {supplier.totalValue !== undefined && supplier.totalValue > 0 && (
                    <span className="flex items-center gap-1 tabular-nums">
                      <DollarSign className="w-3 h-3" />
                      {formatCurrency(supplier.totalValue)}
                    </span>
                  )}
                  <StatusBadge isActive={supplier.isActive !== false} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-brand-50/50 dark:hover:bg-brand-950/10 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleView(supplier)}
                        className="flex items-center gap-2 hover:text-brand-600 dark:hover:text-brand-400 transition-colors focus-ring"
                      >
                        <Truck className="w-4 h-4 text-brand-500" />
                        <span className="font-medium text-gray-900 dark:text-white">{supplier.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell">
                      {supplier.contactPerson || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell truncate max-w-[150px]">
                      {supplier.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                      {supplier.phone}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <StarRating rating={supplier.rating || 0} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge isActive={supplier.isActive !== false} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleView(supplier)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {canEditSuppliers && (
                          <button
                            onClick={() => handleEdit(supplier)}
                            className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-950/30 rounded transition-colors focus-ring"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-brand-500" />
                          </button>
                        )}
                        {canDeleteSuppliers && (
                          <button
                            onClick={() => {
                              setSupplierToDelete(supplier);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 hover:bg-brand-accent-100 dark:hover:bg-brand-accent-950/30 rounded transition-colors focus-ring"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-brand-accent-500" />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>

              <div className="text-center">
                <div className="w-16 h-16 bg-brand-accent-100 dark:bg-brand-accent-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-brand-accent-600 dark:text-brand-accent-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Supplier</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{supplierToDelete.name}</strong>?
                </p>
                {supplierToDelete.productCount && supplierToDelete.productCount > 0 && (
                  <div className="p-3 bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-800 rounded-lg mb-4 text-sm text-warning-700 dark:text-warning-300">
                    <Package className="w-4 h-4 inline mr-1" />
                    This supplier has {supplierToDelete.productCount} product(s) associated with it.
                    Deleting it will remove the supplier from all products.
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-brand-accent-600 text-white rounded-lg hover:bg-brand-accent-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-brand focus-ring"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete Supplier
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
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 custom-scrollbar"
            >
              <button
                onClick={() => setShowDetailModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-brand-50 dark:bg-brand-950/20 rounded-lg">
                  <Truck className="w-6 h-6 text-brand-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedSupplier.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Supplier Details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Supplier ID</p>
                  <p className="font-mono text-sm text-gray-900 dark:text-white">{selectedSupplier.id}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                  <StatusBadge isActive={selectedSupplier.isActive !== false} />
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Contact Person</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedSupplier.contactPerson || 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Rating</p>
                  <StarRating rating={selectedSupplier.rating || 0} size="md" />
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedSupplier.email}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedSupplier.phone}</p>
                </div>
                {selectedSupplier.address && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg sm:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Address</p>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedSupplier.address}</p>
                  </div>
                )}
                {selectedSupplier.businessUnitName && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Business Unit</p>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedSupplier.businessUnitName}</p>
                  </div>
                )}
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Products</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{selectedSupplier.productCount || 0}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Value</p>
                  <p className="text-lg font-bold text-success-600 dark:text-success-400 tabular-nums">
                    {formatCurrency(selectedSupplier.totalValue || 0)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                  <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedSupplier.createdAt)}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Last Updated</p>
                  <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedSupplier.updatedAt)}</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                >
                  Close
                </button>
                {canEditSuppliers && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleEdit(selectedSupplier);
                    }}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2 transition-colors shadow-brand focus-ring"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Supplier
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    router.push(`/admin/inventory?supplier=${selectedSupplier.id}`);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors focus-ring"
                >
                  <Package className="w-4 h-4" />
                  View Products
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
