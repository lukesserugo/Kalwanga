// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\catalog\categories\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit, Trash2, Folder, X, Check,
  ChevronRight, ChevronDown, Search, RefreshCw,
  Grid, List, ArrowUpDown, EyeOff, Star, StarOff,
  Upload, Download, Filter, MoreVertical, Copy,
  AlertTriangle, Eye, Loader2, Lock, ArrowLeft
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { categoryService } from '../../../../../services/categoryService';
import { toast } from '../../../../../utils/toast-manager';
import { PermissionResource } from '../../../../../types/enums';
import { useAuth } from '../../../../../hooks/useAuth';

interface Category {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  productCount?: number;
  parentId?: string | null;
  children?: Category[];
  featured?: boolean;
  businessUnitId: string;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = 'grid' | 'list' | 'tree';

export default function CategoriesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete, canManage, isLoading: permissionLoading } = usePermission();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', parentId: '', isActive: true, featured: false });
  const [submitting, setSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canViewCategories = canView(PermissionResource.CATEGORY) || canManage(PermissionResource.CATEGORY);
  const canCreateCategories = canCreate(PermissionResource.CATEGORY) || canManage(PermissionResource.CATEGORY);
  const canEditCategories = canEdit(PermissionResource.CATEGORY) || canManage(PermissionResource.CATEGORY);
  const canDeleteCategories = canDelete(PermissionResource.CATEGORY) || canManage(PermissionResource.CATEGORY);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && canViewCategories) {
      loadCategories();
    } else if (isClient && !canViewCategories) {
      setLoading(false);
    }
  }, [isClient, canViewCategories]);

  const loadCategories = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const data = await categoryService.getAllCategories({ limit: 100 });
      setCategories(data || []);
      setFilteredCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setError('Failed to load categories. Please try again.');
      toast.error('Failed to load categories');
      setCategories([]);
      setFilteredCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCategories(false);
    toast.success('Categories refreshed');
  };

  useEffect(() => {
    let filtered = [...categories];
    
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      filtered = filtered.filter(cat => 
        cat.name.toLowerCase().includes(search) ||
        cat.description?.toLowerCase().includes(search)
      );
    }
    
    filtered.sort((a, b) => {
      return sortOrder === 'asc' 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    });
    
    setFilteredCategories(filtered);
  }, [categories, searchQuery, sortOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSubmitting(true);
    try {
      const description = formData.description?.trim() || undefined;
      const parentId = formData.parentId || undefined;
      
      const data = {
        name: formData.name.trim(),
        description: description,
        parentId: parentId,
        isActive: formData.isActive,
        featured: formData.featured,
        businessUnitId: 'default',
        userId: user?.id || 'default-user-id',
      };

      if (editingCategory) {
        await categoryService.updateCategory(editingCategory.id, {
          name: data.name,
          description: data.description,
          parentId: data.parentId,
          isActive: data.isActive,
          featured: data.featured,
        });
        toast.success('Category updated successfully');
      } else {
        await categoryService.createCategory(data);
        toast.success('Category created successfully');
      }
      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '', parentId: '', isActive: true, featured: false });
      await loadCategories(false);
    } catch (error: any) {
      console.error('Failed to save category:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to save category';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await categoryService.deleteCategory(id);
      toast.success('Category deleted successfully');
      setShowDeleteModal(false);
      setSelectedCategory(null);
      await loadCategories(false);
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete category';
      toast.error(errorMessage);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCategories.size === 0) return;
    try {
      const ids = Array.from(selectedCategories);
      await categoryService.bulkDeleteCategories(ids);
      toast.success(`${ids.length} categories deleted successfully`);
      setSelectedCategories(new Set());
      setShowBulkDeleteModal(false);
      await loadCategories(false);
    } catch (error: any) {
      console.error('Failed to delete categories:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete categories';
      toast.error(errorMessage);
    }
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    if (!canEditCategories) {
      toast.error('You don\'t have permission to change category status');
      return;
    }
    try {
      await categoryService.toggleCategoryStatus(id, isActive);
      toast.success(`Category ${isActive ? 'activated' : 'deactivated'} successfully`);
      await loadCategories(false);
    } catch (error: any) {
      console.error('Failed to toggle category status:', error);
      toast.error('Failed to update category status');
    }
  };

  const toggleCategoryExpand = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const toggleAllSelection = () => {
    if (selectedCategories.size === filteredCategories.length) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(filteredCategories.map(c => c.id)));
    }
  };

  const buildCategoryTree = useCallback((items: Category[], parentId: string | null = null): Category[] => {
    return items
      .filter(item => item.parentId === parentId)
      .map(item => ({
        ...item,
        children: buildCategoryTree(items, item.id),
      }));
  }, []);

  const categoryTree = useMemo(() => buildCategoryTree(filteredCategories), [filteredCategories, buildCategoryTree]);

  if (permissionLoading || !isClient) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 dark:border-brand-400"></div>
      </div>
    );
  }

  if (!canViewCategories) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view categories. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-brand focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </button>
      </div>
    );
  }

  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 dark:border-brand-400"></div>
      </div>
    );
  }

  const renderTree = (items: Category[], level = 0) => {
    return items.map(category => (
      <div key={category.id} style={{ marginLeft: `${Math.min(level * 24, 48)}px` }}>
        <div className={`flex items-center gap-2 p-2 rounded-lg hover:bg-brand-50/50 dark:hover:bg-brand-950/10 group ${
          selectedCategory?.id === category.id ? 'bg-brand-50 dark:bg-brand-950/20' : ''
        }`}>
          {category.children && category.children.length > 0 && (
            <button
              onClick={() => toggleCategoryExpand(category.id)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-transform focus-ring"
              aria-label={expandedCategories.has(category.id) ? 'Collapse' : 'Expand'}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${expandedCategories.has(category.id) ? 'rotate-90' : ''}`} />
            </button>
          )}
          {canDeleteCategories && (
            <input
              type="checkbox"
              checked={selectedCategories.has(category.id)}
              onChange={() => toggleCategorySelection(category.id)}
              className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 transition-colors"
              aria-label={`Select ${category.name}`}
            />
          )}
          <div
            className="flex-1 flex items-center gap-2 cursor-pointer"
            onClick={() => setSelectedCategory(category)}
          >
            <Folder className={`w-5 h-5 ${category.isActive ? 'text-brand-500' : 'text-gray-400'}`} />
            <div>
              <span className={`font-medium ${category.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                {category.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 tabular-nums">
                ({category.productCount || 0} products)
              </span>
              {category.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                  {category.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {category.featured && <Star className="w-4 h-4 text-brand-500 fill-brand-500" />}
            {!category.isActive && <EyeOff className="w-4 h-4 text-gray-400" />}
            {canEditCategories && (
              <button
                onClick={() => {
                  setEditingCategory(category);
                  setFormData({
                    name: category.name,
                    description: category.description || '',
                    parentId: category.parentId || '',
                    isActive: category.isActive,
                    featured: category.featured || false,
                  });
                  setShowModal(true);
                }}
                className="p-1 hover:bg-brand-100 dark:hover:bg-brand-950/30 rounded transition-colors focus-ring"
                title="Edit"
              >
                <Edit className="w-4 h-4 text-brand-500" />
              </button>
            )}
            {canDeleteCategories && (
              <button
                onClick={() => {
                  setSelectedCategory(category);
                  setShowDeleteModal(true);
                }}
                className="p-1 hover:bg-brand-accent-100 dark:hover:bg-brand-accent-950/30 rounded transition-colors focus-ring"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-brand-accent-500" />
              </button>
            )}
          </div>
        </div>
        {category.children && category.children.length > 0 && expandedCategories.has(category.id) && (
          <div>
            {renderTree(category.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const renderGridView = () => {
    if (filteredCategories.length === 0) {
      return (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <Folder className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No categories found</p>
          {canCreateCategories && (
            <button
              onClick={() => {
                setEditingCategory(null);
                setFormData({ name: '', description: '', parentId: '', isActive: true, featured: false });
                setShowModal(true);
              }}
              className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors inline-flex items-center gap-2 shadow-brand focus-ring"
            >
              <Plus className="w-4 h-4" />
              Add your first category
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCategories.map((category) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-brand-100 dark:bg-brand-950/30 rounded-lg flex-shrink-0">
                  <Folder className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">{category.name}</h3>
                  {category.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{category.description}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 tabular-nums">
                    {category.productCount || 0} products
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                {category.featured && (
                  <Star className="w-4 h-4 text-brand-500 fill-brand-500" />
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  category.isActive
                    ? 'bg-success-100 dark:bg-success-950/30 text-success-700 dark:text-success-300'
                    : 'bg-brand-accent-100 dark:bg-brand-accent-950/30 text-brand-accent-700 dark:text-brand-accent-300'
                }`}>
                  {category.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            {canEditCategories && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingCategory(category);
                    setFormData({
                      name: category.name,
                      description: category.description || '',
                      parentId: category.parentId || '',
                      isActive: category.isActive,
                      featured: category.featured || false,
                    });
                    setShowModal(true);
                  }}
                  className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-950/30 rounded transition-colors focus-ring"
                  title="Edit category"
                >
                  <Edit className="w-4 h-4 text-brand-500" />
                </button>
                {canDeleteCategories && (
                  <button
                    onClick={() => {
                      setSelectedCategory(category);
                      setShowDeleteModal(true);
                    }}
                    className="p-1.5 hover:bg-brand-accent-100 dark:hover:bg-brand-accent-950/30 rounded transition-colors focus-ring"
                    title="Delete category"
                  >
                    <Trash2 className="w-4 h-4 text-brand-accent-500" />
                  </button>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    );
  };

  const renderListView = () => {
    if (filteredCategories.length === 0) {
      return (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <Folder className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No categories found</p>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {canDeleteCategories && (
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCategories.size === filteredCategories.length && filteredCategories.length > 0}
                      onChange={toggleAllSelection}
                      className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 transition-colors"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Products</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Featured</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCategories.map((category) => (
                <tr key={category.id} className="hover:bg-brand-50/50 dark:hover:bg-brand-950/10 transition-colors">
                  {canDeleteCategories && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCategories.has(category.id)}
                        onChange={() => toggleCategorySelection(category.id)}
                        className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 transition-colors"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Folder className={`w-4 h-4 ${category.isActive ? 'text-brand-500' : 'text-gray-400'}`} />
                      <span className={`font-medium ${category.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                        {category.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {category.description || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                    {category.productCount || 0}
                  </td>
                  <td className="px-4 py-3">
                    {canEditCategories ? (
                      <button
                        onClick={() => handleToggleStatus(category.id, !category.isActive)}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors focus-ring ${
                          category.isActive
                            ? 'bg-success-100 text-success-700 dark:bg-success-950/30 dark:text-success-400 hover:bg-success-200 dark:hover:bg-success-950/50'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {category.isActive ? 'Active' : 'Inactive'}
                      </button>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        category.isActive
                          ? 'bg-success-100 text-success-700 dark:bg-success-950/30 dark:text-success-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400'
                      }`}>
                        {category.isActive ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {category.featured ? (
                      <Star className="w-4 h-4 text-brand-500 fill-brand-500" />
                    ) : (
                      <StarOff className="w-4 h-4 text-gray-300" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setSelectedCategory(category);
                          setShowDetailsModal(true);
                        }}
                        className="p-1.5 hover:bg-brand-50 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      {canEditCategories && (
                        <button
                          onClick={() => {
                            setEditingCategory(category);
                            setFormData({
                              name: category.name,
                              description: category.description || '',
                              parentId: category.parentId || '',
                              isActive: category.isActive,
                              featured: category.featured || false,
                            });
                            setShowModal(true);
                          }}
                          className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-950/30 rounded transition-colors focus-ring"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-brand-500" />
                        </button>
                      )}
                      {canDeleteCategories && (
                        <button
                          onClick={() => {
                            setSelectedCategory(category);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 hover:bg-brand-accent-100 dark:hover:bg-brand-accent-950/30 rounded transition-colors focus-ring"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-brand-accent-500" />
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
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Folder className="w-6 h-6 text-brand-500" />
              Categories
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
              {categories.length} categories • Manage your product categories
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-50 focus-ring"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {canCreateCategories && (
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setFormData({ name: '', description: '', parentId: '', isActive: true, featured: false });
                  setShowModal(true);
                }}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2 transition-colors shadow-brand focus-ring"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-brand-accent-50 dark:bg-brand-accent-950/20 border border-brand-accent-200 dark:border-brand-accent-800 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-brand-accent-500 flex-shrink-0" />
            <span className="text-brand-accent-700 dark:text-brand-accent-300">{error}</span>
            <button
              onClick={() => loadCategories(false)}
              className="ml-auto px-3 py-1 bg-brand-accent-100 dark:bg-brand-accent-800/30 text-brand-accent-700 dark:text-brand-accent-300 rounded-lg hover:bg-brand-accent-200 dark:hover:bg-brand-accent-800/50 transition-colors text-sm focus-ring"
            >
              Retry
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus-ring"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            {(['grid', 'list', 'tree'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 focus-ring ${
                  viewMode === mode
                    ? 'bg-brand-600 text-white shadow-brand'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700'
                }`}
              >
                {mode === 'grid' && <Grid className="w-4 h-4" />}
                {mode === 'list' && <List className="w-4 h-4" />}
                {mode === 'tree' && <Folder className="w-4 h-4" />}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors focus-ring"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>

          {selectedCategories.size > 0 && canDeleteCategories && (
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              className="px-4 py-2 bg-brand-accent-600 text-white rounded-lg hover:bg-brand-accent-700 transition-colors flex items-center gap-2 shadow-brand focus-ring"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected ({selectedCategories.size})
            </button>
          )}
        </div>

        {viewMode === 'tree' ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8">
                <Folder className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No categories found</p>
              </div>
            ) : (
              <div className="space-y-1">
                {renderTree(categoryTree)}
              </div>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          renderGridView()
        ) : (
          renderListView()
        )}

        {filteredCategories.length > 0 && filteredCategories.length < categories.length && (
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            Showing {filteredCategories.length} of {categories.length} categories
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-brand-50 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category Name <span className="text-brand-accent-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:focus:ring-brand-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="Enter category name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:focus:ring-brand-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="Enter category description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Parent Category
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:focus:ring-brand-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                  >
                    <option value="">None (Top Level)</option>
                    {categories
                      .filter(cat => cat.id !== editingCategory?.id)
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-brand-600 border-gray-300 dark:border-gray-600 rounded focus:ring-brand-500 dark:focus:ring-brand-400 bg-white dark:bg-gray-700 transition-colors duration-200"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                      className="w-4 h-4 text-brand-500 border-gray-300 dark:border-gray-600 rounded focus:ring-brand-500 bg-white dark:bg-gray-700 transition-colors duration-200"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Featured</span>
                  </label>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors text-gray-700 dark:text-gray-300 w-full sm:w-auto focus-ring"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto shadow-brand focus-ring"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      editingCategory ? 'Update' : 'Create'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && selectedCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-brand-accent-100 dark:bg-brand-accent-950/30 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-brand-accent-600 dark:text-brand-accent-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Category</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{selectedCategory.name}</strong>?
                {selectedCategory.productCount && selectedCategory.productCount > 0 && (
                  <span className="block mt-2 text-brand-accent-600">
                    ⚠️ This category has {selectedCategory.productCount} products. They will need to be reassigned.
                  </span>
                )}
                {selectedCategory.children && selectedCategory.children.length > 0 && (
                  <span className="block mt-2 text-brand-accent-600">
                    ⚠️ This category has {selectedCategory.children.length} subcategories. They will need to be reassigned.
                  </span>
                )}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors focus-ring"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(selectedCategory.id)}
                  className="px-4 py-2 bg-brand-accent-600 hover:bg-brand-accent-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-brand focus-ring"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Category
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {showBulkDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowBulkDeleteModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-brand-accent-100 dark:bg-brand-accent-950/30 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-brand-accent-600 dark:text-brand-accent-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Selected Categories</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{selectedCategories.size}</strong> selected categories?
                This will permanently remove them and all associated data.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors focus-ring"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-brand-accent-600 hover:bg-brand-accent-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-brand focus-ring"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete {selectedCategories.size} Categories
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowDetailsModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button
                onClick={() => setShowDetailsModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Category Details</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-brand-500 to-brand-accent-500 flex items-center justify-center text-3xl">
                    📂
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedCategory.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ID: {selectedCategory.id.slice(0, 8)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Products</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums">
                      {selectedCategory.productCount || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                    <p className={`text-lg font-semibold ${selectedCategory.isActive ? 'text-success-600' : 'text-gray-500'}`}>
                      {selectedCategory.isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Featured</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedCategory.featured ? '⭐ Featured' : 'Not Featured'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Parent</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedCategory.parentId ? 'Has Parent' : 'Top Level'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(selectedCategory.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Updated</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(selectedCategory.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {selectedCategory.description && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Description</p>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedCategory.description}</p>
                  </div>
                )}
                {selectedCategory.children && selectedCategory.children.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Subcategories</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedCategory.children.map(child => (
                        <span key={child.id} className="text-xs bg-brand-100 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full">
                          {child.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors focus-ring"
                  >
                    Close
                  </button>
                  {canEditCategories && (
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        setEditingCategory(selectedCategory);
                        setFormData({
                          name: selectedCategory.name,
                          description: selectedCategory.description || '',
                          parentId: selectedCategory.parentId || '',
                          isActive: selectedCategory.isActive,
                          featured: selectedCategory.featured || false,
                        });
                        setShowModal(true);
                      }}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-brand focus-ring"
                    >
                      Edit Category
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
