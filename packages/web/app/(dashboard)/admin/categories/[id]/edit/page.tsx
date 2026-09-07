// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\categories\[id]\edit\page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, FolderTree, Loader2, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../../../../hooks/useAuth';
import { usePermission } from '../../../../../../hooks/usePermission';
import { categoryService } from '../../../../../../services/categoryService';
import { CategoryForm } from '../../../../../../components/categories/CategoryForm';
import { PermissionResource } from '../../../../../../types/enums';
import { toast } from '../../../../../../utils/toast-manager';

export default function EditCategoryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();
  const { canEdit, canManage } = usePermission();
  const [loading, setLoading] = useState(true);
  const [categoryExists, setCategoryExists] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 'default';
  
  // Fix: Use string format with colon for permissions
  const canEditCategory = canEdit?.(`${PermissionResource.CATEGORY}:edit`) || 
                          canManage?.(`${PermissionResource.CATEGORY}:manage`) || 
                          false;

  const verifyCategory = useCallback(async () => {
    if (!id) {
      setError('Category ID is missing');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await categoryService.getCategoryById(id);
      setCategoryExists(true);
    } catch (error: any) {
      console.error('Failed to verify category:', error);
      setError(error?.message || 'Category not found');
      toast.error('Category not found');
      setTimeout(() => {
        router.push('/admin/categories');
      }, 1500);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    verifyCategory();
  }, [verifyCategory]);

  const handleNavigateBack = () => {
    router.push('/admin/categories');
  };

  const handleSuccess = () => {
    router.push('/admin/categories');
    router.refresh();
  };

  const handleCancel = () => {
    router.push('/admin/categories');
  };

  // Permission guard
  if (!canEditCategory) {
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
          <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to edit categories.</p>
          <button
            onClick={handleNavigateBack}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Categories
          </button>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-500 dark:text-gray-400 mt-2">Loading category...</p>
      </div>
    );
  }

  if (error || !categoryExists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Category Not Found</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {error || 'The category you are trying to edit does not exist.'}
          </p>
          <button
            onClick={handleNavigateBack}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Categories
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      {/* Header - Fix: Use button instead of Link */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleNavigateBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-blue-500" />
            Edit Category
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Update category information
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
      >
        <CategoryForm
          categoryId={id}
          businessUnitId={businessUnitId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </motion.div>

      {/* Category ID Info */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Editing category: <span className="font-mono">{id.slice(0, 8)}...</span>
        </span>
        <span>
          Business Unit: {businessUnitId === 'default' ? 'Default (will be resolved)' : businessUnitId.slice(0, 8) + '...'}
        </span>
      </div>
    </div>
  );
}
