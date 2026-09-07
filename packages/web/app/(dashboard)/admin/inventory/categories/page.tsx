// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\categories\page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Tag, Plus, Edit, Trash2, RefreshCw,
  FolderTree, FolderOpen, Package, Search,
  Loader2, Lock, Eye, ArrowUpDown, Grid, List
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { useAuth } from '../../../../../hooks/useAuth';
import { categoryService } from '../../../../../services/categoryService';
import { toast } from '../../../../../utils/toast-manager';
import { PermissionResource } from '../../../../../types/enums';
import { Category } from '../../../../../types/category';

export default function InventoryCategoriesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete, canManage } = usePermission();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 'default';

  // Permission checks
  const canViewCategories = canView(PermissionResource.CATEGORY) || canManage(PermissionResource.CATEGORY);
  const canCreateCategories = canCreate(PermissionResource.CATEGORY) || canManage(PermissionResource.CATEGORY);
  const canEditCategories = canEdit(PermissionResource.CATEGORY) || canManage(PermissionResource.CATEGORY);
  const canDeleteCategories = canDelete(PermissionResource.CATEGORY) || canManage(PermissionResource.CATEGORY);

  // Load categories
  const loadCategories = useCallback(async (showLoading = true) => {
    if (!canViewCategories) {
      setLoading(false);
      return;
    }
    
    try {
      if (showLoading) setLoading(true);
      
      const data = await categoryService.getAllCategories({
        limit: 100,
        businessUnitId,
        isActive: true,
      });
      
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Failed to load categories');
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId, canViewCategories]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCategories(false);
    toast.success('Categories refreshed');
  };

  // Delete handler
  const handleDelete = async () => {
    if (!categoryToDelete) return;
    setDeleting(true);
    try {
      await categoryService.deleteCategory(categoryToDelete.id);
      toast.success('Category deleted successfully');
      setShowDeleteModal(false);
      setCategoryToDelete(null);
      loadCategories(false);
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  // Filter and sort categories
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

  // Access denied
  if (!canViewCategories) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to view categories.</p>
      </div>
    );
  }

  // Loading state
  if (loading && categories.length === 0) {
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
            <FolderTree className="w-8 h-8 text-blue-500" />
            Categories
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {categories.length} categories • Manage product categories
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
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
          {canCreateCategories && (
            <Link
              href="/admin/categories/create"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </Link>
          )}
        </div>
      </div>

      {/* Search */}
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
        </div>
      </div>

      {/* Categories Display */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No categories found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {searchQuery ? 'Try adjusting your search' : 'Create your first category'}
          </p>
          {canCreateCategories && !searchQuery && (
            <Link
              href="/admin/categories/create"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Add Category
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((category) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <Link href={`/admin/categories/${category.id}`} className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
                    <Tag className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">{category.name}</h4>
                    {category.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{category.description}</p>
                    )}
                  </div>
                </Link>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  {canEditCategories && (
                    <Link
                      href={`/admin/categories/${category.id}/edit`}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      aria-label="Edit category"
                    >
                      <Edit className="w-4 h-4 text-gray-500" />
                    </Link>
                  )}
                  {canDeleteCategories && (
                    <button
                      onClick={() => {
                        setCategoryToDelete(category);
                        setShowDeleteModal(true);
                      }}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      aria-label="Delete category"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {(category as any).productCount || 0} products
                </span>
                <Link
                  href={`/admin/categories/${category.id}`}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  View
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Products</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/categories/${category.id}`} className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-blue-500" />
                        <span className="font-medium text-gray-900 dark:text-white">{category.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {category.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {(category as any).productCount || 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/categories/${category.id}`}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </Link>
                        {canEditCategories && (
                          <Link
                            href={`/admin/categories/${category.id}/edit`}
                            className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-blue-500" />
                          </Link>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Category</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete <strong>{categoryToDelete.name}</strong>?
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
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
          </div>
        </div>
      )}
    </div>
  );
}
