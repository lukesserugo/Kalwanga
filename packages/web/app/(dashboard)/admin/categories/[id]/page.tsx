// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\categories\[id]\page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Edit, Trash2, Package, FolderTree,
  Star, EyeOff, Loader2, Lock, AlertCircle,
  CheckCircle, XCircle, Calendar, Clock, Tag,
  Building, ChevronRight, X
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { categoryService } from '../../../../../services/categoryService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';

export default function CategoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();
  const { canEdit, canDelete, canManage } = usePermission();
  
  const [category, setCategory] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 'default';
  
  // Fix: Use string format with colon for permissions
  const canEditCategory = canEdit?.(`${PermissionResource.CATEGORY}:edit`) || 
                          canManage?.(`${PermissionResource.CATEGORY}:manage`) || 
                          false;
  const canDeleteCategory = canDelete?.(`${PermissionResource.CATEGORY}:delete`) || 
                            canManage?.(`${PermissionResource.CATEGORY}:manage`) || 
                            false;

  const loadCategory = useCallback(async () => {
    try {
      setLoading(true);
      const [catData, catWithProducts] = await Promise.all([
        categoryService.getCategoryById(id),
        categoryService.getCategoryWithProducts(id),
      ]);
      setCategory(catData);
      setProducts(catWithProducts?.products || []);
    } catch (error) {
      console.error('Failed to load category:', error);
      toast.error('Failed to load category');
      router.push('/admin/categories');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (id) {
      loadCategory();
    }
  }, [id, loadCategory]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await categoryService.deleteCategory(id);
      toast.success('Category deleted successfully');
      router.push('/admin/categories');
      router.refresh();
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      toast.error(error?.message || 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const handleNavigateBack = () => {
    router.push('/admin/categories');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-500 dark:text-gray-400 mt-2">Loading category...</p>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-6xl mb-4">📂</div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Category not found</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">The category you're looking for doesn't exist.</p>
          <button
            onClick={handleNavigateBack}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Categories
          </button>
        </motion.div>
      </div>
    );
  }

  const productCount = products.length;
  const hasProducts = productCount > 0;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ============================================
          HEADER - Fix: Use button instead of Link
          ============================================ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleNavigateBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {category.name}
              {category.featured && (
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              )}
              {!category.isActive && (
                <EyeOff className="w-5 h-5 text-gray-400" />
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span>ID: {category.id.slice(0, 8)}</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full" />
              <span>{productCount} products</span>
              {category.parent && (
                <>
                  <span className="w-1 h-1 bg-gray-300 rounded-full" />
                  <span>Parent: {category.parent.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditCategory && (
            <button
              onClick={() => router.push(`/admin/categories/${id}/edit`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
          {canDeleteCategory && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* ============================================
          CATEGORY INFO
          ============================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Details Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-500" />
            Category Details
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
              <p className="text-gray-900 dark:text-white font-medium">{category.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Description</p>
              <p className="text-gray-900 dark:text-white">
                {category.description || 'No description provided'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  category.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400'
                }`}>
                  {category.isActive ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  {category.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Featured</p>
                <span className="inline-flex items-center gap-1">
                  {category.featured ? (
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                <p className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  {formatDate(category.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Updated</p>
                <p className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  {formatDate(category.updatedAt)}
                </p>
              </div>
            </div>
            {category.parentId && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Parent Category</p>
                <p className="text-gray-900 dark:text-white">{category.parent?.name || 'Unknown'}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Business Unit</p>
              <p className="text-sm text-gray-900 dark:text-white font-mono flex items-center gap-1">
                <Building className="w-3 h-3 text-gray-400" />
                {category.businessUnitId}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Products Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-green-500" />
              Products in Category
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({productCount})
              </span>
            </h3>
            {hasProducts && productCount > 5 && (
              <button
                onClick={() => setShowAllProducts(!showAllProducts)}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                {showAllProducts ? 'Show Less' : 'View All'}
              </button>
            )}
          </div>
          
          {!hasProducts ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No products in this category</p>
              <button
                onClick={() => router.push('/admin/catalog/add?categoryId=' + category.id)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Add product →
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(showAllProducts ? products : products.slice(0, 5)).map((product) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/catalog/${product.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {product.sku}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(product.unitPrice)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </motion.div>
              ))}
              {!showAllProducts && productCount > 5 && (
                <button
                  onClick={() => setShowAllProducts(true)}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 py-2"
                >
                  Show {productCount - 5} more products
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* ============================================
          DELETE MODAL
          ============================================ */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>

              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Category</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{category.name}</strong>?
                </p>
                {hasProducts && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-4">
                    ⚠️ This category has {productCount} products that will need to be reassigned.
                  </p>
                )}
                {category.children && category.children.length > 0 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-4">
                    ⚠️ This category has {category.children.length} subcategories that will be affected.
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
