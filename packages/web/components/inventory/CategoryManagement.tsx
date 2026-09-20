'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, Plus, Edit, Trash2, X, Save, RefreshCw,
  FolderTree, FolderOpen, Package, Search,
  ChevronRight, ChevronDown, MoreVertical, Loader2,
  AlertCircle, CheckCircle, Lock, Shield, Building,
  Layers, Grid, List, Filter, ArrowUp, ArrowDown,
  Copy, Link, ExternalLink, Eye, Star, Globe,
  Archive, Clock, Calendar, Hash, Users,
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { inventoryService } from '../../services/inventoryService';
import { PermissionResource } from '../../types/enums';
import { formatDate, formatNumber } from '../../utils/formatters';

interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  parent?: Category;
  businessUnitId: string;
  businessUnit?: { id: string; name: string; code: string };
  createdAt: string;
  updatedAt: string;
  children?: Category[];
  productCount?: number;
  isActive?: boolean;
  sortOrder?: number;
  slug?: string;
  metadata?: Record<string, any>;
}

interface CategoryFormData {
  name: string;
  description: string;
  parentId: string;
  isActive: boolean;
  sortOrder: number;
}

interface CategoryManagementProps {
  className?: string;
  compact?: boolean;
  onCategorySelect?: (category: Category) => void;
  selectedCategoryId?: string;
  showProductCount?: boolean;
  allowNesting?: boolean;
}

const ICON_COLORS = [
  'text-brand-500',
  'text-success-500',
  'text-warning-500',
  'text-danger-500',
  'text-secondary-500',
  'text-secondary-500',
  'text-brand-accent-500',
  'text-success-500',
  'text-brand-500',
  'text-brand-500',
];

const CategoryItem: React.FC<{
  category: Category;
  level: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  onSelect?: (category: Category) => void;
  isSelected?: boolean;
  showProductCount?: boolean;
  compact?: boolean;
}> = ({
  category,
  level,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onSelect,
  isSelected = false,
  showProductCount = true,
  compact = false,
}) => {
  const hasChildren = category.children && category.children.length > 0;
  const isActive = category.isActive !== false;
  const colorIndex = category.id.charCodeAt(0) % ICON_COLORS.length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`${
        isSelected ? 'bg-brand-50 dark:bg-brand-900/10' : ''
      } ${compact ? 'p-2' : 'p-3'}`}
    >
      <div
        className={`flex items-center justify-between hover:bg-orange-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer ${
          compact ? 'p-1.5' : 'p-2'
        }`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={() => onSelect?.(category)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors focus-ring"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-5" />}

          <div
            className={`p-1.5 rounded-lg flex-shrink-0 ${
              isActive
                ? 'bg-brand-50 dark:bg-brand-900/20'
                : 'bg-gray-50 dark:bg-gray-700/30'
            }`}
          >
            {hasChildren ? (
              <FolderTree
                className={`w-4 h-4 ${
                  isActive ? ICON_COLORS[colorIndex] : 'text-gray-400'
                }`}
              />
            ) : (
              <Tag
                className={`w-4 h-4 ${
                  isActive ? ICON_COLORS[colorIndex] : 'text-gray-400'
                }`}
              />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p
                className={`font-medium truncate ${
                  isActive
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {category.name}
              </p>
              {!isActive && (
                <span className="px-1.5 py-0.5 text-2xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                  Inactive
                </span>
              )}
              {category.slug && (
                <span className="text-2xs text-gray-400 font-mono hidden sm:inline">
                  {category.slug}
                </span>
              )}
            </div>
            {category.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                {category.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {showProductCount && category.productCount !== undefined && (
            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 tabular-nums">
              <Package className="w-3 h-3" />
              {category.productCount}
            </span>
          )}

          {category.businessUnit && (
            <span className="text-2xs text-gray-400 hidden sm:flex items-center gap-1">
              <Building className="w-3 h-3" />
              {category.businessUnit.name}
            </span>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(category);
              }}
              className="p-1 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded transition-colors focus-ring"
              title="Edit Category"
            >
              <Edit className="w-4 h-4 text-brand-500" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (
                  confirm(
                    `Are you sure you want to delete "${category.name}"?`
                  )
                ) {
                  onDelete(category.id);
                }
              }}
              className="p-1 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded transition-colors focus-ring"
              title="Delete Category"
            >
              <Trash2 className="w-4 h-4 text-danger-500" />
            </button>
          </div>
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div className="border-l-2 border-gray-200 dark:border-gray-700 ml-5">
          {category.children!.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              level={level + 1}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onSelect={onSelect}
              isSelected={isSelected}
              showProductCount={showProductCount}
              compact={compact}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

const LoadingSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-2">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse flex items-center gap-3 p-3">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mt-1" />
          </div>
          <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
};

export function CategoryManagement({
  className = '',
  compact = false,
  onCategorySelect,
  selectedCategoryId,
  showProductCount = true,
  allowNesting = true,
}: CategoryManagementProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    parentId: '',
    isActive: true,
    sortOrder: 0,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const canManage =
    hasPermission(`${PermissionResource.INVENTORY}:manage`) ||
    hasPermission(`${PermissionResource.INVENTORY}:edit`) ||
    user?.role === 'SUPER_ADMIN';

  const businessUnitId =
    user?.businessUnits?.[0]?.businessUnitId ||
    (user?.businessUnits?.[0] as any)?.id ||
    localStorage.getItem('businessUnitId') ||
    '';

  const loadCategories = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await inventoryService.getCategories(businessUnitId);

      const categoryList = (data || []).map((item: any) => ({
        id: item.id || '',
        name: item.name || 'Unnamed',
        description: item.description || '',
        parentId: item.parentId || '',
        businessUnitId: item.businessUnitId || businessUnitId,
        businessUnit: item.businessUnit,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        productCount: item.productCount || item._count?.products || 0,
        isActive: item.isActive !== false,
        sortOrder: item.sortOrder || 0,
        slug: item.slug || '',
        metadata: item.metadata || {},
      }));

      const tree = buildCategoryTree(categoryList);
      setCategories(tree);

      const firstLevelIds = new Set(tree.map((c) => c.id));
      setExpanded(firstLevelIds);
    } catch (error: any) {
      console.error('Failed to load categories:', error);
      setError(error?.message || 'Failed to load categories');
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId]);

  const buildCategoryTree = (items: Category[]): Category[] => {
    const map = new Map<string, Category>();
    const roots: Category[] = [];

    items.forEach((item) => {
      map.set(item.id, { ...item, children: [] });
    });

    map.forEach((item) => {
      if (item.parentId && map.has(item.parentId)) {
        const parent = map.get(item.parentId)!;
        if (!parent.children) parent.children = [];
        parent.children.push(item);
      } else {
        roots.push(item);
      }
    });

    roots.forEach((root) => {
      if (root.children) {
        root.children.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      }
    });

    return roots.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
    toast.success('Categories refreshed');
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Category name is required';
    }
    if (formData.name.trim().length > 100) {
      errors.name = 'Category name must be less than 100 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      const firstError = Object.values(formErrors)[0];
      toast.error(firstError);
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        ...formData,
        businessUnitId: businessUnitId,
      };

      if (editingCategory) {
        toast.success('Category updated successfully');
      } else {
        toast.success('Category created successfully');
      }

      setShowAddModal(false);
      setEditingCategory(null);
      resetForm();
      await loadCategories();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      toast.success('Category deleted successfully');
      await loadCategories();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete category');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      parentId: '',
      isActive: true,
      sortOrder: 0,
    });
    setFormErrors({});
    setTouched({});
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      description: category.description || '',
      parentId: category.parentId || '',
      isActive: category.isActive !== false,
      sortOrder: category.sortOrder || 0,
    });
    setShowAddModal(true);
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    const query = searchQuery.toLowerCase().trim();
    const filterTree = (items: Category[]): Category[] => {
      const result: Category[] = [];

      for (const item of items) {
        const matches =
          item.name.toLowerCase().includes(query) ||
          (item.description && item.description.toLowerCase().includes(query));

        if (matches) {
          result.push(item);
        } else if (item.children && item.children.length > 0) {
          const filteredChildren = filterTree(item.children);
          if (filteredChildren.length > 0) {
            result.push({ ...item, children: filteredChildren });
          }
        }
      }

      return result;
    };

    return filterTree(categories);
  }, [categories, searchQuery]);

  const getTotalProductCount = (items: Category[]): number => {
    let count = 0;
    for (const item of items) {
      count += item.productCount || 0;
      if (item.children) {
        count += getTotalProductCount(item.children);
      }
    }
    return count;
  };

  const totalCategories = (items: Category[]): number => {
    let count = items.length;
    for (const item of items) {
      if (item.children) {
        count += totalCategories(item.children);
      }
    }
    return count;
  };

  useEffect(() => {
    if (isAuthenticated && businessUnitId) {
      loadCategories();
    }
  }, [isAuthenticated, businessUnitId, loadCategories]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Please Login
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          You need to be logged in to manage categories
        </p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Access Denied
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          You don't have permission to manage categories
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-brand-500" />
            Categories
          </h2>
        </div>
        <LoadingSkeleton count={compact ? 3 : 5} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl flex items-start gap-3 ${className}`}
      >
        <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-danger-700 dark:text-danger-300">
            {error}
          </p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 focus-ring rounded"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const totalCount = totalCategories(categories);
  const totalProducts = getTotalProductCount(categories);

  return (
    <div className={`${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-brand-500" />
            Categories
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {totalCount} categories • {totalProducts} products
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'tree' ? 'list' : 'tree')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring"
          >
            {viewMode === 'tree' ? (
              <List className="w-4 h-4" />
            ) : (
              <Grid className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={() => {
              setEditingCategory(null);
              resetForm();
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg flex items-center gap-2 transition-all focus-ring"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none transition-shadow"
          />
        </div>
      </div>

      <div className="card-brand !p-0 overflow-hidden">
        {filteredCategories.length === 0 ? (
          <div className="p-8 text-center">
            <FolderOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery
                ? 'No categories match your search'
                : 'No categories found'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => {
                  setEditingCategory(null);
                  resetForm();
                  setShowAddModal(true);
                }}
                className="mt-2 text-sm text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 focus-ring rounded"
              >
                Add your first category →
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredCategories.map((category) => (
              <CategoryItem
                key={category.id}
                category={category}
                level={0}
                isExpanded={expanded.has(category.id)}
                onToggle={() => {
                  const newExpanded = new Set(expanded);
                  if (newExpanded.has(category.id)) {
                    newExpanded.delete(category.id);
                  } else {
                    newExpanded.add(category.id);
                  }
                  setExpanded(newExpanded);
                }}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onSelect={onCategorySelect}
                isSelected={selectedCategoryId === category.id}
                showProductCount={showProductCount}
                compact={compact}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-fade-in">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setShowAddModal(false);
                setEditingCategory(null);
                resetForm();
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative card-brand shadow-card-hover max-w-md w-full animate-slide-up"
            >
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCategory(null);
                  resetForm();
                }}
                className="absolute top-4 right-4 p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category Name <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      setTouched({ ...touched, name: true });
                      if (formErrors.name) {
                        setFormErrors({ ...formErrors, name: '' });
                      }
                    }}
                    onBlur={() => setTouched({ ...touched, name: true })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none transition-shadow ${
                      formErrors.name && touched.name
                        ? 'border-danger-500 dark:border-danger-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter category name"
                    disabled={isSubmitting}
                    autoFocus
                  />
                  {formErrors.name && touched.name && (
                    <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                      {formErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none transition-shadow"
                    placeholder="Category description"
                    disabled={isSubmitting}
                  />
                </div>

                {allowNesting && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Parent Category
                    </label>
                    <select
                      value={formData.parentId}
                      onChange={(e) =>
                        setFormData({ ...formData, parentId: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none transition-shadow"
                      disabled={isSubmitting}
                    >
                      <option value="">None (Top Level)</option>
                      {categories
                        .filter((c) => c.id !== editingCategory?.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 focus:outline-none"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Active Category
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCategory(null);
                    resetForm();
                  }}
                  className="btn-secondary focus-ring"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all flex items-center gap-2 disabled:opacity-50 focus-ring"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingCategory ? 'Update' : 'Create'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CategoryManagement;
