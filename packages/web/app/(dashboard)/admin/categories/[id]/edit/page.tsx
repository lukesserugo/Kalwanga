// packages/web/app/(dashboard)/admin/categories/[id]/edit/page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FolderTree,
  Loader2,
  Lock,
  AlertCircle,
  Hash,
  Info,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

import { useAuth } from '../../../../../../hooks/useAuth';
import { usePermission } from '../../../../../../hooks/usePermission';
import { categoryService } from '../../../../../../services/categoryService';
import { CategoryForm } from '../../../../../../components/categories/CategoryForm';
import { CategoryAvatar } from '../../../../../../components/categories/CategoryAvatar';
import { PermissionResource } from '../../../../../../types/enums';
import { toast } from '../../../../../../utils/toast-manager';
import type { Category } from '../../../../../../types/category';

export default function EditCategoryPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { user } = useAuth();
  const { canEdit, canManage } = usePermission();

  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const businessUnitId =
    user?.businessUnits?.[0]?.businessUnitId || 'default';

  const canEditCategory =
    canEdit?.(`${PermissionResource.CATEGORY}:edit`) ||
    canManage?.(`${PermissionResource.CATEGORY}:manage`) ||
    false;

  // ---- Fetch the category once ----
  const loadCategory = useCallback(async () => {
    if (!id) {
      setError('Category ID is missing');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await categoryService.getCategoryById(id);
      setCategory(data);
    } catch (err: any) {
      console.error('Failed to load category for editing:', err);
      const message = err?.message || 'Category not found';
      setError(message);
      toast.error(message);
      // Give the user a moment to read the error before redirecting.
      setTimeout(() => router.push('/admin/categories'), 1500);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadCategory();
  }, [loadCategory]);

  // ---- Navigation ----
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
  if (!canEditCategory) {
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
            You don't have permission to edit categories.
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

  // ---- Loading ----
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 animate-pulse">
        {/* Breadcrumb */}
        <div className="h-4 w-56 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-80 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        {/* Hero preview */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </div>
        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 h-96" />
      </div>
    );
  }

  // ---- Error / not found ----
  if (error || !category) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-md"
        >
          <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Category Not Found
          </h2>
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

  // ---- Render ----
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* BREADCRUMB */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <button
          onClick={handleNavigateBack}
          disabled={isSubmitting}
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
        >
          Categories
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <button
          onClick={() =>
            !isSubmitting &&
            router.push(`/admin/categories/${category.id}`)
          }
          disabled={isSubmitting}
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[12rem] disabled:opacity-50"
        >
          {category.name}
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-700 dark:text-gray-300 font-medium">
          Edit
        </span>
      </nav>

      {/* HEADER */}
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
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shrink-0">
              <FolderTree className="w-5 h-5" />
            </span>
            <span className="truncate">Edit Category</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Update name, media, hierarchy, and SEO. Changes are saved
            immediately.
          </p>
        </div>

        <button
          onClick={() =>
            !isSubmitting &&
            router.push(`/admin/categories/${category.id}`)
          }
          disabled={isSubmitting}
          className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          title="View public detail page"
        >
          <ExternalLink className="w-4 h-4" />
          View
        </button>
      </div>

      {/* PREVIEW CARD */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div
          className="h-1.5"
          style={{
            background:
              category.color ||
              'linear-gradient(to right, #3B82F6, #6366F1)',
          }}
        />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <CategoryAvatar
            category={category}
            size="xl"
            rounded="xl"
            className="shadow-sm ring-4 ring-white dark:ring-gray-800 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Currently editing
            </p>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
              {category.name}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1 font-mono">
                <Hash className="w-3 h-3" />
                {category.slug}
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span className="inline-flex items-center gap-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    category.isActive ? 'bg-emerald-500' : 'bg-gray-400'
                  }`}
                />
                {category.isActive ? 'Active' : 'Inactive'}
              </span>
              {(category as any).featured && (
                <>
                  <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    ★ Featured
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* FORM */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 sm:p-8"
      >
        <CategoryForm
          initialData={category}
          businessUnitId={businessUnitId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          onSubmittingChange={setIsSubmitting}
        />
      </motion.div>

      {/* CONTEXT FOOTER */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isSubmitting
                ? 'bg-amber-500 animate-pulse'
                : 'bg-emerald-500'
            }`}
          />
          {isSubmitting ? (
            <>Saving changes…</>
          ) : (
            <>
              Editing category:{' '}
              <span className="font-mono">{category.id.slice(0, 12)}…</span>
            </>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          Business Unit:{' '}
          <span className="font-mono">
            {businessUnitId === 'default'
              ? 'Default'
              : businessUnitId.slice(0, 12) + '…'}
          </span>
        </span>
      </div>
    </div>
  );
}
