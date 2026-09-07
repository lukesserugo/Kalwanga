// D:\Projects\Kalwanga\packages\web\components\categories\CategoryList.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Category } from '../../types/category';
import { categoryService, PaginatedResponse } from '../../services/categoryService';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import Button from '../common/Button';
import { SearchBar } from '../common/SearchBar';
import { toast } from '../../utils/toast-manager';
import { 
  Edit, Trash2, Eye, Plus, Check, X, 
  Loader2, AlertCircle, FolderTree, Star,
  ChevronLeft, ChevronRight, RefreshCw,
  Grid, List, LayoutGrid, ArrowUpDown
} from 'lucide-react';
import { CategoryForm } from './CategoryForm';

interface CategoryListProps {
  businessUnitId: string;
  onCategoryUpdated?: () => void;
}

export function CategoryList({ businessUnitId, onCategoryUpdated }: CategoryListProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'compact'>('table');
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
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'productCount'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const loadCategories = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      if (!showLoading) setRefreshing(true);
      
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        businessUnitId,
        sortBy,
        sortOrder,
      };
      if (search) params.search = search;

      console.log('📤 Fetching categories with params:', params);

      const result = await categoryService.getAllCategories(params);
      
      console.log('📥 Categories result:', result);
      
      // Handle both array and paginated response
      let categoriesData: Category[] = [];
      let total = 0;
      let totalPages = 1;
      
      if (Array.isArray(result)) {
        categoriesData = result;
        total = result.length;
        totalPages = Math.ceil(result.length / pagination.limit);
      } else if (result && typeof result === 'object') {
        // Check if result has data property (PaginatedResponse)
        if ('data' in result && Array.isArray(result.data)) {
          categoriesData = result.data;
          total = (result as PaginatedResponse<Category>).total || 0;
          totalPages = (result as PaginatedResponse<Category>).totalPages || 1;
        } else {
          // Try to find any array in the response
          const possibleArray = Object.values(result).find(val => Array.isArray(val));
          if (possibleArray) {
            categoriesData = possibleArray;
            total = categoriesData.length;
            totalPages = 1;
          }
        }
      }
      
      setCategories(categoriesData);
      setPagination({
        ...pagination,
        total: total,
        totalPages: totalPages,
      });
      
      console.log(`✅ Loaded ${categoriesData.length} categories (total: ${total})`);
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Failed to load categories');
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId, pagination.page, pagination.limit, search, sortBy, sortOrder]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleRefresh = async () => {
    await loadCategories(false);
    toast.success('Categories refreshed');
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    setDeleting(true);
    try {
      await categoryService.deleteCategory(selectedCategory.id);
      toast.success(`Category "${selectedCategory.name}" deleted successfully`);
      setShowDeleteModal(false);
      setSelectedCategory(null);
      await loadCategories(false);
      if (onCategoryUpdated) onCategoryUpdated();
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      toast.error(error?.message || 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} categories?`)) return;
    try {
      await categoryService.bulkDeleteCategories(ids);
      toast.success(`${ids.length} categories deleted`);
      await loadCategories(false);
      if (onCategoryUpdated) onCategoryUpdated();
    } catch (error: any) {
      console.error('Failed to delete categories:', error);
      toast.error(error?.message || 'Failed to delete categories');
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center gap-1">
        <Check className="w-3 h-3" /> Active
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400 flex items-center gap-1">
        <X className="w-3 h-3" /> Inactive
      </span>
    );
  };

  const getCategoryCount = (category: Category): number => {
    return (category as any).productCount || 0;
  };

  const getCategoryImage = (category: Category): string => {
    return (category as any).image || '📁';
  };

  const columns = [
    {
      key: 'name',
      header: 'Category',
      sortable: true,
      render: (category: Category) => (
        <div className="flex items-center gap-3">
          <div className="text-2xl">{getCategoryImage(category)}</div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
              {category.name}
              {(category as any).featured && (
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              )}
            </p>
            {category.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                {category.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'parent',
      header: 'Parent',
      render: (category: Category) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {category.parentId ? 'Has Parent' : 'Top Level'}
        </span>
      ),
    },
    {
      key: 'products',
      header: 'Products',
      sortable: true,
      render: (category: Category) => (
        <span className="font-medium">{getCategoryCount(category)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (category: Category) => getStatusBadge(category.isActive),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (category: Category) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push(`/admin/categories/${category.id}`)}
            className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            title="View"
          >
            <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
          <button
            onClick={() => {
              setEditingCategory(category);
              setShowFormModal(true);
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={() => {
              setSelectedCategory(category);
              setShowDeleteModal(true);
            }}
            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-blue-500" />
            Categories
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {pagination.total} categories • Manage your product categories
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          {/* View Mode Toggle */}
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            {(['table', 'grid', 'compact'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {mode === 'table' && <List className="w-4 h-4" />}
                {mode === 'grid' && <Grid className="w-4 h-4" />}
                {mode === 'compact' && <LayoutGrid className="w-4 h-4" />}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Sort Toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
          
          {/* Add Category */}
          <Button
            onClick={() => {
              setEditingCategory(null);
              setShowFormModal(true);
            }}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search categories..."
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <Table
          columns={columns}
          data={categories}
          loading={loading}
          emptyMessage="No categories found"
        />
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing {categories.length} of {pagination.total} categories
          </span>
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination({ ...pagination, page })}
          />
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Category"
      >
        <div className="p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Category</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete <strong>{selectedCategory?.name}</strong>?
              {selectedCategory && getCategoryCount(selectedCategory) > 0 && (
                <span className="block mt-2 text-red-600">
                  ⚠️ This category has {getCategoryCount(selectedCategory)} products. They will need to be reassigned.
                </span>
              )}
              {selectedCategory && (selectedCategory as any).children?.length > 0 && (
                <span className="block mt-2 text-yellow-600">
                  ⚠️ This category has {(selectedCategory as any).children.length} subcategories that will be affected.
                </span>
              )}
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button 
              variant="danger" 
              onClick={handleDelete} 
              disabled={deleting}
              className="flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Form Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingCategory ? 'Edit Category' : 'New Category'}
        size="lg"
      >
        <div className="p-6">
          <CategoryForm
            categoryId={editingCategory?.id}
            businessUnitId={businessUnitId}
            onSuccess={() => {
              setShowFormModal(false);
              loadCategories(false);
              if (onCategoryUpdated) onCategoryUpdated();
            }}
            onCancel={() => setShowFormModal(false)}
          />
        </div>
      </Modal>
    </div>
  );
}
