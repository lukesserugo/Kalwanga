// packages/web/components/categories/AdminCategoryManager.tsx

'use client';

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  ChevronRight,
  FolderTree,
  Grid3x3,
  List as ListIcon,
  ArrowUpDown,
  Eye,
  Star,
  StarOff,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  X,
  Package,
  Layers,
  Info,
} from 'lucide-react';

import { toast } from '../../utils/toast-manager';
import { formatDate } from '../../utils/formatters';
import { formatCurrency } from '../../utils/formatters';
import { categoryService } from '../../services/categoryService';
import { Category } from '../../types/category';
import { CategoryForm } from './CategoryForm';
import { CategoryGrid } from './CategoryGrid';
import { CategoryAvatar } from './CategoryAvatar';

// ============================================
// TYPES
// ============================================

interface Permission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canFeature: boolean;
}

interface AdminCategoryManagerProps {
  categories: Category[];
  setCategories: (categories: Category[]) => void;
  permissions: Permission;
  businessUnitId: string;
  onCategoryUpdate: () => void;
}

// ============================================
// HELPERS
// ============================================

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

export default function AdminCategoryManager({
  categories,
  setCategories,
  permissions,
  businessUnitId,
  onCategoryUpdate,
}: AdminCategoryManagerProps) {
  // ---- Local UI state ----
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'tree'>('grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const searchInputRef = useRef<HTMLInputElement>(null);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (typing) {
        if (e.key === 'Escape') (target as HTMLElement).blur();
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Derived list ----
  const visibleCategories = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? categories.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.slug.toLowerCase().includes(q) ||
            (c.description?.toLowerCase().includes(q) ?? false),
        )
      : categories;

    return [...filtered].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [categories, searchTerm, sortOrder]);

  const rootCategories = useMemo(
    () => visibleCategories.filter((c) => !c.parentId),
    [visibleCategories],
  );

  // ---- Modal close ----
  const handleCloseModal = useCallback(() => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowDetailsModal(false);
    setSelectedCategory(null);
  }, []);

  // ---- CRUD ----
  const handleDeleteCategory = async (id: string) => {
    setDeleting(true);
    try {
      await categoryService.deleteCategory(id);
      toast.success('Category deleted successfully');
      setShowDeleteModal(false);
      setSelectedCategory(null);
      onCategoryUpdate();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCategories.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedCategories);
      const result = await categoryService.bulkDeleteCategories(ids);
      toast.success(
        result?.message || `${ids.length} categories processed`,
      );
      setSelectedCategories(new Set());
      onCategoryUpdate();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete categories');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleToggleStatus = async (category: Category) => {
    if (togglingIds.has(category.id)) return;
    setTogglingIds((prev) => new Set(prev).add(category.id));
    try {
      const next = !category.isActive;
      await categoryService.toggleCategoryStatus(category.id, next);
      toast.success(
        `"${category.name}" ${next ? 'activated' : 'deactivated'}`,
      );
      onCategoryUpdate();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update status');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(category.id);
        return next;
      });
    }
  };

  const handleToggleFeatured = async (category: Category) => {
    if (togglingIds.has(category.id)) return;
    setTogglingIds((prev) => new Set(prev).add(category.id));
    try {
      const next = !isFeatured(category);
      await categoryService.updateCategory(category.id, { featured: next });
      toast.success(`"${category.name}" ${next ? 'featured' : 'unfeatured'}`);
      onCategoryUpdate();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update featured');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(category.id);
        return next;
      });
    }
  };

  // ---- Selection ----
  const toggleCategorySelection = (id: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSelection = () => {
    const visibleIds = visibleCategories.map((c) => c.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedCategories.has(id));
    setSelectedCategories(allSelected ? new Set() : new Set(visibleIds));
  };

  const toggleExpand = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ---- Openers ----
  const openEdit = (cat: Category) => {
    setSelectedCategory(cat);
    setShowEditModal(true);
  };
  const openDelete = (cat: Category) => {
    setSelectedCategory(cat);
    setShowDeleteModal(true);
  };
  const openDetails = (cat: Category) => {
    setSelectedCategory(cat);
    setShowDetailsModal(true);
  };

  const allSelected =
    visibleCategories.length > 0 &&
    visibleCategories.every((c) => selectedCategories.has(c.id));

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4">
      {/* ============================================
          TOOLBAR
          ============================================ */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search categories…  (press / to focus)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View mode */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1">
            {(['grid', 'list', 'tree'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === mode
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                aria-label={`${mode} view`}
              >
                {mode === 'grid' && <Grid3x3 className="w-4 h-4" />}
                {mode === 'list' && <ListIcon className="w-4 h-4" />}
                {mode === 'tree' && <FolderTree className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </span>
              </button>
            ))}
          </div>

          {/* Sort */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title={`Sort ${sortOrder === 'asc' ? 'Z-A' : 'A-Z'}`}
            aria-label="Toggle sort order"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>

          {/* Add */}
          {permissions.canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          )}
        </div>

        {/* Selection bar */}
        <AnimatePresence>
          {selectedCategories.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {selectedCategories.size} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedCategories(new Set())}
                    className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline"
                  >
                    Clear
                  </button>
                  {permissions.canDelete && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {bulkDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ============================================
          DISPLAY
          ============================================ */}
      <div className="min-h-[400px]">
        {visibleCategories.length === 0 ? (
          <EmptyState
            hasSearch={!!searchTerm}
            hasAny={categories.length > 0}
            canCreate={permissions.canCreate}
            onCreate={() => setShowCreateModal(true)}
            onClear={() => setSearchTerm('')}
          />
        ) : viewMode === 'tree' ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 space-y-1">
            {rootCategories.map((cat) => (
              <TreeRow
                key={cat.id}
                category={cat}
                depth={0}
                expanded={expandedCategories}
                onToggleExpand={toggleExpand}
                selected={selectedCategories}
                onToggleSelect={toggleCategorySelection}
                permissions={permissions}
                togglingIds={togglingIds}
                onEdit={openEdit}
                onDelete={openDelete}
                onView={openDetails}
                onToggleStatus={handleToggleStatus}
                onToggleFeatured={handleToggleFeatured}
              />
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          <CategoryGrid
            categories={visibleCategories}
            onEdit={openEdit}
            onDelete={openDelete}
            onView={openDetails}
            onToggleStatus={handleToggleStatus}
            canEdit={permissions.canEdit}
            canDelete={permissions.canDelete}
          />
        ) : (
          <ListView
            categories={visibleCategories}
            selected={selectedCategories}
            allSelected={allSelected}
            onToggleSelect={toggleCategorySelection}
            onToggleAll={toggleAllSelection}
            permissions={permissions}
            togglingIds={togglingIds}
            onView={openDetails}
            onEdit={openEdit}
            onDelete={openDelete}
            onToggleStatus={handleToggleStatus}
            onToggleFeatured={handleToggleFeatured}
          />
        )}
      </div>

      {/* ============================================
          MODALS
          ============================================ */}

      {/* Create */}
      <AnimatePresence>
        {showCreateModal && (
          <ModalShell onClose={handleCloseModal} size="lg">
            <ModalHeader
              title="Create new category"
              subtitle="Add a category to organize your products"
              onClose={handleCloseModal}
            />
            <CategoryForm
              businessUnitId={businessUnitId}
              onSuccess={() => {
                setShowCreateModal(false);
                onCategoryUpdate();
              }}
              onCancel={handleCloseModal}
            />
          </ModalShell>
        )}
      </AnimatePresence>

      {/* Edit */}
      <AnimatePresence>
        {showEditModal && selectedCategory && (
          <ModalShell onClose={handleCloseModal} size="lg">
            <ModalHeader
              title="Edit category"
              subtitle={selectedCategory.name}
              onClose={handleCloseModal}
            />
            <CategoryForm
              initialData={selectedCategory}
              businessUnitId={businessUnitId}
              onSuccess={() => {
                setShowEditModal(false);
                setSelectedCategory(null);
                onCategoryUpdate();
              }}
              onCancel={handleCloseModal}
            />
          </ModalShell>
        )}
      </AnimatePresence>

      {/* Details */}
      <AnimatePresence>
        {showDetailsModal && selectedCategory && (
          <ModalShell onClose={handleCloseModal} size="lg">
            <ModalHeader
              title="Category details"
              subtitle={selectedCategory.slug}
              onClose={handleCloseModal}
            />
            <DetailsPanel
              category={selectedCategory}
              permissions={permissions}
              onEdit={() => {
                setShowDetailsModal(false);
                setShowEditModal(true);
              }}
              onClose={handleCloseModal}
            />
          </ModalShell>
        )}
      </AnimatePresence>

      {/* Delete */}
      <AnimatePresence>
        {showDeleteModal && selectedCategory && (
          <ModalShell onClose={handleCloseModal} size="sm">
            <DeleteConfirm
              category={selectedCategory}
              deleting={deleting}
              onCancel={handleCloseModal}
              onConfirm={() =>
                handleDeleteCategory(selectedCategory.id)
              }
            />
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface TreeRowProps {
  category: Category;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  permissions: Permission;
  togglingIds: Set<string>;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onView: (cat: Category) => void;
  onToggleStatus: (cat: Category) => void;
  onToggleFeatured: (cat: Category) => void;
}

function TreeRow({
  category,
  depth,
  expanded,
  onToggleExpand,
  selected,
  onToggleSelect,
  permissions,
  togglingIds,
  onEdit,
  onDelete,
  onView,
  onToggleStatus,
  onToggleFeatured,
}: TreeRowProps) {
  const hasChildren =
    childCountOf(category) > 0 ||
    !!(category.children && category.children.length > 0);
  const isOpen = expanded.has(category.id);
  const isSelected = selected.has(category.id);
  const isToggling = togglingIds.has(category.id);
  const featured = isFeatured(category);
  const productCount = productCountOf(category);

  return (
    <div>
      <div
        className={`group flex items-center gap-2 p-2 rounded-lg transition-colors ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
        }`}
        style={{ paddingLeft: 8 + depth * 20 }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => hasChildren && onToggleExpand(category.id)}
          disabled={!hasChildren}
          className={`p-1 rounded transition-transform ${
            hasChildren
              ? 'hover:bg-gray-200 dark:hover:bg-gray-600'
              : 'opacity-0 pointer-events-none'
          }`}
          aria-label={isOpen ? 'Collapse' : 'Expand'}
        >
          <ChevronRight
            className={`w-4 h-4 transition-transform ${
              isOpen ? 'rotate-90' : ''
            }`}
          />
        </button>

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(category.id)}
          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          aria-label={`Select ${category.name}`}
        />

        {/* Avatar + name */}
        <button
          onClick={() => onView(category)}
          className="flex-1 flex items-center gap-2.5 min-w-0 text-left"
        >
          <CategoryAvatar category={category} size="sm" rounded="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`font-medium truncate ${
                  category.isActive
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {category.name}
              </span>
              {featured && (
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
              )}
            </div>
            {category.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {category.description}
              </p>
            )}
          </div>
        </button>

        {/* Product count */}
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
          <Package className="w-3 h-3" />
          {productCount}
        </span>

        {/* Featured toggle */}
        {permissions.canFeature && (
          <button
            onClick={() => !isToggling && onToggleFeatured(category)}
            disabled={isToggling}
            className="p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            title={featured ? 'Unfeature' : 'Feature'}
            aria-label={featured ? 'Unfeature' : 'Feature'}
          >
            {isToggling ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : featured ? (
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            ) : (
              <StarOff className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}

        {/* Status toggle */}
        {permissions.canChangeStatus && (
          <button
            onClick={() => !isToggling && onToggleStatus(category)}
            disabled={isToggling}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-colors shrink-0 ${
              category.isActive
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
            } disabled:opacity-50`}
            title={category.isActive ? 'Deactivate' : 'Activate'}
          >
            {category.isActive ? 'Active' : 'Inactive'}
          </button>
        )}

        {/* Row actions */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onView(category)}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="View"
          >
            <Eye className="w-4 h-4 text-gray-500" />
          </button>
          {permissions.canEdit && (
            <button
              onClick={() => onEdit(category)}
              className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              title="Edit"
            >
              <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>
          )}
          {permissions.canDelete && (
            <button
              onClick={() => onDelete(category)}
              className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isOpen && category.children && (
        <div>
          {category.children.map((child) => (
            <TreeRow
              key={child.id}
              category={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              selected={selected}
              onToggleSelect={onToggleSelect}
              permissions={permissions}
              togglingIds={togglingIds}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
              onToggleStatus={onToggleStatus}
              onToggleFeatured={onToggleFeatured}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- List view ----------

interface ListViewProps {
  categories: Category[];
  selected: Set<string>;
  allSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  permissions: Permission;
  togglingIds: Set<string>;
  onView: (cat: Category) => void;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onToggleStatus: (cat: Category) => void;
  onToggleFeatured: (cat: Category) => void;
}

function ListView({
  categories,
  selected,
  allSelected,
  onToggleSelect,
  onToggleAll,
  permissions,
  togglingIds,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
  onToggleFeatured,
}: ListViewProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Slug
              </th>
              <th className="hidden lg:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Description
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Products
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Featured
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {categories.map((category, index) => {
              const featured = isFeatured(category);
              const isToggling = togglingIds.has(category.id);
              const productCount = productCountOf(category);

              return (
                <motion.tr
                  key={category.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(index * 0.015, 0.25) }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group"
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(category.id)}
                      onChange={() => onToggleSelect(category.id)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      aria-label={`Select ${category.name}`}
                    />
                  </td>

                  <td className="px-3 py-3">
                    <button
                      onClick={() => onView(category)}
                      className="flex items-center gap-3 text-left w-full"
                    >
                      <CategoryAvatar
                        category={category}
                        size="sm"
                        rounded="lg"
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

                  <td className="hidden md:table-cell px-3 py-3">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded">
                      /{category.slug}
                    </span>
                  </td>

                  <td className="hidden lg:table-cell px-3 py-3 max-w-xs">
                    <span className="text-sm text-gray-600 dark:text-gray-400 truncate block">
                      {category.description || (
                        <span className="italic text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </span>
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300">
                        <Package className="w-3.5 h-3.5 text-gray-400" />
                        {productCount}
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    <button
                      onClick={() =>
                        permissions.canChangeStatus &&
                        !isToggling &&
                        onToggleStatus(category)
                      }
                      disabled={!permissions.canChangeStatus || isToggling}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        category.isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400'
                      } ${
                        permissions.canChangeStatus
                          ? 'cursor-pointer hover:opacity-80'
                          : 'cursor-default'
                      } disabled:opacity-50`}
                    >
                      {isToggling ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            category.isActive
                              ? 'bg-emerald-500'
                              : 'bg-gray-400'
                          }`}
                        />
                      )}
                      {category.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>

                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() =>
                        permissions.canFeature &&
                        !isToggling &&
                        onToggleFeatured(category)
                      }
                      disabled={!permissions.canFeature || isToggling}
                      className="p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                      title={featured ? 'Unfeature' : 'Feature'}
                    >
                      {featured ? (
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      ) : (
                        <StarOff className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                      )}
                    </button>
                  </td>

                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onView(category)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      {permissions.canEdit && (
                        <button
                          onClick={() => onEdit(category)}
                          className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </button>
                      )}
                      {permissions.canDelete && (
                        <button
                          onClick={() => onDelete(category)}
                          className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
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

// ---------- Modal shell ----------

interface ModalShellProps {
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

function ModalShell({ onClose, size = 'md', children }: ModalShellProps) {
  const width =
    size === 'sm'
      ? 'max-w-md'
      : size === 'lg'
        ? 'max-w-3xl'
        : 'max-w-xl';
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${width} max-h-[90vh] overflow-y-auto p-6`}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
}

function ModalHeader({ title, subtitle, onClose }: ModalHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0"
        aria-label="Close"
      >
        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      </button>
    </div>
  );
}

// ---------- Details panel ----------

interface DetailsPanelProps {
  category: Category;
  permissions: Permission;
  onEdit: () => void;
  onClose: () => void;
}

function DetailsPanel({
  category,
  permissions,
  onEdit,
  onClose,
}: DetailsPanelProps) {
  const featured = isFeatured(category);
  const productCount = productCountOf(category);
  const childCount = childCountOf(category);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50">
        <CategoryAvatar category={category} size="xl" rounded="xl" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {category.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">
            /{category.slug}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                category.isActive
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              {category.isActive ? 'Active' : 'Inactive'}
            </span>
            {featured && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <Star className="w-3 h-3 fill-current" />
                Featured
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatBox
          label="Products"
          value={productCount}
          icon={<Package className="w-4 h-4" />}
        />
        <StatBox
          label="Subcategories"
          value={childCount}
          icon={<Layers className="w-4 h-4" />}
        />
      </div>

      {category.description && (
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Description
          </p>
          <p className="text-sm text-gray-900 dark:text-white">
            {category.description}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatBox
          label="Created"
          value={formatDate(category.createdAt)}
        />
        <StatBox
          label="Updated"
          value={formatDate(category.updatedAt)}
        />
      </div>

      {category.children && category.children.length > 0 && (
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Subcategories
          </p>
          <div className="flex flex-wrap gap-1.5">
            {category.children.map((child) => (
              <span
                key={child.id}
                className="inline-flex items-center gap-1 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-600"
              >
                <CategoryAvatar
                  category={child}
                  size="xs"
                  rounded="full"
                />
                {child.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
        {permissions.canEdit && (
          <button
            onClick={onEdit}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Edit Category
          </button>
        )}
      </div>
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

function StatBox({ label, value, icon }: StatBoxProps) {
  return (
    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-gray-400">{icon}</span>}
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums truncate">
        {value}
      </p>
    </div>
  );
}

// ---------- Delete confirm ----------

interface DeleteConfirmProps {
  category: Category;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirm({
  category,
  deleting,
  onCancel,
  onConfirm,
}: DeleteConfirmProps) {
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

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={deleting}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={deleting || hasChildren}
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </div>
  );
}

// ---------- Empty state ----------

interface EmptyStateProps {
  hasSearch: boolean;
  hasAny: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onClear: () => void;
}

function EmptyState({
  hasSearch,
  hasAny,
  canCreate,
  onCreate,
  onClear,
}: EmptyStateProps) {
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
        {hasSearch
          ? 'No matching categories'
          : hasAny
            ? 'Nothing to show'
            : 'No categories yet'}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
        {hasSearch
          ? 'Try adjusting your search terms.'
          : 'Categories help you organize products. Create your first one to get started.'}
      </p>
      <div className="flex justify-center gap-2">
        {hasSearch && (
          <button
            onClick={onClear}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Clear search
          </button>
        )}
        {canCreate && !hasSearch && (
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        )}
      </div>
    </motion.div>
  );
}
