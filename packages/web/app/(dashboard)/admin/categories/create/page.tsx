// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\categories\create\page.tsx

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, FolderTree, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { CategoryForm } from '../../../../../components/categories/CategoryForm';
import { PermissionResource } from '../../../../../types/enums';

export default function CreateCategoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canCreate, canManage } = usePermission();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 'default';
  
  // Fix: Use string format with colon for permissions
  const canCreateCategory = canCreate?.(`${PermissionResource.CATEGORY}:create`) || 
                            canManage?.(`${PermissionResource.CATEGORY}:manage`) || 
                            false;

  // Handle navigation with loading state
  const handleNavigateBack = () => {
    router.push('/admin/categories');
  };

  const handleSuccess = () => {
    setIsSubmitting(false);
    router.push('/admin/categories');
    router.refresh();
  };

  const handleCancel = () => {
    router.push('/admin/categories');
  };

  // Permission guard
  if (!canCreateCategory) {
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
          <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to create categories.</p>
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
      {/* Header - Fix: Use button instead of Link to avoid hydration errors */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleNavigateBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Go back"
          disabled={isSubmitting}
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-blue-500" />
            Create Category
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Add a new category to your catalog</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
      >
        <CategoryForm
          businessUnitId={businessUnitId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </motion.div>

      {/* Business Unit Info */}
      <div className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center">
        <span>Business Unit: </span>
        <span className="font-mono">
          {businessUnitId === 'default' ? 'Default (will be resolved)' : businessUnitId.slice(0, 8) + '...'}
        </span>
      </div>
    </div>
  );
}
