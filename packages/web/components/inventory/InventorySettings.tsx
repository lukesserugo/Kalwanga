// D:\Projects\Kalwanga\packages\web\components\inventory\InventorySettings.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Save, Settings, MapPin, Tag, Bell, Shield, RefreshCw,
  Truck, Package, AlertTriangle, Clock, DollarSign,
  Plus, X, Edit, Trash2, Check
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { inventoryService } from '../../services/inventoryService';

interface SettingsData {
  defaultReorderPoint: number;
  defaultReorderQuantity: number;
  defaultLocation: string;
  lowStockAlertThreshold: number;
  enableAutoReorder: boolean;
  autoReorderDays: number;
  defaultSupplier: string;
  categories: Array<{ id: string; name: string; description?: string }>;
  locations: Array<{ id: string; name: string; address?: string }>;
  suppliers: Array<{ id: string; name: string; contactPerson?: string; phone?: string }>;
}

export function InventorySettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({
    defaultReorderPoint: 5,
    defaultReorderQuantity: 10,
    defaultLocation: 'Warehouse',
    lowStockAlertThreshold: 20,
    enableAutoReorder: false,
    autoReorderDays: 7,
    defaultSupplier: '',
    categories: [],
    locations: [{ id: '1', name: 'Warehouse' }, { id: '2', name: 'Store A' }, { id: '3', name: 'Store B' }],
    suppliers: [],
  });

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string; description?: string } | null>(null);
  const [editingLocation, setEditingLocation] = useState<{ id: string; name: string; address?: string } | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [locationForm, setLocationForm] = useState({ name: '', address: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Load settings from API
      // const data = await inventoryService.getSettings();
      // setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // await inventoryService.updateSettings(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Category CRUD
  const handleAddCategory = () => {
    if (!categoryForm.name) {
      toast.error('Category name is required');
      return;
    }
    const newCategory = {
      id: Date.now().toString(),
      name: categoryForm.name,
      description: categoryForm.description,
    };
    setSettings({
      ...settings,
      categories: [...settings.categories, newCategory],
    });
    setCategoryForm({ name: '', description: '' });
    setShowCategoryModal(false);
    toast.success('Category added successfully');
  };

  const handleEditCategory = (category: { id: string; name: string; description?: string }) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, description: category.description || '' });
    setShowCategoryModal(true);
  };

  const handleUpdateCategory = () => {
    if (!editingCategory) return;
    if (!categoryForm.name) {
      toast.error('Category name is required');
      return;
    }
    setSettings({
      ...settings,
      categories: settings.categories.map(c =>
        c.id === editingCategory.id
          ? { ...c, name: categoryForm.name, description: categoryForm.description }
          : c
      ),
    });
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '' });
    setShowCategoryModal(false);
    toast.success('Category updated successfully');
  };

  const handleDeleteCategory = (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    setSettings({
      ...settings,
      categories: settings.categories.filter(c => c.id !== id),
    });
    toast.success('Category deleted successfully');
  };

  // Location CRUD
  const handleAddLocation = () => {
    if (!locationForm.name) {
      toast.error('Location name is required');
      return;
    }
    const newLocation = {
      id: Date.now().toString(),
      name: locationForm.name,
      address: locationForm.address,
    };
    setSettings({
      ...settings,
      locations: [...settings.locations, newLocation],
    });
    setLocationForm({ name: '', address: '' });
    setShowLocationModal(false);
    toast.success('Location added successfully');
  };

  const handleEditLocation = (location: { id: string; name: string; address?: string }) => {
    setEditingLocation(location);
    setLocationForm({ name: location.name, address: location.address || '' });
    setShowLocationModal(true);
  };

  const handleUpdateLocation = () => {
    if (!editingLocation) return;
    if (!locationForm.name) {
      toast.error('Location name is required');
      return;
    }
    setSettings({
      ...settings,
      locations: settings.locations.map(l =>
        l.id === editingLocation.id
          ? { ...l, name: locationForm.name, address: locationForm.address }
          : l
      ),
    });
    setEditingLocation(null);
    setLocationForm({ name: '', address: '' });
    setShowLocationModal(false);
    toast.success('Location updated successfully');
  };

  const handleDeleteLocation = (id: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return;
    setSettings({
      ...settings,
      locations: settings.locations.filter(l => l.id !== id),
    });
    toast.success('Location deleted successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900">Inventory Settings</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">Configure default values, categories, locations and preferences</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Default Values */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-500" />
              Default Values
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Reorder Point
                </label>
                <input
                  type="number"
                  value={settings.defaultReorderPoint}
                  onChange={(e) => setSettings({ ...settings, defaultReorderPoint: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
                <p className="text-xs text-gray-400 mt-1">Minimum stock level before reorder</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Reorder Quantity
                </label>
                <input
                  type="number"
                  value={settings.defaultReorderQuantity}
                  onChange={(e) => setSettings({ ...settings, defaultReorderQuantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
                <p className="text-xs text-gray-400 mt-1">Default quantity to reorder</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Location
                </label>
                <select
                  value={settings.defaultLocation}
                  onChange={(e) => setSettings({ ...settings, defaultLocation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {settings.locations.map((loc) => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Supplier
                </label>
                <select
                  value={settings.defaultSupplier}
                  onChange={(e) => setSettings({ ...settings, defaultSupplier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  {settings.suppliers.map((sup) => (
                    <option key={sup.id} value={sup.name}>{sup.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Categories Management */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                Categories
              </h3>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryForm({ name: '', description: '' });
                  setShowCategoryModal(true);
                }}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Category
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {settings.categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-medium text-gray-900">{category.name}</p>
                    {category.description && (
                      <p className="text-sm text-gray-500">{category.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Edit className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
              {settings.categories.length === 0 && (
                <p className="text-sm text-gray-400 col-span-2 text-center py-4">No categories added yet</p>
              )}
            </div>
          </div>

          {/* Locations Management */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" />
                Locations
              </h3>
              <button
                onClick={() => {
                  setEditingLocation(null);
                  setLocationForm({ name: '', address: '' });
                  setShowLocationModal(true);
                }}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Location
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {settings.locations.map((location) => (
                <div key={location.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-medium text-gray-900">{location.name}</p>
                    {location.address && (
                      <p className="text-sm text-gray-500">{location.address}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditLocation(location)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Edit className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(location.id)}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts & Notifications */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-500" />
              Alerts & Notifications
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Low Stock Alert Threshold (%)
                </label>
                <input
                  type="number"
                  value={settings.lowStockAlertThreshold}
                  onChange={(e) => setSettings({ ...settings, lowStockAlertThreshold: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="100"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Alert when stock falls below this percentage of reorder point (e.g., 20% = alert at 80% of reorder point)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.enableAutoReorder}
                  onChange={(e) => setSettings({ ...settings, enableAutoReorder: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Enable Auto-Reorder</span>
              </div>
              {settings.enableAutoReorder && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auto-Reorder Days
                  </label>
                  <input
                    type="number"
                    value={settings.autoReorderDays}
                    onChange={(e) => setSettings({ ...settings, autoReorderDays: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                  <p className="text-xs text-gray-400 mt-1">Check stock levels every X days</p>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Category/Location Modal */}
      {(showCategoryModal || showLocationModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => {
            setShowCategoryModal(false);
            setShowLocationModal(false);
            setEditingCategory(null);
            setEditingLocation(null);
          }} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <button
              onClick={() => {
                setShowCategoryModal(false);
                setShowLocationModal(false);
                setEditingCategory(null);
                setEditingLocation(null);
              }}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">
              {showCategoryModal && (editingCategory ? 'Edit Category' : 'Add Category')}
              {showLocationModal && (editingLocation ? 'Edit Location' : 'Add Location')}
            </h3>
            
            {showCategoryModal && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter category name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Category description"
                  />
                </div>
              </div>
            )}

            {showLocationModal && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location Name *
                  </label>
                  <input
                    type="text"
                    value={locationForm.name}
                    onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter location name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={locationForm.address}
                    onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Location address"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setShowLocationModal(false);
                  setEditingCategory(null);
                  setEditingLocation(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showCategoryModal) {
                    if (editingCategory) {
                      handleUpdateCategory();
                    } else {
                      handleAddCategory();
                    }
                  }
                  if (showLocationModal) {
                    if (editingLocation) {
                      handleUpdateLocation();
                    } else {
                      handleAddLocation();
                    }
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingCategory || editingLocation ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
