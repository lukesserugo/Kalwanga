// packages/web/app/(dashboard)/admin/categories/page.tsx

'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  RefreshCw,
  FolderTree,
  Grid3x3,
  List as ListIcon,
  ArrowUpDown,
  Lock,
  AlertTriangle,
  Loader2,
  X,
  Package,
  Layers,
  Star,
  Image as ImageIcon,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';

import { usePermission } from '../../../../hooks/usePermission';
import { useAuth } from '../../../../hooks/useAuth';
import { categoryService } from '../../../../services/categoryService';
import { toast } from '../../../../utils/toast-manager';
import { PermissionResource } from '../../../../types/enums';
import { CategoryGrid } from '../../../../components/categories/CategoryGrid';
import { CategoryAvatar } from '../../../../components/categories/CategoryAvatar';
import type { Category } from '../../../../types/category';

// ============================================
// HELPERS
// ============================================

function productCountOf(cat: Category): number {
  return cat.productCount ?? cat._count?.products ?? 0;
}

function childCountOf(cat: Category): number {
  return cat.childCount ?? cat._count?.children ?? 0;
}

// ============================================
// PAGE
// ============================================

export default function AdminCategoriesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete, canManage } = usePermission();

  // ---- State ----
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const businessUnitId =
    user?.businessUnits?.[0]?.businessUnitId || 'default';

  // ---- Permissions ----
  const canViewCategories =
    canView?.(`${PermissionResource.CATEGORY}:view`) ||
    canManage?.(`${PermissionResource.CATEGORY}:manage`) ||
    false;
  const canCreateCategories =
    canCreate?.(`${PermissionResource.CATEGORY}:create`) ||
    canManage?.(`${PermissionResource.CATEGORY}:manage`) ||
    false;
  const canEditCategories =
    canEdit?.(`${PermissionResource.CATEGORY}:edit`) ||
    canManage?.(`${PermissionResource.CATEGORY}:manage`) ||
    false;
  const canDeleteCategories =
    canDelete?.(`${PermissionResource.CATEGORY}:delete`) ||
    canManage?.(`${PermissionResource.CATEGORY}:manage`) ||
    false;

  // ---- Data loading ----
  const loadCategories = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);
        else setRefreshing(true);

        const data = await categoryService.getAllCategories({
          limit: 200,
          businessUnitId,
        });

        setCategories(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load categories:', error);
        toast.error('Failed to load categories');
        setCategories([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [businessUnitId],
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowDeleteModal(false);
        setCategoryToDelete(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ---- Derived stats ----
  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.isActive).length;
    const inactive = total - active;
    const featured = categories.filter((c) => (c as any).featured).length;
    const withImages = categories.filter((c) => !!c.image).length;
    const totalProducts = categories.reduce(
      (sum, c) => sum + productCountOf(c),
      0,
    );
    return { total, active, inactive, featured, withImages, totalProducts };
  }, [categories]);

  // ---- Filtering + sorting ----
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categories
      .filter((cat) => {
        if (statusFilter === 'active' && !cat.isActive) return false;
        if (statusFilter === 'inactive' && cat.isActive) return false;
        if (!q) return true;
        return (
          cat.name.toLowerCase().includes(q) ||
          cat.slug.toLowerCase().includes(q) ||
          (cat.description?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        const cmp = a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [categories, searchQuery, sortOrder, statusFilter]);

  // ---- Actions ----
  const handleRefresh = async () => {
    await loadCategories(false);
    toast.success('Categories refreshed');
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    setDeleting(true);
    try {
      await categoryService.deleteCategory(categoryToDelete.id);
      toast.success(`Category "${categoryToDelete.name}" deleted`);
      setShowDeleteModal(false);
      setCategoryToDelete(null);
      await loadCategories(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (category: Category) => {
    try {
      const newStatus = !category.isActive;
      await categoryService.toggleCategoryStatus(category.id, newStatus);
      toast.success(
        `Category "${category.name}" ${newStatus ? 'activated' : 'deactivated'}`,
      );
      await loadCategories(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update category status');
    }
  };

  // ---- Permission guard ----
  if (!canViewCategories) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Access Restricted
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You don't have permission to view categories.
          </p>
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

  // ---- Render ----
  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-[1600px] mx-auto">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
              <FolderTree className="w-5 h-5" />
            </span>
            Categories
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {stats.total} total · {stats.active} active · {stats.featured}{' '}
            featured
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>

          {/* View toggle */}
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            {(['grid', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                aria-label={`${mode} view`}
              >
                {mode === 'grid' ? (
                  <Grid3x3 className="w-4 h-4" />
                ) : (
                  <ListIcon className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() =>
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
            }
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle sort order"
            title={`Sort ${sortOrder === 'asc' ? 'Z-A' : 'A-Z'}`}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>

          {canCreateCategories && (
            <button
              onClick={() => router.push('/admin/categories/create')}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 flex items-center gap-2 transition-all shadow-sm hover:shadow"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          )}
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<FolderTree className="w-4 h-4" />}
          label="Total"
          value={stats.total}
          tone="blue"
        />
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Active"
          value={stats.active}
          tone="emerald"
        />
        <StatCard
          icon={<XCircle className="w-4 h-4" />}
          label="Inactive"
          value={stats.inactive}
          tone="gray"
        />
        <StatCard
          icon={<Star className="w-4 h-4" />}
          label="Featured"
          value={stats.featured}
          tone="amber"
        />
        <StatCard
          icon={<ImageIcon className="w-4 h-4" />}
          label="With image"
          value={stats.withImages}
          tone="violet"
        />
        <StatCard
          icon={<Package className="w-4 h-4" />}
          label="Products"
          value={stats.totalProducts}
          tone="indigo"
        />
      </div>

      {/* TOOLBAR */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search categories…  (press / to focus)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1">
            {(['all', 'active', 'inactive'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      {loading ? (
        <SkeletonGrid />
      ) : filteredCategories.length === 0 ? (
        <EmptyState
          hasSearch={!!searchQuery}
          hasFilter={statusFilter !== 'all'}
          canCreate={canCreateCategories}
          onCreate={() => router.push('/admin/categories/create')}
          onClear={() => {
            setSearchQuery('');
            setStatusFilter('all');
          }}
        />
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
          canEdit={canEditCategories}
          canDelete={canDeleteCategories}
        />
      ) : (
        <CategoryList
          categories={filteredCategories}
          canEdit={canEditCategories}
          canDelete={canDeleteCategories}
          onView={(cat) => router.push(`/admin/categories/${cat.id}`)}
          onEdit={(cat) => router.push(`/admin/categories/${cat.id}/edit`)}
          onDelete={(cat) => {
            setCategoryToDelete(cat);
            setShowDeleteModal(true);
          }}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {/* Footer count */}
      {!loading && filteredCategories.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Showing {filteredCategories.length} of {categories.length} categories
        </p>
      )}

      {/* DELETE MODAL */}
      <AnimatePresence>
        {showDeleteModal && categoryToDelete && (
          <DeleteModal
            category={categoryToDelete}
            deleting={deleting}
            onCancel={() => {
              setShowDeleteModal(false);
              setCategoryToDelete(null);
            }}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'blue' | 'emerald' | 'gray' | 'amber' | 'violet' | 'indigo';
}

const TONES: Record<
  StatCardProps['tone'],
  { bg: string; text: string; iconBg: string }
> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
  },
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
    iconBg: 'bg-gray-100 dark:bg-gray-700',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    text: 'text-violet-700 dark:text-violet-300',
    iconBg: 'bg-violet-100 dark:bg-violet-900/40',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    text: 'text-indigo-700 dark:text-indigo-300',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
  },
};

function StatCard({ icon, label, value, tone }: StatCardProps) {
  const t = TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${t.bg} rounded-2xl p-3 sm:p-4 border border-transparent hover:border-current/10 transition-colors`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${t.iconBg} ${t.text}`}
        >
          {icon}
        </span>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold ${t.text} tabular-nums`}>{value}</p>
    </motion.div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse"
        >
          <div className="h-1 bg-gray-200 dark:bg-gray-700" />
          <div className="p-5 pt-12">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            </div>
          </div>
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  hasSearch: boolean;
  hasFilter: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onClear: () => void;
}

function EmptyState({
  hasSearch,
  hasFilter,
  canCreate,
  onCreate,
  onClear,
}: EmptyStateProps) {
  const isFiltered = hasSearch || hasFilter;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center"
    >
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 mb-4">
        <FolderTree className="w-10 h-10 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {isFiltered ? 'No matching categories' : 'No categories yet'}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
        {isFiltered
          ? 'Try adjusting your search or filters to find what you need.'
          : 'Categories help you organize your products. Create your first one to get started.'}
      </p>
      <div className="flex justify-center gap-2">
        {isFiltered && (
          <button
            onClick={onClear}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Clear filters
          </button>
        )}
        {canCreate && !isFiltered && (
          <button
            onClick={onCreate}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// LIST VIEW
// ============================================

interface CategoryListProps {
  categories: Category[];
  canEdit: boolean;
  canDelete: boolean;
  onView: (cat: Category) => void;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onToggleStatus: (cat: Category) => void;
}

function CategoryList({
  categories,
  canEdit,
  canDelete,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
}: CategoryListProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Slug
              </th>
              <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Products
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {categories.map((category, index) => {
              const productCount = productCountOf(category);
              const childCount = childCountOf(category);
              const featured = (category as any).featured === true;

              return (
                <motion.tr
                  key={category.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(index * 0.015, 0.25) }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group"
                >
                  {/* Category */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onView(category)}
                      className="flex items-center gap-3 text-left w-full"
                    >
                      <CategoryAvatar
                        category={category}
                        size="md"
                        rounded="xl"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {category.name}
                          </span>
                          {featured && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono md:hidden">
                          /{category.slug}
                        </span>
                      </div>
                    </button>
                  </td>

                  {/* Slug */}
                  <td className="hidden md:table-cell px-4 py-3">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded">
                      /{category.slug}
                    </span>
                  </td>

                  {/* Description */}
                  <td className="hidden lg:table-cell px-4 py-3 max-w-xs">
                    <span className="text-sm text-gray-600 dark:text-gray-400 truncate block">
                      {category.description || (
                        <span className="italic text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </span>
                  </td>

                  {/* Products */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300">
                        <Package className="w-3.5 h-3.5 text-gray-400" />
                        {productCount}
                      </span>
                      {childCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                          <Layers className="w-3 h-3" />
                          {childCount}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => canEdit && onToggleStatus(category)}
                      disabled={!canEdit}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        category.isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400'
                      } ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          category.isActive
                            ? 'bg-emerald-500'
                            : 'bg-gray-400'
                        }`}
                      />
                      {category.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <IconButton
                        icon={<Eye className="w-4 h-4" />}
                        label="View"
                        onClick={() => onView(category)}
                      />
                      {canEdit && (
                        <IconButton
                          icon={<Edit className="w-4 h-4" />}
                          label="Edit"
                          onClick={() => onEdit(category)}
                          tone="blue"
                        />
                      )}
                      {canDelete && (
                        <IconButton
                          icon={<Trash2 className="w-4 h-4" />}
                          label="Delete"
                          onClick={() => onDelete(category)}
                          tone="red"
                        />
                      )}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'blue' | 'red';
}

function IconButton({ icon, label, onClick, tone = 'default' }: IconButtonProps) {
  const tones = {
    default:
      'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400',
    blue: 'hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    red: 'hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400',
  };
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${tones[tone]}`}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

// ============================================
// DELETE MODAL
// ============================================

interface DeleteModalProps {
  category: Category;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteModal({
  category,
  deleting,
  onCancel,
  onConfirm,
}: DeleteModalProps) {
  const productCount = productCountOf(category);
  const childCount = childCountOf(category);
  const hasBlockers = childCount > 0;
  const willArchive = !hasBlockers && productCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <CategoryAvatar
            category={category}
            size="lg"
            rounded="xl"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Delete category
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Are you sure you want to delete{' '}
            <strong className="text-gray-900 dark:text-white">
              "{category.name}"
            </strong>
            ?
          </p>
        </div>

        {/* Impact preview */}
        {hasBlockers && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 dark:text-red-300">
              <strong>Cannot delete.</strong> This category has {childCount}{' '}
              subcategor{childCount === 1 ? 'y' : 'ies'}. Move or delete them
              first.
            </div>
          </div>
        )}

        {willArchive && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              This category has {productCount} product
              {productCount === 1 ? '' : 's'}. It will be{' '}
              <strong>archived (soft-deleted)</strong> instead of removed.
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting || hasBlockers}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                {willArchive ? 'Archive' : 'Delete'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
