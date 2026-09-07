// D:\Projects\Kalwanga\packages\web\components\categories\AdminCategoryManager.tsx

'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit, Trash2, Search, RefreshCw,
  ChevronDown, ChevronRight, FolderTree,
  Grid, List, ArrowUpDown, EyeOff,
  Star, StarOff, Eye, XCircle, CheckCircle,
  Loader2, AlertCircle, X
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { formatDate } from '../../utils/helpers';
import { categoryService } from '../../services/categoryService';
import { Category } from '../../types/category';
import { CategoryForm } from './CategoryForm';
import { CategoryGrid } from './CategoryGrid';

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

export default function AdminCategoryManager({
  categories,
  setCategories,
  permissions,
  businessUnitId,
  onCategoryUpdate
}: AdminCategoryManagerProps) {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'tree'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Filter categories based on search
  const filteredCategories = categories.filter(cat => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return cat.name.toLowerCase().includes(search) ||
      cat.description?.toLowerCase().includes(search);
  });

  // Sort categories
  const sortedCategories = [...filteredCategories].sort((a, b) => {
    return sortOrder === 'asc' 
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name);
  });

  // CRUD Handlers
  const handleCreateCategory = async (data: any) => {
    try {
      const response = await categoryService.createCategory({
        ...data,
        businessUnitId
      });
      if (response) {
        toast.success('Category created successfully');
        setShowCreateModal(false);
        onCategoryUpdate();
      }
    } catch (error: any) {
      console.error('Failed to create category:', error);
      toast.error(error?.message || 'Failed to create category');
    }
  };

  const handleUpdateCategory = async (id: string, data: any) => {
    try {
      const response = await categoryService.updateCategory(id, data);
      if (response) {
        toast.success('Category updated successfully');
        setShowEditModal(false);
        setSelectedCategory(null);
        onCategoryUpdate();
      }
    } catch (error: any) {
      console.error('Failed to update category:', error);
      toast.error(error?.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setDeleting(true);
    try {
      await categoryService.deleteCategory(id);
      toast.success('Category deleted successfully');
      setShowDeleteModal(false);
      setSelectedCategory(null);
      onCategoryUpdate();
    } catch (error: any) {
      console.error('Failed to delete category:', error);
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
      await categoryService.bulkDeleteCategories(ids);
      toast.success(`${ids.length} categories deleted successfully`);
      setSelectedCategories(new Set());
      onCategoryUpdate();
    } catch (error: any) {
      console.error('Failed to delete categories:', error);
      toast.error(error?.message || 'Failed to delete categories');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      await categoryService.toggleCategoryStatus(id, isActive);
      toast.success(`Category ${isActive ? 'activated' : 'deactivated'} successfully`);
      onCategoryUpdate();
    } catch (error: any) {
      console.error('Failed to toggle category status:', error);
      toast.error(error?.message || 'Failed to update category status');
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
    if (selectedCategories.size === sortedCategories.length && sortedCategories.length > 0) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(sortedCategories.map(c => c.id)));
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowDetailsModal(false);
    setSelectedCategory(null);
  };

  const renderCategoryTree = (categories: Category[], level = 0) => {
    return categories.map(category => (
      <div key={category.id} className={`ml-${Math.min(level * 4, 8)}`}>
        <div className={`flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 group ${
          selectedCategory?.id === category.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
        }`}>
          {category.children && category.children.length > 0 && (
            <button
              onClick={() => toggleCategoryExpand(category.id)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-transform"
              aria-label="Toggle expand"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${expandedCategories.has(category.id) ? 'rotate-90' : ''}`} />
            </button>
          )}
          <input
            type="checkbox"
            checked={selectedCategories.has(category.id)}
            onChange={() => toggleCategorySelection(category.id)}
            className="rounded border-gray-300 dark:border-gray-600"
            aria-label={`Select ${category.name}`}
          />
          <div
            className="flex-1 flex items-center gap-2 cursor-pointer"
            onClick={() => setSelectedCategory(category)}
          >
            <FolderTree className={`w-5 h-5 ${category.isActive ? 'text-blue-500' : 'text-gray-400'}`} />
            <div>
              <span className={`font-medium ${category.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                {category.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
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
            {!category.isActive && <EyeOff className="w-4 h-4 text-gray-400" />}
            {category.featured && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
            {permissions.canEdit && (
              <button
                onClick={() => {
                  setSelectedCategory(category);
                  setShowEditModal(true);
                }}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4 text-blue-600" />
              </button>
            )}
            {permissions.canDelete && (
              <button
                onClick={() => {
                  setSelectedCategory(category);
                  setShowDeleteModal(true);
                }}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        </div>
        {category.children && category.children.length > 0 && expandedCategories.has(category.id) && (
          <div className="ml-4">
            {renderCategoryTree(category.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="space-y-4">
      {/* Admin Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
          {['grid', 'list', 'tree'].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {mode === 'grid' && <Grid className="w-4 h-4" />}
              {mode === 'list' && <List className="w-4 h-4" />}
              {mode === 'tree' && <FolderTree className="w-4 h-4" />}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Toggle sort order"
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>

        {permissions.canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        )}

        {selectedCategories.size > 0 && permissions.canDelete && (
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {bulkDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Delete Selected ({selectedCategories.size})
          </button>
        )}
      </div>

      {/* Categories Display */}
      <div className="min-h-[400px]">
        {sortedCategories.length === 0 ? (
          <div className="text-center py-12">
            <FolderTree className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Categories Found</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {categories.length === 0 ? 'Create your first category to get started.' : 'No categories match your search.'}
            </p>
            {permissions.canCreate && categories.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-1" />
                Create First Category
              </button>
            )}
          </div>
        ) : viewMode === 'tree' ? (
          <div className="space-y-1">
            {renderCategoryTree(sortedCategories.filter(c => !c.parentId))}
          </div>
        ) : viewMode === 'grid' ? (
          <CategoryGrid
            categories={sortedCategories}
            onEdit={(cat) => {
              setSelectedCategory(cat);
              setShowEditModal(true);
            }}
            onDelete={(cat) => {
              setSelectedCategory(cat);
              setShowDeleteModal(true);
            }}
            onView={(cat) => {
              setSelectedCategory(cat);
              setShowDetailsModal(true);
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="p-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCategories.size === sortedCategories.length && sortedCategories.length > 0}
                      onChange={toggleAllSelection}
                      className="rounded border-gray-300 dark:border-gray-600"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">Name</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">Description</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">Products</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">Featured</th>
                  <th className="p-3 text-right text-sm font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((category) => (
                  <tr key={category.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedCategories.has(category.id)}
                        onChange={() => toggleCategorySelection(category.id)}
                        className="rounded border-gray-300 dark:border-gray-600"
                        aria-label={`Select ${category.name}`}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <FolderTree className={`w-4 h-4 ${category.isActive ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className={`font-medium ${category.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                          {category.name}
                        </span>
                        {category.featured && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {category.description || '-'}
                    </td>
                    <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                      {category.productCount || 0}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => permissions.canChangeStatus && handleToggleStatus(category.id, !category.isActive)}
                        disabled={!permissions.canChangeStatus}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                          category.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        } ${permissions.canChangeStatus ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        {category.isActive ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {category.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => permissions.canFeature && handleToggleStatus(category.id, category.isActive)}
                        disabled={!permissions.canFeature}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title={category.featured ? 'Unfeature' : 'Feature'}
                      >
                        {category.featured ? (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <StarOff className="w-4 h-4 text-gray-300" />
                        )}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedCategory(category);
                            setShowDetailsModal(true);
                          }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {permissions.canEdit && (
                          <button
                            onClick={() => {
                              setSelectedCategory(category);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-blue-600" />
                          </button>
                        )}
                        {permissions.canDelete && (
                          <button
                            onClick={() => {
                              setSelectedCategory(category);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Category Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseModal} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Category</h2>
                  <button onClick={handleCloseModal} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
                <CategoryForm
                  businessUnitId={businessUnitId}
                  onSuccess={() => {
                    setShowCreateModal(false);
                    onCategoryUpdate();
                  }}
                  onCancel={handleCloseModal}
                />
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Category Modal */}
      <AnimatePresence>
        {showEditModal && selectedCategory && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseModal} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Category</h2>
                  <button onClick={handleCloseModal} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
                <CategoryForm
                  categoryId={selectedCategory.id}
                  businessUnitId={businessUnitId}
                  onSuccess={() => {
                    setShowEditModal(false);
                    setSelectedCategory(null);
                    onCategoryUpdate();
                  }}
                  onCancel={handleCloseModal}
                />
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedCategory && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseModal} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Category Details</h2>
                  <button onClick={handleCloseModal} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-3xl">
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
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedCategory.productCount || 0}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                      <p className={`text-lg font-semibold ${selectedCategory.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                        {selectedCategory.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatDate(selectedCategory.createdAt)}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Updated</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatDate(selectedCategory.updatedAt)}
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
                          <span key={child.id} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            {child.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                    <button
                      onClick={handleCloseModal}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Close
                    </button>
                    {permissions.canEdit && (
                      <button
                        onClick={() => {
                          setShowDetailsModal(false);
                          setShowEditModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Edit Category
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && selectedCategory && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseModal} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
              >
                <button
                  onClick={handleCloseModal}
                  className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Category</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Are you sure you want to delete <strong>{selectedCategory.name}</strong>?
                    {selectedCategory.productCount && selectedCategory.productCount > 0 && (
                      <span className="block mt-2 text-red-600">
                        ⚠️ This category has {selectedCategory.productCount} products. They will need to be reassigned.
                      </span>
                    )}
                    {selectedCategory.children && selectedCategory.children.length > 0 && (
                      <span className="block mt-2 text-red-600">
                        ⚠️ This category has {selectedCategory.children.length} subcategories. They will need to be reassigned.
                      </span>
                    )}
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleCloseModal}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(selectedCategory.id)}
                      disabled={deleting}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
