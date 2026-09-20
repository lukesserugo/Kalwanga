// packages/web/components/categories/CategoryList.tsx

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Edit,
  Trash2,
  Eye,
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  FolderTree,
  Star,
  RefreshCw,
  LayoutGrid,
  List as ListIcon,
  Grid3x3,
  ArrowUpDown,
  Package,
  Layers,
  Hash,
} from 'lucide-react';

import { Category } from '../../types/category';
import { categoryService } from '../../services/categoryService';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import Button from '../common/Button';
import { SearchBar } from '../common/SearchBar';
import { toast } from '../../utils/toast-manager';

import { CategoryForm } from './CategoryForm';
import { CategoryGrid } from './CategoryGrid';
import { CategoryAvatar } from './CategoryAvatar';

// ============================================
// TYPES & HELPERS
// ============================================

interface CategoryListProps {
  businessUnitId: string;
  onCategoryUpdated?: () => void;
}

type ViewMode = 'table' | 'grid' | 'compact';
type SortField = 'name' | 'createdAt' | 'productCount';
type SortOrder = 'asc' | 'desc';

function productCountOf(c: Category): number {
  return c.productCount ?? c._count?.products ?? 0;
}

function childCountOf(c: Category): number {
  return c.childCount ?? c._count?.children ?? 0;
}

function isFeatured(c: Category): boolean {
  return (c as any).featured === true;
}

// ============================================
// COMPONENT
// ============================================

export function CategoryList({
  businessUnitId,
  onCategoryUpdated,
}: CategoryListProps) {
  const router = useRouter();

  // ---- State ----
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // ---- Load ----
  const loadCategories = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);
        else setRefreshing(true);

        const params: Record<string, any> = {
          page: pagination.page,
          limit: pagination.limit,
          businessUnitId,
          sortBy,
          sortOrder,
        };
        if (search) params.search = search;

        const result = await categoryService.getAllCategories(params);

        // Normalize: array, wrapped, or paginated
        let data: Category[] = [];
        let total = 0;
        let totalPages = 1;

        if (Array.isArray(result)) {
          data = result;
          total = result.length;
          totalPages = Math.ceil(result.length / pagination.limit) || 1;
        } else if (result && typeof result === 'object') {
          const anyResult = result as any;
          if (Array.isArray(anyResult.data)) {
            data = anyResult.data;
            total = anyResult.total ?? data.length;
            totalPages = anyResult.totalPages ?? 1;
          } else {
            const possibleArray = Object.values(anyResult).find((v) =>
              Array.isArray(v),
            ) as Category[] | undefined;
            if (possibleArray) {
              data = possibleArray;
              total = data.length;
              totalPages = 1;
            }
          }
        }

        setCategories(data);
        setPagination((prev) => ({
          ...prev,
          total,
          totalPages,
        }));
      } catch (error) {
        console.error('Failed to load categories:', error);
        toast.error('Failed to load categories');
        setCategories([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [businessUnitId, pagination.page, pagination.limit, search, sortBy, sortOrder],
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // ---- Actions ----
  const handleRefresh = async () => {
    await loadCategories(false);
    toast.success('Categories refreshed');
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    setDeleting(true);
    try {
      await categoryService.deleteCategory(selectedCategory.id);
      toast.success(`Category "${selectedCategory.name}" deleted`);
      setShowDeleteModal(false);
      setSelectedCategory(null);
      await loadCategories(false);
      onCategoryUpdated?.();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setShowFormModal(true);
  };

  const openCreate = () => {
    setEditingCategory(null);
    setShowFormModal(true);
  };

  const openDelete = (category: Category) => {
    setSelectedCategory(category);
    setShowDeleteModal(true);
  };

  const openView = (category: Category) => {
    router.push(`/admin/categories/${category.id}`);
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // ---- Columns (memoized) ----
  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Category',
        sortable: true,
        render: (category: Category) => (
          <div className="flex items-center gap-3">
            <CategoryAvatar category={category} size="md" rounded="lg" />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                <span className="truncate">{category.name}</span>
                {isFeatured(category) && (
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                )}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono flex items-center gap-1">
                <Hash className="w-2.5 h-2.5" />
                {category.slug}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: 'parent',
        header: 'Hierarchy',
        render: (category: Category) => {
          const children = childCountOf(category);
          return (
            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <FolderTree className="w-3.5 h-3.5 text-gray-400" />
                {category.parentId ? 'Has parent' : 'Root'}
              </span>
              {children > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                  <Layers className="w-3 h-3" />
                  {children}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'products',
        header: 'Products',
        sortable: true,
        render: (category: Category) => (
          <span className="inline-flex items-center gap-1 font-medium tabular-nums">
            <Package className="w-3.5 h-3.5 text-gray-400" />
            {productCountOf(category)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (category: Category) => (
          <StatusBadge isActive={category.isActive} />
        ),
      },
      {
        key: 'actions',
        header: '',
        render: (category: Category) => (
          <div className="flex items-center justify-end gap-0.5">
            <button
              onClick={() => openView(category)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="View"
              aria-label="View category"
            >
              <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={() => openEdit(category)}
              className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              title="Edit"
              aria-label="Edit category"
            >
              <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>
            <button
              onClick={() => openDelete(category)}
              className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              title="Delete"
              aria-label="Delete category"
            >
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* ============================================
          HEADER
          ============================================ */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
              <FolderTree className="w-5 h-5" />
            </span>
            Categories
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {pagination.total} categor{pagination.total === 1 ? 'y' : 'ies'}{' '}
            · Manage your product categories
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>

          {/* View mode */}
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            {(
              [
                { key: 'table', icon: ListIcon, label: 'Table' },
                { key: 'grid', icon: Grid3x3, label: 'Grid' },
                { key: 'compact', icon: LayoutGrid, label: 'Compact' },
              ] as const
            ).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                aria-label={`${label} view`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            aria-label="Toggle sort order"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>

          <Button
            onClick={openCreate}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* ============================================
          SEARCH
          ============================================ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search categories…"
        />
      </div>

      {/* ============================================
          CONTENT
          ============================================ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {viewMode === 'table' && (
          <>
            <Table
              columns={columns}
              data={categories}
              loading={loading}
              emptyMessage="No categories found"
              onRowClick={(cat: Category) => openView(cat)}
            />

            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex flex-wrap items-center justify-between gap-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Showing {categories.length} of {pagination.total} categor
                {pagination.total === 1 ? 'y' : 'ies'}
              </span>
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(page) =>
                  setPagination((prev) => ({ ...prev, page }))
                }
              />
            </div>
          </>
        )}

        {viewMode === 'grid' && (
          <div className="p-4">
            <CategoryGrid
              categories={categories}
              isLoading={loading}
              onEdit={openEdit}
              onDelete={openDelete}
              onView={openView}
              emptyMessage="No categories found"
              emptySubMessage="Create your first category to get started"
              showCreateButton
              onCreateClick={openCreate}
              columns={4}
            />
            {pagination.totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={(page) =>
                    setPagination((prev) => ({ ...prev, page }))
                  }
                />
              </div>
            )}
          </div>
        )}

        {viewMode === 'compact' && (
          <div className="p-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl bg-gray-100 dark:bg-gray-700/50 animate-pulse"
                  />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="py-16 text-center">
                <FolderTree className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No categories found
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {categories.map((category) => (
                    <motion.button
                      key={category.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ x: 2 }}
                      onClick={() => openView(category)}
                      className="group flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left"
                    >
                      <CategoryAvatar
                        category={category}
                        size="md"
                        rounded="lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {category.name}
                          </p>
                          {isFeatured(category) && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {productCountOf(category)} product
                          {productCountOf(category) === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(category);
                          }}
                          className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          title="Edit"
                          aria-label="Edit category"
                        >
                          <Edit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDelete(category);
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          title="Delete"
                          aria-label="Delete category"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </motion.button>
                  ))}
                </div>
                {pagination.totalPages > 1 && (
                  <div className="flex justify-center mt-6">
                    <Pagination
                      currentPage={pagination.page}
                      totalPages={pagination.totalPages}
                      onPageChange={(page) =>
                        setPagination((prev) => ({ ...prev, page }))
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ============================================
          DELETE MODAL
          ============================================ */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !deleting && setShowDeleteModal(false)}
        title="Delete Category"
      >
        <div className="p-6">
          {selectedCategory && (
            <DeleteContent
              category={selectedCategory}
              deleting={deleting}
              onCancel={() => setShowDeleteModal(false)}
              onConfirm={handleDelete}
            />
          )}
        </div>
      </Modal>

      {/* ============================================
          FORM MODAL
          ============================================ */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingCategory ? 'Edit Category' : 'New Category'}
        size="lg"
      >
        <div className="p-6">
          <CategoryForm
            {...(editingCategory
              ? { initialData: editingCategory }
              : { businessUnitId })}
            onSuccess={() => {
              setShowFormModal(false);
              setEditingCategory(null);
              loadCategories(false);
              onCategoryUpdated?.();
            }}
            onCancel={() => {
              setShowFormModal(false);
              setEditingCategory(null);
            }}
          />
        </div>
      </Modal>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
      <CheckCircle2 className="w-3 h-3" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400">
      <XCircle className="w-3 h-3" />
      Inactive
    </span>
  );
}

interface DeleteContentProps {
  category: Category;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteContent({
  category,
  deleting,
  onCancel,
  onConfirm,
}: DeleteContentProps) {
  const productCount = productCountOf(category);
  const childCount = childCountOf(category);
  const hasChildren = childCount > 0;
  const hasProducts = productCount > 0;
  const willArchive = !hasChildren && hasProducts;

  return (
    <div>
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
          Delete{' '}
          <strong className="text-gray-900 dark:text-white">
            "{category.name}"
          </strong>
          ?
        </p>
      </div>

      {hasChildren && (
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
        <Button variant="outline" onClick={onCancel} disabled={deleting}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          disabled={deleting || hasChildren}
          className="flex items-center gap-2"
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
        </Button>
      </div>
    </div>
  );
}

export default CategoryList;
