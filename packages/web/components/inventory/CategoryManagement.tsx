// D:\Projects\Kalwanga\packages\web\components\inventory\CategoryManagement.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Tag, Plus, Edit, Trash2, X, Save, RefreshCw,
  FolderTree, FolderOpen, Package, Search,
  ChevronRight, ChevronDown, MoreVertical
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';

interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  businessUnitId: string;
  createdAt: string;
  updatedAt: string;
  children?: Category[];
  productCount?: number;
}

export function CategoryManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentId: '',
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  useEffect(() => {
    loadCategories();
  }, [businessUnitId]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      // Load categories from API
      // const data = await inventoryService.getCategories(businessUnitId);
      // setCategories(data);
      setCategories([
        { id: '1', name: 'Electronics', description: 'Electronic devices', businessUnitId, createdAt: '', updatedAt: '' },
        { id: '2', name: 'Clothing', description: 'Apparel and accessories', businessUnitId, createdAt: '', updatedAt: '' },
        { id: '3', name: 'Food', description: 'Perishable items', businessUnitId, createdAt: '', updatedAt: '' },
      ]);
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Category name is required');
      return;
    }
    try {
      if (editingCategory) {
        // await inventoryService.updateCategory(editingCategory.id, formData);
        toast.success('Category updated successfully');
      } else {
        // await inventoryService.createCategory({ ...formData, businessUnitId });
        toast.success('Category created successfully');
      }
      setShowAddModal(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '', parentId: '' });
      loadCategories();
    } catch (error) {
      toast.error('Failed to save category');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      // await inventoryService.deleteCategory(id);
      toast.success('Category deleted successfully');
      loadCategories();
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FolderTree className="w-6 h-6 text-blue-500" />
                Categories
              </h2>
              <p className="text-sm text-gray-500 mt-1">Manage product categories and hierarchy</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadCategories}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setFormData({ name: '', description: '', parentId: '' });
                  setShowAddModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Categories List */}
        <div className="divide-y">
          {filteredCategories.length === 0 ? (
            <div className="p-8 text-center">
              <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No categories found</p>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setFormData({ name: '', description: '', parentId: '' });
                  setShowAddModal(true);
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Add your first category →
              </button>
            </div>
          ) : (
            filteredCategories.map((category) => (
              <div key={category.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleExpand(category.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      {expanded.has(category.id) ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Tag className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{category.name}</p>
                      {category.description && (
                        <p className="text-sm text-gray-500">{category.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {category.productCount !== undefined && (
                      <span className="text-sm text-gray-500">
                        {category.productCount} products
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setEditingCategory(category);
                        setFormData({
                          name: category.name,
                          description: category.description || '',
                          parentId: category.parentId || '',
                        });
                        setShowAddModal(true);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Edit className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => {
            setShowAddModal(false);
            setEditingCategory(null);
          }} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingCategory(null);
              }}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter category name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Category description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Category
                </label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None (Top Level)</option>
                  {categories.filter(c => c.id !== editingCategory?.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCategory(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingCategory ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
