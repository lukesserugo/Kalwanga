// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\categories\page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, RefreshCw, FolderTree, Grid, List,
  ArrowUpDown, Star, StarOff, Eye, EyeOff, Edit,
  Trash2, Lock, AlertTriangle, Loader2, X,
  CheckCircle, XCircle, Package
} from 'lucide-react';
import { usePermission } from '../../../../hooks/usePermission';
import { useAuth } from '../../../../hooks/useAuth';
import { categoryService } from '../../../../services/categoryService';
import { toast } from '../../../../utils/toast-manager';
import { PermissionResource } from '../../../../types/enums';
import { CategoryGrid } from '../../../../components/categories/CategoryGrid';
import { Category } from '../../../../types/category';

export default function AdminCategoriesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete, canManage } = usePermission();
  
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 'default';

  // Fix: Use string format with colon for permissions
  const canViewCategories = canView?.(`${PermissionResource.CATEGORY}:view`) || canManage?.(`${PermissionResource.CATEGORY}:manage`) || false;
  const canCreateCategories = canCreate?.(`${PermissionResource.CATEGORY}:create`) || canManage?.(`${PermissionResource.CATEGORY}:manage`) || false;
  const canEditCategories = canEdit?.(`${PermissionResource.CATEGORY}:edit`) || canManage?.(`${PermissionResource.CATEGORY}:manage`) || false;
  const canDeleteCategories = canDelete?.(`${PermissionResource.CATEGORY}:delete`) || canManage?.(`${PermissionResource.CATEGORY}:manage`) || false;

  const loadCategories = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      if (!showLoading) setRefreshing(true);
      
      const data = await categoryService.getAllCategories({
        limit: 100,
        businessUnitId,
        isActive: true,
      });
      
      setCategories(data || []);
      
      // Calculate stats
      const total = data?.length || 0;
      const active = data?.filter((cat: Category) => cat.isActive).length || 0;
      const inactive = total - active;
      setStats({ total, active, inactive });
      
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Failed to load categories');
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleRefresh = async () => {
    await loadCategories(false);
    toast.success('Categories refreshed');
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    setDeleting(true);
    try {
      await categoryService.deleteCategory(categoryToDelete.id);
      toast.success(`Category "${categoryToDelete.name}" deleted successfully`);
      setShowDeleteModal(false);
      setCategoryToDelete(null);
      await loadCategories(false);
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      toast.error(error?.message || 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (category: Category) => {
    try {
      const newStatus = !category.isActive;
      await categoryService.toggleCategoryStatus(category.id, newStatus);
      toast.success(`Category "${category.name}" ${newStatus ? 'activated' : 'deactivated'}`);
      await loadCategories(false);
    } catch (error: any) {
      console.error('Failed to toggle category status:', error);
      toast.error(error?.message || 'Failed to update category status');
    }
  };

  const filteredCategories = categories
    .filter(cat => {
      if (!searchQuery) return true;
      const search = searchQuery.toLowerCase();
      return cat.name.toLowerCase().includes(search) ||
        cat.description?.toLowerCase().includes(search);
    })
    .sort((a, b) => {
      return sortOrder === 'asc' 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    });

  // Permission guard
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
          <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to view categories.</p>
          <button
            onClick={() => router.push('/admin/inventory')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Inventory
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ============================================
          HEADER
          ============================================ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FolderTree className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
            Categories
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {stats.total} categories • {stats.active} active • {stats.inactive} inactive
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          {/* View Mode Toggle */}
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            {(['grid', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {mode === 'grid' && <Grid className="w-4 h-4" />}
                {mode === 'list' && <List className="w-4 h-4" />}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Sort Toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle sort order"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
          
          {/* Add Category */}
          {canCreateCategories && (
            <button
              onClick={() => router.push('/admin/categories/create')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          )}
        </div>
      </div>

      {/* ============================================
          SEARCH
          ============================================ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ============================================
          CATEGORIES DISPLAY
          ============================================ */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-500 dark:text-gray-400 mt-2">Loading categories...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FolderTree className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No categories found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {searchQuery ? 'Try adjusting your search' : 'Create your first category'}
          </p>
          {canCreateCategories && !searchQuery && (
            <button
              onClick={() => router.push('/admin/categories/create')}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <CategoryGrid
          categories={filteredCategories}
          onEdit={(cat) => router.push(`/admin/categories/${cat.id}/edit`)}
          onDelete={(cat) => {
            setCategoryToDelete(cat);
            setShowDeleteModal(true);
          }}
          onView={(cat) => router.push(`/admin/categories/${cat.id}`)}
          onToggleStatus={handleToggleStatus}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Products</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCategories.map((category) => (
                  <motion.tr
                    key={category.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/admin/categories/${category.id}`)}
                        className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                      >
                        <FolderTree className={`w-4 h-4 ${category.isActive ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className={`font-medium ${category.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                          {category.name}
                        </span>
                        {(category as any).featured && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {category.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Package className="w-3 h-3 text-gray-400" />
                        {(category as any).productCount || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => canEditCategories && handleToggleStatus(category)}
                        disabled={!canEditCategories}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          category.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        } ${canEditCategories ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        {category.isActive ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {category.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => router.push(`/admin/categories/${category.id}`)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {canEditCategories && (
                          <button
                            onClick={() => router.push(`/admin/categories/${category.id}/edit`)}
                            className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-blue-500" />
                          </button>
                        )}
                        {canDeleteCategories && (
                          <button
                            onClick={() => {
                              setCategoryToDelete(category);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Footer with count */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredCategories.length} of {categories.length} categories
              {searchQuery && ` (filtered from ${categories.length})`}
            </p>
          </div>
        </div>
      )}

      {/* ============================================
          DELETE MODAL
          ============================================ */}
      <AnimatePresence>
        {showDeleteModal && categoryToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              {/* Close button */}
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>

              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Category</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{categoryToDelete.name}</strong>?
                </p>
                {(categoryToDelete as any).productCount > 0 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-4">
                    ⚠️ This category has {(categoryToDelete as any).productCount} products that will need to be reassigned.
                  </p>
                )}
                {(categoryToDelete as any).childCount > 0 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-4">
                    ⚠️ This category has {(categoryToDelete as any).childCount} subcategories that will be affected.
                  </p>
                )}
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
