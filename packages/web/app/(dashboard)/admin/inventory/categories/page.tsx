// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\categories\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, Plus, Edit, Trash2, RefreshCw,
  FolderTree, FolderOpen, Package, Search,
  Loader2, Lock, Eye, ArrowUpDown, Grid, List,
  X, AlertCircle, CheckCircle, Info, HelpCircle,
  ChevronRight, ChevronDown, MoreVertical, Copy,
  Link2, ExternalLink, Star, Award, Globe, Archive,
  Clock, Calendar, Hash, Building2, Database,
  Users, BarChart3, PieChart, TrendingUp, TrendingDown,
  Filter, AlertTriangle,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { useAuth } from '../../../../../hooks/useAuth';
import { categoryService } from '../../../../../services/categoryService';
import { inventoryService } from '../../../../../services/inventoryService';
import { toast } from '../../../../../utils/toast-manager';
import { formatDate, formatNumber } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';
import { Category } from '../../../../../types/category';

// ============================================
// TYPES
// ============================================

interface CategoryWithStats extends Category {
  productCount?: number;
  childrenCount?: number;
  parentName?: string;
  businessUnitName?: string;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const CategoryCard: React.FC<{
  category: CategoryWithStats;
  onEdit: (category: CategoryWithStats) => void;
  onDelete: (category: CategoryWithStats) => void;
  onView: (category: CategoryWithStats) => void;
  canEdit: boolean;
  canDelete: boolean;
}> = ({ category, onEdit, onDelete, onView, canEdit, canDelete }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all"
    >
      <div className="flex items-start justify-between">
        <button
          onClick={() => onView(category)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
        >
          <div className="p-2 bg-brand-50 dark:bg-brand-950/20 rounded-lg flex-shrink-0">
            <Tag className="w-5 h-5 text-brand-500" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {category.name}
            </h4>
            {category.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {category.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400 dark:text-gray-500">
              {category.parentName && (
                <span className="flex items-center gap-0.5">
                  <FolderTree className="w-3 h-3" />
                  {category.parentName}
                </span>
              )}
              {category.businessUnitName && (
                <span className="flex items-center gap-0.5">
                  <Building2 className="w-3 h-3" />
                  {category.businessUnitName}
                </span>
              )}
              {category.isActive === false && (
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500">
                  Inactive
                </span>
              )}
            </div>
          </div>
        </button>
        <div className="flex gap-1 flex-shrink-0 ml-2">
          <button
            onClick={() => onView(category)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
            title="View"
          >
            <Eye className="w-4 h-4 text-gray-500" />
          </button>
          {canEdit && (
            <button
              onClick={() => onEdit(category)}
              className="p-1 hover:bg-brand-100 dark:hover:bg-brand-950/30 rounded transition-colors focus-ring"
              title="Edit"
            >
              <Edit className="w-4 h-4 text-brand-500" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(category)}
              className="p-1 hover:bg-brand-accent-100 dark:hover:bg-brand-accent-950/30 rounded transition-colors focus-ring"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-brand-accent-500" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1 tabular-nums">
            <Package className="w-3.5 h-3.5" />
            {category.productCount || 0} products
          </span>
          {category.childrenCount !== undefined && category.childrenCount > 0 && (
            <span className="flex items-center gap-1 tabular-nums">
              <FolderTree className="w-3.5 h-3.5" />
              {category.childrenCount} sub-categories
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatDate(category.createdAt)}
          </span>
        </div>
        <button
          onClick={() => onView(category)}
          className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 flex items-center gap-1 focus-ring transition-colors"
        >
          <ChevronRight className="w-3 h-3" />
          View Details
        </button>
      </div>
    </motion.div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function InventoryCategoriesPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { canView, canCreate, canEdit, canDelete, canManage } = usePermission();
  
  const initialLoadRef = useRef(false);
  const loadDataRef = useRef(false);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortField, setSortField] = useState<'name' | 'productCount' | 'createdAt'>('name');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithStats | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 
                          (user?.businessUnits?.[0] as any)?.id || 
                          localStorage.getItem('businessUnitId') || '';

  const canViewCategories = canView(PermissionResource.CATEGORY) || canManage(PermissionResource.CATEGORY);
  const canCreateCategories = canCreate(PermissionResource.CATEGORY) || canManage(PermissionResource.CATEGORY);
  const canEditCategories = canEdit(PermissionResource.CATEGORY) || canManage(PermissionResource.CATEGORY);
  const canDeleteCategories = canDelete(PermissionResource.CATEGORY) || canManage(PermissionResource.CATEGORY);

  const loadCategories = useCallback(async (showLoading = true) => {
    if (loadDataRef.current) {
      console.log('⏭️ Skipping load - already loading');
      return;
    }
    
    if (!canViewCategories) {
      setLoading(false);
      return;
    }
    
    loadDataRef.current = true;
    
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      const data = await inventoryService.getCategories(businessUnitId);
      
      const categoriesWithStats = (data || []).map((cat: any) => ({
        id: cat.id || '',
        name: cat.name || 'Unnamed',
        description: cat.description || '',
        parentId: cat.parentId || '',
        parentName: cat.parent?.name,
        businessUnitId: cat.businessUnitId || businessUnitId,
        businessUnitName: cat.businessUnit?.name,
        createdAt: cat.createdAt || new Date().toISOString(),
        updatedAt: cat.updatedAt || new Date().toISOString(),
        isActive: cat.isActive !== false,
        productCount: cat.productCount || cat._count?.products || 0,
        childrenCount: cat.children?.length || 0,
        slug: cat.slug || '',
        sortOrder: cat.sortOrder || 0,
        metadata: cat.metadata || {},
      }));
      
      setCategories(categoriesWithStats);
      initialLoadRef.current = true;
      
    } catch (error: any) {
      console.error('Failed to load categories:', error);
      const errorMsg = error?.message || 'Failed to load categories';
      setError(errorMsg);
      toast.error(errorMsg);
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadDataRef.current = false;
    }
  }, [businessUnitId, canViewCategories]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCategories(false);
    toast.success('Categories refreshed');
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await categoryService.deleteCategory(categoryToDelete.id);
      toast.success('Category deleted successfully');
      setShowDeleteModal(false);
      setCategoryToDelete(null);
      await loadCategories(false);
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      const errorMsg = error?.message || 'Failed to delete category';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (category: CategoryWithStats) => {
    router.push(`/admin/categories/${category.id}/edit`);
  };

  const handleView = (category: CategoryWithStats) => {
    setSelectedCategory(category);
    setShowDetailModal(true);
  };

  const filteredCategories = useMemo(() => {
    let result = [...categories];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(cat =>
        cat.name.toLowerCase().includes(query) ||
        (cat.description && cat.description.toLowerCase().includes(query))
      );
    }
    
    if (filterActive === 'active') {
      result = result.filter(cat => cat.isActive !== false);
    } else if (filterActive === 'inactive') {
      result = result.filter(cat => cat.isActive === false);
    }
    
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      return sortOrder === 'asc' 
        ? (aVal || 0) - (bVal || 0) 
        : (bVal || 0) - (aVal || 0);
    });
    
    return result;
  }, [categories, searchQuery, filterActive, sortField, sortOrder]);

  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter(c => c.isActive !== false).length;
    const inactive = categories.filter(c => c.isActive === false).length;
    const totalProducts = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);
    const categoriesWithChildren = categories.filter(c => (c.childrenCount || 0) > 0).length;
    
    return { total, active, inactive, totalProducts, categoriesWithChildren };
  }, [categories]);

  useEffect(() => {
    if (isAuthenticated && businessUnitId && !initialLoadRef.current) {
      loadCategories();
    }
  }, [isAuthenticated, businessUnitId, loadCategories]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Please Login</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You need to be logged in to manage categories.</p>
      </div>
    );
  }

  if (!canViewCategories) {
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
            You don't have permission to view categories. Please contact your administrator.
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

  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const hasActiveFilters = searchQuery || filterActive !== 'all';

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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FolderTree className="w-7 h-7 sm:w-8 sm:h-8 text-brand-500" />
            Categories
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
            {stats.total} categories • {stats.totalProducts} products • {stats.categoriesWithChildren} with sub-categories
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
            {(['grid', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 focus-ring ${
                  viewMode === mode
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {mode === 'grid' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors focus-ring"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
          {canCreateCategories && (
            <Link
              href="/admin/categories/create"
              className="px-3 sm:px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-1 sm:gap-2 transition-colors text-sm shadow-brand focus-ring"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Category</span>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Categories</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
          <p className="text-2xl font-bold text-success-600 dark:text-success-400 tabular-nums">{stats.active}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Inactive</p>
          <p className="text-2xl font-bold text-gray-400 dark:text-gray-500 tabular-nums">{stats.inactive}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Products</p>
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 tabular-nums">{stats.totalProducts}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
            />
          </div>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as 'name' | 'productCount' | 'createdAt')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          >
            <option value="name">Sort by Name</option>
            <option value="productCount">Sort by Products</option>
            <option value="createdAt">Sort by Created Date</option>
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterActive('all');
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
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                  <button
                    onClick={() => setFilterActive('all')}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors focus-ring ${
                      filterActive === 'all'
                        ? 'bg-brand-100 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    All ({stats.total})
                  </button>
                  <button
                    onClick={() => setFilterActive('active')}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors focus-ring ${
                      filterActive === 'active'
                        ? 'bg-success-100 dark:bg-success-950/30 text-success-700 dark:text-success-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    Active ({stats.active})
                  </button>
                  <button
                    onClick={() => setFilterActive('inactive')}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors focus-ring ${
                      filterActive === 'inactive'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    Inactive ({stats.inactive})
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No categories found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {searchQuery || filterActive !== 'all' ? 'Try adjusting your filters' : 'Create your first category'}
          </p>
          {canCreateCategories && !searchQuery && filterActive === 'all' && (
            <Link
              href="/admin/categories/create"
              className="mt-4 inline-block px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-brand focus-ring"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Add Category
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={handleEdit}
              onDelete={(cat) => {
                setCategoryToDelete(cat);
                setShowDeleteModal(true);
              }}
              onView={handleView}
              canEdit={canEditCategories}
              canDelete={canDeleteCategories}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Products</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-brand-50/50 dark:hover:bg-brand-950/10 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleView(category)}
                        className="flex items-center gap-2 hover:text-brand-600 dark:hover:text-brand-400 transition-colors focus-ring"
                      >
                        <Tag className="w-4 h-4 text-brand-500" />
                        <span className="font-medium text-gray-900 dark:text-white">{category.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate hidden md:table-cell">
                      {category.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                      {category.productCount || 0}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        category.isActive !== false
                          ? 'bg-success-100 text-success-700 dark:bg-success-950/30 dark:text-success-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
                      }`}>
                        {category.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleView(category)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {canEditCategories && (
                          <button
                            onClick={() => handleEdit(category)}
                            className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-950/30 rounded transition-colors focus-ring"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-brand-500" />
                          </button>
                        )}
                        {canDeleteCategories && (
                          <button
                            onClick={() => {
                              setCategoryToDelete(category);
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && categoryToDelete && (
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
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Category</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{categoryToDelete.name}</strong>?
                </p>
                {categoryToDelete.productCount && categoryToDelete.productCount > 0 && (
                  <div className="p-3 bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-800 rounded-lg mb-4 text-sm text-warning-700 dark:text-warning-300">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    This category has {categoryToDelete.productCount} product(s) associated with it.
                    Deleting it will remove the category from all products.
                  </div>
                )}
                {categoryToDelete.childrenCount && categoryToDelete.childrenCount > 0 && (
                  <div className="p-3 bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-800 rounded-lg mb-4 text-sm text-warning-700 dark:text-warning-300">
                    <FolderTree className="w-4 h-4 inline mr-1" />
                    This category has {categoryToDelete.childrenCount} sub-category(s). They will be moved to the parent category.
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
                  className="px-4 py-2 bg-brand-accent-600 text-white rounded-lg hover:bg-brand-accent-700 flex items-center gap-2 disabled:opacity-50 transition-colors shadow-brand focus-ring"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete Category
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedCategory && (
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
                  <FolderTree className="w-6 h-6 text-brand-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedCategory.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Category Details
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Category ID</p>
                  <p className="font-mono text-sm text-gray-900 dark:text-white">{selectedCategory.id}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedCategory.isActive !== false
                      ? 'bg-success-100 text-success-700 dark:bg-success-950/30 dark:text-success-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
                  }`}>
                    {selectedCategory.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {selectedCategory.parentName && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Parent Category</p>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedCategory.parentName}</p>
                  </div>
                )}
                {selectedCategory.businessUnitName && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Business Unit</p>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedCategory.businessUnitName}</p>
                  </div>
                )}
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Products</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                    {selectedCategory.productCount || 0}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Sub-Categories</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                    {selectedCategory.childrenCount || 0}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg sm:col-span-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Description</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedCategory.description || 'No description provided'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                  <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedCategory.createdAt)}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Last Updated</p>
                  <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedCategory.updatedAt)}</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                >
                  Close
                </button>
                {canEditCategories && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleEdit(selectedCategory);
                    }}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2 transition-colors shadow-brand focus-ring"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Category
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    router.push(`/admin/inventory?category=${selectedCategory.id}`);
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
