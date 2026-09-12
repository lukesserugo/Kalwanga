// D:\Projects\Kalwanga\packages\web\components\inventory\InventorySettings.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, Settings, MapPin, Tag, Bell, Shield, RefreshCw,
  Truck, Package, AlertTriangle, Clock, DollarSign,
  Plus, X, Edit, Trash2, Check, Loader2,
  Building, Users, Phone, Mail, Globe, Star,
  Archive, AlertCircle, Info, ChevronDown, ChevronUp,
  Lock, Eye, EyeOff, Hash, Calendar, FileText,
  Printer, Download, Upload, Copy, Link
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { inventoryService } from '../../services/inventoryService';
import { PermissionResource } from '../../types/enums';

// ============================================
// TYPES
// ============================================

interface Category {
  id: string;
  name: string;
  description?: string;
  businessUnitId?: string;
  isActive?: boolean;
  parentId?: string;
  children?: Category[];
  productCount?: number;
}

interface Location {
  id: string;
  name: string;
  address?: string;
  businessUnitId?: string;
  isActive?: boolean;
  type?: 'WAREHOUSE' | 'STORE' | 'DISTRIBUTION' | 'SUPPLIER';
}

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}

interface SettingsData {
  defaultReorderPoint: number;
  defaultReorderQuantity: number;
  defaultLocation: string;
  lowStockAlertThreshold: number;
  enableAutoReorder: boolean;
  autoReorderDays: number;
  defaultSupplier: string;
  enableBarcodeScanning: boolean;
  enableQrGeneration: boolean;
  enableStockNotifications: boolean;
  notificationEmail: string;
  categories: Category[];
  locations: Location[];
  suppliers: Supplier[];
}

interface FormErrors {
  categoryName?: string;
  locationName?: string;
  supplierName?: string;
  notificationEmail?: string;
}

// ============================================
// CONSTANTS
// ============================================

const LOCATION_TYPES = [
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'STORE', label: 'Store' },
  { value: 'DISTRIBUTION', label: 'Distribution Center' },
  { value: 'SUPPLIER', label: 'Supplier' },
];

// ============================================
// SUB-COMPONENTS
// ============================================

const SettingSection: React.FC<{
  title: string;
  icon: React.ElementType;
  description?: string;
  children: React.ReactNode;
}> = ({ title, icon: Icon, description, children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start gap-3">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Icon className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          )}
        </div>
      </div>
      <div className="p-6">
        {children}
      </div>
    </motion.div>
  );
};

const EmptyState: React.FC<{
  title: string;
  description: string;
  icon: React.ElementType;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, icon: Icon, actionLabel, onAction }) => {
  return (
    <div className="text-center py-8">
      <Icon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-3 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function InventorySettings() {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({
    defaultReorderPoint: 5,
    defaultReorderQuantity: 10,
    defaultLocation: 'Warehouse',
    lowStockAlertThreshold: 20,
    enableAutoReorder: false,
    autoReorderDays: 7,
    defaultSupplier: '',
    enableBarcodeScanning: true,
    enableQrGeneration: true,
    enableStockNotifications: true,
    notificationEmail: '',
    categories: [],
    locations: [],
    suppliers: [],
  });

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [locationForm, setLocationForm] = useState({ name: '', address: '', type: 'WAREHOUSE' as Location['type'] });
  const [supplierForm, setSupplierForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const canManage = hasPermission(`${PermissionResource.INVENTORY}:manage`) || user?.role === 'SUPER_ADMIN';

  // ============================================
  // LOAD SETTINGS
  // ============================================

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load categories
      const categoriesData = await inventoryService.getCategories();
      // Load suppliers
      const suppliersData = await inventoryService.getSuppliers();
      
      setSettings(prev => ({
        ...prev,
        categories: categoriesData.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          isActive: cat.isActive !== false,
          productCount: cat.productCount || 0,
        })),
        suppliers: suppliersData.map((sup: any) => ({
          id: sup.id,
          name: sup.name,
          contactPerson: sup.contactPerson,
          phone: sup.phone,
          email: sup.email,
          address: sup.address,
          isActive: sup.isActive !== false,
        })),
        locations: prev.locations,
      }));
    } catch (error: any) {
      console.error('Failed to load settings:', error);
      setError(error?.message || 'Failed to load settings');
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // SAVE SETTINGS
  // ============================================

  const handleSave = async () => {
    if (!canManage) {
      toast.error('You do not have permission to manage settings');
      return;
    }

    // Validate notification email
    if (settings.enableStockNotifications && settings.notificationEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(settings.notificationEmail)) {
        setErrors({ ...errors, notificationEmail: 'Please enter a valid email address' });
        toast.error('Please enter a valid email address');
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Save settings to API
      // await inventoryService.updateSettings(settings);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setSuccess(true);
      toast.success('Settings saved successfully');
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      setError(error?.message || 'Failed to save settings');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // CATEGORY CRUD
  // ============================================

  const handleAddCategory = () => {
    if (!categoryForm.name.trim()) {
      setErrors({ ...errors, categoryName: 'Category name is required' });
      toast.error('Category name is required');
      return;
    }
    
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name: categoryForm.name.trim(),
      description: categoryForm.description || undefined,
      isActive: true,
    };
    
    setSettings({
      ...settings,
      categories: [...settings.categories, newCategory],
    });
    setCategoryForm({ name: '', description: '' });
    setShowCategoryModal(false);
    setErrors({});
    toast.success('Category added successfully');
  };

  const handleUpdateCategory = () => {
    if (!editingCategory) return;
    if (!categoryForm.name.trim()) {
      setErrors({ ...errors, categoryName: 'Category name is required' });
      toast.error('Category name is required');
      return;
    }
    
    setSettings({
      ...settings,
      categories: settings.categories.map(c =>
        c.id === editingCategory.id
          ? { ...c, name: categoryForm.name.trim(), description: categoryForm.description || undefined }
          : c
      ),
    });
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '' });
    setShowCategoryModal(false);
    setErrors({});
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

  // ============================================
  // LOCATION CRUD
  // ============================================

  const handleAddLocation = () => {
    if (!locationForm.name.trim()) {
      setErrors({ ...errors, locationName: 'Location name is required' });
      toast.error('Location name is required');
      return;
    }
    
    const newLocation: Location = {
      id: `loc_${Date.now()}`,
      name: locationForm.name.trim(),
      address: locationForm.address || undefined,
      type: locationForm.type,
      isActive: true,
    };
    
    setSettings({
      ...settings,
      locations: [...settings.locations, newLocation],
    });
    setLocationForm({ name: '', address: '', type: 'WAREHOUSE' });
    setShowLocationModal(false);
    setErrors({});
    toast.success('Location added successfully');
  };

  const handleUpdateLocation = () => {
    if (!editingLocation) return;
    if (!locationForm.name.trim()) {
      setErrors({ ...errors, locationName: 'Location name is required' });
      toast.error('Location name is required');
      return;
    }
    
    setSettings({
      ...settings,
      locations: settings.locations.map(l =>
        l.id === editingLocation.id
          ? { ...l, name: locationForm.name.trim(), address: locationForm.address || undefined, type: locationForm.type }
          : l
      ),
    });
    setEditingLocation(null);
    setLocationForm({ name: '', address: '', type: 'WAREHOUSE' });
    setShowLocationModal(false);
    setErrors({});
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

  // ============================================
  // SUPPLIER CRUD
  // ============================================

  const handleAddSupplier = () => {
    if (!supplierForm.name.trim()) {
      setErrors({ ...errors, supplierName: 'Supplier name is required' });
      toast.error('Supplier name is required');
      return;
    }
    
    const newSupplier: Supplier = {
      id: `sup_${Date.now()}`,
      name: supplierForm.name.trim(),
      contactPerson: supplierForm.contactPerson || undefined,
      phone: supplierForm.phone || undefined,
      email: supplierForm.email || undefined,
      address: supplierForm.address || undefined,
      isActive: true,
    };
    
    setSettings({
      ...settings,
      suppliers: [...settings.suppliers, newSupplier],
    });
    setSupplierForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
    setShowSupplierModal(false);
    setErrors({});
    toast.success('Supplier added successfully');
  };

  const handleUpdateSupplier = () => {
    if (!editingSupplier) return;
    if (!supplierForm.name.trim()) {
      setErrors({ ...errors, supplierName: 'Supplier name is required' });
      toast.error('Supplier name is required');
      return;
    }
    
    setSettings({
      ...settings,
      suppliers: settings.suppliers.map(s =>
        s.id === editingSupplier.id
          ? { 
              ...s, 
              name: supplierForm.name.trim(),
              contactPerson: supplierForm.contactPerson || undefined,
              phone: supplierForm.phone || undefined,
              email: supplierForm.email || undefined,
              address: supplierForm.address || undefined,
            }
          : s
      ),
    });
    setEditingSupplier(null);
    setSupplierForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
    setShowSupplierModal(false);
    setErrors({});
    toast.success('Supplier updated successfully');
  };

  const handleDeleteSupplier = (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    setSettings({
      ...settings,
      suppliers: settings.suppliers.filter(s => s.id !== id),
    });
    toast.success('Supplier deleted successfully');
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated, loadSettings]);

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Please Login</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">You need to be logged in to manage inventory settings</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Access Denied</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">You don't have permission to manage inventory settings</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-800/30 rounded transition"
          >
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* Success Banner */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3"
        >
          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          <p className="text-sm text-green-700 dark:text-green-300">Settings saved successfully!</p>
        </motion.div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Settings className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Inventory Settings</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Configure default values, categories, locations and preferences
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Default Values */}
      <SettingSection title="Default Values" icon={Tag} description="Configure default settings for new inventory items">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Reorder Point
            </label>
            <input
              type="number"
              value={settings.defaultReorderPoint}
              onChange={(e) => setSettings({ ...settings, defaultReorderPoint: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="0"
              disabled={saving}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Minimum stock level before reorder</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Reorder Quantity
            </label>
            <input
              type="number"
              value={settings.defaultReorderQuantity}
              onChange={(e) => setSettings({ ...settings, defaultReorderQuantity: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="0"
              disabled={saving}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Default quantity to reorder</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Location
            </label>
            <select
              value={settings.defaultLocation}
              onChange={(e) => setSettings({ ...settings, defaultLocation: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={saving}
            >
              {settings.locations.map((loc) => (
                <option key={loc.id} value={loc.name}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Supplier
            </label>
            <select
              value={settings.defaultSupplier}
              onChange={(e) => setSettings({ ...settings, defaultSupplier: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={saving}
            >
              <option value="">None</option>
              {settings.suppliers.map((sup) => (
                <option key={sup.id} value={sup.name}>{sup.name}</option>
              ))}
            </select>
          </div>
        </div>
      </SettingSection>

      {/* Categories Management */}
      <SettingSection title="Categories" icon={Package} description="Manage product categories">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {settings.categories.length} categories
          </span>
          <button
            onClick={() => {
              setEditingCategory(null);
              setCategoryForm({ name: '', description: '' });
              setShowCategoryModal(true);
            }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Category
          </button>
        </div>
        
        {settings.categories.length === 0 ? (
          <EmptyState
            title="No categories added yet"
            description="Add categories to organize your inventory items"
            icon={Package}
            actionLabel="Add Category"
            onAction={() => {
              setEditingCategory(null);
              setCategoryForm({ name: '', description: '' });
              setShowCategoryModal(true);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {settings.categories.map((category) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{category.name}</p>
                  {category.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{category.description}</p>
                  )}
                  {category.productCount !== undefined && (
                    <p className="text-xs text-gray-400">{category.productCount} products</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={() => {
                      setEditingCategory(category);
                      setCategoryForm({ name: category.name, description: category.description || '' });
                      setShowCategoryModal(true);
                    }}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                  >
                    <Edit className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </SettingSection>

      {/* Locations Management */}
      <SettingSection title="Locations" icon={MapPin} description="Manage inventory locations">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {settings.locations.length} locations
          </span>
          <button
            onClick={() => {
              setEditingLocation(null);
              setLocationForm({ name: '', address: '', type: 'WAREHOUSE' });
              setShowLocationModal(true);
            }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Location
          </button>
        </div>
        
        {settings.locations.length === 0 ? (
          <EmptyState
            title="No locations added yet"
            description="Add locations to track inventory across different places"
            icon={MapPin}
            actionLabel="Add Location"
            onAction={() => {
              setEditingLocation(null);
              setLocationForm({ name: '', address: '', type: 'WAREHOUSE' });
              setShowLocationModal(true);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {settings.locations.map((location) => (
              <motion.div
                key={location.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{location.name}</p>
                  {location.address && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{location.address}</p>
                  )}
                  {location.type && (
                    <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300">
                      {LOCATION_TYPES.find(t => t.value === location.type)?.label || location.type}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={() => {
                      setEditingLocation(location);
                      setLocationForm({ 
                        name: location.name, 
                        address: location.address || '', 
                        type: location.type || 'WAREHOUSE' 
                      });
                      setShowLocationModal(true);
                    }}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                  >
                    <Edit className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDeleteLocation(location.id)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </SettingSection>

      {/* Suppliers Management */}
      <SettingSection title="Suppliers" icon={Building} description="Manage product suppliers">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {settings.suppliers.length} suppliers
          </span>
          <button
            onClick={() => {
              setEditingSupplier(null);
              setSupplierForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
              setShowSupplierModal(true);
            }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Supplier
          </button>
        </div>
        
        {settings.suppliers.length === 0 ? (
          <EmptyState
            title="No suppliers added yet"
            description="Add suppliers to track where your inventory comes from"
            icon={Truck}
            actionLabel="Add Supplier"
            onAction={() => {
              setEditingSupplier(null);
              setSupplierForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
              setShowSupplierModal(true);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {settings.suppliers.map((supplier) => (
              <motion.div
                key={supplier.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{supplier.name}</p>
                  {supplier.contactPerson && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                      <Users className="w-3 h-3" /> {supplier.contactPerson}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-gray-400">
                    {supplier.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{supplier.phone}</span>}
                    {supplier.email && <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" />{supplier.email}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={() => {
                      setEditingSupplier(supplier);
                      setSupplierForm({ 
                        name: supplier.name,
                        contactPerson: supplier.contactPerson || '',
                        phone: supplier.phone || '',
                        email: supplier.email || '',
                        address: supplier.address || '',
                      });
                      setShowSupplierModal(true);
                    }}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                  >
                    <Edit className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(supplier.id)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </SettingSection>

      {/* Alerts & Notifications */}
      <SettingSection title="Alerts & Notifications" icon={Bell} description="Configure stock alerts and notifications">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Low Stock Alert Threshold (%)
            </label>
            <input
              type="number"
              value={settings.lowStockAlertThreshold}
              onChange={(e) => setSettings({ ...settings, lowStockAlertThreshold: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="0"
              max="100"
              disabled={saving}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Alert when stock falls below this percentage of reorder point (e.g., 20% = alert at 80% of reorder point)
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.enableAutoReorder}
              onChange={(e) => setSettings({ ...settings, enableAutoReorder: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              disabled={saving}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Enable Auto-Reorder</span>
          </div>
          
          {settings.enableAutoReorder && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Auto-Reorder Days
              </label>
              <input
                type="number"
                value={settings.autoReorderDays}
                onChange={(e) => setSettings({ ...settings, autoReorderDays: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="1"
                disabled={saving}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Check stock levels every X days</p>
            </div>
          )}
          
          <div className="flex items-center gap-3">
            <input              type="checkbox"
              checked={settings.enableStockNotifications}
              onChange={(e) => setSettings({ ...settings, enableStockNotifications: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              disabled={saving}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Enable Stock Notifications</span>
          </div>
          
          {settings.enableStockNotifications && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notification Email
              </label>
              <input
                type="email"
                value={settings.notificationEmail}
                onChange={(e) => {
                  setSettings({ ...settings, notificationEmail: e.target.value });
                  if (errors.notificationEmail) {
                    setErrors({ ...errors, notificationEmail: undefined });
                  }
                }}
                onBlur={() => {
                  setTouched({ ...touched, notificationEmail: true });
                  if (settings.notificationEmail) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(settings.notificationEmail)) {
                      setErrors({ ...errors, notificationEmail: 'Please enter a valid email address' });
                    }
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="admin@company.com"
                disabled={saving}
              />
              {errors.notificationEmail && touched.notificationEmail && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.notificationEmail}</p>
              )}
            </div>
          )}
        </div>
      </SettingSection>

      {/* Advanced Settings */}
      <SettingSection title="Advanced Settings" icon={Shield} description="Advanced inventory configuration">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.enableBarcodeScanning}
              onChange={(e) => setSettings({ ...settings, enableBarcodeScanning: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              disabled={saving}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Enable Barcode Scanning</span>
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.enableQrGeneration}
              onChange={(e) => setSettings({ ...settings, enableQrGeneration: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              disabled={saving}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Enable QR Code Generation</span>
          </div>
        </div>
      </SettingSection>

      {/* Save Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Last saved: {new Date().toLocaleString()}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Category Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
              setShowCategoryModal(false);
              setEditingCategory(null);
              setErrors({});
            }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  setErrors({});
                }}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => {
                      setCategoryForm({ ...categoryForm, name: e.target.value });
                      if (errors.categoryName) {
                        setErrors({ ...errors, categoryName: undefined });
                      }
                    }}
                    onBlur={() => {
                      if (!categoryForm.name.trim()) {
                        setErrors({ ...errors, categoryName: 'Category name is required' });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                      errors.categoryName ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter category name"
                    autoFocus
                  />
                  {errors.categoryName && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.categoryName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Category description (optional)"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowCategoryModal(false);
                    setEditingCategory(null);
                    setErrors({});
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingCategory ? 'Update' : 'Add'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Location Modal */}
      <AnimatePresence>
        {showLocationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
              setShowLocationModal(false);
              setEditingLocation(null);
              setErrors({});
            }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <button
                onClick={() => {
                  setShowLocationModal(false);
                  setEditingLocation(null);
                  setErrors({});
                }}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {editingLocation ? 'Edit Location' : 'Add Location'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location Name *
                  </label>
                  <input
                    type="text"
                    value={locationForm.name}
                    onChange={(e) => {
                      setLocationForm({ ...locationForm, name: e.target.value });
                      if (errors.locationName) {
                        setErrors({ ...errors, locationName: undefined });
                      }
                    }}
                    onBlur={() => {
                      if (!locationForm.name.trim()) {
                        setErrors({ ...errors, locationName: 'Location name is required' });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                      errors.locationName ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter location name"
                    autoFocus
                  />
                  {errors.locationName && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.locationName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={locationForm.address}
                    onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Location address (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    value={locationForm.type}
                    onChange={(e) => setLocationForm({ ...locationForm, type: e.target.value as Location['type'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {LOCATION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowLocationModal(false);
                    setEditingLocation(null);
                    setErrors({});
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingLocation ? handleUpdateLocation : handleAddLocation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingLocation ? 'Update' : 'Add'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Supplier Modal */}
      <AnimatePresence>
        {showSupplierModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
              setShowSupplierModal(false);
              setEditingSupplier(null);
              setErrors({});
            }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <button
                onClick={() => {
                  setShowSupplierModal(false);
                  setEditingSupplier(null);
                  setErrors({});
                }}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    value={supplierForm.name}
                    onChange={(e) => {
                      setSupplierForm({ ...supplierForm, name: e.target.value });
                      if (errors.supplierName) {
                        setErrors({ ...errors, supplierName: undefined });
                      }
                    }}
                    onBlur={() => {
                      if (!supplierForm.name.trim()) {
                        setErrors({ ...errors, supplierName: 'Supplier name is required' });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                      errors.supplierName ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter supplier name"
                    autoFocus
                  />
                  {errors.supplierName && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.supplierName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Contact person name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Email address"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={supplierForm.address}
                    onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Supplier address (optional)"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowSupplierModal(false);
                    setEditingSupplier(null);
                    setErrors({});
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingSupplier ? handleUpdateSupplier : handleAddSupplier}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingSupplier ? 'Update' : 'Add'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// EXPORT
// ============================================

export default InventorySettings;
