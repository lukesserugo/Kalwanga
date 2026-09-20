// packages/web/app/(dashboard)/admin/categories/create/page.tsx

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FolderTree,
  Lock,
  Sparkles,
  Info,
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { CategoryForm } from '../../../../../components/categories/CategoryForm';
import { PermissionResource } from '../../../../../types/enums';

export default function CreateCategoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canCreate, canManage } = usePermission();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const businessUnitId =
    user?.businessUnits?.[0]?.businessUnitId || 'default';

  const canCreateCategory =
    canCreate?.(`${PermissionResource.CATEGORY}:create`) ||
    canManage?.(`${PermissionResource.CATEGORY}:manage`) ||
    false;

  const handleNavigateBack = () => {
    if (isSubmitting) return;
    router.push('/admin/categories');
  };

  const handleSuccess = () => {
    setIsSubmitting(false);
    router.push('/admin/categories');
    router.refresh();
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    router.push('/admin/categories');
  };

  // ---- Permission guard ----
  if (!canCreateCategory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-md"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Access Restricted
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You don't have permission to create categories.
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
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-start gap-4">
        <button
          onClick={handleNavigateBack}
          disabled={isSubmitting}
          className="mt-1 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
              <FolderTree className="w-5 h-5" />
            </span>
            Create Category
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Add a new category to organize your products. Slugs are
            auto-generated from the name and can be edited.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Modern fields supported
          </span>
        </div>
      </div>

      {/* ---- Form ---- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 sm:p-8"
      >
        <CategoryForm
          businessUnitId={businessUnitId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          onSubmittingChange={setIsSubmitting}
        />
      </motion.div>

      {/* ---- Context footer ---- */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
        <Info className="w-3.5 h-3.5" />
        <span>Business Unit:</span>
        <span className="font-mono text-gray-500 dark:text-gray-400">
          {businessUnitId === 'default'
            ? 'Default (will be resolved on save)'
            : businessUnitId.slice(0, 12) + '…'}
        </span>
      </div>
    </div>
  );
}
